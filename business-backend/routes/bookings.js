const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");  // Reservation → Booking
const Payment = require("../models/Payment");
const Lodging = require("../models/Lodging");
const Room = require("../models/Room");  // OwnHotel → Room
const Business = require("../models/Business");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 예약 목록 조회 (필터링 지원)
router.get("/", async (req, res) => {
  try {
    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const { status, hotelId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = { business_id: business._id };  // business → business_id

    if (status) {
      query.booking_status = status;  // status → booking_status
    }

    if (hotelId) {
      // hotelId는 room_id를 통해 조회해야 할 수도 있음
    }

    if (startDate || endDate) {
      query.checkin_date = {};  // start_date → checkin_date
      if (startDate) {
        query.checkin_date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.checkin_date.$lte = new Date(endDate);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([  // reservations → bookings
      Booking.find(query)  // Reservation → Booking
        .populate('room_id', 'room_name price')  // own_hotel_id → room_id
        .populate('user_id', 'email user_name')  // fullname → user_name
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Booking.countDocuments(query)  // Reservation → Booking
    ]);

    // 각 예약의 결제 정보 포함
    const bookingsWithPayment = await Promise.all(  // reservationsWithPayment → bookingsWithPayment
      bookings.map(async (booking) => {  // reservation → booking
        const payment = await Payment.findOne({ booking_id: booking._id })  // reserve_id → booking_id
          .populate('payment_type_id')
          .lean();
        return {
          ...booking,
          payment: payment || null
        };
      })
    );

    res.json({
      bookings: bookingsWithPayment,  // reservations → bookings
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error("GET /api/bookings 실패", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 예약 상세 조회
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "잘못된 id 형식입니다." });
    }

    const booking = await Booking.findOne({  // reservation → booking, Reservation → Booking
      _id: req.params.id,
      business_id: req.user.id  // business → business_id
    })
      .populate('room_id')  // own_hotel_id → room_id
      .populate('user_id');

    if (!booking) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    const payment = await Payment.findOne({ booking_id: booking._id })  // reserve_id → booking_id
      .populate('payment_type_id')
      .lean();

    res.json({
      ...booking.toObject(),
      payment: payment || null
    });
  } catch (error) {
    console.error("GET /api/bookings/:id 실패", error);
    res.status(500).json({ message: "서버 오류" });
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

    const booking = await Booking.findOne({  // reservation → booking, Reservation → Booking
      _id: req.params.id,
      business_id: req.user.id  // business → business_id
    });

    if (!booking) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    const updates = { booking_status: status };  // status → booking_status
    
    // 취소 시 결제 환불 처리
    if (status === 'cancelled') {
      const payment = await Payment.findOne({ booking_id: req.params.id });  // reserve_id → booking_id
      if (payment) {
        payment.paid = 0;
        await payment.save();
      }
    }

    const updated = await Booking.findByIdAndUpdate(  // Reservation → Booking
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('room_id', 'room_name price')  // own_hotel_id → room_id
      .populate('user_id', 'email user_name');  // fullname → user_name

    const payment = await Payment.findOne({ booking_id: updated._id })  // reserve_id → booking_id
      .populate('payment_type_id')
      .lean();

    res.json({
      ...updated.toObject(),
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

    const booking = await Booking.findOne({  // reservation → booking, Reservation → Booking
      _id: req.params.id,
      business_id: req.user.id  // business → business_id
    });

    if (!booking) {
      return res.status(404).json({ message: "예약을 찾을 수 없습니다." });
    }

    // Payment 모델 업데이트
    const payment = await Payment.findOne({ booking_id: req.params.id });  // reserve_id → booking_id
    if (payment) {
      if (paymentStatus === 'paid') {
        payment.paid = payment.total;
      } else if (paymentStatus === 'refunded') {
        payment.paid = 0;
      }
      await payment.save();
    }

    const updated = await Booking.findById(req.params.id)  // Reservation → Booking
      .populate('room_id', 'room_name price')  // own_hotel_id → room_id
      .populate('user_id', 'email user_name');  // fullname → user_name

    const updatedPayment = await Payment.findOne({ booking_id: req.params.id })  // reserve_id → booking_id
      .populate('payment_type_id')
      .lean();

    res.json({
      ...updated.toObject(),
      payment: updatedPayment || null
    });
  } catch (error) {
    console.error("PATCH /api/bookings/:id/payment 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;
