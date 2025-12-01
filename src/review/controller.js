const reviewService = require("./service");
const { successResponse, errorResponse } = require("../common/response");
const mongoose = require("mongoose");

// 리뷰 작성
const createReview = async (req, res) => {
  try {
    const { lodging_id, booking_id, rating, content, images } = req.body;

    // 필수 필드 검증
    if (!lodging_id || !booking_id || !rating || !content) {
      return res.status(400).json(errorResponse("필수 필드가 누락되었습니다.", 400));
    }

    // 평점 범위 검증
    if (rating < 1 || rating > 5) {
      return res.status(400).json(errorResponse("평점은 1부터 5까지입니다.", 400));
    }

    const result = await reviewService.createReview({
      lodging_id,
      booking_id,
      rating,
      content,
      images
    }, req.user.id);

    return res.status(201).json(successResponse({ review: result }, "리뷰가 작성되었습니다.", 201));
  } catch (error) {
    if (error.message === "BOOKING_NOT_FOUND") {
      return res.status(404).json(errorResponse("예약을 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("리뷰를 작성할 권한이 없습니다.", 403));
    }
    if (error.message === "INVALID_BOOKING_STATUS") {
      return res.status(403).json(errorResponse("예약 상태가 올바르지 않습니다.", 403));
    }
    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json(errorResponse("객실 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "LODGING_MISMATCH") {
      return res.status(400).json(errorResponse("예약한 호텔과 리뷰 작성 대상 호텔이 일치하지 않습니다.", 400));
    }
    if (error.message === "REVIEW_ALREADY_EXISTS") {
      return res.status(400).json(errorResponse("이미 해당 예약에 대한 리뷰를 작성하셨습니다.", 400));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 리뷰 신고
const reportReview = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json(errorResponse("신고 사유를 입력해주세요.", 400));
    }

    const result = await reviewService.reportReview(req.params.id, reason, req.user.id);
    return res.status(201).json(successResponse({ report: result }, "리뷰가 신고되었습니다.", 201));
  } catch (error) {
    if (error.message === "REVIEW_NOT_FOUND") {
      return res.status(404).json(errorResponse("리뷰를 찾을 수 없습니다.", 404));
    }
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("해당 호텔의 소유자만 리뷰를 신고할 수 있습니다.", 403));
    }
    if (error.message === "REPORT_ALREADY_EXISTS") {
      return res.status(400).json(errorResponse("이미 해당 리뷰를 신고하셨습니다.", 400));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 리뷰 차단
const blockReview = async (req, res) => {
  try {
    const result = await reviewService.blockReview(req.params.id, req.user.id);
    return res.status(200).json(successResponse({ review: result }, "리뷰가 차단되었습니다.", 200));
  } catch (error) {
    if (error.message === "REVIEW_NOT_FOUND") {
      return res.status(404).json(errorResponse("리뷰를 찾을 수 없습니다.", 404));
    }
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("해당 호텔의 소유자만 리뷰를 차단할 수 있습니다.", 403));
    }
    if (error.message === "ALREADY_BLOCKED") {
      return res.status(400).json(errorResponse("이미 차단된 리뷰입니다.", 400));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 차단된 리뷰 목록 조회
const getBlockedReviews = async (req, res) => {
  try {
    const result = await reviewService.getBlockedReviews(req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 숙소별 리뷰 목록 조회
const getReviewsByLodging = async (req, res) => {
  try {
    const { lodgingId } = req.params;
    const { page, limit, rating } = req.query;

    // lodgingId 형식 검증
    if (!lodgingId || !mongoose.Types.ObjectId.isValid(lodgingId)) {
      return res.status(400).json(errorResponse("잘못된 lodging_id 형식입니다.", 400));
    }

    const filters = {
      page,
      limit,
      rating
    };

    const result = await reviewService.getReviewsByLodging(lodgingId, filters);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    console.error("GET /api/reviews/lodging/:lodgingId 실패", error);
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 신고 내역 조회
const getReports = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await reviewService.getReports(filters);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 사업자의 모든 숙소 리뷰 목록 조회
const getReviews = async (req, res) => {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      rating: req.query.rating
    };

    const result = await reviewService.getReviews(req.user.id, filters);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    console.error("GET /api/business/reviews 실패", error);
    
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 리뷰 상세 조회
const getReviewById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const result = await reviewService.getReviewById(req.params.id, req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    console.error("GET /api/business/reviews/:id 실패", error);
    
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "REVIEW_NOT_FOUND") {
      return res.status(404).json(errorResponse("리뷰를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 리뷰 답변
const replyToReview = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const { reply } = req.body;

    if (!reply || reply.trim().length === 0) {
      return res.status(400).json(errorResponse("답변 내용을 입력해주세요.", 400));
    }

    const result = await reviewService.replyToReview(req.params.id, reply, req.user.id);
    return res.status(200).json(successResponse(result, "답변이 작성되었습니다.", 200));
  } catch (error) {
    console.error("POST /api/business/reviews/:id/reply 실패", error);
    
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "REVIEW_NOT_FOUND") {
      return res.status(404).json(errorResponse("리뷰를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 리뷰 통계
const getReviewStats = async (req, res) => {
  try {
    const result = await reviewService.getReviewStats(req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    console.error("GET /api/business/reviews/stats 실패", error);
    
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
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

