const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    lodging_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lodging',
      required: true,
      index: true
    },
    
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    
    booking_id: {
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
    
    blocked_at: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'reviews'
  }
);

reviewSchema.index({ lodging_id: 1, status: 1, created_at: -1 });
reviewSchema.index({ user_id: 1, created_at: -1 });
reviewSchema.index({ booking_id: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);

