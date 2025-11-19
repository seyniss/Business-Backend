const mongoose = require("mongoose");

const amenitySchema = new mongoose.Schema(
  {
    // ERD: hotel_amenities 테이블
    amenity_name: {  // service_name → amenity_name (ERD에 맞춰서)
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    amenity_detail: {  // service_detail → amenity_detail
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    }
  },
  {
    timestamps: false,
    collection: 'amenities'  // facilities → amenities
  }
);

module.exports = mongoose.model('Amenity', amenitySchema);
