const mongoose = require("mongoose");

const amenitySchema = new mongoose.Schema(
  {
    amenity_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    amenity_detail: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    }
  },
  {
    timestamps: false,
    collection: 'amenities'
  }
);

module.exports = mongoose.model('Amenity', amenitySchema);

