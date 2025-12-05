const mongoose = require("mongoose");

const amenitySchema = new mongoose.Schema(
  {
    // 숙소 참조
    lodgingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lodging',
      required: true,
      unique: true,
      index: true
    },
    
    // 편의시설 옵션들
    bbqGrill: {
      type: Boolean,
      default: false
    },
    netflix: {
      type: Boolean,
      default: false
    },
    swimmingPool: {
      type: Boolean,
      default: false
    },
    parking: {
      type: Boolean,
      default: false
    },
    wifi: {
      type: Boolean,
      default: false
    },
    kitchen: {
      type: Boolean,
      default: false
    },
    pc: {
      type: Boolean,
      default: false
    },
    tv: {
      type: Boolean,
      default: false
    },
    ac: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    collection: 'amenities'
  }
);

amenitySchema.index({ lodgingId: 1 });

module.exports = mongoose.model('Amenity', amenitySchema);

