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
      email: user.email
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
  const { email, password, name, phoneNumber, dateOfBirth, address, profileImage, role, businessName, businessNumber } = userData;

  // 이메일 중복 검사
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  // role 검증 (USER, BUSINESS, ADMIN 중 하나)
  const validRoles = ["USER", "BUSINESS", "ADMIN"];
  const userRole = role && validRoles.includes(role) ? role : "USER";

  // 사업자로 가입하는 경우 사업자 정보 검증
  if (userRole === "BUSINESS") {
    if (!businessName || !businessNumber) {
      throw new Error("BUSINESS_INFO_REQUIRED");
    }

    // 사업자등록번호 중복 검사
    const existingBusiness = await Business.findOne({ businessNumber });
    if (existingBusiness) {
      throw new Error("BUSINESS_NUMBER_ALREADY_EXISTS");
    }
  }

  // User 인스턴스 생성 (passwordHash는 setPassword에서 설정)
  const user = new User({
    email: email.toLowerCase(),
    name,
    phoneNumber: phoneNumber || "",
    dateOfBirth: dateOfBirth || null,
    address: address || "",
    profileImage: profileImage || "",
    role: userRole,
    isActive: true
  });

  // 비밀번호 해싱 및 저장
  await user.setPassword(password);
  await user.save();

  // 사업자로 가입하는 경우 Business 모델에도 등록
  if (userRole === "BUSINESS") {
    await Business.create({
      loginId: user._id,
      businessName,
      businessNumber
    });
  }

  return {
    user: user.toSafeJSON(),
    message: userRole === "BUSINESS" ? "사업자 회원가입 완료" : "회원가입 완료"
  };
};

// 로그인
const login = async (email, password) => {
  const user = await User.findOne({ email: email.toLowerCase() })
    .select("+passwordHash +isActive +failedLoginAttempts +lastLoginAttempt");

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // 계정 활성 상태 확인
  if (!user.isActive) {
    throw new Error("ACCOUNT_INACTIVE");
  }

  // 잠금 해제 로직 (10분 경과 시 자동 해제)
  if (user.failedLoginAttempts >= LOCK_MAX) {
    const last = user.lastLoginAttempt ? user.lastLoginAttempt.getTime() : 0;
    const passed = Date.now() - last;
    if (passed > LOCKOUT_DURATION_MS) {
      // 10분 경과 시 자동 해제
      user.failedLoginAttempts = 0;
      user.lastLoginAttempt = null;
      await user.save();
    } else {
      // 여전히 잠금 상태면 로그인 불가
      const remainMs = Math.max(0, LOCKOUT_DURATION_MS - passed);
      throw new Error("ACCOUNT_LOCKED");
    }
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

  // 로그인 성공: 실패 카운트 초기화 및 마지막 로그인 시도 시간 초기화
  user.failedLoginAttempts = 0;
  user.lastLoginAttempt = null;
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
    const business = await Business.findOne({ loginId: user._id });
    responseData.business = business || null;
  }

  return responseData;
};

// 로그아웃
const logout = async (userId) => {
  // 쿠키/헤더 제거는 controller에서 처리
  return { message: '로그아웃 성공' };
};

// 사업자 신청
const applyBusiness = async (userId, businessData) => {
  const { businessName, businessNumber } = businessData;

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
  const existingBusiness = await Business.findOne({ loginId: userId });
  if (existingBusiness) {
    throw new Error("ALREADY_APPLIED");
  }

  // Business 문서 생성
  await Business.create({
    loginId: userId,
    businessName,
    businessNumber
  });

  // User role을 BUSINESS로 변경 (승인 대기 상태는 Business 모델에서 관리)
  user.role = "BUSINESS";
  await user.save();

  return {
    message: "사업자 신청이 완료되었습니다. 관리자 승인 대기 중입니다.",
    user: user.toSafeJSON()
  };
};

// 비밀번호 변경
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select("+passwordHash");
  
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  // 현재 비밀번호 확인
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  // 새 비밀번호로 변경
  await user.setPassword(newPassword);
  await user.save();

  return { message: "비밀번호가 변경되었습니다." };
};

// 비밀번호 찾기 (이메일로 리셋 토큰 발송)
const forgotPassword = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  
  if (!user) {
    // 보안을 위해 사용자가 존재하지 않아도 성공 메시지 반환
    return { message: "이메일로 비밀번호 재설정 링크를 발송했습니다." };
  }

  // TODO: 실제로는 이메일 발송 로직이 필요합니다
  // 현재는 간단히 메시지만 반환
  return { message: "이메일로 비밀번호 재설정 링크를 발송했습니다." };
};

// 프로필 수정
const updateProfile = async (userId, profileData) => {
  const { name, phoneNumber, dateOfBirth, address, profileImage } = profileData;

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  // 업데이트할 필드만 수정
  if (name !== undefined) user.name = name;
  if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
  if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth || null;
  if (address !== undefined) user.address = address;
  if (profileImage !== undefined) user.profileImage = profileImage;

  await user.save();

  return {
    user: user.toSafeJSON(),
    message: "프로필이 수정되었습니다."
  };
};

// 카카오 로그인
const kakaoLogin = async (kakaoToken) => {
  // TODO: 카카오 API를 통해 사용자 정보 조회
  // 현재는 간단한 구조만 제공
  // 실제로는 axios 등을 사용해 카카오 API 호출 필요
  
  // 임시 구현: 카카오 토큰 검증 후 사용자 조회 또는 생성
  // const kakaoUserInfo = await verifyKakaoToken(kakaoToken);
  // const user = await User.findOne({ email: kakaoUserInfo.email, provider: 'kakao' });
  
  throw new Error("KAKAO_LOGIN_NOT_IMPLEMENTED");
};

// 카카오 회원가입 완료
const completeKakaoSignup = async (kakaoData) => {
  // TODO: 카카오 회원가입 완료 로직
  // 카카오로 로그인한 사용자의 추가 정보를 입력받아 회원가입 완료
  
  throw new Error("KAKAO_SIGNUP_NOT_IMPLEMENTED");
};

module.exports = {
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
  LOCK_MAX,
  LOCKOUT_DURATION_MS
};

