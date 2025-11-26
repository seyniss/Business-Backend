const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    lodging_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lodging',
      required: true,
      index: true
    },
    
    room_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    
    room_size: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    
    capacity_min: {
      type: Number,
      required: true,
      min: 1
    },
    
    capacity_max: {
      type: Number,
      required: true,
      min: 1
    },
    
    check_in_time: {
      type: String,
      required: true,
      default: "15:00"
    },
    
    check_out_time: {
      type: String,
      required: true,
      default: "11:00"
    },
    
    room_image: {
      type: String,
      trim: true
    },
    
    price: {
      type: Number,
      required: true,
      min: 0
    },
    
    count_room: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    
    owner_discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    platform_discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  {
    timestamps: true,
    collection: 'rooms'
  }
);

roomSchema.index({ lodging_id: 1, createdAt: -1 });

module.exports = mongoose.model('Room', roomSchema);

