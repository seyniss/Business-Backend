const BusinessUser = require("./model");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

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
  const { email, password, name, phoneNumber, businessName, businessNumber } = userData;

  // [DEBUG] 이메일 중복 검사
  // 에러 발생 시: 이미 존재하는 이메일로 회원가입 시도
  const existingUser = await BusinessUser.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    console.error(`[REGISTER ERROR] EMAIL_ALREADY_EXISTS - email: ${email}, existingUserId: ${existingUser._id}`);
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  // [DEBUG] 전화번호 필수 검증
  if (!phoneNumber) {
    console.error(`[REGISTER ERROR] PHONE_NUMBER_REQUIRED - email: ${email}`);
    throw new Error("PHONE_NUMBER_REQUIRED");
  }

  // [DEBUG] 사업자등록번호 필수 검증
  if (!businessNumber) {
    console.error(`[REGISTER ERROR] BUSINESS_NUMBER_REQUIRED - email: ${email}`);
    throw new Error("BUSINESS_NUMBER_REQUIRED");
  }

  // [DEBUG] 사업자등록번호 중복 검사
  // 에러 발생 시: 이미 등록된 사업자등록번호로 회원가입 시도
  const existingBusiness = await BusinessUser.findOne({ businessNumber });
  if (existingBusiness) {
    console.error(`[REGISTER ERROR] BUSINESS_NUMBER_ALREADY_EXISTS - businessNumber: ${businessNumber}`);
    throw new Error("BUSINESS_NUMBER_ALREADY_EXISTS");
  }

  // businessName이 없으면 name을 사용
  const finalBusinessName = businessName || name;

  // [DEBUG] BusinessUser 인스턴스 생성 (passwordHash는 setPassword에서 설정)
  // 에러 발생 시: BusinessUser 스키마 검증 실패 또는 필수 필드 누락
  const user = new BusinessUser({
    email: email.toLowerCase(),
    name,
    phoneNumber: phoneNumber,
    role: "business", // 항상 사업자로 생성
    isActive: true,
    businessName: finalBusinessName,
    businessNumber: businessNumber
  });

  // [DEBUG] 비밀번호 해싱 및 저장
  // 에러 발생 시: 비밀번호 해싱 실패 또는 User 저장 실패 (중복 키, 검증 오류 등)
  try {
    await user.setPassword(password);
    await user.save();
    
    // [DEBUG] user._id 검증 및 타입 확인
    if (!user._id) {
      console.error(`[REGISTER ERROR] BusinessUser._id is null/undefined after save - email: ${email}`);
      throw new Error("BUSINESS_USER_ID_NOT_GENERATED");
    }
    
    console.log(`[REGISTER SUCCESS] BusinessUser created - userId: ${user._id}, userId type: ${typeof user._id}, userId constructor: ${user._id.constructor.name}, email: ${email}, role: business`);
  } catch (userSaveError) {
    console.error(`[REGISTER ERROR] BusinessUser save failed - email: ${email}, error: ${userSaveError.message}, code: ${userSaveError.code}`);
    throw userSaveError;
  }


  // 프론트엔드 요구사항에 맞게 business 객체 반환
  const userObj = user.toSafeJSON();
  const business = {
    id: userObj._id || userObj.id,
    name: userObj.name,
    email: userObj.email,
    phoneNumber: userObj.phoneNumber,
    businessNumber: userObj.businessNumber,
    createdAt: userObj.createdAt
  };

  return {
    token: makeToken(user),
    business,
    message: "사업자 회원가입 완료"
  };
};

// 로그인
const login = async (email, password) => {
  const user = await BusinessUser.findOne({ email: email.toLowerCase() })
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

  // 프론트엔드 요구사항에 맞게 business 객체 반환
  const userObj = user.toSafeJSON();
  const business = user.role === 'business' ? {
    id: userObj._id || userObj.id,
    name: userObj.name,
    email: userObj.email,
    phoneNumber: userObj.phoneNumber,
    businessNumber: userObj.businessNumber,
    createdAt: userObj.createdAt
  } : null;

  return {
    token,
    business,
    loginAttempts: 0,
    remainingAttempts: LOCK_MAX,
    locked: false
  };
};

// 내 정보 조회
const getMe = async (userId) => {
  const user = await BusinessUser.findById(userId);
  if (!user) {
    throw new Error("BUSINESS_USER_NOT_FOUND");
  }

  // 프론트엔드 요구사항에 맞게 business 객체 직접 반환
  const userObj = user.toSafeJSON();
  return {
    id: userObj._id || userObj.id,
    name: userObj.name,
    email: userObj.email,
    phoneNumber: userObj.phoneNumber,
    businessNumber: userObj.businessNumber,
    createdAt: userObj.createdAt
  };
};

// 로그아웃
const logout = async (userId) => {
  // 쿠키/헤더 제거는 controller에서 처리
  return { message: '로그아웃 성공' };
};

// 비밀번호 변경
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await BusinessUser.findById(userId).select("+passwordHash");
  
  if (!user) {
    throw new Error("BUSINESS_USER_NOT_FOUND");
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
  const user = await BusinessUser.findOne({ email: email.toLowerCase() });
  
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
  const { name, phoneNumber, businessNumber } = profileData;

  const user = await BusinessUser.findById(userId);
  if (!user) {
    throw new Error("BUSINESS_USER_NOT_FOUND");
  }

  // 업데이트할 필드만 수정
  if (name !== undefined) user.name = name;
  if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
  if (businessNumber !== undefined) user.businessNumber = businessNumber;

  await user.save();

  const userObj = user.toSafeJSON();
  const business = {
    id: userObj._id || userObj.id,
    name: userObj.name,
    email: userObj.email,
    phoneNumber: userObj.phoneNumber,
    businessNumber: userObj.businessNumber,
    createdAt: userObj.createdAt
  };

  return {
    business,
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
  // const user = await BusinessUser.findOne({ email: kakaoUserInfo.email, provider: 'kakao' });
  
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
  changePassword,
  forgotPassword,
  updateProfile,
  kakaoLogin,
  completeKakaoSignup,
  LOCK_MAX,
  LOCKOUT_DURATION_MS
};

