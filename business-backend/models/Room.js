const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    // ERD: Room 테이블
    lodging_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lodging',
      required: true,
      index: true
    },
    
    // ERD 필드
    room_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
      // ERD: ENUM (객실종류: 스위트룸, 디럭스룸 등)
    },
    
    room_size: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
      // ERD: Varchar(50), 객실크기 (예: "30㎡")
    },
    
    capacity_min: {
      type: Number,
      required: true,
      min: 1
      // ERD: Integer, 기준인원
    },
    
    capacity_max: {
      type: Number,
      required: true,
      min: 1
      // ERD: Integer, 최대인원
    },
    
    check_in_time: {
      type: String,
      required: true,
      default: "15:00"
      // ERD: Time, 입실시간
    },
    
    check_out_time: {
      type: String,
      required: true,
      default: "11:00"
      // ERD: Time, 퇴실시간
    },
    
    room_image: {
      type: String,
      trim: true
      // ERD: Text, 객실 이미지
    },
    
    // ERD에 없지만 비즈니스 로직을 위해 유지할 필드들
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
    collection: 'rooms'  // own_hotels → rooms
  }
);

roomSchema.index({ lodging_id: 1, createdAt: -1 });

module.exports = mongoose.model('Room', roomSchema);

