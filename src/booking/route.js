// 어떤 URL(Endpoint)이 어떤 controller 함수를 실행할지 정의하는 곳
// 비즈니스 로직은 service → 입력/출력은 controller → URL 연결은 route

const express = require("express");
const router = express.Router();

const {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  updatePaymentStatus,
  getBookingStats,
} = require("./controller");
const { authenticateToken, requireBusiness } = require("../common/authMiddleware");

// 모든 라우트는 인증 필요
router.use(authenticateToken);

// POST /api/business/bookings → 예약 생성 (사용자/사업자 모두 가능)
router.post("/", createBooking);

// GET /api/business/bookings → 예약 목록 조회 (사용자/사업자 모두 가능)
router.get("/", getBookings);

// GET /api/business/bookings/stats → 예약 통계 (사업자만 가능)
router.get("/stats", requireBusiness, getBookingStats);

// GET /api/business/bookings/:id → 예약 상세 조회 (사용자/사업자 모두 가능)
router.get("/:id", getBookingById);

// PATCH /api/business/bookings/:id/status → 예약 상태 변경 (사업자만 가능)
router.patch("/:id/status", requireBusiness, updateBookingStatus);

// PATCH /api/business/bookings/:id/payment → 결제 상태 변경 (사업자만 가능)
router.patch("/:id/payment", requireBusiness, updatePaymentStatus);

module.exports = router;

