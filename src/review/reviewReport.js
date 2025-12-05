const mongoose = require("mongoose");

const reviewReportSchema = new mongoose.Schema(
  {
    // 신고된 리뷰
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
      required: true,
      index: true
    },
    
    // 신고한 사업자
    businessUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessUser',
      required: true,
      index: true
    },
    
    // 신고 사유
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    
    // 신고 상태
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'rejected'],
      default: 'pending',
      index: true
    },
    
    // 관리자 응답
    adminResponse: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null
    },
    
    // 관리자 처리 시간
    reviewedAt: {
      type: Date,
      default: null
    },
    
    // 처리한 관리자 ID
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessUser',
      default: null
    }
  },
  {
    timestamps: { createdAt: 'reportedAt', updatedAt: 'updatedAt' },
    collection: 'review_reports'
  }
);

// 복합 인덱스
reviewReportSchema.index({ businessUserId: 1, status: 1, reportedAt: -1 });
reviewReportSchema.index({ reviewId: 1, businessUserId: 1 }, { unique: true }); // 같은 리뷰에 대한 중복 신고 방지

module.exports = mongoose.model('ReviewReport', reviewReportSchema);

