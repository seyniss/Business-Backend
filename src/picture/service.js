const RoomPicture = require("./model");
const Room = require("../room/model");
const Lodging = require("../lodging/model");
const Business = require("../auth/business");
const { deleteObject } = require("../s3");

const S3_BASE_URL =
  process.env.S3_BASE_URL ||
  `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com`;

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

// 객실별 사진 목록 조회
const getPicturesByRoom = async (roomId, userId) => {
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const room = await Room.findById(roomId).populate('lodging_id');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodging_id);
  if (!lodging || String(lodging.business_id) !== String(business._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const pictures = await RoomPicture.find({ room_id: roomId })
    .sort({ createdAt: -1 })
    .lean();

  const processedPictures = pictures.map(p => ({
    ...p,
    picture_url: p.picture_url.startsWith('http') 
      ? p.picture_url 
      : joinS3Url(S3_BASE_URL, p.picture_url)
  }));

  return processedPictures;
};

// 사진 추가
const createPicture = async (pictureData, userId) => {
  const { room_id, picture_name, picture_url } = pictureData;

  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const room = await Room.findById(room_id).populate('lodging_id');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodging_id);
  if (!lodging || String(lodging.business_id) !== String(business._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const pictureKey = urlToKey(picture_url);
  const picture = await RoomPicture.create({
    room_id,
    picture_name,
    picture_url: pictureKey
  });

  return {
    ...picture.toObject(),
    picture_url: joinS3Url(S3_BASE_URL, pictureKey)
  };
};

// 사진 삭제
const deletePicture = async (pictureId, userId) => {
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const picture = await RoomPicture.findById(pictureId);
  if (!picture) {
    throw new Error("PICTURE_NOT_FOUND");
  }

  const room = await Room.findById(picture.room_id).populate('lodging_id');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodging_id);
  if (!lodging || String(lodging.business_id) !== String(business._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const key = urlToKey(picture.picture_url);
  if (key) {
    try {
      await deleteObject(key);
    } catch (s3Error) {
      console.warn("S3 삭제 실패:", s3Error);
    }
  }

  await picture.deleteOne();
  return { ok: true, id: picture._id };
};

module.exports = {
  getPicturesByRoom,
  createPicture,
  deletePicture
};

