const mongoose = require("mongoose");

// 결제수단 타입 모델 (카드 결제 고정, 여러 카드 종류 구분용)
const paymentTypeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
      // 예: "신용카드", "체크카드", "하이브리드카드" 등
    },
    typeCode: {
      type: Number,
      required: true,
      unique: true
      // 카드 타입 구분 코드
    }
  },
  {
    timestamps: false,
    collection: 'payment_types'
  }
);

module.exports = mongoose.model('PaymentType', paymentTypeSchema);

