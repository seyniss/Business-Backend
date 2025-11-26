// 어떤 URL(Endpoint)이 어떤 controller 함수를 실행할지 정의하는 곳
// 비즈니스 로직은 service → 입력/출력은 controller → URL 연결은 route

const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getMe,
  logout,
  applyBusiness,
} = require("./controller");
const { authenticateToken } = require("../common/authMiddleware");

// POST /api/auth/register → 회원가입 (로그인 불필요)
router.post("/register", register);

// POST /api/auth/login → 로그인 (로그인 불필요)
router.post("/login", login);

// 인증 필요 라우트
router.use(authenticateToken);

// GET /api/auth/me → 내 정보 조회 (로그인 필요)
router.get("/me", getMe);

// POST /api/auth/logout → 로그아웃 (로그인 필요)
router.post("/logout", logout);

// POST /api/auth/apply-business → 사업자 신청 (로그인 필요)
router.post("/apply-business", applyBusiness);

module.exports = router;

