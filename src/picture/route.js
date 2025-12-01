// 어떤 URL(Endpoint)이 어떤 controller 함수를 실행할지 정의하는 곳
// 비즈니스 로직은 service → 입력/출력은 controller → URL 연결은 route

const express = require("express");
const router = express.Router();

const {
  getPicturesByRoom,
  createPicture,
  deletePicture,
} = require("./controller");
const { authenticateToken, requireBusiness } = require("../common/authMiddleware");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// GET /api/pictures/room/:roomId → 객실별 사진 목록 조회
router.get("/room/:roomId", getPicturesByRoom);

// POST /api/pictures → 사진 추가
router.post("/", createPicture);

// DELETE /api/pictures/:id → 사진 삭제
router.delete("/:id", deletePicture);

module.exports = router;

