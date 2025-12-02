const lodgingService = require("./service");
const { successResponse, errorResponse } = require("../common/response");
const mongoose = require("mongoose");

// 숙소 목록 조회
const getLodgings = async (req, res) => {
  try {
    const result = await lodgingService.getLodgings(req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 숙소 상세 조회
const getLodgingById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const result = await lodgingService.getLodgingById(req.params.id, req.user.id);
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

// 숙소 생성
const createLodging = async (req, res) => {
  try {
    const {
      lodgingName,
      address,
      rating,
      description,
      images,
      country,
      category,
      hashtag,
      amenityName,
      amenityDetail,
      minPrice,
      lat,
      lng,
      reviewCount
    } = req.body;

    // 필수 필드 검증
    if (!lodgingName || !address || !rating || !description || !images || !country || !category) {
      return res.status(400).json(errorResponse("필수 필드가 누락되었습니다.", 400));
    }

    // images 배열 검증
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json(errorResponse("이미지는 최소 1개 이상 필요합니다.", 400));
    }

    // rating 범위 검증
    if (rating < 1 || rating > 5) {
      return res.status(400).json(errorResponse("등급은 1~5 사이의 값이어야 합니다.", 400));
    }

    // category 검증
    const validCategories = ["호텔", "모텔", "리조트", "게스트하우스", "에어비앤비"];
    if (!validCategories.includes(category)) {
      return res.status(400).json(errorResponse(`카테고리는 다음 중 하나여야 합니다: ${validCategories.join(", ")}`, 400));
    }

    // minPrice 검증
    if (minPrice !== undefined && (typeof minPrice !== 'number' || minPrice < 0)) {
      return res.status(400).json(errorResponse("최저 가격은 0 이상의 숫자여야 합니다.", 400));
    }

    // lat, lng 검증 (제공된 경우)
    if (lat !== undefined && (typeof lat !== 'number' || lat < -90 || lat > 90)) {
      return res.status(400).json(errorResponse("위도(lat)는 -90과 90 사이의 값이어야 합니다.", 400));
    }
    if (lng !== undefined && (typeof lng !== 'number' || lng < -180 || lng > 180)) {
      return res.status(400).json(errorResponse("경도(lng)는 -180과 180 사이의 값이어야 합니다.", 400));
    }

    // reviewCount 검증
    if (reviewCount !== undefined && (typeof reviewCount !== 'number' || reviewCount < 0)) {
      return res.status(400).json(errorResponse("리뷰 개수는 0 이상의 숫자여야 합니다.", 400));
    }

    const result = await lodgingService.createLodging({
      lodgingName,
      address,
      rating,
      description,
      images,
      country,
      category,
      hashtag,
      amenityName,
      amenityDetail,
      minPrice,
      lat,
      lng,
      reviewCount
    }, req.user.id);

    return res.status(201).json(successResponse(result, "숙소가 생성되었습니다.", 201));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message.includes("좌표 변환 실패") || error.message.includes("주소 또는 좌표가 필요")) {
      return res.status(400).json(errorResponse(error.message, 400));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 숙소 수정
const updateLodging = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const {
      lodgingName,
      address,
      rating,
      description,
      images,
      country,
      category,
      hashtag,
      amenityName,
      amenityDetail,
      minPrice,
      lat,
      lng,
      reviewCount
    } = req.body;

    // 유효성 검증
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json(errorResponse("등급은 1~5 사이의 값이어야 합니다.", 400));
    }

    const validCategories = ["호텔", "모텔", "리조트", "게스트하우스", "에어비앤비"];
    if (category !== undefined && !validCategories.includes(category)) {
      return res.status(400).json(errorResponse(`카테고리는 다음 중 하나여야 합니다: ${validCategories.join(", ")}`, 400));
    }

    // minPrice 검증
    if (minPrice !== undefined && (typeof minPrice !== 'number' || minPrice < 0)) {
      return res.status(400).json(errorResponse("최저 가격은 0 이상의 숫자여야 합니다.", 400));
    }

    // lat, lng 검증 (제공된 경우)
    if (lat !== undefined && (typeof lat !== 'number' || lat < -90 || lat > 90)) {
      return res.status(400).json(errorResponse("위도(lat)는 -90과 90 사이의 값이어야 합니다.", 400));
    }
    if (lng !== undefined && (typeof lng !== 'number' || lng < -180 || lng > 180)) {
      return res.status(400).json(errorResponse("경도(lng)는 -180과 180 사이의 값이어야 합니다.", 400));
    }

    // reviewCount 검증
    if (reviewCount !== undefined && (typeof reviewCount !== 'number' || reviewCount < 0)) {
      return res.status(400).json(errorResponse("리뷰 개수는 0 이상의 숫자여야 합니다.", 400));
    }

    const result = await lodgingService.updateLodging(req.params.id, {
      lodgingName,
      address,
      rating,
      description,
      images,
      country,
      category,
      hashtag,
      amenityName,
      amenityDetail,
      minPrice,
      lat,
      lng,
      reviewCount
    }, req.user.id);

    return res.status(200).json(successResponse(result, "숙소가 수정되었습니다.", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "LODGING_NOT_FOUND") {
      return res.status(404).json(errorResponse("숙소를 찾을 수 없습니다.", 404));
    }
    if (error.message.includes("좌표 변환 실패")) {
      return res.status(400).json(errorResponse(error.message, 400));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 숙소 삭제
const deleteLodging = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const result = await lodgingService.deleteLodging(req.params.id, req.user.id);
    return res.status(200).json(successResponse(result, "숙소가 삭제되었습니다.", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "LODGING_NOT_FOUND") {
      return res.status(404).json(errorResponse("숙소를 찾을 수 없습니다.", 404));
    }
    if (error.message === "HAS_BOOKINGS") {
      return res.status(400).json(errorResponse("예약이 있어 숙소를 삭제할 수 없습니다.", 400));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

module.exports = {
  getLodgings,
  getLodgingById,
  createLodging,
  updateLodging,
  deleteLodging
};

