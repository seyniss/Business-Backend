const Booking = require("./model");
const Payment = require("./payment");
const PaymentType = require("./paymentType");
const Room = require("../room/model");
const Lodging = require("../lodging/model");
const BusinessUser = require("../auth/model");
const mongoose = require("mongoose");

// 예약 가능 여부 체크 (트랜잭션 내에서 사용)
const checkRoomAvailability = async (roomId, checkinDate, checkoutDate, session) => {
  // 날짜가 겹치는 기존 예약 조회
  // 겹침 조건: 새 예약의 체크인이 기존 예약의 체크아웃 전이고, 새 예약의 체크아웃이 기존 예약의 체크인 후
  const overlappingBookings = await Booking.countDocuments({
    roomId: roomId,
    bookingStatus: { $in: ['pending', 'confirmed'] }, // pending과 confirmed만 카운트
    $and: [
      { checkinDate: { $lt: checkoutDate } }, // 새 예약의 체크인이 기존 예약의 체크아웃 전
      { checkoutDate: { $gt: checkinDate } }  // 새 예약의 체크아웃이 기존 예약의 체크인 후
    ]
  }).session(session);

  return overlappingBookings;
};

// 예약 생성 (트랜잭션 사용)
const createBooking = async (bookingData, userId) => {
  const { room_id, user_id, adult, child, checkin_date, checkout_date, duration } = bookingData;
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 트랜잭션 내에서 Room 조회
    const room = await Room.findById(room_id).session(session);
    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }

    // Lodging 조회를 통해 businessUserId 가져오기
    const lodging = await Lodging.findById(room.lodgingId).session(session);
    if (!lodging) {
      throw new Error("LODGING_NOT_FOUND");
    }

    const businessUserId = lodging.businessId;

    // 인원 수가 Room의 수용 인원 범위 내인지 확인
    const totalGuests = (Number(adult) || 0) + (Number(child) || 0);
    
    if (totalGuests < room.capacityMin || totalGuests > (room.maxGuests || room.capacityMax)) {
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
    if (existingBookingsCount >= (room.quantity || room.countRoom)) {
      throw new Error("ROOM_NOT_AVAILABLE");
    }

    // BusinessUser 유효성 검증 (트랜잭션 외부에서 조회해도 됨 - 읽기 전용)
    const user = await BusinessUser.findById(user_id);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // 예약 생성 (트랜잭션 내에서, 항상 pending 상태로 시작)
    const booking = await Booking.create([{
      roomId: room_id,
      userId: user_id,
      businessUserId: businessUserId,
      adult: adult || 0,
      child: child || 0,
      checkinDate: new Date(checkin_date),
      checkoutDate: new Date(checkout_date),
      duration,
      bookingStatus: 'pending',
      bookingDate: new Date()
    }], { session });

    // 트랜잭션 커밋
    await session.commitTransaction();

    // 트랜잭션 외부에서 관련 데이터 조회 (읽기 전용)
    const bookingObj = booking[0].toObject();
    
    const [roomData, userData, payment] = await Promise.all([
      Room.findById(bookingObj.roomId).lean().catch(() => null),
      BusinessUser.findById(bookingObj.userId).lean().catch(() => null),
      Payment.findOne({ bookingId: bookingObj._id })
        .populate('paymentTypeId')
        .lean()
        .catch(() => null)
    ]);

    const lodgingData = roomData && roomData.lodgingId
      ? await Lodging.findById(roomData.lodgingId).lean().catch(() => null)
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
const getBookings = async (filters, userId) => {
  const { status, lodgingId, startDate, endDate, search, page = 1, limit = 20 } = filters;

  const query = {};

  // 사업자의 사업 예약만 조회
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }
  query.businessUserId = user._id;

  if (status) {
    query.bookingStatus = status;
  }

  if (lodgingId) {
    const rooms = await Room.find({ lodgingId: lodgingId }).select('_id');
    const roomIds = rooms.map(r => r._id);
    if (roomIds.length > 0) {
      query.roomId = { $in: roomIds };
    } else {
      query.roomId = { $in: [] };
    }
  }

  if (startDate || endDate) {
    query.checkinDate = {};
    if (startDate) {
      query.checkinDate.$gte = new Date(startDate);
    }
    if (endDate) {
      query.checkinDate.$lte = new Date(endDate);
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
        if (!booking.roomId || !booking.userId || !booking._id) {
          return {
            booking: booking,
            room: null,
            lodging: null,
            user: null,
            payment: null
          };
        }

        const [room, user, payment] = await Promise.all([
          Room.findById(booking.roomId).lean().catch(() => null),
          BusinessUser.findById(booking.userId).lean().catch(() => null),
          Payment.findOne({ bookingId: booking._id })
            .populate('paymentTypeId')
            .lean()
            .catch(() => null)
        ]);
        
        const lodging = room && room.lodgingId 
          ? await Lodging.findById(room.lodgingId).lean().catch(() => null)
          : null;
        
        // 프론트엔드 요구사항에 맞게 응답 형식 변환
        const formattedBooking = {
          id: booking._id.toString(),
          hotelName: lodging?.lodgingName || 'Unknown',
          roomType: room?.roomName || room?.name || 'Unknown',
          guestName: user?.name || 'Unknown',
          guestEmail: user?.email || '',
          guestPhone: user?.phoneNumber || '',
          checkIn: booking.checkinDate ? new Date(booking.checkinDate).toISOString().split('T')[0] : '',
          checkOut: booking.checkoutDate ? new Date(booking.checkoutDate).toISOString().split('T')[0] : '',
          guests: (booking.adult || 0) + (booking.child || 0),
          amount: payment?.paid || 0,
          status: booking.bookingStatus || 'pending',
          createdAt: booking.createdAt ? new Date(booking.createdAt).toISOString().split('T')[0] : ''
        };
        
        return formattedBooking;
      } catch (err) {
        console.error("예약 데이터 처리 중 오류:", booking._id, err);
        return null; // 유효하지 않은 예약은 제외
      }
    })
  );
  
  let validBookings = bookingsWithPayment.filter(item => item !== null);

  // search 필터 적용 (guestName, hotelName, roomType에서 검색)
  if (search) {
    const searchLower = search.toLowerCase();
    validBookings = validBookings.filter(booking => {
      return (
        booking.guestName?.toLowerCase().includes(searchLower) ||
        booking.hotelName?.toLowerCase().includes(searchLower) ||
        booking.roomType?.toLowerCase().includes(searchLower)
      );
    });
  }

  return {
    bookings: validBookings,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page)
  };
};

// 예약 상세 조회
const getBookingById = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  // 사업자의 사업 예약인지 확인
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }
  if (String(booking.businessUserId) !== String(user._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const [room, guestUser, payment] = await Promise.all([
    Room.findById(booking.roomId).lean(),
    BusinessUser.findById(booking.userId).lean(),
    Payment.findOne({ bookingId: booking._id })
      .populate('paymentTypeId')
      .lean()
  ]);

  const lodging = room ? await Lodging.findById(room.lodgingId).lean() : null;

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  return {
    id: booking._id.toString(),
    hotelName: lodging?.lodgingName || 'Unknown',
    roomType: room?.roomName || room?.name || 'Unknown',
    guestName: guestUser?.name || 'Unknown',
    guestEmail: guestUser?.email || '',
    guestPhone: guestUser?.phoneNumber || '',
    checkIn: booking.checkinDate ? new Date(booking.checkinDate).toISOString().split('T')[0] : '',
    checkOut: booking.checkoutDate ? new Date(booking.checkoutDate).toISOString().split('T')[0] : '',
    guests: (booking.adult || 0) + (booking.child || 0),
    amount: payment?.paid || 0,
    status: booking.bookingStatus || 'pending',
    createdAt: booking.createdAt ? new Date(booking.createdAt).toISOString().split('T')[0] : ''
  };
};

// 예약 상태 변경
const updateBookingStatus = async (bookingId, status, cancellationReason, userId) => {
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    businessUserId: user._id
  });

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  const updates = { bookingStatus: status };
  
  // 취소 상태일 때만 취소 사유 저장
  if (status === 'cancelled' && cancellationReason) {
    updates.cancellationReason = cancellationReason;
  } else if (status !== 'cancelled') {
    // 취소 상태가 아니면 취소 사유 초기화
    updates.cancellationReason = null;
  }
  
  // Payment 자동 생성/업데이트 로직 제거
  // 결제는 별도 결제 API에서 처리하므로 여기서는 bookingStatus만 변경

  const updated = await Booking.findByIdAndUpdate(
    bookingId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  const [roomData, userData, paymentData] = await Promise.all([
    Room.findById(updated.roomId).lean(),
    BusinessUser.findById(updated.userId).lean(),
    Payment.findOne({ bookingId: updated._id })
      .populate('paymentTypeId')
      .lean()
  ]);

  const lodging = roomData ? await Lodging.findById(roomData.lodgingId).lean() : null;

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  return {
    id: updated._id.toString(),
    hotelName: lodging?.lodgingName || 'Unknown',
    roomType: roomData?.roomName || roomData?.name || 'Unknown',
    guestName: userData?.name || 'Unknown',
    guestEmail: userData?.email || '',
    guestPhone: userData?.phoneNumber || '',
    checkIn: updated.checkinDate ? new Date(updated.checkinDate).toISOString().split('T')[0] : '',
    checkOut: updated.checkoutDate ? new Date(updated.checkoutDate).toISOString().split('T')[0] : '',
    guests: (updated.adult || 0) + (updated.child || 0),
    amount: paymentData?.paid || 0,
    status: updated.bookingStatus || 'pending',
    createdAt: updated.createdAt ? new Date(updated.createdAt).toISOString().split('T')[0] : ''
  };
};

// 결제 상태 변경
const updatePaymentStatus = async (bookingId, paymentStatus, userId) => {
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    businessUserId: user._id
  });

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  // Booking 모델의 paymentStatus 업데이트
  const updates = { paymentStatus: paymentStatus };
  
  const paymentDoc = await Payment.findOne({ bookingId: bookingId });
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

  const [roomData, userData, paymentData] = await Promise.all([
    Room.findById(updated.roomId).lean(),
    BusinessUser.findById(updated.userId).lean(),
    Payment.findOne({ bookingId: bookingId })
      .populate('paymentTypeId')
      .lean()
  ]);

  const lodging = roomData ? await Lodging.findById(roomData.lodgingId).lean() : null;

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  return {
    id: updated._id.toString(),
    hotelName: lodging?.lodgingName || 'Unknown',
    roomType: roomData?.roomName || roomData?.name || 'Unknown',
    guestName: userData?.name || 'Unknown',
    guestEmail: userData?.email || '',
    guestPhone: userData?.phoneNumber || '',
    checkIn: updated.checkinDate ? new Date(updated.checkinDate).toISOString().split('T')[0] : '',
    checkOut: updated.checkoutDate ? new Date(updated.checkoutDate).toISOString().split('T')[0] : '',
    guests: (updated.adult || 0) + (updated.child || 0),
    amount: paymentData?.paid || 0,
    status: updated.bookingStatus || 'pending',
    createdAt: updated.createdAt ? new Date(updated.createdAt).toISOString().split('T')[0] : ''
  };
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  updatePaymentStatus
};

