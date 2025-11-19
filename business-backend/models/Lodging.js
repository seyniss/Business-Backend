const mongoose = require("mongoose");

const lodgingSchema = new mongoose.Schema(
  {
    // 🏨 숙소 기본 정보
    lodging_name: {
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
    
    star_rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 3
    },
    
    description: {
      type: String,
      required: true,
      trim: true
    },
    
    images: {  // image → images로 변경
      type: [String],
      default: [],
      trim: true
      // 숙소 전체 사진 및 편의시설 사진 배열
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
    
    // 👤 리뷰 작성 회원 정보 (숙소 작성자 아님)
    user_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    
    // 📅 예약 정보
    booking_id: {  // reservation_id → booking_id
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',  // Reservation → Booking
      required: false
    },
    
    // #️⃣ 해시태그 (배열로 저장)
    hashtag: {
      type: [String],
      default: [],
      trim: true,
      // 예: ["#한강뷰", "#근처맛집", "#넓은방"]
    },
    
    // 🔗 사업자 참조 (Business 모델과 연결)
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    
    // 🎯 편의시설 정보 (선택사항)
    amenity_id: {  // facility_id → amenity_id
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Amenity',  // Facility → Amenity
      required: false
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'lodgings'
  }
);

// 복합 인덱스
lodgingSchema.index({ business_id: 1, created_at: -1 });
lodgingSchema.index({ country: 1 });
lodgingSchema.index({ category: 1 });
lodgingSchema.index({ star_rating: -1 });
lodgingSchema.index({ amenity_id: 1 });  // facility_id → amenity_id

module.exports = mongoose.model('Lodging', lodgingSchema);

