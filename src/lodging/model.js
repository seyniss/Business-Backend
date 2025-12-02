const mongoose = require("mongoose");

const lodgingSchema = new mongoose.Schema(
  {
    // 🏨 숙소 기본 정보
    lodgingName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 3
    },
    
    reviewCount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    minPrice: {
      type: Number,
      min: 0
    },
    
    // 🗺️ 지도 좌표
    lat: {
      type: Number,
      required: true
    },
    
    lng: {
      type: Number,
      required: true
    },
    
    description: {
      type: String,
      required: true,
      trim: true
    },
    
    images: {
      type: [String],
      default: [],
      trim: true
    },
    
    // 🌍 위치 정보
    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    
    // 🏠 숙소 종류
    category: {
      type: String,
      enum: ["호텔", "모텔", "리조트", "게스트하우스", "에어비앤비"],
      required: true
    },
    
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: false
    },
    
    // #️⃣ 해시태그 (배열로 저장)
    hashtag: {
      type: [String],
      default: [],
      trim: true,
    },
    
    // 🔗 사업자 참조 (Business 모델과 연결)
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    
    amenityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Amenity',
      required: false
    }
  },
  {
    timestamps: true,
    collection: 'lodgings'
  }
);

// 복합 인덱스
lodgingSchema.index({ businessId: 1, createdAt: -1 });
lodgingSchema.index({ country: 1 });
lodgingSchema.index({ category: 1 });
lodgingSchema.index({ rating: -1 });
lodgingSchema.index({ amenityId: 1 });
// 지도 좌표를 위한 2dsphere 인덱스 (지도 API 쿼리 최적화)
lodgingSchema.index({ lat: 1, lng: 1 });

module.exports = mongoose.model('Lodging', lodgingSchema);

