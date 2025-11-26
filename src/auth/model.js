const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    // 🔐 기본 정보
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true
    },
    user_name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, "유효한 이메일"],
      unique: true
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    password: {
      type: String,
      required: true,
      select: false
    },

    // 👤 개인정보
    date_of_birth: {
      type: Date
    },
    profile_image: {
      type: String,
      trim: true,
      default: ""
    },
    address: {
      type: String,
      trim: true,
      default: ""
    },

    // 🔑 권한 및 상태
    role: {
      type: String,
      enum: ["USER", "BUSINESS", "ADMIN"],
      default: "USER",
      index: true
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "pending"],
      default: "active",
      index: true
    },

    // 🔒 보안 관련
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lastLoginAttempt: {
      type: Date
    },
    tokenVersion: {
      type: Number,
      default: 0,
      index: true
    }
  },
  {
    timestamps: { createdAt: "created_on", updatedAt: "updated_on" }
  }
);

// ----------------------
// 메서드들
// ----------------------
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.setPassword = async function (plain) {
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(plain, salt);
};

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject({ versionKey: false });
  delete obj.password;
  return obj;
};

userSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model("User", userSchema);

