const bookingService = require("./service");
const statsService = require("../stats/service");
const { successResponse, errorResponse } = require("../common/response");
const mongoose = require("mongoose");

// 예약 생성
const createBooking = async (req, res) => {
  try {
    // 프론트엔드는 checkIn, checkOut을 보내지만, 서비스는 checkin_date, checkout_date를 기대
    const checkin_date = req.body.checkIn || req.body.checkin_date;
    const checkout_date = req.body.checkOut || req.body.checkout_date;
    const room_id = req.body.roomId || req.body.room_id;
    const { adult, child } = req.body;
    const user_id = req.user.id; // 로그인한 사용자의 ID 사용

    // 필수 필드 검증
    if (!room_id || !checkin_date || !checkout_date) {
      return res.status(400).json(errorResponse("필수 필드가 누락되었습니다. (roomId, checkIn, checkOut)", 400));
    }

    // ObjectId 형식 검증
    if (!mongoose.Types.ObjectId.isValid(room_id)) {
      return res.status(400).json(errorResponse("잘못된 room_id 형식입니다.", 400));
    }

    // 날짜 형식 검증 및 변환
    const checkinDate = new Date(checkin_date);
    const checkoutDate = new Date(checkout_date);
    
    if (isNaN(checkinDate.getTime())) {
      return res.status(400).json(errorResponse("유효하지 않은 checkin_date 형식입니다.", 400));
    }
    if (isNaN(checkoutDate.getTime())) {
      return res.status(400).json(errorResponse("유효하지 않은 checkout_date 형식입니다.", 400));
    }

    // 날짜 유효성 검증
    if (checkoutDate <= checkinDate) {
      return res.status(400).json(errorResponse("checkout_date는 checkin_date보다 이후여야 합니다.", 400));
    }

    // duration 자동 계산 (체크인-체크아웃 기간)
    const duration = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
    
    // duration 최소값 검증
    if (duration < 1) {
      return res.status(400).json(errorResponse("체크인과 체크아웃 날짜는 최소 1일 이상 차이가 나야 합니다.", 400));
    }

    // 인원 수 검증
    const adultCount = adult || 0;
    const childCount = child || 0;
    
    if (adultCount < 0 || childCount < 0) {
      return res.status(400).json(errorResponse("인원 수는 0 이상이어야 합니다.", 400));
    }

    const result = await bookingService.createBooking({
      room_id,
      user_id,
      adult: adultCount,
      child: childCount,
      checkin_date: checkinDate,
      checkout_date: checkoutDate,
      duration
    }, req.user.id);

    return res.status(201).json(successResponse(result, "예약이 생성되었습니다.", 201));
  } catch (error) {
    console.error("POST /api/bookings 실패", error);
    
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "ROOM_NOT_FOUND") {
      return res.status(404).json(errorResponse("객실을 찾을 수 없습니다.", 404));
    }
    if (error.message === "LODGING_NOT_FOUND") {
      return res.status(404).json(errorResponse("숙소를 찾을 수 없습니다.", 404));
    }
    if (error.message === "INVALID_GUEST_COUNT") {
      return res.status(400).json(errorResponse("인원 수가 객실 수용 인원 범위를 벗어났습니다.", 400));
    }
    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json(errorResponse("사용자를 찾을 수 없습니다.", 404));
    }
    if (error.message === "ROOM_NOT_AVAILABLE") {
      return res.status(409).json(errorResponse("해당 기간에 예약 가능한 방이 없습니다.", 409));
    }

    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 예약 목록 조회
const getBookings = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      lodgingId: req.query.lodgingId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search,
      page: req.query.page || 1,
      limit: req.query.pageSize || req.query.limit || 10
    };

    const result = await bookingService.getBookings(filters, req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    console.error("GET /api/bookings 실패", error);
    
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }

    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 예약 상세 조회
const getBookingById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    const result = await bookingService.getBookingById(req.params.id, req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    console.error("GET /api/bookings/:id 실패", error);
    
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "BOOKING_NOT_FOUND") {
      return res.status(404).json(errorResponse("예약을 찾을 수 없습니다.", 404));
    }
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json(errorResponse("해당 예약에 대한 접근 권한이 없습니다.", 403));
    }

    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 예약 상태 변경
const updateBookingStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    // req.body가 없는 경우 처리
    if (!req.body) {
      return res.status(400).json(errorResponse("요청 본문이 없습니다.", 400));
    }

    const { status, cancellationReason } = req.body;

    if (!status || !['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json(errorResponse("유효하지 않은 상태입니다.", 400));
    }

    const result = await bookingService.updateBookingStatus(req.params.id, status, cancellationReason, req.user.id);
    return res.status(200).json(successResponse(result, "예약 상태가 변경되었습니다.", 200));
  } catch (error) {
    console.error("PATCH /api/bookings/:id/status 실패", error);
    
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "BOOKING_NOT_FOUND") {
      return res.status(404).json(errorResponse("예약을 찾을 수 없습니다.", 404));
    }

    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 결제 상태 변경
const updatePaymentStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse("잘못된 id 형식입니다.", 400));
    }

    // req.body가 없는 경우 처리
    if (!req.body) {
      return res.status(400).json(errorResponse("요청 본문이 없습니다.", 400));
    }

    const { paymentStatus } = req.body;

    if (!paymentStatus || !['pending', 'paid', 'refunded', 'failed'].includes(paymentStatus)) {
      return res.status(400).json(errorResponse("유효하지 않은 결제 상태입니다.", 400));
    }

    const result = await bookingService.updatePaymentStatus(req.params.id, paymentStatus, req.user.id);
    return res.status(200).json(successResponse(result, "결제 상태가 변경되었습니다.", 200));
  } catch (error) {
    console.error("PATCH /api/bookings/:id/payment 실패", error);
    
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    if (error.message === "BOOKING_NOT_FOUND") {
      return res.status(404).json(errorResponse("예약을 찾을 수 없습니다.", 404));
    }

    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 예약 통계
const getBookingStats = async (req, res) => {
  try {
    const result = await statsService.getDashboardStats(req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    console.error("GET /api/business/bookings/stats 실패", error);
    
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  updatePaymentStatus,
  getBookingStats
};

