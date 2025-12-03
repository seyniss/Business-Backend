const Amenity = require("./model");
const Lodging = require("../lodging/model");
const Business = require("../auth/business");

// 편의시설 생성/수정
const createOrUpdateAmenity = async (amenityData, lodgingId, userId) => {
  const { amenity_name, amenity_detail } = amenityData;

  const business = await Business.findOne({ loginId: userId });
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

  let amenity = await Amenity.findById(lodging.amenity_id);
  
  if (amenity) {
    amenity.amenity_name = amenity_name;
    amenity.amenity_detail = amenity_detail || "";
    await amenity.save();
  } else {
    amenity = await Amenity.create({
      amenity_name,
      amenity_detail: amenity_detail || ""
    });
    
    lodging.amenity_id = amenity._id;
    await lodging.save();
  }

  return amenity;
};

// 숙소별 편의시설 조회
const getAmenityByLodging = async (lodgingId, userId) => {
  const business = await Business.findOne({ loginId: userId });
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

  if (!lodging.amenity_id) {
    return null;
  }

  const amenity = await Amenity.findById(lodging.amenity_id);
  return amenity;
};

// 편의시설 수정
const updateAmenity = async (amenityId, amenityData, userId) => {
  const { amenity_name, amenity_detail } = amenityData;

  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findOne({
    amenity_id: amenityId,
    business_id: business._id
  });

  if (!lodging) {
    throw new Error("UNAUTHORIZED");
  }

  const amenity = await Amenity.findById(amenityId);
  if (!amenity) {
    throw new Error("AMENITY_NOT_FOUND");
  }

  const updates = {};
  if (amenity_name !== undefined) updates.amenity_name = amenity_name;
  if (amenity_detail !== undefined) updates.amenity_detail = amenity_detail;

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

