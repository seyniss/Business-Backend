const mongoose = require("mongoose");

const amenitySchema = new mongoose.Schema(
  {
    amenityName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    amenityDetail: {
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

