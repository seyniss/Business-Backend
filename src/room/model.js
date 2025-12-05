const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    lodgingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lodging',
      required: true,
      index: true
    },
    
    // 실제 데이터 필드명
    roomName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    
    // 호환성을 위한 필드 (roomName의 별칭)
    name: {
      type: String,
      trim: true,
      maxlength: 100
    },
    
    type: {
      type: String,
      enum: ['standard', 'deluxe', 'suite'],
      default: 'standard',
      trim: true,
      required: false
    },
    
    roomSize: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    
    capacityMin: {
      type: Number,
      required: true,
      min: 1
    },
    
    // 실제 데이터 필드명
    capacityMax: {
      type: Number,
      required: true,
      min: 1
    },
    
    // 호환성을 위한 필드 (capacityMax의 별칭)
    maxGuests: {
      type: Number,
      min: 1
    },
    
    checkInTime: {
      type: String,
      required: true,
      default: "15:00"
    },
    
    checkOutTime: {
      type: String,
      required: true,
      default: "11:00"
    },
    
    // 실제 데이터 필드명
    roomImage: {
      type: String,
      trim: true,
      default: ""
    },
    
    // 호환성을 위한 필드 (roomImage를 배열로 변환)
    images: {
      type: [String],
      default: [],
      trim: true
    },
    
    amenities: {
      type: [String],
      default: [],
      trim: true
    },
    
    description: {
      type: String,
      trim: true,
      default: ""
    },
    
    price: {
      type: Number,
      required: true,
      min: 0
    },
    
    // 실제 데이터 필드명
    countRoom: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    
    // 호환성을 위한 필드 (countRoom의 별칭)
    quantity: {
      type: Number,
      min: 1,
      default: 1
    },
    
    ownerDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    platformDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active',
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'rooms'
  }
);

roomSchema.index({ lodgingId: 1, createdAt: -1 });

// 호환성을 위한 pre-save 훅: name, maxGuests, quantity, images 자동 설정
roomSchema.pre('save', function(next) {
  // roomName이 있으면 name에도 설정
  if (this.roomName && !this.name) {
    this.name = this.roomName;
  }
  // name이 있으면 roomName에도 설정
  if (this.name && !this.roomName) {
    this.roomName = this.name;
  }
  
  // capacityMax가 있으면 maxGuests에도 설정
  if (this.capacityMax && !this.maxGuests) {
    this.maxGuests = this.capacityMax;
  }
  // maxGuests가 있으면 capacityMax에도 설정
  if (this.maxGuests && !this.capacityMax) {
    this.capacityMax = this.maxGuests;
  }
  
  // countRoom이 있으면 quantity에도 설정
  if (this.countRoom && !this.quantity) {
    this.quantity = this.countRoom;
  }
  // quantity가 있으면 countRoom에도 설정
  if (this.quantity && !this.countRoom) {
    this.countRoom = this.quantity;
  }
  
  // roomImage가 있으면 images 배열에도 추가
  if (this.roomImage && (!this.images || this.images.length === 0)) {
    this.images = [this.roomImage];
  }
  // images 배열의 첫 번째 요소를 roomImage로 설정
  if (this.images && this.images.length > 0 && !this.roomImage) {
    this.roomImage = this.images[0];
  }
  
  next();
});

module.exports = mongoose.model('Room', roomSchema);

