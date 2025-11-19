const express = require("express");
const router = express.Router();
const Amenity = require("../models/Amenity");  // Facility → Amenity
const Lodging = require("../models/Lodging");
const Business = require("../models/Business");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 편의시설 생성 (숙소 등록 시 함께 생성)
router.post("/", async (req, res) => {
  try {
    const { amenity_name, amenity_detail, lodging_id } = req.body;  // service_name → amenity_name, service_detail → amenity_detail

    if (!amenity_name || !lodging_id) {
      return res.status(400).json({ message: "필수 필드가 누락되었습니다." });
    }

    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    // 숙소 소유권 확인
    const lodging = await Lodging.findOne({
      _id: lodging_id,
      business_id: business._id
    });

    if (!lodging) {
      return res.status(404).json({ message: "숙소를 찾을 수 없습니다." });
    }

    // 기존 편의시설이 있으면 업데이트, 없으면 생성
    let amenity = await Amenity.findById(lodging.amenity_id);  // facility → amenity, facility_id → amenity_id
    
    if (amenity) {
      amenity.amenity_name = amenity_name;
      amenity.amenity_detail = amenity_detail || "";
      await amenity.save();
    } else {
      amenity = await Amenity.create({  // Facility → Amenity
        amenity_name,  // service_name → amenity_name
        amenity_detail: amenity_detail || ""  // service_detail → amenity_detail
      });
      
      // 숙소에 편의시설 ID 연결
      lodging.amenity_id = amenity._id;  // facility_id → amenity_id
      await lodging.save();
    }

    res.status(201).json(amenity);
  } catch (error) {
    console.error("POST /api/amenities 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 숙소별 편의시설 조회
router.get("/lodging/:lodgingId", async (req, res) => {
  try {
    const { lodgingId } = req.params;

    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const lodging = await Lodging.findOne({
      _id: lodgingId,
      business_id: business._id
    });

    if (!lodging) {
      return res.status(404).json({ message: "숙소를 찾을 수 없습니다." });
    }

    if (!lodging.amenity_id) {  // facility_id → amenity_id
      return res.json(null);
    }

    const amenity = await Amenity.findById(lodging.amenity_id);  // Facility → Amenity, facility_id → amenity_id
    res.json(amenity);
  } catch (error) {
    console.error("GET /api/amenities/lodging/:lodgingId 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 편의시설 수정
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const { amenity_name, amenity_detail } = req.body;  // service_name → amenity_name, service_detail → amenity_detail

    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    // 편의시설이 속한 숙소 확인
    const lodging = await Lodging.findOne({
      amenity_id: req.params.id,  // facility_id → amenity_id
      business_id: business._id
    });

    if (!lodging) {
      return res.status(404).json({ message: "편의시설을 찾을 수 없거나 권한이 없습니다." });
    }

    const amenity = await Amenity.findById(req.params.id);  // Facility → Amenity
    if (!amenity) {
      return res.status(404).json({ message: "편의시설을 찾을 수 없습니다." });
    }

    const updates = {};
    if (amenity_name !== undefined) updates.amenity_name = amenity_name;  // service_name → amenity_name
    if (amenity_detail !== undefined) updates.amenity_detail = amenity_detail;  // service_detail → amenity_detail

    const updated = await Amenity.findByIdAndUpdate(  // Facility → Amenity
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (error) {
    console.error("PUT /api/amenities/:id 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;
