const pictureService = require("./service");
const { successResponse, errorResponse } = require("../common/response");
const mongoose = require("mongoose");

// 객실별 사진 목록 조회
const getPicturesByRoom = async (req, res) => {
  try {
    const result = await pictureService.getPicturesByRoom(req.params.roomId, req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json(errorResponse("객실을 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("권한이 없습니다.", 403));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 사진 추가
const createPicture = async (req, res) => {
  try {
    const { room_id, picture_name, picture_url } = req.body;

    if (!room_id || !picture_name || !picture_url) {
      return res.status(400).json(errorResponse("필수 필드가 누락되었습니다.", 400));
    }

    const result = await pictureService.createPicture({
      room_id,
      picture_name,
      picture_url
    }, req.user.id);

    return res.status(201).json(successResponse(result, "사진이 추가되었습니다.", 201));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json(errorResponse("객실을 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("권한이 없습니다.", 403));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 사진 삭제
const deletePicture = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const result = await pictureService.deletePicture(req.params.id, req.user.id);
    return res.status(200).json(successResponse(result, "사진이 삭제되었습니다.", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "PICTURE_NOT_FOUND") {
      return res.status(404).json(errorResponse("사진을 찾을 수 없습니다.", 404));
    }
    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json(errorResponse("객실을 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("권한이 없습니다.", 403));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

module.exports = {
  getPicturesByRoom,
  createPicture,
  deletePicture
};

