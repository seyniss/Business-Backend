// 어떤 URL(Endpoint)이 어떤 controller 함수를 실행할지 정의하는 곳
// 비즈니스 로직은 service → 입력/출력은 controller → URL 연결은 route

const express = require("express");
const router = express.Router();

const {
  createReview,
  reportReview,
  blockReview,
  getBlockedReviews,
  getReviewsByLodging,
  getReports,
  getReviews,
  getReviewById,
  replyToReview,
  getReviewStats,
} = require("./controller");
const { authenticateToken, requireRole, requireBusiness } = require("../common/authMiddleware");

// 공개 라우트 (인증 불필요)
// GET /api/business/reviews/lodging/:lodgingId → 숙소별 리뷰 목록 조회 (공개)
router.get("/lodging/:lodgingId", getReviewsByLodging);

// 인증 필요 라우트
router.use(authenticateToken);

// POST /api/business/reviews → 리뷰 작성 (user만)
router.post("/", requireRole("user"), createReview);

// admin 전용 라우트 (requireBusiness 전에 위치)
// GET /api/business/reviews/reports → 신고 내역 조회 (admin만)
router.get("/reports", requireRole("admin"), getReports);

// 사업자 전용 라우트
router.use(requireBusiness);

// GET /api/business/reviews → 사업자의 모든 숙소 리뷰 목록 조회
router.get("/", getReviews);

// GET /api/business/reviews/stats → 리뷰 통계 (stats가 :id보다 먼저 와야 함)
router.get("/stats", getReviewStats);

// GET /api/business/reviews/blocked → 차단된 리뷰 목록 조회
router.get("/blocked", getBlockedReviews);

// GET /api/business/reviews/:id → 리뷰 상세 조회
router.get("/:id", getReviewById);

// POST /api/business/reviews/:id/reply → 리뷰 답변
router.post("/:id/reply", replyToReview);

// POST /api/business/reviews/:id/report → 리뷰 신고
router.post("/:id/report", reportReview);

// PATCH /api/business/reviews/:id/block → 리뷰 차단
router.patch("/:id/block", blockReview);

module.exports = router;

