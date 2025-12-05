const authService = require("./service");
const { successResponse, errorResponse } = require("../common/response");

// 회원가입
const register = async (req, res) => {
  try {
    const { email, password, name, phoneNumber, businessName, businessNumber } = req.body;

    // 필수 필드 검증
    if (!email || !password || !name || !phoneNumber) {
      return res.status(400).json(errorResponse("이메일/비밀번호/이름/전화번호는 필수입니다.", 400));
    }

    // 사업자등록번호 필수
    if (!businessNumber) {
      return res.status(400).json(errorResponse("사업자등록번호는 필수입니다.", 400));
    }

    const result = await authService.register({
      email,
      password,
      name,
      phoneNumber,
      businessName,
      businessNumber
    });

    return res.status(201).json(successResponse(result, "회원가입 완료", 201));
  } catch (error) {
    if (error.message === "EMAIL_ALREADY_EXISTS") {
      return res.status(400).json(errorResponse("이미 가입된 이메일", 400));
    }
    if (error.message === "PHONE_NUMBER_REQUIRED") {
      return res.status(400).json(errorResponse("전화번호는 필수입니다.", 400));
    }
    if (error.message === "BUSINESS_NUMBER_REQUIRED") {
      return res.status(400).json(errorResponse("사업자등록번호는 필수입니다.", 400));
    }
    if (error.message === "BUSINESS_NUMBER_ALREADY_EXISTS") {
      return res.status(400).json(errorResponse("이미 등록된 사업자등록번호입니다.", 400));
    }
    return res.status(500).json(errorResponse("회원가입 실패", 500, error.message));
  }
};

// 로그인
const login = async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json(errorResponse("이메일 또는 비밀번호가 올바르지 않습니다.", 400));
    }

    const result = await authService.login(email, password);

    // 쿠키 설정
    res.cookie('token', result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json(successResponse(result, "로그인 성공", 200));
  } catch (error) {
    if (error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json(errorResponse("이메일 또는 비밀번호가 올바르지 않습니다.", 401));
    }
    if (error.message === "ACCOUNT_SUSPENDED") {
      return res.status(403).json(errorResponse("계정이 정지되었습니다. 관리자에게 문의하세요.", 403));
    }
    if (error.message === "ACCOUNT_INACTIVE") {
      return res.status(403).json(errorResponse("비활성화된 계정입니다.", 403));
    }
    if (error.message === "PENDING_APPROVAL") {
      return res.status(403).json(errorResponse("관리자 승인 대기 중입니다. 승인 후 로그인 가능합니다.", 403));
    }
    if (error.message === "ACCOUNT_LOCKED") {
      const remainMin = Math.ceil(authService.LOCKOUT_DURATION_MS / 60000);
      return res.status(423).json(errorResponse(
        `계정이 잠금 상태입니다. ${remainMin}분 후 다시 시도해 주세요.`,
        423
      ));
    }
    return res.status(500).json(errorResponse("로그인 실패", 500, error.message));
  }
};

// 내 정보 조회
const getMe = async (req, res) => {
  try {
    const result = await authService.getMe(req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "BUSINESS_USER_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보 없음", 404));
    }
    return res.status(401).json(errorResponse("조회 실패", 401, error.message));
  }
};

// 로그아웃
const logout = async (req, res) => {
  try {
    const result = await authService.logout(req.user.id);

    res.clearCookie('token', {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: '/'
    });

    return res.status(200).json(successResponse(result, "로그아웃 성공", 200));
  } catch (error) {
    return res.status(500).json(errorResponse("로그아웃 실패", 500, error.message));
  }
};

// 비밀번호 변경
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json(errorResponse("현재 비밀번호와 새 비밀번호는 필수입니다.", 400));
    }

    if (newPassword.length < 6) {
      return res.status(400).json(errorResponse("새 비밀번호는 최소 6자 이상이어야 합니다.", 400));
    }

    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);

    return res.status(200).json(successResponse(result, "비밀번호가 변경되었습니다.", 200));
  } catch (error) {
    if (error.message === "BUSINESS_USER_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "INVALID_CURRENT_PASSWORD") {
      return res.status(400).json(errorResponse("현재 비밀번호가 올바르지 않습니다.", 400));
    }
    return res.status(500).json(errorResponse("비밀번호 변경 실패", 500, error.message));
  }
};

// 비밀번호 찾기
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(errorResponse("이메일은 필수입니다.", 400));
    }

    const result = await authService.forgotPassword(email);

    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    return res.status(500).json(errorResponse("비밀번호 찾기 실패", 500, error.message));
  }
};

// 프로필 수정
const updateProfile = async (req, res) => {
  try {
    const { name, phoneNumber, businessNumber } = req.body;

    const result = await authService.updateProfile(req.user.id, {
      name,
      phoneNumber,
      businessNumber
    });

    return res.status(200).json(successResponse(result, "프로필이 수정되었습니다.", 200));
  } catch (error) {
    if (error.message === "BUSINESS_USER_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("프로필 수정 실패", 500, error.message));
  }
};

// 카카오 로그인
const kakaoLogin = async (req, res) => {
  try {
    // 프론트엔드는 access_token을 보내지만, 서비스는 accessToken을 기대
    const accessToken = req.body.access_token || req.body.accessToken;

    if (!accessToken) {
      return res.status(400).json(errorResponse("카카오 액세스 토큰이 필요합니다.", 400));
    }

    const result = await authService.kakaoLogin(accessToken);

    // 로그인 성공 시 쿠키 설정
    if (result.token) {
      res.cookie('token', result.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }

    return res.status(200).json(successResponse(result, "카카오 로그인 성공", 200));
  } catch (error) {
    if (error.message === "KAKAO_LOGIN_NOT_IMPLEMENTED") {
      return res.status(501).json(errorResponse("카카오 로그인 기능이 아직 구현되지 않았습니다.", 501));
    }
    return res.status(500).json(errorResponse("카카오 로그인 실패", 500, error.message));
  }
};

// 카카오 회원가입 완료
const completeKakaoSignup = async (req, res) => {
  try {
    const result = await authService.completeKakaoSignup(req.body);

    return res.status(200).json(successResponse(result, "카카오 회원가입이 완료되었습니다.", 200));
  } catch (error) {
    if (error.message === "KAKAO_SIGNUP_NOT_IMPLEMENTED") {
      return res.status(501).json(errorResponse("카카오 회원가입 기능이 아직 구현되지 않았습니다.", 501));
    }
    return res.status(500).json(errorResponse("카카오 회원가입 실패", 500, error.message));
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  changePassword,
  forgotPassword,
  updateProfile,
  kakaoLogin,
  completeKakaoSignup
};

