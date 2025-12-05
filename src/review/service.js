const Review = require("./model");
const ReviewReport = require("./reviewReport");
const Booking = require("../booking/model");
const Lodging = require("../lodging/model");
const BusinessUser = require("../auth/model");
const Room = require("../room/model");

// 리뷰 신고
const reportReview = async (reviewId, reason, userId) => {
  // 리뷰 확인
  const review = await Review.findById(reviewId).populate('lodgingId', 'userId');
  if (!review) {
    throw new Error("REVIEW_NOT_FOUND");
  }

  // 사업자 정보 조회
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 호텔의 소유자인지 확인
  if (review.lodgingId.userId.toString() !== user._id.toString()) {
    throw new Error("UNAUTHORIZED");
  }

  // 이미 신고했는지 확인
  const existingReport = await ReviewReport.findOne({
    reviewId: reviewId,
    businessUserId: user._id
  });

  if (existingReport) {
    throw new Error("REPORT_ALREADY_EXISTS");
  }

  // 신고 생성
  const report = new ReviewReport({
    reviewId: reviewId,
    businessUserId: user._id,
    reason: reason.trim()
  });

  await report.save();

  return {
    _id: report._id,
    reviewId: report.reviewId,
    reason: report.reason,
    status: report.status,
    reportedAt: report.reportedAt
  };
};

// 리뷰 차단
const blockReview = async (reviewId, userId) => {
  // 리뷰 확인 (lodgingId를 populate하여 userId 확인)
  const review = await Review.findById(reviewId).populate('lodgingId', 'userId');
  if (!review) {
    throw new Error("REVIEW_NOT_FOUND");
  }

  // lodgingId 저장 (populate 전 원본 ObjectId)
  const lodgingId = review.lodgingId._id || review.lodgingId;

  // 사업자 정보 조회
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 호텔의 소유자인지 확인
  if (review.lodgingId.userId.toString() !== user._id.toString()) {
    throw new Error("UNAUTHORIZED");
  }

  // 이미 차단된 리뷰인지 확인
  if (review.status === 'blocked') {
    throw new Error("ALREADY_BLOCKED");
  }

  // 리뷰 차단
  const wasActive = review.status === 'active';
  review.status = 'blocked';
  review.blockedAt = new Date();
  await review.save();

  // Lodging의 reviewCount 감소 (active -> blocked인 경우)
  if (wasActive) {
    await Lodging.findByIdAndUpdate(lodgingId, {
      $inc: { reviewCount: -1 }
    });
  }

  return {
    _id: review._id,
    status: review.status,
    blockedAt: review.blockedAt
  };
};

// 차단된 리뷰 목록 조회
const getBlockedReviews = async (userId) => {
  // 사업자 정보 조회
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 호텔 목록 조회
  const lodgings = await Lodging.find({ businessId: user._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 차단된 리뷰 조회
  const blockedReviews = await Review.find({
    lodgingId: { $in: lodgingIds },
    status: 'blocked'
  })
    .populate('userId', 'name')
    .populate('lodgingId', 'name')
    .sort({ blockedAt: -1 })
    .lean();

  return {
    count: blockedReviews.length,
    reviews: blockedReviews
  };
};

// 숙소별 리뷰 목록 조회
const getReviewsByLodging = async (lodgingId, filters) => {
  const { page = 1, limit = 20, rating } = filters;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // 필터 조건
  const query = {
    lodgingId: lodgingId,
    status: 'active' // 차단되지 않은 활성 리뷰만
  };

  // 평점 필터 (선택)
  if (rating && [1, 2, 3, 4, 5].includes(parseInt(rating))) {
    query.rating = parseInt(rating);
  }

  // 리뷰 조회
  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate('userId', 'name')
      .populate('lodgingId', 'name')
      .populate({
        path: 'bookingId',
        select: 'checkinDate checkoutDate bookingStatus',
        populate: {
          path: 'roomId',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 }) // 최신순 정렬
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Review.countDocuments(query)
  ]);

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  const formattedReviews = reviews.map(review => {
    // status 매핑: active → approved, blocked → reported, 기타 → pending
    let reviewStatus = 'pending';
    if (review.status === 'active') reviewStatus = 'approved';
    else if (review.status === 'blocked') reviewStatus = 'reported';
    
    return {
      id: review._id.toString(),
      guestName: review.userId?.name || 'Unknown',
      roomType: review.bookingId?.roomId?.name || 'Unknown',
      rating: review.rating,
      comment: review.content,
      date: review.createdAt ? new Date(review.createdAt).toISOString().split('T')[0] : '',
      status: reviewStatus
    };
  });

  return {
    reviews: formattedReviews,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page)
  };
};

// 사업자의 모든 숙소 리뷰 목록 조회
const getReviews = async (userId, filters) => {
  const { page = 1, limit = 20, status, rating, search } = filters;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // 사업자 정보 조회
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ businessId: user._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 필터 조건
  const query = {
    lodgingId: { $in: lodgingIds }
  };

  // 상태 필터
  if (status && ['active', 'blocked'].includes(status)) {
    query.status = status;
  }

  // 평점 필터
  if (rating && [1, 2, 3, 4, 5].includes(parseInt(rating))) {
    query.rating = parseInt(rating);
  }

  // 리뷰 조회
  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate('userId', 'name')
      .populate('lodgingId', 'name')
      .populate({
        path: 'bookingId',
        select: 'checkinDate checkoutDate bookingStatus',
        populate: {
          path: 'roomId',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Review.countDocuments(query)
  ]);

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  let formattedReviews = reviews.map(review => {
    // status 매핑: active → approved, blocked → reported, 기타 → pending
    let reviewStatus = 'pending';
    if (review.status === 'active') reviewStatus = 'approved';
    else if (review.status === 'blocked') reviewStatus = 'reported';
    
    return {
      id: review._id.toString(),
      guestName: review.userId?.name || 'Unknown',
      roomType: review.bookingId?.roomId?.name || 'Unknown',
      rating: review.rating,
      comment: review.content,
      date: review.createdAt ? new Date(review.createdAt).toISOString().split('T')[0] : '',
      status: reviewStatus
    };
  });

  // search 필터 적용 (guestName, comment에서 검색)
  if (search) {
    const searchLower = search.toLowerCase();
    formattedReviews = formattedReviews.filter(review => {
      return (
        review.guestName?.toLowerCase().includes(searchLower) ||
        review.comment?.toLowerCase().includes(searchLower)
      );
    });
  }

  return {
    reviews: formattedReviews,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page)
  };
};

// 리뷰 상세 조회
const getReviewById = async (reviewId, userId) => {
  // 사업자 정보 조회
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ businessId: user._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 리뷰 조회 및 소유권 확인
  const review = await Review.findOne({
    _id: reviewId,
    lodgingId: { $in: lodgingIds }
  })
    .populate('userId', 'name')
    .populate('lodgingId', 'name')
    .populate({
      path: 'bookingId',
      select: 'checkinDate checkoutDate bookingStatus',
      populate: {
        path: 'roomId',
        select: 'name'
      }
    })
    .lean();

  if (!review) {
    throw new Error("REVIEW_NOT_FOUND");
  }

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  let reviewStatus = 'pending';
  if (review.status === 'active') reviewStatus = 'approved';
  else if (review.status === 'blocked') reviewStatus = 'reported';

  return {
    id: review._id.toString(),
    guestName: review.userId?.name || 'Unknown',
    roomType: review.bookingId?.roomId?.name || 'Unknown',
    rating: review.rating,
    comment: review.content,
    date: review.createdAt ? new Date(review.createdAt).toISOString().split('T')[0] : '',
    status: reviewStatus,
    reply: review.reply || null,
    images: review.images || []
  };
};

// 리뷰 답변
const replyToReview = async (reviewId, reply, userId) => {
  // 사업자 정보 조회
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ businessId: user._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 리뷰 조회 및 소유권 확인
  const review = await Review.findOne({
    _id: reviewId,
    lodgingId: { $in: lodgingIds }
  });

  if (!review) {
    throw new Error("REVIEW_NOT_FOUND");
  }

  // 답변 작성
  review.reply = reply.trim();
  review.replyDate = new Date();
  await review.save();

  // 답변 포함하여 반환
  const populatedReview = await Review.findById(review._id)
    .populate('userId', 'name')
    .populate('lodgingId', 'name')
    .lean();

  return populatedReview;
};

// 리뷰 통계
const getReviewStats = async (userId) => {
  // 사업자 정보 조회
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ businessId: user._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 전체 통계
  const [totalReviews, activeReviews, blockedReviews, avgRating] = await Promise.all([
    Review.countDocuments({ lodgingId: { $in: lodgingIds } }),
    Review.countDocuments({ lodgingId: { $in: lodgingIds }, status: 'active' }),
    Review.countDocuments({ lodgingId: { $in: lodgingIds }, status: 'blocked' }),
    Review.aggregate([
      {
        $match: {
          lodgingId: { $in: lodgingIds },
          status: 'active'
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          ratingCounts: {
            $push: '$rating'
          }
        }
      }
    ])
  ]);

  // 평점별 개수 계산
  const ratingDistribution = await Review.aggregate([
    {
      $match: {
        lodgingId: { $in: lodgingIds },
        status: 'active'
      }
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    }
  ]);

  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratingDistribution.forEach(item => {
    if (ratingCounts[item._id] !== undefined) {
      ratingCounts[item._id] = item.count;
    }
  });

  // 답변 통계
  const repliedReviews = await Review.countDocuments({
    lodgingId: { $in: lodgingIds },
    reply: { $ne: null }
  });

  // 최근 30일 리뷰 수
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentReviews = await Review.countDocuments({
    lodgingId: { $in: lodgingIds },
    createdAt: { $gte: thirtyDaysAgo }
  });

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  return {
    totalReviews,
    averageRating: avgRating.length > 0 ? Math.round(avgRating[0].avgRating * 10) / 10 : 0,
    ratingDistribution: {
      "5": ratingCounts[5] || 0,
      "4": ratingCounts[4] || 0,
      "3": ratingCounts[3] || 0,
      "2": ratingCounts[2] || 0,
      "1": ratingCounts[1] || 0
    }
  };
};

// 신고 내역 조회 (사업자 본인이 신고한 내역만)
const getReports = async (filters, userId) => {
  const { status, page = 1, limit = 20 } = filters;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // 사업자 정보 조회
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 필터 조건 (사업자 본인이 신고한 내역만)
  const filter = {
    businessUserId: user._id
  };
  if (status && ['pending', 'reviewed', 'rejected'].includes(status)) {
    filter.status = status;
  }

  // 신고 내역 조회
  const reports = await ReviewReport.find(filter)
    .populate({
      path: 'reviewId',
      select: 'rating content status createdAt',
      populate: [
        {
          path: 'lodgingId',
          select: 'name'
        },
        {
          path: 'userId',
          select: 'name'
        }
      ]
    })
    .populate('businessUserId', 'businessName')
    .populate('reviewedBy', 'name')
    .sort({ reportedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  // 전체 개수
  const total = await ReviewReport.countDocuments(filter);

  return {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    reports: reports
  };
};

module.exports = {
  reportReview,
  blockReview,
  getBlockedReviews,
  getReviewsByLodging,
  getReports,
  getReviews,
  getReviewById,
  replyToReview,
  getReviewStats
};

