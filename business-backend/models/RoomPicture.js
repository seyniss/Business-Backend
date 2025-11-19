const mongoose = require("mongoose");

const roomPictureSchema = new mongoose.Schema(
  {
    // ERD: room_pictures 테이블
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true
    },
    picture_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    picture_url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    }
  },
  {
    timestamps: true,
    collection: 'room_pictures'
  }
);

roomPictureSchema.index({ room_id: 1, createdAt: -1 });

module.exports = mongoose.model('RoomPicture', roomPictureSchema);
