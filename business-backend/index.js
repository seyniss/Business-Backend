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

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ message: '서버 오류', error: err?.message || String(err) });
});

app.listen(PORT, () => {
  console.log(`Business Backend Server running: http://localhost:${PORT}`);
});

