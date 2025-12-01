const roomService = require("./service");
const { successResponse, errorResponse } = require("../common/response");
const mongoose = require("mongoose");

// 객실 목록 조회 (쿼리 파라미터로 lodgingId 전달)
const getRooms = async (req, res) => {
  try {
    const { lodgingId } = req.query;
    
    if (!lodgingId) {
      return res.status(400).json(errorResponse("lodgingId 쿼리 파라미터가 필요합니다.", 400));
    }
    
    if (!mongoose.Types.ObjectId.isValid(lodgingId)) {
      return res.status(400).json(errorResponse("잘못된 lodgingId 형식입니다.", 400));
    }

    const result = await roomService.getRooms(lodgingId, req.user.id);
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

// 객실 상세 조회
const getRoomById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const result = await roomService.getRoomById(req.params.id, req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json(errorResponse("객실을 찾을 수 없습니다.", 404));
    }
    if (error.message === "LODGING_NOT_FOUND") {
      return res.status(404).json(errorResponse("숙소를 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("권한이 없습니다.", 403));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 객실 생성
const createRoom = async (req, res) => {
  try {
    const {
      lodging_id,
      price,
      count_room,
      check_in_time,
      check_out_time,
      room_name,
      room_size,
      capacity_max,
      capacity_min,
      owner_discount,
      platform_discount,
      room_image
    } = req.body;

    if (!lodging_id || !price || !room_name || !capacity_max || !capacity_min) {
      return res.status(400).json(errorResponse("필수 필드가 누락되었습니다.", 400));
    }

    const result = await roomService.createRoom({
      lodging_id,
      price,
      count_room,
      check_in_time,
      check_out_time,
      room_name,
      room_size,
      capacity_max,
      capacity_min,
      owner_discount,
      platform_discount,
      room_image
    }, req.user.id);

    return res.status(201).json(successResponse(result, "객실이 생성되었습니다.", 201));
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

// 객실 수정
const updateRoom = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const {
      price,
      count_room,
      check_in_time,
      check_out_time,
      room_name,
      room_size,
      capacity_max,
      capacity_min,
      owner_discount,
      platform_discount,
      room_image
    } = req.body;

    const result = await roomService.updateRoom(req.params.id, {
      price,
      count_room,
      check_in_time,
      check_out_time,
      room_name,
      room_size,
      capacity_max,
      capacity_min,
      owner_discount,
      platform_discount,
      room_image
    }, req.user.id);

    return res.status(200).json(successResponse(result, "객실이 수정되었습니다.", 200));
  } catch (error) {
    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json(errorResponse("객실을 찾을 수 없습니다.", 404));
    }
    if (error.message === "LODGING_NOT_FOUND") {
      return res.status(404).json(errorResponse("숙소를 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("권한이 없습니다.", 403));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 객실 삭제
const deleteRoom = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const result = await roomService.deleteRoom(req.params.id, req.user.id);
    return res.status(200).json(successResponse(result, "객실이 삭제되었습니다.", 200));
  } catch (error) {
    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json(errorResponse("객실을 찾을 수 없습니다.", 404));
    }
    if (error.message === "LODGING_NOT_FOUND") {
      return res.status(404).json(errorResponse("숙소를 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("권한이 없습니다.", 403));
    }
    if (error.message === "HAS_BOOKINGS") {
      return res.status(400).json(errorResponse("예약이 있어 객실을 삭제할 수 없습니다.", 400));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 객실 상태 변경
const updateRoomStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const { status } = req.body;

    if (!status || !['active', 'inactive', 'maintenance'].includes(status)) {
      return res.status(400).json(errorResponse("유효하지 않은 상태입니다. (active, inactive, maintenance)", 400));
    }

    const result = await roomService.updateRoomStatus(req.params.id, status, req.user.id);
    return res.status(200).json(successResponse(result, "객실 상태가 변경되었습니다.", 200));
  } catch (error) {
    console.error("PATCH /api/business/rooms/:id/status 실패", error);
    
    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json(errorResponse("객실을 찾을 수 없습니다.", 404));
    }
    if (error.message === "LODGING_NOT_FOUND") {
      return res.status(404).json(errorResponse("숙소를 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("권한이 없습니다.", 403));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

module.exports = {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  updateRoomStatus
};

