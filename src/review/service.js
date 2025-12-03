const Review = require("./model");
const ReviewReport = require("./reviewReport");
const Booking = require("../booking/model");
const Lodging = require("../lodging/model");
const Business = require("../auth/business");
const Room = require("../room/model");

// 리뷰 작성
const createReview = async (reviewData, userId) => {
  const { lodgingId, bookingId, rating, content, images } = reviewData;

  // 예약 존재 여부 확인
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  // 사용자 일치 확인
  if (booking.userId.toString() !== userId) {
    throw new Error("UNAUTHORIZED");
  }

  // 예약 상태 확인
  if (!['confirmed', 'completed'].includes(booking.bookingStatus)) {
    throw new Error("INVALID_BOOKING_STATUS");
  }

  // 해당 예약의 roomId로 lodgingId 확인
  const room = await Room.findById(booking.roomId);
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  if (room.lodgingId.toString() !== lodgingId) {
    throw new Error("LODGING_MISMATCH");
  }

  // 이미 리뷰를 작성했는지 확인
  const existingReview = await Review.findOne({ bookingId: bookingId });
  if (existingReview) {
    throw new Error("REVIEW_ALREADY_EXISTS");
  }

  // 리뷰 생성
  const review = new Review({
    lodgingId,
    userId: userId,
    bookingId,
    rating,
    content,
    images: images || []
  });

  await review.save();

  // Lodging의 reviewCount 증가 (status가 'active'인 경우)
  if (review.status === 'active') {
    await Lodging.findByIdAndUpdate(lodgingId, {
      $inc: { reviewCount: 1 }
    });
  }

  // 리뷰 정보와 함께 사용자 정보 포함하여 반환
  const populatedReview = await Review.findById(review._id)
    .populate('userId', 'name profileImage')
    .populate('lodgingId', 'lodgingName')
    .lean();

  return populatedReview;
};

// 리뷰 신고
const reportReview = async (reviewId, reason, userId) => {
  // 리뷰 확인
  const review = await Review.findById(reviewId).populate('lodgingId', 'businessId');
  if (!review) {
    throw new Error("REVIEW_NOT_FOUND");
  }

  // 사업자 정보 조회
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 호텔의 소유자인지 확인
  if (review.lodgingId.businessId.toString() !== business._id.toString()) {
    throw new Error("UNAUTHORIZED");
  }

  // 이미 신고했는지 확인
  const existingReport = await ReviewReport.findOne({
    reviewId: reviewId,
    businessId: business._id
  });

  if (existingReport) {
    throw new Error("REPORT_ALREADY_EXISTS");
  }

  // 신고 생성
  const report = new ReviewReport({
    reviewId: reviewId,
    businessId: business._id,
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
  // 리뷰 확인 (lodgingId를 populate하여 businessId 확인)
  const review = await Review.findById(reviewId).populate('lodgingId', 'businessId');
  if (!review) {
    throw new Error("REVIEW_NOT_FOUND");
  }

  // lodgingId 저장 (populate 전 원본 ObjectId)
  const lodgingId = review.lodgingId._id || review.lodgingId;

  // 사업자 정보 조회
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 호텔의 소유자인지 확인
  if (review.lodgingId.businessId.toString() !== business._id.toString()) {
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
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 호텔 목록 조회
  const lodgings = await Lodging.find({ businessId: business._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 차단된 리뷰 조회
  const blockedReviews = await Review.find({
    lodgingId: { $in: lodgingIds },
    status: 'blocked'
  })
    .populate('userId', 'name profileImage')
    .populate('lodgingId', 'lodgingName')
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
      .populate('userId', 'name profileImage')
      .populate('lodgingId', 'lodgingName')
      .populate({
        path: 'bookingId',
        select: 'checkinDate checkoutDate bookingStatus',
        populate: {
          path: 'roomId',
          select: 'roomName'
        }
      })
      .sort({ createdAt: -1 }) // 최신순 정렬
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Review.countDocuments(query)
  ]);

  return {
    reviews,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  };
};

// 사업자의 모든 숙소 리뷰 목록 조회
const getReviews = async (userId, filters) => {
  const { page = 1, limit = 20, status, rating } = filters;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // 사업자 정보 조회
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ businessId: business._id }).select('_id');
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
      .populate('userId', 'name profileImage')
      .populate('lodgingId', 'lodgingName')
      .populate({
        path: 'bookingId',
        select: 'checkinDate checkoutDate bookingStatus',
        populate: {
          path: 'roomId',
          select: 'roomName'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Review.countDocuments(query)
  ]);

  return {
    reviews,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  };
};

// 리뷰 상세 조회
const getReviewById = async (reviewId, userId) => {
  // 사업자 정보 조회
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ businessId: business._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 리뷰 조회 및 소유권 확인
  const review = await Review.findOne({
    _id: reviewId,
    lodgingId: { $in: lodgingIds }
  })
    .populate('userId', 'name profileImage')
    .populate('lodgingId', 'lodgingName')
    .populate({
      path: 'bookingId',
      select: 'checkinDate checkoutDate bookingStatus',
      populate: {
        path: 'roomId',
        select: 'roomName'
      }
    })
    .lean();

  if (!review) {
    throw new Error("REVIEW_NOT_FOUND");
  }

  return review;
};

// 리뷰 답변
const replyToReview = async (reviewId, reply, userId) => {
  // 사업자 정보 조회
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ businessId: business._id }).select('_id');
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
    .populate('userId', 'name profileImage')
    .populate('lodgingId', 'lodgingName')
    .lean();

  return populatedReview;
};

// 리뷰 통계
const getReviewStats = async (userId) => {
  // 사업자 정보 조회
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ businessId: business._id }).select('_id');
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
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (avgRating.length > 0 && avgRating[0].ratingCounts) {
    avgRating[0].ratingCounts.forEach(rating => {
      if (ratingCounts[rating] !== undefined) {
        ratingCounts[rating]++;
      }
    });
  }

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

  return {
    overview: {
      totalReviews,
      activeReviews,
      blockedReviews,
      repliedReviews,
      recentReviews,
      avgRating: avgRating.length > 0 ? Math.round(avgRating[0].avgRating * 10) / 10 : 0
    },
    ratingDistribution: ratingCounts
  };
};

// 신고 내역 조회 (ADMIN만)
const getReports = async (filters) => {
  const { status, page = 1, limit = 20 } = filters;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // 필터 조건
  const filter = {};
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
          select: 'lodgingName'
        },
        {
          path: 'userId',
          select: 'name'
        }
      ]
    })
    .populate('businessId', 'businessName')
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
  createReview,
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

