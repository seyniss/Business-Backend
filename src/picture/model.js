const mongoose = require("mongoose");

const roomPictureSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true
    },
    pictureName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    pictureUrl: {
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

roomPictureSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('RoomPicture', roomPictureSchema);

