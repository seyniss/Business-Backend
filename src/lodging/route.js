// 어떤 URL(Endpoint)이 어떤 controller 함수를 실행할지 정의하는 곳
// 비즈니스 로직은 service → 입력/출력은 controller → URL 연결은 route

const express = require("express");
const router = express.Router();

const {
  getLodgings,
  getLodgingById,
  createLodging,
  updateLodging,
  deleteLodging,
} = require("./controller");
const { authenticateToken, requireBusiness } = require("../common/authMiddleware");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// GET /api/lodgings → 숙소 목록 조회
router.get("/", getLodgings);

// GET /api/lodgings/:id → 숙소 상세 조회
router.get("/:id", getLodgingById);

// POST /api/lodgings → 숙소 생성
router.post("/", createLodging);

// PUT /api/lodgings/:id → 숙소 수정
router.put("/:id", updateLodging);

// DELETE /api/lodgings/:id → 숙소 삭제
router.delete("/:id", deleteLodging);

module.exports = router;

