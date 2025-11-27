const Review = require("./model");
const ReviewReport = require("./reviewReport");
const Booking = require("../booking/model");
const Lodging = require("../lodging/model");
const Business = require("../auth/business");
const Room = require("../room/model");

// 리뷰 작성
const createReview = async (reviewData, userId) => {
  const { lodging_id, booking_id, rating, content, images } = reviewData;

  // 예약 존재 여부 확인
  const booking = await Booking.findById(booking_id);
  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  // 사용자 일치 확인
  if (booking.user_id.toString() !== userId) {
    throw new Error("UNAUTHORIZED");
  }

  // 예약 상태 확인
  if (!['confirmed', 'completed'].includes(booking.booking_status)) {
    throw new Error("INVALID_BOOKING_STATUS");
  }

  // 해당 예약의 room_id로 lodging_id 확인
  const room = await Room.findById(booking.room_id);
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  if (room.lodging_id.toString() !== lodging_id) {
    throw new Error("LODGING_MISMATCH");
  }

  // 이미 리뷰를 작성했는지 확인
  const existingReview = await Review.findOne({ booking_id: booking_id });
  if (existingReview) {
    throw new Error("REVIEW_ALREADY_EXISTS");
  }

  // 리뷰 생성
  const review = new Review({
    lodging_id,
    user_id: userId,
    booking_id,
    rating,
    content,
    images: images || []
  });

  await review.save();

  // 리뷰 정보와 함께 사용자 정보 포함하여 반환
  const populatedReview = await Review.findById(review._id)
    .populate('user_id', 'displayName profile_image')
    .populate('lodging_id', 'lodging_name')
    .lean();

  return populatedReview;
};

// 리뷰 신고
const reportReview = async (reviewId, reason, userId) => {
  // 리뷰 확인
  const review = await Review.findById(reviewId).populate('lodging_id', 'business_id');
  if (!review) {
    throw new Error("REVIEW_NOT_FOUND");
  }

  // 사업자 정보 조회
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 호텔의 소유자인지 확인
  if (review.lodging_id.business_id.toString() !== business._id.toString()) {
    throw new Error("UNAUTHORIZED");
  }

  // 이미 신고했는지 확인
  const existingReport = await ReviewReport.findOne({
    review_id: reviewId,
    business_id: business._id
  });

  if (existingReport) {
    throw new Error("REPORT_ALREADY_EXISTS");
  }

  // 신고 생성
  const report = new ReviewReport({
    review_id: reviewId,
    business_id: business._id,
    reason: reason.trim()
  });

  await report.save();

  return {
    _id: report._id,
    review_id: report.review_id,
    reason: report.reason,
    status: report.status,
    reported_at: report.reported_at
  };
};

// 리뷰 차단
const blockReview = async (reviewId, userId) => {
  // 리뷰 확인
  const review = await Review.findById(reviewId).populate('lodging_id', 'business_id');
  if (!review) {
    throw new Error("REVIEW_NOT_FOUND");
  }

  // 사업자 정보 조회
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 호텔의 소유자인지 확인
  if (review.lodging_id.business_id.toString() !== business._id.toString()) {
    throw new Error("UNAUTHORIZED");
  }

  // 이미 차단된 리뷰인지 확인
  if (review.status === 'blocked') {
    throw new Error("ALREADY_BLOCKED");
  }

  // 리뷰 차단
  review.status = 'blocked';
  review.blocked_at = new Date();
  await review.save();

  return {
    _id: review._id,
    status: review.status,
    blocked_at: review.blocked_at
  };
};

// 차단된 리뷰 목록 조회
const getBlockedReviews = async (userId) => {
  // 사업자 정보 조회
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 호텔 목록 조회
  const lodgings = await Lodging.find({ business_id: business._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 차단된 리뷰 조회
  const blockedReviews = await Review.find({
    lodging_id: { $in: lodgingIds },
    status: 'blocked'
  })
    .populate('user_id', 'displayName profile_image')
    .populate('lodging_id', 'lodging_name')
    .sort({ blocked_at: -1 })
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
    lodging_id: lodgingId,
    status: 'active' // 차단되지 않은 활성 리뷰만
  };

  // 평점 필터 (선택)
  if (rating && [1, 2, 3, 4, 5].includes(parseInt(rating))) {
    query.rating = parseInt(rating);
  }

  // 리뷰 조회
  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate('user_id', 'displayName profile_image')
      .populate('lodging_id', 'lodging_name')
      .populate({
        path: 'booking_id',
        select: 'checkin_date checkout_date booking_status',
        populate: {
          path: 'room_id',
          select: 'room_name'
        }
      })
      .sort({ created_at: -1 }) // 최신순 정렬
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
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ business_id: business._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 필터 조건
  const query = {
    lodging_id: { $in: lodgingIds }
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
      .populate('user_id', 'displayName profile_image')
      .populate('lodging_id', 'lodging_name')
      .populate({
        path: 'booking_id',
        select: 'checkin_date checkout_date booking_status',
        populate: {
          path: 'room_id',
          select: 'room_name'
        }
      })
      .sort({ created_at: -1 })
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
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ business_id: business._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 리뷰 조회 및 소유권 확인
  const review = await Review.findOne({
    _id: reviewId,
    lodging_id: { $in: lodgingIds }
  })
    .populate('user_id', 'displayName profile_image')
    .populate('lodging_id', 'lodging_name')
    .populate({
      path: 'booking_id',
      select: 'checkin_date checkout_date booking_status',
      populate: {
        path: 'room_id',
        select: 'room_name'
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
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ business_id: business._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 리뷰 조회 및 소유권 확인
  const review = await Review.findOne({
    _id: reviewId,
    lodging_id: { $in: lodgingIds }
  });

  if (!review) {
    throw new Error("REVIEW_NOT_FOUND");
  }

  // 답변 작성
  review.reply = reply.trim();
  review.reply_date = new Date();
  await review.save();

  // 답변 포함하여 반환
  const populatedReview = await Review.findById(review._id)
    .populate('user_id', 'displayName profile_image')
    .populate('lodging_id', 'lodging_name')
    .lean();

  return populatedReview;
};

// 리뷰 통계
const getReviewStats = async (userId) => {
  // 사업자 정보 조회
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 해당 사업자의 숙소 목록 조회
  const lodgings = await Lodging.find({ business_id: business._id }).select('_id');
  const lodgingIds = lodgings.map(l => l._id);

  // 전체 통계
  const [totalReviews, activeReviews, blockedReviews, avgRating] = await Promise.all([
    Review.countDocuments({ lodging_id: { $in: lodgingIds } }),
    Review.countDocuments({ lodging_id: { $in: lodgingIds }, status: 'active' }),
    Review.countDocuments({ lodging_id: { $in: lodgingIds }, status: 'blocked' }),
    Review.aggregate([
      {
        $match: {
          lodging_id: { $in: lodgingIds },
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
    lodging_id: { $in: lodgingIds },
    reply: { $ne: null }
  });

  // 최근 30일 리뷰 수
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentReviews = await Review.countDocuments({
    lodging_id: { $in: lodgingIds },
    created_at: { $gte: thirtyDaysAgo }
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
      path: 'review_id',
      select: 'rating content status created_at',
      populate: [
        {
          path: 'lodging_id',
          select: 'lodging_name'
        },
        {
          path: 'user_id',
          select: 'displayName'
        }
      ]
    })
    .populate('business_id', 'business_name')
    .populate('reviewed_by', 'displayName')
    .sort({ reported_at: -1 })
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

