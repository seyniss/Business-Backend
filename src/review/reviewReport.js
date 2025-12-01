const mongoose = require("mongoose");

const reviewReportSchema = new mongoose.Schema(
  {
    // 신고된 리뷰
    review_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
      required: true,
      index: true
    },
    
    // 신고한 사업자
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
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
    admin_response: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null
    },
    
    // 관리자 처리 시간
    reviewed_at: {
      type: Date,
      default: null
    },
    
    // 처리한 관리자 ID
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: { createdAt: 'reported_at', updatedAt: 'updated_at' },
    collection: 'review_reports'
  }
);

// 복합 인덱스
reviewReportSchema.index({ business_id: 1, status: 1, reported_at: -1 });
reviewReportSchema.index({ review_id: 1, business_id: 1 }, { unique: true }); // 같은 리뷰에 대한 중복 신고 방지

module.exports = mongoose.model('ReviewReport', reviewReportSchema);

