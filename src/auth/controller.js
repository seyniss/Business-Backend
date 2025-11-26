const authService = require("./service");
const { successResponse, errorResponse } = require("../common/response");

// 회원가입
const register = async (req, res) => {
  try {
    const { email, password, user_name, phone, date_of_birth, address, profile_image } = req.body;

    // 필수 필드 검증
    if (!email || !password || !user_name) {
      return res.status(400).json(errorResponse("이메일/비밀번호/이름은 필수입니다.", 400));
    }

    const result = await authService.register({
      email,
      password,
      user_name,
      phone,
      date_of_birth,
      address,
      profile_image
    });

    return res.status(201).json(successResponse(result, "회원가입 완료", 201));
  } catch (error) {
    if (error.message === "EMAIL_ALREADY_EXISTS") {
      return res.status(400).json(errorResponse("이미 가입된 이메일", 400));
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
      const remainMs = Math.max(0, authService.LOCKOUT_DURATION_MS - Date.now());
      const remainMin = Math.ceil(remainMs / 60000);
      return res.status(423).json(errorResponse(
        remainMs > 0
          ? `계정이 잠금 상태입니다. 약 ${remainMin}분 후 다시 시도해 주세요.`
          : "계정이 잠금 상태입니다. 관리자에게 문의하세요.",
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
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json(errorResponse("사용자 정보 없음", 404));
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

// 사업자 신청
const applyBusiness = async (req, res) => {
  try {
    const { business_name, business_number } = req.body;

    // 필수 필드 검증
    if (!business_name || !business_number) {
      return res.status(400).json(errorResponse("사업자명과 사업자등록번호는 필수입니다.", 400));
    }

    const result = await authService.applyBusiness(req.user.id, { business_name, business_number });

    return res.status(201).json(successResponse(result, "사업자 신청이 완료되었습니다.", 201));
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json(errorResponse("사용자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "ALREADY_BUSINESS") {
      return res.status(400).json(errorResponse("이미 사업자로 등록되어 있습니다.", 400));
    }
    if (error.message === "ALREADY_APPLIED") {
      return res.status(400).json(errorResponse("이미 사업자 신청이 완료되었습니다.", 400));
    }
    if (error.code === 11000 && error.keyPattern?.business_number) {
      return res.status(400).json(errorResponse("이미 등록된 사업자등록번호입니다.", 400));
    }
    return res.status(500).json(errorResponse("사업자 신청 실패", 500, error.message));
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  applyBusiness
};

