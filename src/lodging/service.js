const Lodging = require("./model");
const Amenity = require("../amenity/model");
const Booking = require("../booking/model");
const Room = require("../room/model");
const Business = require("../auth/business");

// 숙소 목록 조회
const getLodgings = async (userId) => {
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodgings = await Lodging.find({ businessId: business._id })
    .populate('amenityId')
    .sort({ createdAt: -1 })
    .lean();

  return lodgings;
};

// 숙소 상세 조회
const getLodgingById = async (lodgingId, userId) => {
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findOne({
    _id: lodgingId,
    businessId: business._id
  });

  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  const [amenity, booking] = await Promise.all([
    lodging.amenityId ? Amenity.findById(lodging.amenityId).lean() : null,
    lodging.bookingId ? Booking.findById(lodging.bookingId).lean() : null
  ]);

  return {
    lodging: lodging.toObject(),
    amenity: amenity || null,
    booking: booking || null
  };
};

// 숙소 생성
const createLodging = async (lodgingData, userId) => {
  const {
    lodgingName,
    address,
    starRating,
    description,
    images,
    country,
    category,
    hashtag,
    amenityName,
    amenityDetail
  } = lodgingData;

  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 편의시설 생성 (선택사항)
  let amenity = null;
  if (amenityName) {
    amenity = await Amenity.create({
      amenityName,
      amenityDetail: amenityDetail || ""
    });
  }

  // 해시태그 배열로 변환
  let hashtagArray = [];
  if (hashtag) {
    if (Array.isArray(hashtag)) {
      hashtagArray = hashtag;
    } else if (typeof hashtag === 'string') {
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
    businessId: business._id,
    lodgingName,
    address,
    starRating,
    description,
    images: imagesArray,
    country,
    category,
    hashtag: hashtagArray,
    amenityId: amenity ? amenity._id : null
  });

  const createdLodging = await Lodging.findById(lodging._id)
    .populate('amenityId');

  return createdLodging;
};

// 숙소 수정
const updateLodging = async (lodgingId, lodgingData, userId) => {
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findOne({
    _id: lodgingId,
    businessId: business._id
  });

  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  const {
    lodgingName,
    address,
    starRating,
    description,
    images,
    country,
    category,
    userName,
    hashtag,
    amenityName,
    amenityDetail
  } = lodgingData;

  const updates = {};
  if (lodgingName !== undefined) updates.lodgingName = lodgingName;
  if (address !== undefined) updates.address = address;
  if (starRating !== undefined) updates.starRating = starRating;
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
  if (hashtag !== undefined) {
    if (Array.isArray(hashtag)) {
      updates.hashtag = hashtag;
    } else if (typeof hashtag === 'string') {
      updates.hashtag = hashtag.split(/[,\s]+/).filter(tag => tag.length > 0);
    }
  }
  if (amenityName !== undefined) {
    if (amenityName) {
      const amenity = await Amenity.create({
        amenityName,
        amenityDetail: amenityDetail || ""
      });
      updates.amenityId = amenity._id;
    } else {
      updates.amenityId = null;
    }
  }

  const updated = await Lodging.findByIdAndUpdate(
    lodgingId,
    { $set: updates },
    { new: true, runValidators: true }
  )
    .populate('amenityId');

  return updated;
};

// 숙소 삭제
const deleteLodging = async (lodgingId, userId) => {
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findOne({
    _id: lodgingId,
    businessId: business._id
  });

  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  const rooms = await Room.find({ lodgingId: lodgingId }).select('_id');
  const roomIds = rooms.map(r => r._id);
  if (roomIds.length > 0) {
    const Booking = require("../booking/model");
    const hasBookings = await Booking.exists({ roomId: { $in: roomIds } });
    if (hasBookings) {
      throw new Error("HAS_BOOKINGS");
    }
  }

  // 객실도 함께 삭제 (있는 경우)
  await Room.deleteMany({ lodgingId: lodgingId });
  await lodging.deleteOne();

  return { ok: true, id: lodging._id };
};

module.exports = {
  getLodgings,
  getLodgingById,
  createLodging,
  updateLodging,
  deleteLodging
};

