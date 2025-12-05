const roomService = require("./service");
const { successResponse, errorResponse } = require("../common/response");
const mongoose = require("mongoose");

// 객실 목록 조회
const getRooms = async (req, res) => {
  try {
    const { lodgingId, status, search, page = 1, pageSize = 10 } = req.query;
    
    // lodgingId는 선택사항 (제공되면 해당 숙소의 객실만, 없으면 사업자의 모든 객실)
    if (lodgingId && !mongoose.Types.ObjectId.isValid(lodgingId)) {
      return res.status(400).json(errorResponse("잘못된 lodgingId 형식입니다.", 400));
    }

    const result = await roomService.getRooms(req.user.id, { lodgingId, status, search, page, pageSize });
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
      lodgingId,
      price,
      quantity,
      countRoom,
      checkInTime,
      checkOutTime,
      name,
      roomName,
      type,
      roomSize,
      maxGuests,
      capacityMax,
      capacityMin,
      ownerDiscount,
      platformDiscount,
      images,
      roomImage,
      amenities,
      description,
      status
    } = req.body;

    if (!lodgingId || !price || (!name && !roomName) || (!maxGuests && !capacityMax) || !capacityMin) {
      return res.status(400).json(errorResponse("필수 필드가 누락되었습니다.", 400));
    }

    const result = await roomService.createRoom({
      lodgingId,
      price,
      quantity,
      countRoom,
      checkInTime,
      checkOutTime,
      name,
      roomName,
      type,
      roomSize,
      maxGuests,
      capacityMax,
      capacityMin,
      ownerDiscount,
      platformDiscount,
      images,
      roomImage,
      amenities,
      description,
      status
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
      quantity,
      countRoom,
      checkInTime,
      checkOutTime,
      name,
      roomName,
      type,
      roomSize,
      maxGuests,
      capacityMax,
      capacityMin,
      ownerDiscount,
      platformDiscount,
      images,
      roomImage,
      amenities,
      description,
      status
    } = req.body;

    const result = await roomService.updateRoom(req.params.id, {
      price,
      quantity,
      countRoom,
      checkInTime,
      checkOutTime,
      name,
      roomName,
      type,
      roomSize,
      maxGuests,
      capacityMax,
      capacityMin,
      ownerDiscount,
      platformDiscount,
      images,
      roomImage,
      amenities,
      description,
      status
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

    // 프론트엔드는 available, unavailable, maintenance를 보내지만, 모델은 active, inactive, maintenance를 사용
    if (!status || !['available', 'unavailable', 'maintenance', 'active', 'inactive'].includes(status)) {
      return res.status(400).json(errorResponse("유효하지 않은 상태입니다. (available, unavailable, maintenance)", 400));
    }
    
    // 상태 값 매핑
    let mappedStatus = status;
    if (status === 'available') mappedStatus = 'active';
    else if (status === 'unavailable') mappedStatus = 'inactive';

    const result = await roomService.updateRoomStatus(req.params.id, mappedStatus, req.user.id);
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

