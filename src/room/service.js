const Room = require("./model");
const RoomPicture = require("../picture/model");
const Notice = require("../notice/model");
const Booking = require("../booking/model");
const Lodging = require("../lodging/model");
const BusinessUser = require("../auth/model");

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

// 객실 목록 조회
const getRooms = async (userId, filters = {}) => {
  const { lodgingId, status, search, page = 1, pageSize = 10 } = filters;
  
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 사업자의 모든 숙소 조회
  const lodgings = await Lodging.find({ businessId: user._id }).select('_id').lean();
  const lodgingIds = lodgings.map(l => l._id);

  if (lodgingIds.length === 0) {
    return {
      rooms: [],
      totalPages: 0,
      currentPage: parseInt(page)
    };
  }

  // 쿼리 구성
  const query = { lodgingId: { $in: lodgingIds } };
  
  // lodgingId 필터
  if (lodgingId) {
    if (!lodgingIds.some(id => id.toString() === lodgingId.toString())) {
      throw new Error("LODGING_NOT_FOUND");
    }
    query.lodgingId = lodgingId;
  }
  
  // status 필터 (available → active, unavailable → inactive)
  if (status) {
    if (status === 'available') query.status = 'active';
    else if (status === 'unavailable') query.status = 'inactive';
    else query.status = status;
  }
  
  // search 필터 (roomName 또는 name 검색)
  if (search) {
    query.$or = [
      { roomName: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(pageSize);
  
  const [rooms, total] = await Promise.all([
    Room.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(pageSize))
      .lean(),
    Room.countDocuments(query)
  ]);

  // 응답 형식 변환
  const formattedRooms = rooms.map(room => {
    const processedRoom = processImageUrls(room);
    // roomImage 처리
    let imagesArray = [];
    if (room.roomImage) {
      imagesArray = [room.roomImage];
    } else if (room.images && Array.isArray(room.images) && room.images.length > 0) {
      imagesArray = room.images;
    }
    
    return {
      id: room._id.toString(),
      name: room.roomName || room.name,
      type: room.type || 'standard',
      price: room.price,
      maxGuests: room.capacityMax || room.maxGuests,
      amenities: room.amenities || [],
      description: room.description || "",
      images: processedRoom.images || imagesArray,
      available: room.status === 'active',
      quantity: room.countRoom || room.quantity || 1,
      status: room.status === 'active' ? 'available' : (room.status === 'inactive' ? 'unavailable' : room.status)
    };
  });

  return {
    rooms: formattedRooms,
    totalPages: Math.ceil(total / parseInt(pageSize)),
    currentPage: parseInt(page)
  };
};

// 객실 상세 조회
const getRoomById = async (roomId, userId) => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodgingId);
  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business' || String(lodging.businessId) !== String(user._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const [pictures, notice] = await Promise.all([
    RoomPicture.find({ roomId: room._id }).lean(),
    Notice.findOne({ roomId: room._id }).lean()
  ]);

  const processedRoom = processImageUrls(room.toObject());
  
  // roomImage 처리
  let imagesArray = [];
  if (room.roomImage) {
    imagesArray = [room.roomImage];
  } else if (room.images && Array.isArray(room.images) && room.images.length > 0) {
    imagesArray = room.images;
  }
  
  return {
    id: room._id.toString(),
    name: room.roomName || room.name,
    type: room.type || 'standard',
    price: room.price,
    maxGuests: room.capacityMax || room.maxGuests,
    amenities: room.amenities || [],
    description: room.description || "",
    images: processedRoom.images || imagesArray,
    available: room.status === 'active',
    quantity: room.countRoom || room.quantity || 1,
    status: room.status === 'active' ? 'available' : (room.status === 'inactive' ? 'unavailable' : room.status),
    roomSize: room.roomSize,
    checkInTime: room.checkInTime,
    checkOutTime: room.checkOutTime,
    capacityMin: room.capacityMin,
    ownerDiscount: room.ownerDiscount,
    platformDiscount: room.platformDiscount
  };
};

// 객실 생성
const createRoom = async (roomData, userId) => {
  const {
    lodgingId,
    price,
    quantity,
    countRoom,
    checkInTime,
    checkOutTime,
    name,
    roomName,
    type,
    roomSize,
    maxGuests,
    capacityMax,
    capacityMin,
    ownerDiscount,
    platformDiscount,
    images,
    roomImage,
    amenities,
    description,
    status
  } = roomData;

  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findOne({
    _id: lodgingId,
    businessId: user._id
  });

  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  // images/roomImage 처리
  let imagesArray = [];
  let finalRoomImage = "";
  if (roomImage) {
    finalRoomImage = roomImage;
    imagesArray = [roomImage];
  } else if (images) {
    if (Array.isArray(images)) {
      imagesArray = images.filter(img => img && img.trim().length > 0);
      finalRoomImage = imagesArray[0] || "";
    } else if (typeof images === 'string') {
      imagesArray = [images];
      finalRoomImage = images;
    }
  }

  // status 값 매핑 (available → active, unavailable → inactive, maintenance → maintenance)
  let roomStatus = 'active';
  if (status) {
    if (status === 'available') roomStatus = 'active';
    else if (status === 'unavailable') roomStatus = 'inactive';
    else if (status === 'maintenance') roomStatus = 'maintenance';
    else roomStatus = status;
  }

  const room = await Room.create({
    lodgingId: lodgingId,
    price,
    countRoom: countRoom || quantity || 1,
    quantity: countRoom || quantity || 1,
    checkInTime: checkInTime || "15:00",
    checkOutTime: checkOutTime || "11:00",
    roomName: roomName || name,
    name: roomName || name,
    type: type || 'standard',
    roomSize: roomSize || "",
    capacityMax: capacityMax || maxGuests,
    maxGuests: capacityMax || maxGuests,
    capacityMin: capacityMin || 1,
    ownerDiscount: ownerDiscount || 0,
    platformDiscount: platformDiscount || 0,
    roomImage: finalRoomImage,
    images: imagesArray,
    amenities: amenities || [],
    description: description || "",
    status: roomStatus
  });

  return room;
};

// 객실 수정
const updateRoom = async (roomId, roomData, userId) => {
  const room = await Room.findById(roomId).populate('lodgingId');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodgingId);
  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business' || String(lodging.businessId) !== String(user._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const {
    price,
    quantity,
    countRoom,
    checkInTime,
    checkOutTime,
    name,
    roomName,
    type,
    roomSize,
    maxGuests,
    capacityMax,
    capacityMin,
    ownerDiscount,
    platformDiscount,
    images,
    roomImage,
    amenities,
    description,
    status
  } = roomData;

  const updates = {};
  if (price !== undefined) updates.price = price;
  if (countRoom !== undefined) {
    updates.countRoom = countRoom;
    updates.quantity = countRoom;
  } else if (quantity !== undefined) {
    updates.countRoom = quantity;
    updates.quantity = quantity;
  }
  if (checkInTime !== undefined) updates.checkInTime = checkInTime;
  if (checkOutTime !== undefined) updates.checkOutTime = checkOutTime;
  if (roomName !== undefined) {
    updates.roomName = roomName;
    updates.name = roomName;
  } else if (name !== undefined) {
    updates.roomName = name;
    updates.name = name;
  }
  if (type !== undefined) updates.type = type;
  if (roomSize !== undefined) updates.roomSize = roomSize;
  if (capacityMax !== undefined) {
    updates.capacityMax = capacityMax;
    updates.maxGuests = capacityMax;
  } else if (maxGuests !== undefined) {
    updates.capacityMax = maxGuests;
    updates.maxGuests = maxGuests;
  }
  if (capacityMin !== undefined) updates.capacityMin = capacityMin;
  if (ownerDiscount !== undefined) updates.ownerDiscount = ownerDiscount;
  if (platformDiscount !== undefined) updates.platformDiscount = platformDiscount;
  if (roomImage !== undefined) {
    updates.roomImage = roomImage;
    updates.images = [roomImage];
  } else if (images !== undefined) {
    if (Array.isArray(images)) {
      const filteredImages = images.filter(img => img && img.trim().length > 0);
      updates.images = filteredImages;
      updates.roomImage = filteredImages[0] || "";
    } else if (typeof images === 'string') {
      updates.images = [images];
      updates.roomImage = images;
    }
  }
  if (amenities !== undefined) {
    if (Array.isArray(amenities)) {
      updates.amenities = amenities;
    } else if (typeof amenities === 'string') {
      updates.amenities = amenities.split(',').map(a => a.trim());
    }
  }
  if (description !== undefined) updates.description = description;
  if (status !== undefined) {
    // status 값 매핑
    if (status === 'available') updates.status = 'active';
    else if (status === 'unavailable') updates.status = 'inactive';
    else if (status === 'maintenance') updates.status = 'maintenance';
    else updates.status = status;
  }

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

  const lodging = await Lodging.findById(room.lodgingId);
  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business' || String(lodging.businessId) !== String(user._id)) {
    throw new Error("UNAUTHORIZED");
  }

  room.status = status;
  await room.save();

  return room;
};

// 객실 삭제
const deleteRoom = async (roomId, userId) => {
  const room = await Room.findById(roomId).populate('lodgingId');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodgingId);
  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business' || String(lodging.businessId) !== String(user._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const hasBookings = await Booking.exists({ roomId: roomId });
  if (hasBookings) {
    throw new Error("HAS_BOOKINGS");
  }

  await RoomPicture.deleteMany({ roomId: roomId });
  await Notice.deleteOne({ roomId: roomId });
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

