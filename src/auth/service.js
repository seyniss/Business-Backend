const User = require("./model");
const Business = require("./business");
const jwt = require("jsonwebtoken");

const LOCK_MAX = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10분

const makeToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion || 0
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
      jwtid: `${user._id}-${Date.now()}`,
    }
  );
};

// 회원가입
const register = async (userData) => {
  const { email, password, user_name, phone, date_of_birth, address, profile_image } = userData;

  // 이메일 중복 검사
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  // User 생성 (항상 USER role, active status)
  const user = await User.create({
    email: email.toLowerCase(),
    password,
    user_name,
    phone: phone || "",
    date_of_birth: date_of_birth || null,
    address: address || "",
    profile_image: profile_image || "",
    role: "USER",
    status: "active"
  });

  // 비밀번호 해싱
  await user.setPassword(password);
  await user.save();

  return {
    user: user.toSafeJSON(),
    message: "회원가입 완료"
  };
};

// 로그인
const login = async (email, password) => {
  const user = await User.findOne({ email: email.toLowerCase() })
    .select("+password +status +failedLoginAttempts +lastLoginAttempt +tokenVersion");

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // 계정 상태 확인
  if (user.status === "suspended") {
    throw new Error("ACCOUNT_SUSPENDED");
  }

  if (user.status === "inactive") {
    throw new Error("ACCOUNT_INACTIVE");
  }

  // 사업자인 경우 승인 상태 확인
  if (user.role === "BUSINESS" && user.status === "pending") {
    throw new Error("PENDING_APPROVAL");
  }

  // 잠금 해제 로직
  if (user.failedLoginAttempts >= LOCK_MAX) {
    const last = user.lastLoginAttempt ? user.lastLoginAttempt.getTime() : 0;
    const passed = Date.now() - last;
    if (passed > LOCKOUT_DURATION_MS) {
      user.failedLoginAttempts = 0;
      user.lastLoginAttempt = null;
      await user.save();
    }
  }

  // 여전히 잠금 상태면 로그인 불가
  if (user.failedLoginAttempts >= LOCK_MAX) {
    const last = user.lastLoginAttempt ? user.lastLoginAttempt.getTime() : 0;
    const remainMs = Math.max(0, LOCKOUT_DURATION_MS - (Date.now() - last));
    throw new Error("ACCOUNT_LOCKED");
  }

  // 비밀번호 검증
  const ok = await user.comparePassword(password);

  // 비밀번호 불일치
  if (!ok) {
    user.failedLoginAttempts += 1;
    user.lastLoginAttempt = new Date();

    // 최대 횟수 초과 계정 잠금
    if (user.failedLoginAttempts >= LOCK_MAX) {
      await user.save();
      throw new Error("ACCOUNT_LOCKED");
    }

    const remaining = Math.max(0, LOCK_MAX - user.failedLoginAttempts);
    await user.save();
    throw new Error("INVALID_CREDENTIALS");
  }

  // 로그인 성공: 실패 카운트 초기화 및 토큰 버전 증가
  user.failedLoginAttempts = 0;
  user.lastLoginAttempt = new Date();
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // JWT 발급
  const token = makeToken(user);

  return {
    user: user.toSafeJSON(),
    token,
    loginAttempts: 0,
    remainingAttempts: LOCK_MAX,
    locked: false
  };
};

// 내 정보 조회
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const responseData = {
    user: user.toSafeJSON()
  };

  // 역할에 따라 추가 데이터 반환
  if (user.role === "BUSINESS") {
    const business = await Business.findOne({ login_id: user._id });
    responseData.business = business || null;
  }

  return responseData;
};

// 로그아웃
const logout = async (userId) => {
  await User.findByIdAndUpdate(
    userId,
    { $inc: { tokenVersion: 1 } },
    { new: true }
  );
  return { message: '로그아웃 성공' };
};

// 사업자 신청
const applyBusiness = async (userId, businessData) => {
  const { business_name, business_number } = businessData;

  // 현재 사용자 정보 조회
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  // 이미 BUSINESS role인지 확인
  if (user.role === "BUSINESS") {
    throw new Error("ALREADY_BUSINESS");
  }

  // 이미 Business 문서가 존재하는지 확인
  const existingBusiness = await Business.findOne({ login_id: userId });
  if (existingBusiness) {
    throw new Error("ALREADY_APPLIED");
  }

  // Business 문서 생성
  await Business.create({
    login_id: userId,
    business_name,
    business_number
  });

  // User role을 BUSINESS로, status를 pending으로 변경
  user.role = "BUSINESS";
  user.status = "pending";
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  return {
    message: "사업자 신청이 완료되었습니다. 관리자 승인 대기 중입니다.",
    user: user.toSafeJSON()
  };
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  applyBusiness,
  LOCK_MAX,
  LOCKOUT_DURATION_MS
};

