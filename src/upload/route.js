// 어떤 URL(Endpoint)이 어떤 controller 함수를 실행할지 정의하는 곳
// 비즈니스 로직은 service → 입력/출력은 controller → URL 연결은 route

const express = require("express");
const router = express.Router();

const {
  generatePresignUrl,
  ping,
} = require("./controller");
const { authenticateToken, requireBusiness } = require("../common/authMiddleware");

// GET /api/upload/ping → Ping
router.get('/ping', ping);

// POST /api/upload/presign → Presign URL 생성 (로그인 필요, 사업자 권한 필요)
router.post('/presign', authenticateToken, requireBusiness, generatePresignUrl);

module.exports = router;

