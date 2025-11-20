const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Business = require("../models/Business");
const { authenticateToken } = require('../middlewares/auth');

const LOCK_MAX = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10분

function makeToken(user) {
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
}

// 회원가입 (USER만 가능)
router.post("/register", async (req, res) => {
  try {
    const { 
      email, 
      password, 
      user_name, 
      phone, 
      date_of_birth,
      address,
      profile_image
    } = req.body;

    // 필수 필드 검증
    if (!email || !password || !user_name) {
      return res.status(400).json({ message: "이메일/비밀번호/이름은 필수입니다." });
    }

    // 이메일 중복 검사
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "이미 가입된 이메일" });
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

    res.status(201).json({ 
      user: user.toSafeJSON(),
      message: "회원가입 완료"
    });
  } catch (error) {
    return res.status(500).json({
      message: "회원가입 실패",
      error: error.message
    });
  }
});

// 로그인
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase();
    const password = String(req.body?.password || "");

    const invalidMsg = { message: "이메일 또는 비밀번호가 올바르지 않습니다." };

    if (!email || !password) {
      return res.status(400).json({
        ...invalidMsg,
        remainingAttempts: null,
        locked: false
      });
    }

    const user = await User.findOne({ email }).select("+password +status +failedLoginAttempts +lastLoginAttempt +tokenVersion");

    if (!user) {
      return res.status(401).json({
        ...invalidMsg,
        loginAttempts: null,
        remainingAttempts: null,
        locked: false
      });
    }

    // 계정 상태 확인
    if (user.status === "suspended") {
      return res.status(403).json({
        message: "계정이 정지되었습니다. 관리자에게 문의하세요.",
        locked: true
      });
    }

    if (user.status === "inactive") {
      return res.status(403).json({
        message: "비활성화된 계정입니다.",
        locked: true
      });
    }

    // 사업자인 경우 승인 상태 확인
    if (user.role === "BUSINESS" && user.status === "pending") {
      return res.status(403).json({
        message: "관리자 승인 대기 중입니다. 승인 후 로그인 가능합니다.",
        locked: false
      });
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
      const remainMin = Math.ceil(remainMs / 60000);

      return res.status(423).json({
        message:
          remainMs > 0
            ? `계정이 잠금 상태입니다. 약 ${remainMin}분 후 다시 시도해 주세요.`
            : "계정이 잠금 상태입니다. 관리자에게 문의하세요.",
        locked: true
      });
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

        return res.status(423).json({
          message: "유효성 검증 실패로 계정이 잠겼습니다. 관리자에게 문의하세요.",
          loginAttempts: user.failedLoginAttempts,
          remainingAttempts: 0,
          locked: true
        });
      }

      const remaining = Math.max(0, LOCK_MAX - user.failedLoginAttempts);
      await user.save();

      return res.status(400).json({
        ...invalidMsg,
        loginAttempts: user.failedLoginAttempts,
        remainingAttempts: remaining,
        locked: false
      });
    }

    // 로그인 성공: 실패 카운트 초기화 및 토큰 버전 증가 (이전 세션 무효화)
    user.failedLoginAttempts = 0;
    user.lastLoginAttempt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // JWT 발급 및 쿠키 설정
    const token = makeToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // 성공 응답
    return res.status(200).json({
      user: user.toSafeJSON(),
      token,
      loginAttempts: 0,
      remainingAttempts: LOCK_MAX,
      locked: false
    });
  } catch (error) {
    return res.status(500).json({
      message: "로그인 실패",
      error: error.message
    });
  }
});

// 인증 필요 라우트
router.use(authenticateToken);

// 내 정보 조회
router.get("/me", async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "사용자 정보 없음" });

    const responseData = {
      user: user.toSafeJSON()
    };

    // 역할에 따라 추가 데이터 반환
    if (user.role === "BUSINESS") {
      const business = await Business.findOne({ login_id: user._id });
      responseData.business = business || null;
    }
    // ADMIN 역할도 필요시 여기에 추가 가능

    return res.status(200).json(responseData);
  } catch (error) {
    res.status(401).json({ message: "조회 실패", error: error.message });
  }
});

// 로그아웃
router.post("/logout", async (req, res) => {
  try {
    // 토큰 버전 증가 (이전 토큰 무효화)
    await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { tokenVersion: 1 } },
      { new: true }
    );

    res.clearCookie('token', {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: '/'
    });

    return res.status(200).json({ message: '로그아웃 성공' });
  } catch (error) {
    return res.status(500).json({ message: '로그아웃 실패', error: error.message });
  }
});

// 사업자 신청
router.post("/apply-business", async (req, res) => {
  try {
    const { business_name, business_number } = req.body;
    const userId = req.user.id;

    // 필수 필드 검증
    if (!business_name || !business_number) {
      return res.status(400).json({ message: "사업자명과 사업자등록번호는 필수입니다." });
    }

    // 현재 사용자 정보 조회
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "사용자 정보를 찾을 수 없습니다." });
    }

    // 이미 BUSINESS role인지 확인
    if (user.role === "BUSINESS") {
      return res.status(400).json({ message: "이미 사업자로 등록되어 있습니다." });
    }

    // 이미 Business 문서가 존재하는지 확인
    const existingBusiness = await Business.findOne({ login_id: userId });
    if (existingBusiness) {
      return res.status(400).json({ message: "이미 사업자 신청이 완료되었습니다." });
    }

    // Business 문서 생성
    await Business.create({
      login_id: userId,
      business_name,
      business_number
    });

    // User role을 BUSINESS로, status를 pending으로 변경
    // 토큰 무효화를 위해 tokenVersion도 증가
    user.role = "BUSINESS";
    user.status = "pending";
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(201).json({
      message: "사업자 신청이 완료되었습니다. 관리자 승인 대기 중입니다.",
      user: user.toSafeJSON()
    });
  } catch (error) {
    // 사업자등록번호 중복 에러 처리
    if (error.code === 11000 && error.keyPattern?.business_number) {
      return res.status(400).json({ message: "이미 등록된 사업자등록번호입니다." });
    }
    
    return res.status(500).json({
      message: "사업자 신청 실패",
      error: error.message
    });
  }
});

module.exports = router;
