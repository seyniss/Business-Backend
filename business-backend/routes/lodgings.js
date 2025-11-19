const express = require("express");
const router = express.Router();
const Lodging = require("../models/Lodging");
const Amenity = require("../models/Amenity");
const OwnHotel = require("../models/OwnHotel");
const Booking = require("../models/Booking");
const Business = require("../models/Business");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");


// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 내 숙소 목록 조회
router.get("/", async (req, res) => {
  try {
    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const lodgings = await Lodging.find({ business_id: business._id })
      .populate('amenity_id')
      .sort({ created_at: -1 })
      .lean();

    res.json(lodgings);
  } catch (error) {
    console.error("GET /api/lodgings 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 숙소 상세 조회
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const lodging = await Lodging.findOne({
      _id: req.params.id,
      business_id: business._id
    })
      .populate('amenity_id')
      .populate('booking_id');

    if (!lodging) {
      return res.status(404).json({ message: "숙소를 찾을 수 없습니다." });
    }

    res.json(lodging);
  } catch (error) {
    console.error("GET /api/lodgings/:id 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 숙소 생성
router.post("/", async (req, res) => {
  try {
    const {
      lodging_name,
      address,
      star_rating,
      description,
      images,  // image → images
      country,
      category,
      user_name,
      hashtag,
      amenity_name,  // service_name → amenity_name
      amenity_detail  // service_detail → amenity_detail
    } = req.body;

    // 필수 필드 검증
    if (!lodging_name || !address || !star_rating || !description || !images || !country || !category || !user_name) {
      return res.status(400).json({ message: "필수 필드가 누락되었습니다." });
    }

    // images 배열 검증
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: "이미지는 최소 1개 이상 필요합니다." });
    }

    // star_rating 범위 검증
    if (star_rating < 1 || star_rating > 5) {
      return res.status(400).json({ message: "별점은 1~5 사이의 값이어야 합니다." });
    }

    // category 검증
    const validCategories = ["호텔", "모텔", "리조트", "게스트하우스", "에어비앤비"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: `카테고리는 다음 중 하나여야 합니다: ${validCategories.join(", ")}` });
    }

    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    // 편의시설 생성 (선택사항)
    let amenity = null;
    if (amenity_name) {
      amenity = await Amenity.create({
        amenity_name,
        amenity_detail: amenity_detail || ""
      });
    }

    // 해시태그 배열로 변환
    let hashtagArray = [];
    if (hashtag) {
      if (Array.isArray(hashtag)) {
        hashtagArray = hashtag;
      } else if (typeof hashtag === 'string') {
        // 쉼표나 공백으로 구분된 문자열을 배열로 변환
        hashtagArray = hashtag.split(/[,\s]+/).filter(tag => tag.length > 0);
      }
    }

    // images 배열 처리
    let imagesArray = [];
    if (Array.isArray(images)) {
      imagesArray = images.filter(img => img && img.trim().length > 0);
    } else if (typeof images === 'string') {
      imagesArray = [images];
    }

    const lodging = await Lodging.create({
      business_id: business._id,
      lodging_name,
      address,
      star_rating,
      description,
      images: imagesArray,  // image → images
      country,
      category,
      user_name,
      hashtag: hashtagArray,
      amenity_id: amenity ? amenity._id : null
    });

    const createdLodging = await Lodging.findById(lodging._id)
      .populate('amenity_id');

    res.status(201).json(createdLodging);
  } catch (error) {
    console.error("POST /api/lodgings 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 숙소 수정
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const lodging = await Lodging.findOne({
      _id: req.params.id,
      business_id: business._id
    });

    if (!lodging) {
      return res.status(404).json({ message: "숙소를 찾을 수 없습니다." });
    }

    const {
      lodging_name,
      address,
      star_rating,
      description,
      images,  // image → images
      country,
      category,
      user_name,
      hashtag,
      amenity_name,  // service_name → amenity_name
      amenity_detail  // service_detail → amenity_detail
    } = req.body;

    // 유효성 검증
    if (star_rating !== undefined && (star_rating < 1 || star_rating > 5)) {
      return res.status(400).json({ message: "별점은 1~5 사이의 값이어야 합니다." });
    }

    const validCategories = ["호텔", "모텔", "리조트", "게스트하우스", "에어비앤비"];
    if (category !== undefined && !validCategories.includes(category)) {
      return res.status(400).json({ message: `카테고리는 다음 중 하나여야 합니다: ${validCategories.join(", ")}` });
    }

    const updates = {};
    if (lodging_name !== undefined) updates.lodging_name = lodging_name;
    if (address !== undefined) updates.address = address;
    if (star_rating !== undefined) updates.star_rating = star_rating;
    if (description !== undefined) updates.description = description;
    if (images !== undefined) {
      if (Array.isArray(images)) {
        updates.images = images.filter(img => img && img.trim().length > 0);
      } else if (typeof images === 'string') {
        updates.images = [images];
      }
    }
    if (country !== undefined) updates.country = country;
    if (category !== undefined) updates.category = category;
    if (user_name !== undefined) updates.user_name = user_name;
    if (hashtag !== undefined) {
      if (Array.isArray(hashtag)) {
        updates.hashtag = hashtag;
      } else if (typeof hashtag === 'string') {
        updates.hashtag = hashtag.split(/[,\s]+/).filter(tag => tag.length > 0);
      }
    }
    if (amenity_name !== undefined) {
      if (amenity_name) {
        updates.amenity_id = await Amenity.create({
          amenity_name,
          amenity_detail: amenity_detail || ""
        })._id;
      } else {
        updates.amenity_id = null;
      }
    }

    const updated = await Lodging.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('amenity_id');

    res.json(updated);
  } catch (error) {
    console.error("PUT /api/lodgings/:id 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 숙소 삭제
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const lodging = await Lodging.findOne({
      _id: req.params.id,
      business_id: business._id
    });

    if (!lodging) {
      return res.status(404).json({ message: "숙소를 찾을 수 없습니다." });
    }

    // 예약이 있는지 확인
    const hasBookings = await Booking.exists({ lodging_id: req.params.id });
    if (hasBookings) {
      return res.status(400).json({ message: "예약이 있어 숙소를 삭제할 수 없습니다." });
    }

    // 소유 숙소도 함께 삭제 (있는 경우)
    await OwnHotel.deleteMany({ hotel_id: req.params.id });
    await lodging.deleteOne();

    res.json({ ok: true, id: lodging._id });
  } catch (error) {
    console.error("DELETE /api/lodgings/:id 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;

