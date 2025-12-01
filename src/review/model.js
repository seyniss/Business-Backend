const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    lodgingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lodging',
      required: true,
      index: true
    },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true
    },
    
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    
    images: {
      type: [String],
      default: [],
      trim: true
    },
    
    status: {
      type: String,
      enum: ['active', 'blocked'],
      default: 'active',
      index: true
    },
    
    blockedAt: {
      type: Date,
      default: null
    },
    
    reply: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000
    },
    
    replyDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'reviews'
  }
);

reviewSchema.index({ lodgingId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ bookingId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);

