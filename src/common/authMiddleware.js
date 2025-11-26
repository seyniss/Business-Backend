// JWT 토큰을 검사하여 인증된 사용자인지 판별하는 미들웨어
// 인증 필요한 API에서만 적용 (예: 예약 생성, 예약 조회 등)

const jwt = require("jsonwebtoken");
const User = require("../auth/model");
const { errorResponse } = require("./response");

const authenticateToken = async (req, res, next) => {
  let token = null;

  // 1️⃣ Authorization 헤더에서 추출
  const h = req.headers.authorization || '';
  if (h.toLowerCase().startsWith('bearer')) token = h.slice(7).trim();

  // 2️⃣ 쿠키에서 추출
  if (req.cookies?.token) token = req.cookies.token;

  if (!token) {
    return res.status(401).json(errorResponse("NO_TOKEN_PROVIDED", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3️⃣ DB에서 사용자 조회 및 토큰 버전 검증
    const user = await User.findById(decoded.id).select('tokenVersion status role');
    
    if (!user) {
      return res.status(401).json(errorResponse("USER_NOT_FOUND", 401));
    }
    
    if (user.status === "suspended") {
      return res.status(403).json(errorResponse("ACCOUNT_SUSPENDED", 403));
    }
    
    if (user.status === "inactive") {
      return res.status(403).json(errorResponse("ACCOUNT_INACTIVE", 403));
    }
    
    // 토큰 버전 검증 (로그아웃 시 버전이 증가하면 이전 토큰 무효화)
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(403).json(errorResponse("TOKEN_EXPIRED", 403));
    }
    
    // DB에서 조회한 사용자 정보를 req.user에 추가
    req.user = {
      ...decoded,
      role: user.role  // DB에서 조회한 role 추가
    };
    next();
  } catch (err) {
    console.error("❌ Invalid token:", err.message);
    return res.status(401).json(errorResponse("INVALID_OR_EXPIRED_TOKEN", 401));
  }
};

// 역할 기반 권한 체크 미들웨어
const requireRole = (role) => (req, res, next) => {
  const r = req.user?.role;

  if (r === role) return next();

  return res.status(403).json(errorResponse(`${role} 권한이 필요합니다.`, 403));
};

const requireBusiness = (req, res, next) => {
  if (req.user?.role === 'BUSINESS') return next();
  return res.status(403).json(errorResponse('사업자 권한이 필요합니다.', 403));
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role === 'ADMIN') return next();
  return res.status(403).json(errorResponse('관리자 권한이 필요합니다.', 403));
};

module.exports = { authenticateToken, requireRole, requireBusiness, requireAdmin };
