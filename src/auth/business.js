const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema(
  {
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true
    },
    
    // 🔗 User 모델 참조
    login_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    // 🏨 사업자 정보
    business_name: {
      type: String,
      required: true,
      trim: true
    },
    business_number: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      sparse: true
    }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

module.exports = mongoose.model("Business", businessSchema);

