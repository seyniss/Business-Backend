const User = require("./model");
const Business = require("./business");
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
  const { email, password, name, phoneNumber, dateOfBirth, address, profileImage, role, businessName, businessNumber } = userData;

  // [DEBUG] 이메일 중복 검사
  // 에러 발생 시: 이미 존재하는 이메일로 회원가입 시도
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    console.error(`[REGISTER ERROR] EMAIL_ALREADY_EXISTS - email: ${email}, existingUserId: ${existingUser._id}`);
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  // [DEBUG] role 검증 (user, business, admin 중 하나)
  // 에러 발생 시: 잘못된 role 값이 전달됨 (기본값: user)
  const validRoles = ["user", "business", "admin"];
  const userRole = role && validRoles.includes(role.toLowerCase()) ? role.toLowerCase() : "user";
  if (role && !validRoles.includes(role.toLowerCase())) {
    console.warn(`[REGISTER WARN] Invalid role provided: ${role}, using default: user`);
  }

  // [DEBUG] 사업자로 가입하는 경우 사업자 정보 검증
  // 에러 발생 시: businessName 또는 businessNumber가 누락됨
  if (userRole === "business") {
    if (!businessName || !businessNumber) {
      console.error(`[REGISTER ERROR] BUSINESS_INFO_REQUIRED - email: ${email}, businessName: ${businessName}, businessNumber: ${businessNumber}`);
      throw new Error("BUSINESS_INFO_REQUIRED");
    }

    // [DEBUG] 사업자등록번호 중복 검사
    // 에러 발생 시: 이미 등록된 사업자등록번호로 회원가입 시도
    const existingBusiness = await Business.findOne({ businessNumber });
    if (existingBusiness) {
      console.error(`[REGISTER ERROR] BUSINESS_NUMBER_ALREADY_EXISTS - businessNumber: ${businessNumber}, existingBusinessId: ${existingBusiness._id}, existingLoginId: ${existingBusiness.loginId}`);
      throw new Error("BUSINESS_NUMBER_ALREADY_EXISTS");
    }
  }

  // [DEBUG] User 인스턴스 생성 (passwordHash는 setPassword에서 설정)
  // 에러 발생 시: User 스키마 검증 실패 또는 필수 필드 누락
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

  // [DEBUG] 비밀번호 해싱 및 저장
  // 에러 발생 시: 비밀번호 해싱 실패 또는 User 저장 실패 (중복 키, 검증 오류 등)
  try {
    await user.setPassword(password);
    await user.save();
    
    // [DEBUG] user._id 검증 및 타입 확인
    if (!user._id) {
      console.error(`[REGISTER ERROR] User._id is null/undefined after save - email: ${email}`);
      throw new Error("USER_ID_NOT_GENERATED");
    }
    
    console.log(`[REGISTER SUCCESS] User created - userId: ${user._id}, userId type: ${typeof user._id}, userId constructor: ${user._id.constructor.name}, email: ${email}, role: ${userRole}`);
  } catch (userSaveError) {
    console.error(`[REGISTER ERROR] User save failed - email: ${email}, error: ${userSaveError.message}, code: ${userSaveError.code}`);
    throw userSaveError;
  }

  // [DEBUG] 사업자로 가입하는 경우 Business 모델에도 등록
  // 에러 발생 시: Business 생성 실패 (중복 키, unique 인덱스 충돌 등)
  if (userRole === "business") {
    // [DEBUG] user._id 재검증 (Business 생성 전)
    if (!user._id) {
      console.error(`[REGISTER ERROR] User._id is null/undefined before Business creation - email: ${email}`);
      throw new Error("USER_ID_MISSING");
    }
    
    // [DEBUG] user._id를 명시적으로 ObjectId로 변환
    let loginId;
    try {
      // user._id가 이미 ObjectId인지 확인
      if (user._id instanceof mongoose.Types.ObjectId) {
        loginId = user._id;
        console.log(`[REGISTER DEBUG] user._id is already ObjectId - userId: ${user._id}`);
      } else {
        // 문자열이거나 다른 타입인 경우 ObjectId로 변환
        loginId = new mongoose.Types.ObjectId(user._id);
        console.log(`[REGISTER DEBUG] Converted user._id to ObjectId - original: ${user._id}, converted: ${loginId}`);
      }
    } catch (conversionError) {
      console.error(`[REGISTER ERROR] Failed to convert user._id to ObjectId - userId: ${user._id}, userId type: ${typeof user._id}, error: ${conversionError.message}`);
      throw new Error("USER_ID_CONVERSION_FAILED");
    }
    
    try {
      // [DEBUG] 기존 null 값 문서 삭제 (unique 인덱스 충돌 방지)
      const deletedNullDocs = await Business.deleteMany({ 
        $or: [
          { loginId: null },
          { loginId: { $exists: false } }
        ]
      });
      if (deletedNullDocs.deletedCount > 0) {
        console.warn(`[REGISTER WARN] Deleted ${deletedNullDocs.deletedCount} null loginId Business documents before creation`);
      }
      
      // [DEBUG] Business 생성 시도 (명시적으로 변환된 loginId 사용)
      console.log(`[REGISTER DEBUG] Creating Business with loginId: ${loginId}, loginId type: ${typeof loginId}, loginId constructor: ${loginId.constructor.name}`);
      const business = await Business.create({
        loginId: loginId,
        businessName,
        businessNumber
      });
      console.log(`[REGISTER SUCCESS] Business created - businessId: ${business._id}, loginId: ${business.loginId}, loginId type: ${typeof business.loginId}, businessNumber: ${businessNumber}`);
    } catch (error) {
      console.error(`[REGISTER ERROR] Business creation failed - userId: ${user._id}, email: ${email}, businessNumber: ${businessNumber}, error: ${error.message}, code: ${error.code}`);
      
      // [DEBUG] User는 이미 생성되었으므로 삭제해야 함 (데이터 일관성 유지)
      try {
        await User.findByIdAndDelete(user._id);
        console.log(`[REGISTER CLEANUP] Deleted User due to Business creation failure - userId: ${user._id}`);
      } catch (deleteError) {
        console.error(`[REGISTER ERROR] Failed to delete User after Business creation failure - userId: ${user._id}, error: ${deleteError.message}`);
      }
      
      // [DEBUG] 중복 키 에러 (E11000) 처리
      if (error.code === 11000) {
        console.warn(`[REGISTER RETRY] Duplicate key error detected, attempting cleanup and retry - error: ${error.message}`);
        
        // [DEBUG] 중복 키 에러 발생 시, 더 강력하게 정리 후 재시도
        const retryDeleted = await Business.deleteMany({ 
          $or: [
            { loginId: null },
            { loginId: { $exists: false } },
            { loginId: user._id },
            { businessNumber: businessNumber }
          ]
        });
        console.log(`[REGISTER RETRY] Cleaned up ${retryDeleted.deletedCount} Business documents before retry`);
        
        // [DEBUG] 잠시 대기 후 재시도 (인덱스 갱신 시간 확보)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          // [DEBUG] 재시도 시에도 명시적으로 변환된 loginId 사용
          console.log(`[REGISTER DEBUG] Retry creating Business with loginId: ${loginId}, loginId type: ${typeof loginId}`);
          const retryBusiness = await Business.create({
            loginId: loginId,
            businessName,
            businessNumber,
            email:user.email
          });
          console.log(`[REGISTER SUCCESS] Business created on retry - businessId: ${retryBusiness._id}, loginId: ${retryBusiness.loginId}, loginId type: ${typeof retryBusiness.loginId}`);
        } catch (retryError) {
          console.error(`[REGISTER ERROR] Business creation retry failed - userId: ${user._id}, error: ${retryError.message}, code: ${retryError.code}`);
          
          // [DEBUG] 재시도 실패 시 User 삭제하고 에러 throw
          try {
            await User.findByIdAndDelete(user._id);
            console.log(`[REGISTER CLEANUP] Deleted User after retry failure - userId: ${user._id}`);
          } catch (deleteError) {
            console.error(`[REGISTER ERROR] Failed to delete User after retry failure - userId: ${user._id}, error: ${deleteError.message}`);
          }
          
          throw new Error("BUSINESS_CREATION_FAILED");
        }
      } else {
        // [DEBUG] 중복 키 에러가 아닌 다른 에러는 그대로 throw
        console.error(`[REGISTER ERROR] Non-duplicate key error - error: ${error.message}, code: ${error.code}, stack: ${error.stack}`);
        throw error;
      }
    }
  }

  return {
    user: user.toSafeJSON(),
    message: userRole === "business" ? "사업자 회원가입 완료" : "회원가입 완료"
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
  if (user.role === "business") {
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

  // [DEBUG] userId 검증 및 ObjectId 변환
  if (!userId) {
    console.error(`[APPLY_BUSINESS ERROR] userId is null/undefined`);
    throw new Error("USER_ID_MISSING");
  }
  
  let loginId;
  try {
    // userId가 이미 ObjectId인지 확인
    if (userId instanceof mongoose.Types.ObjectId) {
      loginId = userId;
      console.log(`[APPLY_BUSINESS DEBUG] userId is already ObjectId - userId: ${userId}`);
    } else {
      // 문자열이거나 다른 타입인 경우 ObjectId로 변환
      loginId = new mongoose.Types.ObjectId(userId);
      console.log(`[APPLY_BUSINESS DEBUG] Converted userId to ObjectId - original: ${userId}, converted: ${loginId}`);
    }
  } catch (conversionError) {
    console.error(`[APPLY_BUSINESS ERROR] Failed to convert userId to ObjectId - userId: ${userId}, userId type: ${typeof userId}, error: ${conversionError.message}`);
    throw new Error("USER_ID_CONVERSION_FAILED");
  }

  // 현재 사용자 정보 조회
  const user = await User.findById(loginId);
  if (!user) {
    console.error(`[APPLY_BUSINESS ERROR] User not found - userId: ${loginId}`);
    throw new Error("USER_NOT_FOUND");
  }

  // [DEBUG] user._id 확인
  if (!user._id) {
    console.error(`[APPLY_BUSINESS ERROR] User._id is null/undefined - userId: ${loginId}`);
    throw new Error("USER_ID_NOT_FOUND");
  }
  console.log(`[APPLY_BUSINESS DEBUG] User found - userId: ${user._id}, user._id type: ${typeof user._id}, user._id constructor: ${user._id.constructor.name}`);

  // 이미 business role인지 확인
  if (user.role === "business") {
    console.warn(`[APPLY_BUSINESS WARN] User already has business role - userId: ${user._id}`);
    throw new Error("ALREADY_BUSINESS");
  }

  // 이미 Business 문서가 존재하는지 확인
  const existingBusiness = await Business.findOne({ loginId: user._id });
  if (existingBusiness) {
    console.warn(`[APPLY_BUSINESS WARN] Business already exists - userId: ${user._id}, businessId: ${existingBusiness._id}`);
    throw new Error("ALREADY_APPLIED");
  }

  // Business 문서 생성
  try {
    // [DEBUG] 기존 null 값 문서 삭제 (unique 인덱스 충돌 방지)
    const deletedNullDocs = await Business.deleteMany({ 
      $or: [
        { loginId: null },
        { loginId: { $exists: false } }
      ]
    });
    if (deletedNullDocs.deletedCount > 0) {
      console.warn(`[APPLY_BUSINESS WARN] Deleted ${deletedNullDocs.deletedCount} null loginId Business documents before creation`);
    }
    
    // [DEBUG] Business 생성 시도 (user._id를 명시적으로 ObjectId로 변환하여 사용)
    let finalLoginId;
    if (user._id instanceof mongoose.Types.ObjectId) {
      finalLoginId = user._id;
    } else {
      finalLoginId = new mongoose.Types.ObjectId(user._id);
    }
    
    console.log(`[APPLY_BUSINESS DEBUG] Creating Business with loginId: ${finalLoginId}, loginId type: ${typeof finalLoginId}, loginId constructor: ${finalLoginId.constructor.name}`);
    await Business.create({
      loginId: finalLoginId,
      businessName,
      businessNumber
    });
    console.log(`[APPLY_BUSINESS SUCCESS] Business created - userId: ${user._id}, businessNumber: ${businessNumber}`);
  } catch (error) {
    console.error(`[APPLY_BUSINESS ERROR] Business creation failed - userId: ${user._id}, businessNumber: ${businessNumber}, error: ${error.message}, code: ${error.code}`);
    
    if (error.code === 11000) {
      // [DEBUG] 중복 키 에러 발생 시, 더 강력하게 정리 후 재시도
      console.warn(`[APPLY_BUSINESS RETRY] Duplicate key error detected, attempting cleanup and retry - error: ${error.message}`);
      
      const retryDeleted = await Business.deleteMany({ 
        $or: [
          { loginId: null },
          { loginId: { $exists: false } },
          { loginId: user._id },
          { businessNumber: businessNumber }
        ]
      });
      console.log(`[APPLY_BUSINESS RETRY] Cleaned up ${retryDeleted.deletedCount} Business documents before retry`);
      
      // 잠시 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        let retryLoginId;
        if (user._id instanceof mongoose.Types.ObjectId) {
          retryLoginId = user._id;
        } else {
          retryLoginId = new mongoose.Types.ObjectId(user._id);
        }
        
        console.log(`[APPLY_BUSINESS RETRY] Retry creating Business with loginId: ${retryLoginId}`);
        await Business.create({
          loginId: retryLoginId,
          businessName,
          businessNumber
        });
        console.log(`[APPLY_BUSINESS SUCCESS] Business created on retry - userId: ${user._id}, businessNumber: ${businessNumber}`);
      } catch (retryError) {
        console.error(`[APPLY_BUSINESS ERROR] Business creation retry failed - userId: ${user._id}, error: ${retryError.message}, code: ${retryError.code}`);
        throw new Error("BUSINESS_CREATION_FAILED");
      }
    } else {
      throw error;
    }
  }

  // User role을 business로 변경 (승인 대기 상태는 Business 모델에서 관리)
  user.role = "business";
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

