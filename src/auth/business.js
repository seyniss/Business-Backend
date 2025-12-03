const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema(
  {
    // 🔗 User 모델 참조
    loginId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      sparse: true
    },

    // 🏨 사업자 정보
    businessName: {
      type: String,
      required: true,
      trim: true
    },
    businessNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      sparse: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Business", businessSchema);

