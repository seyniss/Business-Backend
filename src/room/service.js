const Room = require("./model");
const RoomPicture = require("../picture/model");
const Notice = require("../notice/model");
const Booking = require("../booking/model");
const Lodging = require("../lodging/model");
const Business = require("../auth/business");

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

// 객실 목록 조회 (쿼리 파라미터로 lodgingId 전달)
const getRooms = async (lodgingId, userId) => {
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findOne({
    _id: lodgingId,
    business_id: business._id
  });

  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
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

  return roomsWithDetails;
};

// 객실 상세 조회
const getRoomById = async (roomId, userId) => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodging_id);
  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  const business = await Business.findOne({ login_id: userId });
  if (!business || String(lodging.business_id) !== String(business._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const [pictures, notice] = await Promise.all([
    RoomPicture.find({ room_id: room._id }).lean(),
    Notice.findOne({ room_id: room._id }).lean()
  ]);

  return {
    room: room.toObject(),
    lodging: lodging.toObject(),
    pictures: pictures.map(p => ({
      picture_name: p.picture_name,
      picture_url: processImageUrls({ image: p.picture_url }).image
    })),
    notice: notice || null
  };
};

// 객실 생성
const createRoom = async (roomData, userId) => {
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
  } = roomData;

  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findOne({
    _id: lodging_id,
    business_id: business._id
  });

  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
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

  return room;
};

// 객실 수정
const updateRoom = async (roomId, roomData, userId) => {
  const room = await Room.findById(roomId).populate('lodging_id');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodging_id);
  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  const business = await Business.findOne({ login_id: userId });
  if (!business || String(lodging.business_id) !== String(business._id)) {
    throw new Error("UNAUTHORIZED");
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
  } = roomData;

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
    roomId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  return updated;
};

// 객실 상태 변경
const updateRoomStatus = async (roomId, status, userId) => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodging_id);
  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  const business = await Business.findOne({ login_id: userId });
  if (!business || String(lodging.business_id) !== String(business._id)) {
    throw new Error("UNAUTHORIZED");
  }

  room.status = status;
  await room.save();

  return room;
};

// 객실 삭제
const deleteRoom = async (roomId, userId) => {
  const room = await Room.findById(roomId).populate('lodging_id');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodging_id);
  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  const business = await Business.findOne({ login_id: userId });
  if (!business || String(lodging.business_id) !== String(business._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const hasBookings = await Booking.exists({ room_id: roomId });
  if (hasBookings) {
    throw new Error("HAS_BOOKINGS");
  }

  await RoomPicture.deleteMany({ room_id: roomId });
  await Notice.deleteOne({ room_id: roomId });
  await room.deleteOne();

  return { ok: true, id: room._id };
};

module.exports = {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  updateRoomStatus
};

