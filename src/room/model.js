const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    lodgingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lodging',
      required: true,
      index: true
    },
    
    roomName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
     
    roomSize: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    
    capacityMin: {
      type: Number,
      required: true,
      min: 1
    },
    
    capacityMax: {
      type: Number,
      required: true,
      min: 1
    },
    
    checkInTime: {
      type: String,
      required: true,
      default: "15:00"
    },
    
    checkOutTime: {
      type: String,
      required: true,
      default: "11:00"
    },
    
    roomImage: {
      type: String,
      trim: true
    },
    
    price: {
      type: Number,
      required: true,
      min: 0
    },
    
    countRoom: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    
    ownerDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    platformDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active',
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'rooms'
  }
);

roomSchema.index({ lodgingId: 1, createdAt: -1 });

module.exports = mongoose.model('Room', roomSchema);

