const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const businessUserSchema = new mongoose.Schema(
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
      required: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },

    // 🔑 권한 및 상태
    role: {
      type: String,
      enum: ["business", "admin"],
      default: "business",
      index: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    provider: {
      type: String,
      enum: ['local', 'kakao', 'google'],
      default: 'local'
    },

    // 🏢 사업자 정보
    businessName: {
      type: String,
      trim: true
    },
    businessNumber: {
      type: String,
      trim: true,
      unique: true,
      required: true
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
// 검증 로직
// ----------------------
// businessNumber는 필수, businessName이 없으면 name을 사용
businessUserSchema.pre('validate', function(next) {
  if (!this.businessNumber) {
    return next(new Error('사업자등록번호는 필수입니다.'));
  }
  // businessName이 없으면 name을 사용
  if (!this.businessName) {
    this.businessName = this.name;
  }
  next();
});

// ----------------------
// 메서드들
// ----------------------
businessUserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

businessUserSchema.methods.setPassword = async function (plain) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

businessUserSchema.methods.toSafeJSON = function () {
  const obj = this.toObject({ versionKey: false });
  delete obj.passwordHash;
  return obj;
};

businessUserSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    return ret;
  }
});

module.exports = mongoose.model("BusinessUser", businessUserSchema);

