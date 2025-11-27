// 어떤 URL(Endpoint)이 어떤 controller 함수를 실행할지 정의하는 곳
// 비즈니스 로직은 service → 입력/출력은 controller → URL 연결은 route

const express = require("express");
const router = express.Router();

const {
  getDashboardStats,
  getStatistics,
  getRevenueStats,
  getBookingStats,
  getOccupancyStats,
} = require("./controller");
const { authenticateToken, requireBusiness } = require("../common/authMiddleware");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// GET /api/business/stats/dashboard → 대시보드 통계
router.get("/dashboard", getDashboardStats);

// GET /api/business/stats → 통계 조회 (쿼리 파라미터 기반)
router.get("/", getStatistics);

// GET /api/business/stats/revenue → 매출 통계
router.get("/revenue", getRevenueStats);

// GET /api/business/stats/bookings → 예약 통계
router.get("/bookings", getBookingStats);

// GET /api/business/stats/occupancy → 점유율 통계
router.get("/occupancy", getOccupancyStats);

module.exports = router;

