const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema(
  {
    room_id: {
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
    usage_guide: {
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

