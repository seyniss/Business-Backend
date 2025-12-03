const Booking = require("./model");
const Payment = require("./payment");
const Room = require("../room/model");
const Lodging = require("../lodging/model");
const User = require("../auth/model");
const Business = require("../auth/business");
const mongoose = require("mongoose");

// 예약 가능 여부 체크 (트랜잭션 내에서 사용)
const checkRoomAvailability = async (roomId, checkinDate, checkoutDate, session) => {
  // 날짜가 겹치는 기존 예약 조회
  // 겹침 조건: 새 예약의 체크인이 기존 예약의 체크아웃 전이고, 새 예약의 체크아웃이 기존 예약의 체크인 후
  const overlappingBookings = await Booking.countDocuments({
    room_id: roomId,
    booking_status: { $in: ['pending', 'confirmed'] }, // pending과 confirmed만 카운트
    $and: [
      { checkin_date: { $lt: checkoutDate } }, // 새 예약의 체크인이 기존 예약의 체크아웃 전
      { checkout_date: { $gt: checkinDate } }  // 새 예약의 체크아웃이 기존 예약의 체크인 후
    ]
  }).session(session);

  return overlappingBookings;
};

// 예약 생성 (트랜잭션 사용)
const createBooking = async (bookingData, userId, userRole) => {
  const { room_id, user_id, adult, child, checkin_date, checkout_date, duration } = bookingData;
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 트랜잭션 내에서 Room 조회
    const room = await Room.findById(room_id).session(session);
    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }

    // Lodging 조회를 통해 business_id 가져오기
    const lodging = await Lodging.findById(room.lodging_id).session(session);
    if (!lodging) {
      throw new Error("LODGING_NOT_FOUND");
    }

    const business_id = lodging.business_id;

    // 인원 수가 Room의 수용 인원 범위 내인지 확인
    const totalGuests = (Number(adult) || 0) + (Number(child) || 0);
    
    if (totalGuests < room.capacity_min || totalGuests > room.capacity_max) {
      throw new Error("INVALID_GUEST_COUNT");
    }

    // 예약 가능 여부 체크 (트랜잭션 내에서)
    const existingBookingsCount = await checkRoomAvailability(
      room_id,
      new Date(checkin_date),
      new Date(checkout_date),
      session
    );

    // 방 수량 확인
    if (existingBookingsCount >= room.count_room) {
      throw new Error("ROOM_NOT_AVAILABLE");
    }

    // User 유효성 검증 (트랜잭션 외부에서 조회해도 됨 - 읽기 전용)
    const user = await User.findById(user_id);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // 예약 생성 (트랜잭션 내에서, 항상 pending 상태로 시작)
    const booking = await Booking.create([{
      room_id,
      user_id,
      business_id: business_id,
      adult: adult || 0,
      child: child || 0,
      checkin_date: new Date(checkin_date),
      checkout_date: new Date(checkout_date),
      duration,
      booking_status: 'pending',
      booking_date: new Date()
    }], { session });

    // 트랜잭션 커밋
    await session.commitTransaction();

    // 트랜잭션 외부에서 관련 데이터 조회 (읽기 전용)
    const bookingObj = booking[0].toObject();
    
    const [roomData, userData, payment] = await Promise.all([
      Room.findById(bookingObj.room_id).lean().catch(() => null),
      User.findById(bookingObj.user_id).lean().catch(() => null),
      Payment.findOne({ booking_id: bookingObj._id })
        .populate('payment_type_id')
        .lean()
        .catch(() => null)
    ]);

    const lodgingData = roomData && roomData.lodging_id
      ? await Lodging.findById(roomData.lodging_id).lean().catch(() => null)
      : null;

    return {
      booking: bookingObj,
      room: roomData || null,
      lodging: lodgingData || null,
      user: userData || null,
      payment: payment || null
    };
  } catch (error) {
    // 트랜잭션 롤백
    await session.abortTransaction();
    throw error;
  } finally {
    // 세션 종료
    session.endSession();
  }
};

// 예약 목록 조회
const getBookings = async (filters, userId, userRole) => {
  const { status, lodgingId, startDate, endDate, page = 1, limit = 20 } = filters;

  const query = {};

  // 사용자인 경우: 자신의 예약만 조회
  if (userRole === 'user') {
    query.user_id = userId;
  } 
  // 사업자인 경우: 자신의 사업 예약만 조회
  else if (userRole === 'business') {
    const business = await Business.findOne({ loginId: userId });
    if (!business) {
      throw new Error("BUSINESS_NOT_FOUND");
    }
    query.business_id = business._id;
  } else {
    throw new Error("UNAUTHORIZED");
  }

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
          User.findById(booking.user_id).lean().catch(() => null),
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
  
  const validBookings = bookingsWithPayment.filter(item => item && item.booking);

  return {
    bookings: validBookings,
    total: total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  };
};

// 예약 상세 조회
const getBookingById = async (bookingId, userId, userRole) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  // 사용자인 경우: 자신의 예약인지 확인
  if (userRole === 'user') {
    if (String(booking.user_id) !== String(userId)) {
      throw new Error("UNAUTHORIZED");
    }
  } 
  // 사업자인 경우: 자신의 사업 예약인지 확인
  else if (userRole === 'business') {
    const business = await Business.findOne({ loginId: userId });
    if (!business) {
      throw new Error("BUSINESS_NOT_FOUND");
    }
    if (String(booking.business_id) !== String(business._id)) {
      throw new Error("UNAUTHORIZED");
    }
  } else {
    throw new Error("UNAUTHORIZED");
  }

  const [room, user, payment] = await Promise.all([
    Room.findById(booking.room_id).lean(),
    User.findById(booking.user_id).lean(),
    Payment.findOne({ booking_id: booking._id })
      .populate('payment_type_id')
      .lean()
  ]);

  const lodging = room ? await Lodging.findById(room.lodging_id).lean() : null;

  return {
    booking: booking.toObject(),
    room: room || null,
    lodging: lodging || null,
    user: user || null,
    payment: payment || null
  };
};

// 예약 상태 변경
const updateBookingStatus = async (bookingId, status, cancellationReason, userId) => {
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    business_id: business._id
  });

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  const updates = { booking_status: status };
  
  // 취소 상태일 때만 취소 사유 저장
  if (status === 'cancelled' && cancellationReason) {
    updates.cancellation_reason = cancellationReason;
  } else if (status !== 'cancelled') {
    // 취소 상태가 아니면 취소 사유 초기화
    updates.cancellation_reason = null;
  }
  
  if (status === 'cancelled') {
    const payment = await Payment.findOne({ booking_id: bookingId });
    if (payment) {
      payment.paid = 0;
      await payment.save();
    }
    // 취소 시 결제 상태도 'refunded'로 변경
    updates.payment_status = 'refunded';
  }

  const updated = await Booking.findByIdAndUpdate(
    bookingId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  const [room, user, payment] = await Promise.all([
    Room.findById(updated.room_id).lean(),
    User.findById(updated.user_id).lean(),
    Payment.findOne({ booking_id: updated._id })
      .populate('payment_type_id')
      .lean()
  ]);

  const lodging = room ? await Lodging.findById(room.lodging_id).lean() : null;

  return {
    booking: updated.toObject(),
    room: room || null,
    lodging: lodging || null,
    user: user || null,
    payment: payment || null
  };
};

// 결제 상태 변경
const updatePaymentStatus = async (bookingId, paymentStatus, userId) => {
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    business_id: business._id
  });

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  // Booking 모델의 payment_status 업데이트
  const updates = { payment_status: paymentStatus };
  
  const paymentDoc = await Payment.findOne({ booking_id: bookingId });
  if (paymentDoc) {
    if (paymentStatus === 'paid') {
      paymentDoc.paid = paymentDoc.total;
    } else if (paymentStatus === 'refunded') {
      paymentDoc.paid = 0;
    }
    await paymentDoc.save();
  }

  const updated = await Booking.findByIdAndUpdate(
    bookingId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  const [room, user, payment] = await Promise.all([
    Room.findById(updated.room_id).lean(),
    User.findById(updated.user_id).lean(),
    Payment.findOne({ booking_id: bookingId })
      .populate('payment_type_id')
      .lean()
  ]);

  const lodging = room ? await Lodging.findById(room.lodging_id).lean() : null;

  return {
    booking: updated.toObject(),
    room: room || null,
    lodging: lodging || null,
    user: user || null,
    payment: payment || null
  };
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  updatePaymentStatus
};

