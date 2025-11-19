const express = require("express");
const router = express.Router();
const OwnHotel = require("../models/OwnHotel");
const OwnHotelPicture = require("../models/OwnHotelPicture");
const Notice = require("../models/Notice");
const Booking = require("../models/Booking");
const Lodging = require("../models/Lodging");
const Business = require("../models/Business");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");

const S3_BASE_URL =
  process.env.S3_BASE_URL ||
  `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;

function joinS3Url(base, key) {
  const b = String(base || "").replace(/\/+$/, "");
  const k = String(key || "").replace(/^\/+/, "");
  return `${b}/${k}`;
}

function processImageUrls(room) {
  const roomObj = room.toObject ? room.toObject() : room;
  
  if (roomObj.image && !roomObj.image.startsWith('http')) {
    roomObj.image = joinS3Url(S3_BASE_URL, roomObj.image);
  }
  
  if (Array.isArray(roomObj.images)) {
    roomObj.images = roomObj.images.map(img => 
      img.startsWith('http') ? img : joinS3Url(S3_BASE_URL, img)
    );
  }
  
  return roomObj;
}

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 숙소별 소유 숙소 목록 조회
router.get("/lodging/:lodgingId", async (req, res) => {
  try {
    const { lodgingId } = req.params;

    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    // 숙소 소유권 확인
    const lodging = await Lodging.findOne({
      _id: lodgingId,
      business_id: business._id
    });

    if (!lodging) {
      return res.status(404).json({ message: "숙소를 찾을 수 없습니다." });
    }

    const ownHotels = await OwnHotel.find({ hotel_id: lodgingId })
      .populate('hotel_id', 'lodging_name address country')
      .sort({ createdAt: -1 })
      .lean();

    // 각 소유 숙소의 사진과 공지사항 포함
    const ownHotelsWithDetails = await Promise.all(
      ownHotels.map(async (ownHotel) => {
        const [pictures, notice] = await Promise.all([
          OwnHotelPicture.find({ own_hotel_id: ownHotel._id }).lean(),
          Notice.findOne({ own_hotel_id: ownHotel._id }).lean()
        ]);

        return {
          ...ownHotel,
          pictures: pictures.map(p => ({
            picture_name: p.picture_name,
            picture_url: processImageUrls({ image: p.picture_url }).image
          })),
          notice: notice || null
        };
      })
    );

    res.json(ownHotelsWithDetails);
  } catch (error) {
    console.error("GET /api/rooms/hotel/:hotelId 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 소유 숙소 상세 조회
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const ownHotel = await OwnHotel.findById(req.params.id)
      .populate('hotel_id');

    if (!ownHotel) {
      return res.status(404).json({ message: "소유 숙소를 찾을 수 없습니다." });
    }

    // 호텔 소유권 확인
    const hotel = await Hotel.findById(ownHotel.hotel_id);
    if (!hotel || String(hotel.business) !== req.user.id) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    // 사진과 공지사항 포함
    const [pictures, notice] = await Promise.all([
      OwnHotelPicture.find({ own_hotel_id: ownHotel._id }).lean(),
      Notice.findOne({ own_hotel_id: ownHotel._id }).lean()
    ]);

    const result = {
      ...ownHotel.toObject(),
      pictures: pictures.map(p => ({
        picture_name: p.picture_name,
        picture_url: processImageUrls({ image: p.picture_url }).image
      })),
      notice: notice || null
    };

    res.json(result);
  } catch (error) {
    console.error("GET /api/rooms/:id 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 소유 숙소 생성
router.post("/", async (req, res) => {
  try {
    const {
      hotel_id,
      price,
      count_room,
      check_in,
      check_out,
      room_name,
      room_type,
      max_person,
      min_person,
      owner_discount,
      platform_discount
    } = req.body;

    if (!hotel_id || !price || !room_name || !max_person || !min_person) {
      return res.status(400).json({ message: "필수 필드가 누락되었습니다." });
    }

    // 호텔 소유권 확인
    const hotelDoc = await Hotel.findOne({
      _id: hotel_id,
      business: req.user.id
    });

    if (!hotelDoc) {
      return res.status(404).json({ message: "호텔을 찾을 수 없습니다." });
    }

    const ownHotel = await OwnHotel.create({
      hotel_id,
      price,
      count_room: count_room || 1,
      check_in: check_in || "15:00",
      check_out: check_out || "11:00",
      room_name,
      room_type: room_type || "",
      max_person,
      min_person: min_person || 1,
      owner_discount: owner_discount || 0,
      platform_discount: platform_discount || 0
    });

    res.status(201).json(ownHotel);
  } catch (error) {
    console.error("POST /api/rooms 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 소유 숙소 수정
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const ownHotel = await OwnHotel.findById(req.params.id).populate('hotel_id');

    if (!ownHotel) {
      return res.status(404).json({ message: "소유 숙소를 찾을 수 없습니다." });
    }

    // 호텔 소유권 확인
    const hotel = await Hotel.findById(ownHotel.hotel_id);
    if (!hotel || String(hotel.business) !== req.user.id) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    const {
      price,
      count_room,
      check_in,
      check_out,
      room_name,
      room_type,
      max_person,
      min_person,
      owner_discount,
      platform_discount
    } = req.body;

    const updates = {};
    if (price !== undefined) updates.price = price;
    if (count_room !== undefined) updates.count_room = count_room;
    if (check_in !== undefined) updates.check_in = check_in;
    if (check_out !== undefined) updates.check_out = check_out;
    if (room_name !== undefined) updates.room_name = room_name;
    if (room_type !== undefined) updates.room_type = room_type;
    if (max_person !== undefined) updates.max_person = max_person;
    if (min_person !== undefined) updates.min_person = min_person;
    if (owner_discount !== undefined) updates.owner_discount = owner_discount;
    if (platform_discount !== undefined) updates.platform_discount = platform_discount;

    const updated = await OwnHotel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (error) {
    console.error("PUT /api/rooms/:id 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 소유 숙소 삭제
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const ownHotel = await OwnHotel.findById(req.params.id).populate('hotel_id');

    if (!ownHotel) {
      return res.status(404).json({ message: "소유 숙소를 찾을 수 없습니다." });
    }

    // 호텔 소유권 확인
    const hotel = await Hotel.findById(ownHotel.hotel_id);
    if (!hotel || String(hotel.business) !== req.user.id) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    // 예약이 있는지 확인
    const hasBookings = await Booking.exists({ room_id: req.params.id });
    
    if (hasBookings) {
      return res.status(400).json({ message: "예약이 있어 소유 숙소를 삭제할 수 없습니다." });
    }

    // 관련 사진과 공지사항도 삭제
    await OwnHotelPicture.deleteMany({ own_hotel_id: req.params.id });
    await Notice.deleteOne({ own_hotel_id: req.params.id });
    await ownHotel.deleteOne();

    res.json({ ok: true, id: ownHotel._id });
  } catch (error) {
    console.error("DELETE /api/rooms/:id 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;

