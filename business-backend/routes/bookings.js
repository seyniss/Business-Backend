const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Room = require("../models/Room");
const Lodging = require("../models/Lodging");
const User = require("../models/User");
const Business = require("../models/Business");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 예약 생성 => 개발용, 프론트엔드 테스트 후 삭제
router.post("/", async (req, res) => {
  try {
    const { room_id, user_id, adult, child, checkin_date, checkout_date, duration, booking_status } = req.body;

    // 필수 필드 검증
    if (!room_id || !user_id || !checkin_date || !checkout_date || !duration) {
      return res.status(400).json({ message: "필수 필드가 누락되었습니다. (room_id, user_id, checkin_date, checkout_date, duration)" });
    }

    // ObjectId 형식 검증
    if (!mongoose.Types.ObjectId.isValid(room_id)) {
      return res.status(400).json({ message: "잘못된 room_id 형식입니다." });
    }
    if (!mongoose.Types.ObjectId.isValid(user_id)) {
      return res.status(400).json({ message: "잘못된 user_id 형식입니다." });
    }

    // 날짜 형식 검증 및 변환
    const checkinDate = new Date(checkin_date);
    const checkoutDate = new Date(checkout_date);
    
    if (isNaN(checkinDate.getTime())) {
      return res.status(400).json({ message: "유효하지 않은 checkin_date 형식입니다." });
    }
    if (isNaN(checkoutDate.getTime())) {
      return res.status(400).json({ message: "유효하지 않은 checkout_date 형식입니다." });
    }

    // 날짜 유효성 검증
    if (checkoutDate <= checkinDate) {
      return res.status(400).json({ message: "checkout_date는 checkin_date보다 이후여야 합니다." });
    }

    // duration 계산 검증
    const calculatedDuration = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
    if (duration !== calculatedDuration) {
      return res.status(400).json({ 
        message: `duration이 날짜 차이와 일치하지 않습니다. 계산된 duration: ${calculatedDuration}` 
      });
    }

    // duration 최소값 검증
    if (duration < 1) {
      return res.status(400).json({ message: "duration은 최소 1일 이상이어야 합니다." });
    }

    // 인원 수 검증
    const adultCount = adult || 0;
    const childCount = child || 0;
    const totalGuests = adultCount + childCount;
    
    if (adultCount < 0 || childCount < 0) {
      return res.status(400).json({ message: "인원 수는 0 이상이어야 합니다." });
    }

    // Business 정보 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    // Room 조회 및 소유권 검증
    const room = await Room.findById(room_id);
    if (!room) {
      return res.status(404).json({ message: "객실을 찾을 수 없습니다." });
    }

    // Room이 해당 business의 lodging에 속하는지 확인
    const lodging = await Lodging.findOne({
      _id: room.lodging_id,
      business_id: business._id
    });
    
    if (!lodging) {
      return res.status(403).json({ message: "해당 객실은 본인의 사업에 속하지 않습니다." });
    }

    // 인원 수가 Room의 수용 인원 범위 내인지 확인
    if (totalGuests < room.capacity_min || totalGuests > room.capacity_max) {
      return res.status(400).json({ 
        message: `인원 수는 ${room.capacity_min}명 이상 ${room.capacity_max}명 이하여야 합니다.` 
      });
    }

    // User 유효성 검증
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    // booking_status 검증
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    const status = booking_status || 'pending';
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `유효하지 않은 booking_status입니다. 가능한 값: ${validStatuses.join(', ')}` 
      });
    }

    // 예약 생성
    const booking = await Booking.create({
      room_id,
      user_id,
      business_id: business._id,
      adult: adultCount,
      child: childCount,
      checkin_date: checkinDate,
      checkout_date: checkoutDate,
      duration,
      booking_status: status,
      booking_date: new Date()
    });

    // 생성된 예약 정보와 관련 데이터 조회
    const bookingObj = booking.toObject();
    
    const [roomData, userData, payment] = await Promise.all([
      Room.findById(bookingObj.room_id).lean().catch(err => {
        console.error("Room 조회 실패:", bookingObj.room_id, err);
        return null;
      }),
      User.findById(bookingObj.user_id).select('-password').lean().catch(err => {
        console.error("User 조회 실패:", bookingObj.user_id, err);
        return null;
      }),
      Payment.findOne({ booking_id: bookingObj._id })
        .populate('payment_type_id')
        .lean()
        .catch(err => {
          console.error("Payment 조회 실패:", bookingObj._id, err);
          return null;
        })
    ]);

    const lodgingData = roomData && roomData.lodging_id
      ? await Lodging.findById(roomData.lodging_id).lean().catch(err => {
          console.error("Lodging 조회 실패:", roomData.lodging_id, err);
          return null;
        })
      : null;

    const response = {
      booking: bookingObj,
      room: roomData || null,
      lodging: lodgingData || null,
      user: userData || null,
      payment: payment || null
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("POST /api/bookings 실패", error);
    console.error("에러 스택:", error.stack);
    if (!res.headersSent) {
      res.status(500).json({ message: "서버 오류", error: error.message });
    }
  }
});

// 예약 목록 조회 (필터링 지원)
router.get("/", async (req, res) => {
  try {
    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const { status, lodgingId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = { business_id: business._id };

    if (status) {
      query.booking_status = status;
    }

    if (lodgingId) {
      const rooms = await Room.find({ lodging_id: lodgingId }).select('_id');
      const roomIds = rooms.map(r => r._id);
      if (roomIds.length > 0) {
        query.room_id = { $in: roomIds };
      } else {
        query.room_id = { $in: [] };
      }
    }

    if (startDate || endDate) {
      query.checkin_date = {};
      if (startDate) {
        query.checkin_date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.checkin_date.$lte = new Date(endDate);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Booking.countDocuments(query)
    ]);

    const bookingsWithPayment = await Promise.all(
      bookings.map(async (booking) => {
        try {
          if (!booking.room_id || !booking.user_id || !booking._id) {
            return {
              booking: booking,
              room: null,
              lodging: null,
              user: null,
              payment: null
            };
          }

          const [room, user, payment] = await Promise.all([
            Room.findById(booking.room_id).lean().catch(() => null),
            User.findById(booking.user_id).select('-password').lean().catch(() => null),
            Payment.findOne({ booking_id: booking._id })
              .populate('payment_type_id')
              .lean()
              .catch(() => null)
          ]);
          
          const lodging = room && room.lodging_id 
            ? await Lodging.findById(room.lodging_id).lean().catch(() => null)
            : null;
          
          return {
            booking: booking,
            room: room || null,
            lodging: lodging || null,
            user: user || null,
            payment: payment || null
          };
        } catch (err) {
          console.error("예약 데이터 처리 중 오류:", booking._id, err);
          return {
            booking: booking,
            room: null,
            lodging: null,
            user: null,
            payment: null
          };
        }
      })
    );
    
    // null이나 undefined가 아닌 유효한 예약만 필터링
    const validBookings = bookingsWithPayment.filter(item => item && item.booking);

    const response = {
      bookings: validBookings,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    };

    res.json(response);
  } catch (error) {
    console.error("GET /api/bookings 실패", error);
    console.error("에러 스택:", error.stack);
    if (!res.headersSent) {
      res.status(500).json({ message: "서버 오류", error: error.message });
    }
  }
});

// 예약 상세 조회
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      business_id: business._id
    });

    if (!booking) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    const [room, user, payment] = await Promise.all([
      Room.findById(booking.room_id).lean(),
      User.findById(booking.user_id).select('-password').lean(),
      Payment.findOne({ booking_id: booking._id })
        .populate('payment_type_id')
        .lean()
    ]);

    const lodging = room ? await Lodging.findById(room.lodging_id).lean() : null;

    const response = {
      booking: booking.toObject(),
      room: room || null,
      lodging: lodging || null,
      user: user || null,
      payment: payment || null
    };

    res.json(response);
  } catch (error) {
    console.error("GET /api/bookings/:id 실패", error);
    console.error("에러 스택:", error.stack);
    if (!res.headersSent) {
      res.status(500).json({ message: "서버 오류", error: error.message });
    }
  }
});

// 예약 상태 변경 (승인/취소)
router.patch("/:id/status", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const { status, cancellationReason } = req.body;

    if (!status || !['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ message: "유효하지 않은 상태입니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      business_id: business._id
    });

    if (!booking) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    const updates = { booking_status: status };
    
    if (status === 'cancelled') {
      const payment = await Payment.findOne({ booking_id: req.params.id });
      if (payment) {
        payment.paid = 0;
        await payment.save();
      }
    }

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    const [room, user, payment] = await Promise.all([
      Room.findById(updated.room_id).lean(),
      User.findById(updated.user_id).select('-password').lean(),
      Payment.findOne({ booking_id: updated._id })
        .populate('payment_type_id')
        .lean()
    ]);

    const lodging = room ? await Lodging.findById(room.lodging_id).lean() : null;

    res.json({
      booking: updated.toObject(),
      room: room || null,
      lodging: lodging || null,
      user: user || null,
      payment: payment || null
    });
  } catch (error) {
    console.error("PATCH /api/bookings/:id/status 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 결제 상태 변경
router.patch("/:id/payment", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const { paymentStatus, paymentMethod } = req.body;

    if (!paymentStatus || !['pending', 'paid', 'refunded', 'failed'].includes(paymentStatus)) {
      return res.status(400).json({ message: "유효하지 않은 결제 상태입니다." });
    }

    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      business_id: business._id
    });

    if (!booking) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    const paymentDoc = await Payment.findOne({ booking_id: req.params.id });
    if (paymentDoc) {
      if (paymentStatus === 'paid') {
        paymentDoc.paid = paymentDoc.total;
      } else if (paymentStatus === 'refunded') {
        paymentDoc.paid = 0;
      }
      await paymentDoc.save();
    }

    const updated = await Booking.findById(req.params.id);

    const [room, user, payment] = await Promise.all([
      Room.findById(updated.room_id).lean(),
      User.findById(updated.user_id).select('-password').lean(),
      Payment.findOne({ booking_id: req.params.id })
        .populate('payment_type_id')
        .lean()
    ]);

    const lodging = room ? await Lodging.findById(room.lodging_id).lean() : null;

    res.json({
      booking: updated.toObject(),
      room: room || null,
      lodging: lodging || null,
      user: user || null,
      payment: payment || null
    });
  } catch (error) {
    console.error("PATCH /api/bookings/:id/payment 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;
