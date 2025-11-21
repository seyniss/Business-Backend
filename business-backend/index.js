require('dotenv').config();

const express = require("express");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const mongoose = require("mongoose");

// 라우트
const authRoutes = require("./routes/auth");
const lodgingRoutes = require("./routes/lodgings");
const roomRoutes = require("./routes/rooms");
const bookingRoutes = require("./routes/bookings");  
const statsRoutes = require("./routes/stats");
const uploadRoutes = require('./routes/upload');
const amenityRoutes = require('./routes/amenities');
const noticeRoutes = require('./routes/notices');
const pictureRoutes = require('./routes/pictures');

const app = express();
const PORT = process.env.PORT;

// CORS 설정
app.use(cors({
  origin: process.env.FRONT_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB 연결 성공"))
  .catch((err) => console.error("MongoDB 연결 실패:", err.message));

// 헬스 체크
app.get("/", (_req, res) => res.send("Hotel Booking Business API OK"));

// API 라우트
app.use("/api/auth", authRoutes);
app.use("/api/lodgings", lodgingRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);  
app.use("/api/stats", statsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/amenities", amenityRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/pictures", pictureRoutes);

// 404 핸들러
app.use((req, res, next) => {
  res.status(404).json({ message: '요청하신 경로를 찾을 수 없습니다.' });
});

// JSON 파싱 에러 핸들러
app.use((err, req, res, next) => {
  // JSON 파싱 에러 처리
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON 파싱 에러:', err.message);
    return res.status(400).json({ 
      message: '잘못된 JSON 형식입니다.', 
      error: 'JSON 형식이 올바르지 않습니다. 제어 문자(줄바꿈, 탭 등)가 포함되어 있는지 확인해주세요.',
      detail: err.message 
    });
  }
  
  // 기타 에러 처리
  console.error('Unhandled Error:', err);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({ 
    message: '서버 오류', 
    error: err?.message || String(err) 
  });
});

app.listen(PORT, () => {
  console.log(`Business Backend Server running: http://localhost:${PORT}`);
});

