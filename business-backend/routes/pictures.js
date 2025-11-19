const express = require("express");
const router = express.Router();
const RoomPicture = require("../models/RoomPicture");  // OwnHotelPicture → RoomPicture
const Room = require("../models/Room");  // OwnHotel → Room
const Lodging = require("../models/Lodging");
const Business = require("../models/Business");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");
const { deleteObject } = require("../src/s3");

const S3_BASE_URL =
  process.env.S3_BASE_URL ||
  `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;

function joinS3Url(base, key) {
  const b = String(base || "").replace(/\/+$/, "");
  const k = String(key || "").replace(/^\/+/, "");
  return `${b}/${k}`;
}

function urlToKey(u) {
  if (!u) return "";
  const s = String(u);
  if (!/^https?:\/\//i.test(s)) return s;
  const base = String(S3_BASE_URL || "").replace(/\/+$/, "");
  return s.startsWith(base + "/") ? s.slice(base.length + 1) : s;
}

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 방별 사진 목록 조회
router.get("/room/:roomId", async (req, res) => {  // own-hotel → room
  try {
    const { roomId } = req.params;  // ownHotelId → roomId

    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const room = await Room.findById(roomId).populate('lodging_id');  // ownHotel → room, hotel_id → lodging_id
    if (!room) {
      return res.status(404).json({ message: "방을 찾을 수 없습니다." });
    }

    const lodging = await Lodging.findById(room.lodging_id);  // ownHotel.hotel_id → room.lodging_id
    if (!lodging || String(lodging.business_id) !== String(business._id)) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    const pictures = await RoomPicture.find({ room_id: roomId })  // OwnHotelPicture → RoomPicture, own_hotel_id → room_id
      .sort({ createdAt: -1 })
      .lean();

    const processedPictures = pictures.map(p => ({
      ...p,
      picture_url: p.picture_url.startsWith('http') 
        ? p.picture_url 
        : joinS3Url(S3_BASE_URL, p.picture_url)
    }));

    res.json(processedPictures);
  } catch (error) {
    console.error("GET /api/pictures/room/:roomId 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 사진 추가
router.post("/", async (req, res) => {
  try {
    const { room_id, picture_name, picture_url } = req.body;  // own_hotel_id → room_id

    if (!room_id || !picture_name || !picture_url) {
      return res.status(400).json({ message: "필수 필드가 누락되었습니다." });
    }

    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    // 방 소유권 확인
    const room = await Room.findById(room_id).populate('lodging_id');  // ownHotel → room
    if (!room) {
      return res.status(404).json({ message: "방을 찾을 수 없습니다." });
    }

    const lodging = await Lodging.findById(room.lodging_id);  // ownHotel.hotel_id → room.lodging_id
    if (!lodging || String(lodging.business_id) !== String(business._id)) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    // S3 키로 변환하여 저장
    const pictureKey = urlToKey(picture_url);

    const picture = await RoomPicture.create({  // OwnHotelPicture → RoomPicture
      room_id,  // own_hotel_id → room_id
      picture_name,
      picture_url: pictureKey
    });

    res.status(201).json({
      ...picture.toObject(),
      picture_url: joinS3Url(S3_BASE_URL, pictureKey)
    });
  } catch (error) {
    console.error("POST /api/pictures 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 사진 삭제
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

    const picture = await RoomPicture.findById(req.params.id);  // OwnHotelPicture → RoomPicture
    if (!picture) {
      return res.status(404).json({ message: "사진을 찾을 수 없습니다." });
    }

    // 소유권 확인
    const room = await Room.findById(picture.room_id).populate('lodging_id');  // ownHotel → room, own_hotel_id → room_id
    const lodging = await Lodging.findById(room.lodging_id);  // ownHotel.hotel_id → room.lodging_id
    if (!lodging || String(lodging.business_id) !== String(business._id)) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    // S3에서 삭제
    const key = urlToKey(picture.picture_url);
    if (key) {
      try {
        await deleteObject(key);
      } catch (s3Error) {
        console.warn("S3 삭제 실패:", s3Error);
      }
    }

    await picture.deleteOne();
    res.json({ ok: true, id: picture._id });
  } catch (error) {
    console.error("DELETE /api/pictures/:id 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;

