const Booking = require("../booking/model");
const Payment = require("../booking/payment");
const Lodging = require("../lodging/model");
const Room = require("../room/model");
const Business = require("../auth/business");

// 대시보드 통계
const getDashboardStats = async (userId) => {
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 오늘 날짜 범위
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 기본 통계
  const lodgingIds = await Lodging.find({ business_id: business._id }).distinct('_id');
  
  const [totalLodgings, totalRooms, todayBookings, pendingBookings] = await Promise.all([
    Lodging.countDocuments({ business_id: business._id }),
    Room.countDocuments({ lodging_id: { $in: lodgingIds } }),
    Booking.countDocuments({
      business_id: business._id,
      createdAt: { $gte: today }
    }),
    Booking.countDocuments({
      business_id: business._id,
      booking_status: 'pending'
    })
  ]);

  // 매출 통계 (이번 달)
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const bookings = await Booking.find({
    business_id: business._id,
    booking_status: { $in: ['confirmed', 'completed'] },
    createdAt: { $gte: thisMonthStart }
  }).select('_id').lean();

  const bookingIds = bookings.map(b => b._id);
  const payments = await Payment.find({
    booking_id: { $in: bookingIds }
  }).lean();

  const thisMonthRevenue = {
    total: payments.reduce((sum, p) => sum + (p.paid || 0), 0),
    count: bookings.length
  };

  // 이번 달 예약 추이 (일별)
  const dailyBookings = await Booking.aggregate([
    {
      $match: {
        business_id: business._id,
        createdAt: { $gte: thisMonthStart }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        bookingIds: { $push: '$_id' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // 각 일별 예약의 결제 금액 계산
  const dailyBookingsWithRevenue = await Promise.all(
    dailyBookings.map(async (day) => {
      const payments = await Payment.find({
        booking_id: { $in: day.bookingIds }
      }).lean();
      const revenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
      return {
        _id: day._id,
        count: day.count,
        revenue
      };
    })
  );

  // 호텔별 예약 수
  const hotelStats = await Booking.aggregate([
    {
      $match: {
        business_id: business._id,
        createdAt: { $gte: thisMonthStart }
      }
    },
    {
      $group: {
        _id: '$room_id',
        count: { $sum: 1 },
        bookingIds: { $push: '$_id' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  // 각 호텔별 결제 금액 계산
  const hotelStatsWithRevenue = await Promise.all(
    hotelStats.map(async (stat) => {
      const payments = await Payment.find({
        booking_id: { $in: stat.bookingIds }
      }).lean();
      const revenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
      return {
        _id: stat._id,
        count: stat.count,
        revenue
      };
    })
  );

  // 호텔 정보와 함께 조인
  const topRoomIds = hotelStatsWithRevenue.map(h => h._id);
  const rooms = await Room.find({ _id: { $in: topRoomIds } }).select('room_name').lean();
  const roomMap = {};
  rooms.forEach(r => { roomMap[r._id.toString()] = r.room_name; });

  const roomStatsWithNames = hotelStatsWithRevenue.map(stat => ({
    roomId: stat._id,
    roomName: roomMap[stat._id.toString()] || 'Unknown',
    count: stat.count,
    revenue: stat.revenue
  }));

  return {
    overview: {
      totalLodgings,
      totalRooms,
      todayBookings,
      pendingBookings,
      thisMonthRevenue: thisMonthRevenue.total || 0,
      thisMonthBookings: thisMonthRevenue.count || 0
    },
    dailyBookings: dailyBookingsWithRevenue,
    topRooms: roomStatsWithNames
  };
};

module.exports = {
  getDashboardStats
};

