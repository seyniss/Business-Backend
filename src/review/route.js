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
} = require("./controller");
const { authenticateToken, requireRole } = require("../common/authMiddleware");

// GET /api/reviews/lodging/:lodgingId → 숙소별 리뷰 목록 조회 (인증 불필요, 공개)
router.get("/lodging/:lodgingId", getReviewsByLodging);

// POST /api/reviews → 리뷰 작성 (USER만, 로그인 필요)
router.post("/", authenticateToken, requireRole("USER"), createReview);

// POST /api/reviews/:id/report → 리뷰 신고 (BUSINESS만, 로그인 필요)
router.post("/:id/report", authenticateToken, requireRole("BUSINESS"), reportReview);

// PATCH /api/reviews/:id/block → 리뷰 차단 (BUSINESS만, 로그인 필요)
router.patch("/:id/block", authenticateToken, requireRole("BUSINESS"), blockReview);

// GET /api/reviews/blocked → 차단된 리뷰 목록 조회 (BUSINESS만, 로그인 필요)
router.get("/blocked", authenticateToken, requireRole("BUSINESS"), getBlockedReviews);

// GET /api/reviews/reports → 신고 내역 조회 (ADMIN만, 로그인 필요)
router.get("/reports", authenticateToken, requireRole("ADMIN"), getReports);

module.exports = router;

