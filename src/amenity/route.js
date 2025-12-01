// 어떤 URL(Endpoint)이 어떤 controller 함수를 실행할지 정의하는 곳
// 비즈니스 로직은 service → 입력/출력은 controller → URL 연결은 route

const express = require("express");
const router = express.Router();

const {
  createOrUpdateAmenity,
  getAmenityByLodging,
  updateAmenity,
} = require("./controller");
const { authenticateToken, requireBusiness } = require("../common/authMiddleware");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// POST /api/amenities → 편의시설 생성/수정
router.post("/", createOrUpdateAmenity);

// GET /api/amenities/lodging/:lodgingId → 숙소별 편의시설 조회
router.get("/lodging/:lodgingId", getAmenityByLodging);

// PUT /api/amenities/:id → 편의시설 수정
router.put("/:id", updateAmenity);

module.exports = router;

