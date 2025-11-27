// 어떤 URL(Endpoint)이 어떤 controller 함수를 실행할지 정의하는 곳
// 비즈니스 로직은 service → 입력/출력은 controller → URL 연결은 route

const express = require("express");
const router = express.Router();

const {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
} = require("./controller");
const { authenticateToken, requireBusiness } = require("../common/authMiddleware");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// GET /api/business/rooms → 객실 목록 조회 (쿼리 파라미터: lodgingId)
router.get("/", getRooms);

// POST /api/business/rooms → 객실 생성
router.post("/", createRoom);

// PATCH /api/business/rooms/:id/status → 객실 상태 변경 (/:id보다 먼저 정의)
router.patch("/:id/status", updateRoomStatus);

// GET /api/business/rooms/:id → 객실 상세 조회
router.get("/:id", getRoomById);

// PUT /api/business/rooms/:id → 객실 수정
router.put("/:id", updateRoom);

// DELETE /api/business/rooms/:id → 객실 삭제
router.delete("/:id", deleteRoom);

module.exports = router;

