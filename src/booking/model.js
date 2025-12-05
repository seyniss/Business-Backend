const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',  
      required: true,
      index: true
    },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessUser',
      required: true,
      index: true
    },
    
    businessUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessUser',
      required: true,
      index: true
    },
    
    // ERD 필드
    adult: {
      type: Number,
      default: 0,
      min: 0
    },
    
    child: {
      type: Number,
      default: 0,
      min: 0
    },
    
    checkinDate: {
      type: Date,
      required: true
    },
    
    checkoutDate: {
      type: Date,
      required: true
    },
    
    bookingDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    
    bookingStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true
    },
    
    cancellationReason: {
      type: String,
      trim: true,
      default: null
      // 취소 사유 (bookingStatus가 'cancelled'일 때만 사용)
    },
    
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'failed'],
      default: 'pending',
      index: true
      // 결제 상태
    },
    
    duration: {
      type: Number,
      required: true,
      min: 1
    }
  },
  {
    timestamps: true,
    collection: 'bookings'
  }
);

// 인덱스
bookingSchema.index({ businessUserId: 1, createdAt: -1 });
bookingSchema.index({ roomId: 1, bookingStatus: 1 });
bookingSchema.index({ checkinDate: 1, checkoutDate: 1 });
bookingSchema.index({ bookingStatus: 1 });
// 날짜 겹침 쿼리 최적화를 위한 복합 인덱스
bookingSchema.index({ roomId: 1, bookingStatus: 1, checkinDate: 1, checkoutDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);

