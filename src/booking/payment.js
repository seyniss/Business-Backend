const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
      index: true
    },
    paymentTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentType',
      required: true
      // 사용된 카드 타입 (신용카드, 체크카드 등)
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    paid: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    timestamps: true,
    collection: 'payments'
  }
);

module.exports = mongoose.model('Payment', paymentSchema);

