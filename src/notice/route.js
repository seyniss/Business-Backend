// 어떤 URL(Endpoint)이 어떤 controller 함수를 실행할지 정의하는 곳
// 비즈니스 로직은 service → 입력/출력은 controller → URL 연결은 route

const express = require("express");
const router = express.Router();

const {
  createOrUpdateNotice,
  getNoticeByRoom,
  updateNotice,
} = require("./controller");
const { authenticateToken, requireBusiness } = require("../common/authMiddleware");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// POST /api/notices → 공지사항 생성/수정
router.post("/", createOrUpdateNotice);

// GET /api/notices/room/:roomId → 객실별 공지사항 조회
router.get("/room/:roomId", getNoticeByRoom);

// PUT /api/notices/:id → 공지사항 수정
router.put("/:id", updateNotice);

module.exports = router;

