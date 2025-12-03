const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    // 🔐 기본 정보
    name: {
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
    phoneNumber: {
      type: String,
      trim: true,
      default: ""
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },

    // 👤 개인정보
    dateOfBirth: {
      type: Date
    },
    profileImage: {
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
      enum: ["user", "business", "admin"],
      default: "user",
      index: true
    },
    // status: {
    //   type: String,
    //   enum: ["active", "banned", "pending"],
    //   default: "active",
    //   index: true
    // },
    isActive: {
      type: Boolean,
      default: true
    },
    provider: {
      type: String,
      enum: ['local', 'kakao', 'google'],
      default: 'local'
    },

    // 🔒 보안 관련
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lastLoginAttempt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// ----------------------
// 메서드들
// ----------------------
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.setPassword = async function (plain) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject({ versionKey: false });
  delete obj.passwordHash;
  return obj;
};

userSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    return ret;
  }
});

module.exports = mongoose.model("User", userSchema);

