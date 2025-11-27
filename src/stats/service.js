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

// 기간 계산 헬퍼 함수
const getPeriodDates = (period = 'month') => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'year':
      startDate = new Date(now);
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      startDate = new Date(now);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
};

// 통계 조회 (쿼리 파라미터 기반)
const getStatistics = async (userId, params) => {
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 기본 통계 (대시보드와 유사하지만 쿼리 파라미터로 필터링 가능)
  const lodgingIds = await Lodging.find({ business_id: business._id }).distinct('_id');
  
  const [totalLodgings, totalRooms] = await Promise.all([
    Lodging.countDocuments({ business_id: business._id }),
    Room.countDocuments({ lodging_id: { $in: lodgingIds } })
  ]);

  return {
    totalLodgings,
    totalRooms
  };
};

// 매출 통계
const getRevenueStats = async (userId, period = 'month') => {
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const { startDate, endDate } = getPeriodDates(period);

  const bookings = await Booking.find({
    business_id: business._id,
    booking_status: { $in: ['confirmed', 'completed'] },
    createdAt: { $gte: startDate, $lte: endDate }
  }).select('_id').lean();

  const bookingIds = bookings.map(b => b._id);
  const payments = await Payment.find({
    booking_id: { $in: bookingIds }
  }).lean();

  const totalRevenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
  const totalBookings = bookings.length;
  const averageRevenue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  // 일별/월별 매출 추이
  const dailyRevenue = await Booking.aggregate([
    {
      $match: {
        business_id: business._id,
        booking_status: { $in: ['confirmed', 'completed'] },
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: period === 'year' ? '%Y-%m' : '%Y-%m-%d', date: '$createdAt' } },
        bookingIds: { $push: '$_id' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const dailyRevenueWithAmount = await Promise.all(
    dailyRevenue.map(async (day) => {
      const payments = await Payment.find({
        booking_id: { $in: day.bookingIds }
      }).lean();
      const revenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
      return {
        date: day._id,
        revenue
      };
    })
  );

  return {
    period,
    totalRevenue,
    totalBookings,
    averageRevenue: Math.round(averageRevenue),
    dailyRevenue: dailyRevenueWithAmount
  };
};

// 예약 통계
const getBookingStats = async (userId, period = 'month') => {
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const { startDate, endDate } = getPeriodDates(period);

  const [totalBookings, byStatus] = await Promise.all([
    Booking.countDocuments({
      business_id: business._id,
      createdAt: { $gte: startDate, $lte: endDate }
    }),
    Booking.aggregate([
      {
        $match: {
          business_id: business._id,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$booking_status',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const statusCounts = {
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0
  };

  byStatus.forEach(stat => {
    if (statusCounts.hasOwnProperty(stat._id)) {
      statusCounts[stat._id] = stat.count;
    }
  });

  // 일별 예약 추이
  const dailyBookings = await Booking.aggregate([
    {
      $match: {
        business_id: business._id,
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: period === 'year' ? '%Y-%m' : '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return {
    period,
    totalBookings,
    byStatus: statusCounts,
    dailyBookings: dailyBookings.map(d => ({ date: d._id, count: d.count }))
  };
};

// 점유율 통계
const getOccupancyStats = async (userId, period = 'month') => {
  const business = await Business.findOne({ login_id: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const { startDate, endDate } = getPeriodDates(period);

  // 전체 객실 수
  const lodgingIds = await Lodging.find({ business_id: business._id }).distinct('_id');
  const rooms = await Room.find({ lodging_id: { $in: lodgingIds } }).lean();
  const totalRooms = rooms.reduce((sum, r) => sum + (r.count_room || 1), 0);

  // 기간 내 예약된 객실 수 (확정 및 완료된 예약만)
  const bookings = await Booking.find({
    business_id: business._id,
    booking_status: { $in: ['confirmed', 'completed'] },
    checkin_date: { $lte: endDate },
    checkout_date: { $gte: startDate }
  }).lean();

  // 예약된 객실 수 계산 (날짜별로)
  const occupiedRooms = bookings.length; // 간단한 계산, 실제로는 날짜별로 계산 필요

  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

  // 숙소별 점유율
  const lodgingOccupancy = await Promise.all(
    lodgingIds.map(async (lodgingId) => {
      const lodgingRooms = await Room.find({ lodging_id: lodgingId }).lean();
      const lodgingTotalRooms = lodgingRooms.reduce((sum, r) => sum + (r.count_room || 1), 0);
      const lodgingRoomIds = lodgingRooms.map(r => r._id);
      
      const lodgingBookings = await Booking.countDocuments({
        business_id: business._id,
        room_id: { $in: lodgingRoomIds },
        booking_status: { $in: ['confirmed', 'completed'] },
        checkin_date: { $lte: endDate },
        checkout_date: { $gte: startDate }
      });

      const lodgingOccupancyRate = lodgingTotalRooms > 0 
        ? (lodgingBookings / lodgingTotalRooms) * 100 
        : 0;

      const lodging = await Lodging.findById(lodgingId).select('lodging_name').lean();

      return {
        lodgingId,
        lodgingName: lodging?.lodging_name || 'Unknown',
        totalRooms: lodgingTotalRooms,
        occupiedRooms: lodgingBookings,
        occupancyRate: Math.round(lodgingOccupancyRate * 10) / 10
      };
    })
  );

  return {
    period,
    totalRooms,
    occupiedRooms,
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    byLodging: lodgingOccupancy
  };
};

module.exports = {
  getDashboardStats,
  getStatistics,
  getRevenueStats,
  getBookingStats,
  getOccupancyStats
};

