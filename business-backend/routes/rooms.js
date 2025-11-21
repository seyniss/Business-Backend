const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const RoomPicture = require("../models/RoomPicture");
const Notice = require("../models/Notice");
const Booking = require("../models/Booking");
const Lodging = require("../models/Lodging");
const Business = require("../models/Business");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");

const S3_BASE_URL =
  process.env.S3_BASE_URL ||
  `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com`;

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

// 숙소별 객실 목록 조회
router.get("/lodging/:lodgingId", async (req, res) => {
  try {
    const { lodgingId } = req.params;

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

    const rooms = await Room.find({ lodging_id: lodgingId })
      .sort({ createdAt: -1 })
      .lean();
      
    const roomsWithDetails = await Promise.all(
      rooms.map(async (room) => {
        const [pictures, notice] = await Promise.all([
          RoomPicture.find({ room_id: room._id }).lean(),
          Notice.findOne({ room_id: room._id }).lean()
        ]);

        return {
          room: room,
          lodging: lodging.toObject(),
          pictures: pictures.map(p => ({
            picture_name: p.picture_name,
            picture_url: processImageUrls({ image: p.picture_url }).image
          })),
          notice: notice || null
        };
      })
    );

    res.json(roomsWithDetails);
  } catch (error) {
    console.error("GET /api/rooms/lodging/:lodgingId 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 객실 상세 조회
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: "객실을 찾을 수 없습니다." });
    }

    // 숙소 소유권 확인
    const lodging = await Lodging.findById(room.lodging_id);
    if (!lodging) {
      return res.status(404).json({ message: "숙소를 찾을 수 없습니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business || String(lodging.business_id) !== String(business._id)) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    // 사진과 공지사항 포함
    const [pictures, notice] = await Promise.all([
      RoomPicture.find({ room_id: room._id }).lean(),
      Notice.findOne({ room_id: room._id }).lean()
    ]);

    const result = {
      room: room.toObject(),
      lodging: lodging.toObject(),
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

// 객실 생성
router.post("/", async (req, res) => {
  try {
    const {
      lodging_id,
      price,
      count_room,
      check_in_time,
      check_out_time,
      room_name,
      room_size,
      capacity_max,
      capacity_min,
      owner_discount,
      platform_discount,
      room_image
    } = req.body;

    if (!lodging_id || !price || !room_name || !capacity_max || !capacity_min) {
      return res.status(400).json({ message: "필수 필드가 누락되었습니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const lodging = await Lodging.findOne({
      _id: lodging_id,
      business_id: business._id
    });

    if (!lodging) {
      return res.status(404).json({ message: "숙소를 찾을 수 없습니다." });
    }

    const room = await Room.create({
      lodging_id,
      price,
      count_room: count_room || 1,
      check_in_time: check_in_time || "15:00",
      check_out_time: check_out_time || "11:00",
      room_name,
      room_size: room_size || "",
      capacity_max,
      capacity_min: capacity_min || 1,
      owner_discount: owner_discount || 0,
      platform_discount: platform_discount || 0,
      room_image: room_image || ""
    });

    res.status(201).json(room);
  } catch (error) {
    console.error("POST /api/rooms 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 객실 수정
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const room = await Room.findById(req.params.id).populate('lodging_id');

    if (!room) {
      return res.status(404).json({ message: "객실을 찾을 수 없습니다." });
    }

    // 숙소 소유권 확인
    const lodging = await Lodging.findById(room.lodging_id);
    if (!lodging) {
      return res.status(404).json({ message: "숙소를 찾을 수 없습니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business || String(lodging.business_id) !== String(business._id)) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    const {
      price,
      count_room,
      check_in_time,
      check_out_time,
      room_name,
      room_size,
      capacity_max,
      capacity_min,
      owner_discount,
      platform_discount,
      room_image
    } = req.body;

    const updates = {};
    if (price !== undefined) updates.price = price;
    if (count_room !== undefined) updates.count_room = count_room;
    if (check_in_time !== undefined) updates.check_in_time = check_in_time;
    if (check_out_time !== undefined) updates.check_out_time = check_out_time;
    if (room_name !== undefined) updates.room_name = room_name;
    if (room_size !== undefined) updates.room_size = room_size;
    if (capacity_max !== undefined) updates.capacity_max = capacity_max;
    if (capacity_min !== undefined) updates.capacity_min = capacity_min;
    if (owner_discount !== undefined) updates.owner_discount = owner_discount;
    if (platform_discount !== undefined) updates.platform_discount = platform_discount;
    if (room_image !== undefined) updates.room_image = room_image;

    const updated = await Room.findByIdAndUpdate(
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

// 객실 삭제
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const room = await Room.findById(req.params.id).populate('lodging_id');

    if (!room) {
      return res.status(404).json({ message: "객실을 찾을 수 없습니다." });
    }

    // 숙소 소유권 확인
    const lodging = await Lodging.findById(room.lodging_id);
    if (!lodging) {
      return res.status(404).json({ message: "숙소를 찾을 수 없습니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business || String(lodging.business_id) !== String(business._id)) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    const hasBookings = await Booking.exists({ room_id: req.params.id });
    
    if (hasBookings) {
      return res.status(400).json({ message: "예약이 있어 객실을 삭제할 수 없습니다." });
    }
    await RoomPicture.deleteMany({ room_id: req.params.id });
    await Notice.deleteOne({ room_id: req.params.id });
    await room.deleteOne();

    res.json({ ok: true, id: room._id });
  } catch (error) {
    console.error("DELETE /api/rooms/:id 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;

