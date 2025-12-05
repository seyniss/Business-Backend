const Amenity = require("./model");
const Lodging = require("../lodging/model");
const BusinessUser = require("../auth/model");

// 편의시설 생성/수정
const createOrUpdateAmenity = async (amenityData, lodgingId, userId) => {
  const { 
    bbqGrill, 
    netflix, 
    swimmingPool, 
    parking, 
    wifi, 
    kitchen, 
    pc, 
    tv, 
    ac 
  } = amenityData;

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

  // lodgingId로 직접 조회 (실제 데이터 구조에 맞게)
  let amenity = await Amenity.findOne({ lodgingId: lodgingId });
  
  if (amenity) {
    // 업데이트
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
    // 생성
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
    
    // Lodging의 amenityId 업데이트 (호환성을 위해)
    lodging.amenityId = amenity._id;
    await lodging.save();
  }

  return amenity;
};

// 숙소별 편의시설 조회
const getAmenityByLodging = async (lodgingId, userId) => {
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

  // lodgingId로 직접 조회 (실제 데이터 구조에 맞게)
  const amenity = await Amenity.findOne({ lodgingId: lodgingId });
  return amenity;
};

// 편의시설 수정
const updateAmenity = async (amenityId, amenityData, userId) => {
  const { 
    bbqGrill, 
    netflix, 
    swimmingPool, 
    parking, 
    wifi, 
    kitchen, 
    pc, 
    tv, 
    ac 
  } = amenityData;

  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const amenity = await Amenity.findById(amenityId);
  if (!amenity) {
    throw new Error("AMENITY_NOT_FOUND");
  }

  // 해당 숙소의 소유자 확인
  const lodging = await Lodging.findOne({
    _id: amenity.lodgingId,
    businessId: user._id
  });

  if (!lodging) {
    throw new Error("UNAUTHORIZED");
  }

  const updates = {};
  if (bbqGrill !== undefined) updates.bbqGrill = bbqGrill;
  if (netflix !== undefined) updates.netflix = netflix;
  if (swimmingPool !== undefined) updates.swimmingPool = swimmingPool;
  if (parking !== undefined) updates.parking = parking;
  if (wifi !== undefined) updates.wifi = wifi;
  if (kitchen !== undefined) updates.kitchen = kitchen;
  if (pc !== undefined) updates.pc = pc;
  if (tv !== undefined) updates.tv = tv;
  if (ac !== undefined) updates.ac = ac;

  const updated = await Amenity.findByIdAndUpdate(
    amenityId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  return updated;
};

module.exports = {
  createOrUpdateAmenity,
  getAmenityByLodging,
  updateAmenity
};

