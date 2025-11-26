const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // .env에 설정한 MONGODB_URI 사용
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
    process.exit(1); // 서버 실행 중지
  }
};

module.exports = { connectDB };