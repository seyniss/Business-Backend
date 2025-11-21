const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',  
      required: true,
      index: true
    },
    
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
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
    
    checkin_date: {
      type: Date,
      required: true
    },
    
    checkout_date: {
      type: Date,
      required: true
    },
    
    booking_date: {
      type: Date,
      required: true,
      default: Date.now
    },
    
    booking_status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true
    },
    
    cancellation_reason: {
      type: String,
      trim: true,
      default: null
      // 취소 사유 (booking_status가 'cancelled'일 때만 사용)
    },
    
    payment_status: {
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
bookingSchema.index({ business_id: 1, createdAt: -1 });
bookingSchema.index({ room_id: 1, booking_status: 1 });
bookingSchema.index({ checkin_date: 1, checkout_date: 1 });
bookingSchema.index({ booking_status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
