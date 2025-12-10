const Lodging = require("./model");
const Amenity = require("../amenity/model");
const Booking = require("../booking/model");
const Room = require("../room/model");
const BusinessUser = require("../auth/model");
const Category = require("../category/model"); 
const { addressToCoordinates } = require("../common/kakaoMap");

// 숙소 목록 조회
const getLodgings = async (userId) => {
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findOne({ businessId: user._id })
    .populate('amenityId')
    .populate('categoryId')
    .sort({ createdAt: -1 })
    .lean();

  if (!lodging) {
    return null;
  }

  // 통계 계산
  const [rooms, bookings, reviews] = await Promise.all([
    Room.find({ lodgingId: lodging._id }).lean(),
    Booking.find({ businessUserId: user._id }).lean(),
    require("../review/model").find({ lodgingId: lodging._id, status: 'active' }).lean()
  ]);

  // totalRooms 계산
  const totalRooms = rooms.reduce((sum, r) => sum + (r.countRoom || r.quantity || 1), 0);
  
  // totalBookings 계산
  const totalBookings = bookings.length;
  
  // totalRevenue 계산 (결제 완료된 예약만)
  const Payment = require("../booking/payment");
  const payments = await Payment.find({ 
    bookingId: { $in: bookings.map(b => b._id) },
    paid: { $gt: 0 }
  }).lean();
  const totalRevenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
  
  // avgRating 계산
  const avgRating = reviews.length > 0 
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length 
    : lodging.rating || 0;
  
  // amenities 배열 생성 (실제 데이터 구조에 맞게)
  const amenities = [];
  if (lodging.amenityId) {
    const amenity = lodging.amenityId;
    if (amenity.bbqGrill) amenities.push('bbqGrill');
    if (amenity.netflix) amenities.push('netflix');
    if (amenity.swimmingPool) amenities.push('swimmingPool');
    if (amenity.parking) amenities.push('parking');
    if (amenity.wifi) amenities.push('wifi');
    if (amenity.kitchen) amenities.push('kitchen');
    if (amenity.pc) amenities.push('pc');
    if (amenity.tv) amenities.push('tv');
    if (amenity.ac) amenities.push('ac');
  }
  
  // todayBookings 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayBookings = bookings.filter(b => {
    const bookingDate = new Date(b.createdAt || b.bookingDate);
    bookingDate.setHours(0, 0, 0, 0);
    return bookingDate.getTime() === today.getTime();
  }).length;

  // 응답 형식 변환
  return {
    id: lodging._id.toString(),
    _id: lodging._id.toString(),
    name: lodging.lodgingName,
    lodgingName: lodging.lodgingName, // 프론트엔드 호환성을 위해 추가
    description: lodging.description,
    address: lodging.address,
    city: lodging.city || "",
    country: lodging.country,
    phoneNumber: lodging.phoneNumber || user.phoneNumber || "",
    email: lodging.email || user.email || "",
    website: lodging.website || "",
    checkInTime: lodging.checkInTime || "15:00",
    checkOutTime: lodging.checkOutTime || "11:00",
    images: lodging.images || [],
    totalRooms,
    totalBookings,
    totalRevenue,
    avgRating: Math.round(avgRating * 10) / 10,
    amenities,
    todayBookings,
    newMembers: 0, // 미구현: 신규 회원 수 통계
    rating: lodging.rating,
    categoryId: lodging.categoryId?._id || lodging.categoryId,
    category: lodging.categoryId ? {
      id: lodging.categoryId._id,
      name: lodging.categoryId.name,
      code: lodging.categoryId.code,
      description: lodging.categoryId.description
    } : null,
    minPrice: lodging.minPrice,
    reviewCount: lodging.reviewCount || 0,
    policies: lodging.policies || ""
  };
};

// 숙소 상세 조회
const getLodgingById = async (lodgingId, userId) => {
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findOne({
    _id: lodgingId,
    businessId: user._id
  })
    .populate('amenityId')
    .populate('categoryId')
    .lean();

  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  // getLodgings와 동일한 형식으로 반환 (통계 포함)
  return await getLodgings(userId);
};

// 숙소 생성
const createLodging = async (lodgingData, userId) => {
  const {
    lodgingName,
    address,
    rating,
    description,
    images,
    country,
    categoryId,
    hashtag,
    bbqGrill,
    netflix,
    swimmingPool,
    parking,
    wifi,
    kitchen,
    pc,
    tv,
    ac,
    minPrice,
    lat,
    lng,
    phoneNumber,
    email,
    website,
    checkInTime,
    checkOutTime,
    city,
    policies,
    amenities
  } = lodgingData;

  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  if (!user.businessName) {
    throw new Error("BUSINESS_INFO_MISSING");
  }

  // 사업자가 이미 숙소를 가지고 있는지 확인
  const existingLodging = await Lodging.findOne({ businessId: user._id });
  if (existingLodging) {
    throw new Error("LODGING_ALREADY_EXISTS");
  }

  // 편의시설 생성 (선택사항)
  let amenity = null;
  // 편의시설 데이터가 하나라도 있으면 생성
  if (bbqGrill !== undefined || netflix !== undefined || swimmingPool !== undefined || 
      parking !== undefined || wifi !== undefined || kitchen !== undefined || 
      pc !== undefined || tv !== undefined || ac !== undefined) {
    amenity = await Amenity.create({
      lodgingId: null, // 나중에 설정됨
      bbqGrill: bbqGrill || false,
      netflix: netflix || false,
      swimmingPool: swimmingPool || false,
      parking: parking || false,
      wifi: wifi || false,
      kitchen: kitchen || false,
      pc: pc || false,
      tv: tv || false,
      ac: ac || false
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

  // 주소를 좌표로 변환 (주소가 있고 lat, lng가 제공되지 않은 경우에만)
  let coordinates = { lat, lng };
  if ((!lat || !lng) && address && address.trim().length > 0) {
    try {
      coordinates = await addressToCoordinates(address);
    } catch (error) {
      // 좌표 변환 실패해도 에러를 발생시키지 않고 스킵
      // API 키가 없는 경우는 이미 경고가 출력되었으므로 간단한 로그만 출력
      const isApiKeyError = error.message.includes('KAKAO_MAP_API_KEY');
      if (!isApiKeyError) {
        console.warn(`⚠️  주소 좌표 변환 실패 (스킵): ${address} - ${error.message}`);
      }
      coordinates = { lat: undefined, lng: undefined };
    }
  }

  const lodgingDataToCreate = {
    businessId: user._id,
    businessName: user.businessName,
    lodgingName: lodgingName,
    address,
    rating,
    description,
    images: imagesArray,
    country,
    categoryId,
    hashtag: hashtagArray,
    amenityId: amenity ? amenity._id : null,
    minPrice: minPrice !== undefined ? minPrice : undefined,
    reviewCount: 0, // 기본값 0, 리뷰 생성 시 자동으로 증가
    phoneNumber: phoneNumber || user.phoneNumber || "",
    email: email || user.email || "",
    website: website || "",
    checkInTime: checkInTime || "15:00",
    checkOutTime: checkOutTime || "11:00",
    city: city || ""
  };

  // 좌표가 있는 경우에만 추가
  if (coordinates.lat !== undefined && coordinates.lng !== undefined) {
    lodgingDataToCreate.lat = coordinates.lat;
    lodgingDataToCreate.lng = coordinates.lng;
  }

  const lodging = await Lodging.create(lodgingDataToCreate);

  // lodgingId 설정 (amenity가 생성된 경우)
  if (amenity) {
    amenity.lodgingId = lodging._id;
    await amenity.save();
  }

  const createdLodging = await Lodging.findById(lodging._id)
    .populate('amenityId')
    .populate('categoryId');

  return createdLodging;
};

// 숙소 수정
const updateLodging = async (lodgingId, lodgingData, userId) => {
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

  const {
    lodgingName,
    address,
    rating,
    description,
    images,
    country,
    categoryId,
    hashtag,
    bbqGrill,
    netflix,
    swimmingPool,
    parking,
    wifi,
    kitchen,
    pc,
    tv,
    ac,
    minPrice,
    lat,
    lng,
    phoneNumber,
    email,
    website,
    checkInTime,
    checkOutTime,
    city,
    policies,
    amenities
  } = lodgingData;

  const updates = {};
  if (lodgingName !== undefined) updates.lodgingName = lodgingName;
  if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
  if (email !== undefined) updates.email = email;
  if (website !== undefined) updates.website = website;
  if (checkInTime !== undefined) updates.checkInTime = checkInTime;
  if (checkOutTime !== undefined) updates.checkOutTime = checkOutTime;
  if (city !== undefined) updates.city = city;
  if (address !== undefined) updates.address = address;
  if (rating !== undefined) updates.rating = rating;
  if (description !== undefined) updates.description = description;
  if (minPrice !== undefined) updates.minPrice = minPrice;
  // reviewCount는 리뷰 생성/삭제 시 자동으로 관리되므로 수동 수정 불가
  if (images !== undefined) {
    if (Array.isArray(images)) {
      updates.images = images.filter(img => img && img.trim().length > 0);
    } else if (typeof images === 'string') {
      updates.images = [images];
    }
  }
  if (country !== undefined) updates.country = country;
  if (categoryId !== undefined) updates.categoryId = categoryId;
  if (hashtag !== undefined) {
    if (Array.isArray(hashtag)) {
      updates.hashtag = hashtag;
    } else if (typeof hashtag === 'string') {
      updates.hashtag = hashtag.split(/[,\s]+/).filter(tag => tag.length > 0);
    }
  }
  // 편의시설 업데이트
  if (bbqGrill !== undefined || netflix !== undefined || swimmingPool !== undefined || 
      parking !== undefined || wifi !== undefined || kitchen !== undefined || 
      pc !== undefined || tv !== undefined || ac !== undefined) {
    let amenity = await Amenity.findOne({ lodgingId: lodgingId });
    
    if (amenity) {
      // 기존 편의시설 업데이트
      if (bbqGrill !== undefined) amenity.bbqGrill = bbqGrill;
      if (netflix !== undefined) amenity.netflix = netflix;
      if (swimmingPool !== undefined) amenity.swimmingPool = swimmingPool;
      if (parking !== undefined) amenity.parking = parking;
      if (wifi !== undefined) amenity.wifi = wifi;
      if (kitchen !== undefined) amenity.kitchen = kitchen;
      if (pc !== undefined) amenity.pc = pc;
      if (tv !== undefined) amenity.tv = tv;
      if (ac !== undefined) amenity.ac = ac;
      await amenity.save();
    } else {
      // 새 편의시설 생성
      amenity = await Amenity.create({
        lodgingId: lodgingId,
        bbqGrill: bbqGrill || false,
        netflix: netflix || false,
        swimmingPool: swimmingPool || false,
        parking: parking || false,
        wifi: wifi || false,
        kitchen: kitchen || false,
        pc: pc || false,
        tv: tv || false,
        ac: ac || false
      });
      updates.amenityId = amenity._id;
    }
  }

  // 주소가 변경되었거나 lat/lng가 제공되지 않은 경우 좌표 재변환
  if (address !== undefined || lat !== undefined || lng !== undefined) {
    if (lat !== undefined && lng !== undefined) {
      // 좌표가 직접 제공된 경우
      updates.lat = lat;
      updates.lng = lng;
    } else {
      // 주소를 기반으로 좌표 변환 (주소가 있는 경우에만)
      const addressToUse = address !== undefined ? address : lodging.address;
      if (addressToUse && addressToUse.trim().length > 0) {
        try {
          const coordinates = await addressToCoordinates(addressToUse);
          updates.lat = coordinates.lat;
          updates.lng = coordinates.lng;
        } catch (error) {
          // 좌표 변환 실패해도 에러를 발생시키지 않고 스킵
          // API 키가 없는 경우는 이미 경고가 출력되었으므로 간단한 로그만 출력
          const isApiKeyError = error.message.includes('KAKAO_MAP_API_KEY');
          if (!isApiKeyError) {
            console.warn(`⚠️  주소 좌표 변환 실패 (스킵): ${addressToUse} - ${error.message}`);
          }
          // 좌표를 업데이트하지 않음 (기존 값 유지 또는 undefined)
        }
      }
    }
  }

  // 사업자명이 변경된 경우 업데이트
  if (user.businessName && user.businessName !== lodging.businessName) {
    updates.businessName = user.businessName;
  }

  const updated = await Lodging.findByIdAndUpdate(
    lodgingId,
    { $set: updates },
    { new: true, runValidators: true }
  )
    .populate('amenityId')
    .populate('categoryId');

  return updated;
};

// 숙소 삭제
const deleteLodging = async (lodgingId, userId) => {
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

// 호텔 이미지 수정
const updateLodgingImages = async (userId, images) => {
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findOne({ businessId: user._id });
  if (!lodging) {
    throw new Error("LODGING_NOT_FOUND");
  }

  // images 배열 처리
  let imagesArray = [];
  if (Array.isArray(images)) {
    imagesArray = images.filter(img => img && img.trim().length > 0);
  } else if (typeof images === 'string') {
    imagesArray = [images];
  }

  lodging.images = imagesArray;
  await lodging.save();

  return lodging;
};

module.exports = {
  getLodgings,
  getLodgingById,
  createLodging,
  updateLodging,
  deleteLodging,
  updateLodgingImages
};

