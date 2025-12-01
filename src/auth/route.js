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
  changePassword,
  forgotPassword,
  updateProfile,
  kakaoLogin,
  completeKakaoSignup,
} = require("./controller");
const { authenticateToken } = require("../common/authMiddleware");

// POST /api/business/auth/signup → 회원가입 (로그인 불필요)
router.post("/signup", register);

// POST /api/business/auth/login → 로그인 (로그인 불필요)
router.post("/login", login);

// POST /api/business/auth/forgot-password → 비밀번호 찾기 (로그인 불필요)
router.post("/forgot-password", forgotPassword);

// POST /api/business/auth/kakao → 카카오 로그인 (로그인 불필요)
router.post("/kakao", kakaoLogin);

// POST /api/business/auth/kakao/complete → 카카오 회원가입 완료 (로그인 불필요)
router.post("/kakao/complete", completeKakaoSignup);

// 인증 필요 라우트
router.use(authenticateToken);

// GET /api/business/auth/me → 내 정보 조회 (로그인 필요)
router.get("/me", getMe);

// POST /api/business/auth/logout → 로그아웃 (로그인 필요)
router.post("/logout", logout);

// PUT /api/business/auth/password → 비밀번호 변경 (로그인 필요)
router.put("/password", changePassword);

// PUT /api/business/auth/profile → 프로필 수정 (로그인 필요)
router.put("/profile", updateProfile);

// POST /api/business/auth/apply-business → 사업자 신청 (로그인 필요)
router.post("/apply-business", applyBusiness);

module.exports = router;

