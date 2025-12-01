const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      unique: true,
      index: true
    },
    content: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },
    usageGuide: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },
    introduction: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    }
  },
  {
    timestamps: false,
    collection: 'notice'
  }
);

module.exports = mongoose.model('Notice', noticeSchema);

