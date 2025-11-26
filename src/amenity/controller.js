const amenityService = require("./service");
const { successResponse, errorResponse } = require("../common/response");

// 편의시설 생성/수정
const createOrUpdateAmenity = async (req, res) => {
  try {
    const { amenity_name, amenity_detail, lodging_id } = req.body;

    if (!amenity_name || !lodging_id) {
      return res.status(400).json(errorResponse("필수 필드가 누락되었습니다.", 400));
    }

    const result = await amenityService.createOrUpdateAmenity(
      { amenity_name, amenity_detail },
      lodging_id,
      req.user.id
    );

    return res.status(201).json(successResponse(result, "편의시설이 생성/수정되었습니다.", 201));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "LODGING_NOT_FOUND") {
      return res.status(404).json(errorResponse("숙소를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 숙소별 편의시설 조회
const getAmenityByLodging = async (req, res) => {
  try {
    const result = await amenityService.getAmenityByLodging(req.params.lodgingId, req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "LODGING_NOT_FOUND") {
      return res.status(404).json(errorResponse("숙소를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 편의시설 수정
const updateAmenity = async (req, res) => {
  try {
    const { amenity_name, amenity_detail } = req.body;

    const result = await amenityService.updateAmenity(
      req.params.id,
      { amenity_name, amenity_detail },
      req.user.id
    );

    return res.status(200).json(successResponse(result, "편의시설이 수정되었습니다.", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(404).json(errorResponse("편의시설을 찾을 수 없거나 권한이 없습니다.", 404));
    }
    if (error.message === "AMENITY_NOT_FOUND") {
      return res.status(404).json(errorResponse("편의시설을 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

module.exports = {
  createOrUpdateAmenity,
  getAmenityByLodging,
  updateAmenity
};

