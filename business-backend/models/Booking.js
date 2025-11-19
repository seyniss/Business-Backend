const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    // ERD: bookings 테이블 (reservations → bookings)
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
    
    booking_date: {  // reservation_date → booking_date
      type: Date,
      required: true,
      default: Date.now
    },
    
    booking_status: {  // reservation_status → booking_status
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true
    },
    
    // ERD에 없지만 비즈니스 로직을 위해 유지할 필드
    duration: {
      type: Number,
      required: true,
      min: 1
    }
  },
  {
    timestamps: true,
    collection: 'bookings'  // reservations → bookings
  }
);

// 인덱스
bookingSchema.index({ business_id: 1, createdAt: -1 });
bookingSchema.index({ room_id: 1, booking_status: 1 });  // reservation_status → booking_status
bookingSchema.index({ checkin_date: 1, checkout_date: 1 });
bookingSchema.index({ booking_status: 1 });  // reservation_status → booking_status

module.exports = mongoose.model('Booking', bookingSchema);
