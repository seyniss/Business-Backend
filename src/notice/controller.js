const noticeService = require("./service");
const { successResponse, errorResponse } = require("../common/response");
const mongoose = require("mongoose");

// 공지사항 생성/수정
const createOrUpdateNotice = async (req, res) => {
  try {
    const { room_id, content, usage_guide, introduction } = req.body;

    if (!room_id) {
      return res.status(400).json(errorResponse("room_id는 필수입니다.", 400));
    }

    const result = await noticeService.createOrUpdateNotice({
      room_id,
      content,
      usage_guide,
      introduction
    }, req.user.id);

    return res.status(201).json(successResponse(result, "공지사항이 생성/수정되었습니다.", 201));
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

// 객실별 공지사항 조회
const getNoticeByRoom = async (req, res) => {
  try {
    const result = await noticeService.getNoticeByRoom(req.params.roomId, req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json(errorResponse("객실을 찾을 수 없습니다.", 404));
    }
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("권한이 없습니다.", 403));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 공지사항 수정
const updateNotice = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const { content, usage_guide, introduction } = req.body;

    const result = await noticeService.updateNotice(
      req.params.id,
      { content, usage_guide, introduction },
      req.user.id
    );

    return res.status(200).json(successResponse(result, "공지사항이 수정되었습니다.", 200));
  } catch (error) {
    if (error.message === "NOTICE_NOT_FOUND") {
      return res.status(404).json(errorResponse("공지사항을 찾을 수 없습니다.", 404));
    }
    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json(errorResponse("객실을 찾을 수 없습니다.", 404));
    }
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("권한이 없습니다.", 403));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

module.exports = {
  createOrUpdateNotice,
  getNoticeByRoom,
  updateNotice
};

