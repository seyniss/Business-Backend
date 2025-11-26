const Lodging = require("./model");
const Amenity = require("../amenity/model");
const Booking = require("../booking/model");
const Room = require("../room/model");
const Business = require("../auth/business");

// 숙소 목록 조회
const getLodgings = async (userId) => {
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodgings = await Lodging.find({ business_id: business._id })
    .populate('amenity_id')
    .sort({ created_at: -1 })
    .lean();

  return lodgings;
};

// 숙소 상세 조회
const getLodgingById = async (lodgingId, userId) => {
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

  const [amenity, booking] = await Promise.all([
    lodging.amenity_id ? Amenity.findById(lodging.amenity_id).lean() : null,
    lodging.booking_id ? Booking.findById(lodging.booking_id).lean() : null
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
    lodging_name,
    address,
    star_rating,
    description,
    images,
    country,
    category,
    user_name,
    hashtag,
    amenity_name,
    amenity_detail
  } = lodgingData;

  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
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
    images: imagesArray,
    country,
    category,
    user_name,
    hashtag: hashtagArray,
    amenity_id: amenity ? amenity._id : null
  });

  const createdLodging = await Lodging.findById(lodging._id)
    .populate('amenity_id');

  return createdLodging;
};

// 숙소 수정
const updateLodging = async (lodgingId, lodgingData, userId) => {
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

  const {
    lodging_name,
    address,
    star_rating,
    description,
    images,
    country,
    category,
    user_name,
    hashtag,
    amenity_name,
    amenity_detail
  } = lodgingData;

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
      const amenity = await Amenity.create({
        amenity_name,
        amenity_detail: amenity_detail || ""
      });
      updates.amenity_id = amenity._id;
    } else {
      updates.amenity_id = null;
    }
  }

  const updated = await Lodging.findByIdAndUpdate(
    lodgingId,
    { $set: updates },
    { new: true, runValidators: true }
  )
    .populate('amenity_id');

  return updated;
};

// 숙소 삭제
const deleteLodging = async (lodgingId, userId) => {
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

  const rooms = await Room.find({ lodging_id: lodgingId }).select('_id');
  const roomIds = rooms.map(r => r._id);
  if (roomIds.length > 0) {
    const Booking = require("../booking/model");
    const hasBookings = await Booking.exists({ room_id: { $in: roomIds } });
    if (hasBookings) {
      throw new Error("HAS_BOOKINGS");
    }
  }

  // 객실도 함께 삭제 (있는 경우)
  await Room.deleteMany({ lodging_id: lodgingId });
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

