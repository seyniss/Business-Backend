const Booking = require("../booking/model");
const Payment = require("../booking/payment");
const Lodging = require("../lodging/model");
const Room = require("../room/model");
const Business = require("../auth/business");

// 대시보드 통계
const getDashboardStats = async (userId) => {
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 오늘 날짜 범위
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 기본 통계
  const lodgingIds = await Lodging.find({ businessId: business._id }).distinct('_id');
  
  const [totalLodgings, totalRooms, todayBookings, pendingBookings, activeRooms] = await Promise.all([
    Lodging.countDocuments({ businessId: business._id }),
    Room.countDocuments({ lodgingId: { $in: lodgingIds } }),
    Booking.countDocuments({
      businessId: business._id,
      createdAt: { $gte: today }
    }),
    Booking.countDocuments({
      businessId: business._id,
      bookingStatus: 'pending'
    }),
    // 활성객실: 현재 체크인되어 있는 예약 수
    Booking.countDocuments({
      businessId: business._id,
      bookingStatus: { $in: ['confirmed', 'completed'] },
      checkinDate: { $lte: today },
      checkoutDate: { $gte: today }
    })
  ]);

  // 총매출 (전체 기간 누적 매출)
  const allBookings = await Booking.find({
    businessId: business._id,
    bookingStatus: { $in: ['confirmed', 'completed'] }
  }).select('_id').lean();

  const allBookingIds = allBookings.map(b => b._id);
  const allPayments = await Payment.find({
    booking_id: { $in: allBookingIds }
  }).lean();

  const totalRevenue = allPayments.reduce((sum, p) => sum + (p.paid || 0), 0);

  // 매출 통계 (이번 달)
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const thisMonthBookings = await Booking.find({
    businessId: business._id,
    bookingStatus: { $in: ['confirmed', 'completed'] },
    createdAt: { $gte: thisMonthStart }
  }).select('_id').lean();

  const thisMonthBookingIds = thisMonthBookings.map(b => b._id);
  const thisMonthPayments = await Payment.find({
    booking_id: { $in: thisMonthBookingIds }
  }).lean();

  const thisMonthRevenue = {
    total: thisMonthPayments.reduce((sum, p) => sum + (p.paid || 0), 0),
    count: thisMonthBookings.length
  };

  // 매출 추이 (최근 30일)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const revenueTrendBookings = await Booking.aggregate([
    {
      $match: {
        businessId: business._id,
        bookingStatus: { $in: ['confirmed', 'completed'] },
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        bookingIds: { $push: '$_id' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // 각 일별 매출 계산
  const revenueTrend = await Promise.all(
    revenueTrendBookings.map(async (day) => {
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

  // 최근 예약 정보 (최근 10개)
  const recentBookings = await Booking.find({
    businessId: business._id
  })
    .populate('roomId', 'roomName lodgingId')
    .populate('userId', 'name email')
    .sort({ bookingDate: -1 })
    .limit(10)
    .lean();

  // 최근 예약 정보 포맷팅
  const formattedRecentBookings = recentBookings.map(booking => ({
    bookingId: booking._id,
    roomName: booking.roomId?.roomName || 'Unknown',
    userName: booking.userId?.name || 'Unknown',
    userEmail: booking.userId?.email || '',
    checkinDate: booking.checkinDate,
    checkoutDate: booking.checkoutDate,
    bookingDate: booking.bookingDate,
    bookingStatus: booking.bookingStatus,
    adult: booking.adult,
    child: booking.child
  }));

  return {
    overview: {
      totalLodgings,
      totalRooms,
      todayBookings,
      pendingBookings,
      activeRooms,
      totalRevenue: totalRevenue || 0,
      thisMonthRevenue: thisMonthRevenue.total || 0,
      thisMonthBookings: thisMonthRevenue.count || 0
    },
    revenueTrend: revenueTrend,
    recentBookings: formattedRecentBookings
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
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 기본 통계 (대시보드와 유사하지만 쿼리 파라미터로 필터링 가능)
  const lodgingIds = await Lodging.find({ businessId: business._id }).distinct('_id');
  
  const [totalLodgings, totalRooms] = await Promise.all([
    Lodging.countDocuments({ businessId: business._id }),
    Room.countDocuments({ lodgingId: { $in: lodgingIds } })
  ]);

  return {
    totalLodgings,
    totalRooms
  };
};

// 매출 통계
const getRevenueStats = async (userId, period = 'month') => {
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const { startDate, endDate } = getPeriodDates(period);

  const bookings = await Booking.find({
    businessId: business._id,
    bookingStatus: { $in: ['confirmed', 'completed'] },
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
        businessId: business._id,
        bookingStatus: { $in: ['confirmed', 'completed'] },
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
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const { startDate, endDate } = getPeriodDates(period);

  const [totalBookings, byStatus] = await Promise.all([
    Booking.countDocuments({
      businessId: business._id,
      createdAt: { $gte: startDate, $lte: endDate }
    }),
    Booking.aggregate([
      {
        $match: {
          businessId: business._id,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$bookingStatus',
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
        businessId: business._id,
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
  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const { startDate, endDate } = getPeriodDates(period);

  // 전체 객실 수
  const lodgingIds = await Lodging.find({ businessId: business._id }).distinct('_id');
  const rooms = await Room.find({ lodgingId: { $in: lodgingIds } }).lean();
  const totalRooms = rooms.reduce((sum, r) => sum + (r.countRoom || 1), 0);

  // 기간 내 예약된 객실 수 (확정 및 완료된 예약만)
  const bookings = await Booking.find({
    businessId: business._id,
    bookingStatus: { $in: ['confirmed', 'completed'] },
    checkinDate: { $lte: endDate },
    checkoutDate: { $gte: startDate }
  }).lean();

  // 예약된 객실 수 계산 (날짜별로)
  const occupiedRooms = bookings.length; // 간단한 계산, 실제로는 날짜별로 계산 필요

  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

  // 숙소별 점유율
  const lodgingOccupancy = await Promise.all(
    lodgingIds.map(async (lodgingId) => {
      const lodgingRooms = await Room.find({ lodgingId: lodgingId }).lean();
      const lodgingTotalRooms = lodgingRooms.reduce((sum, r) => sum + (r.countRoom || 1), 0);
      const lodgingRoomIds = lodgingRooms.map(r => r._id);
      
      const lodgingBookings = await Booking.countDocuments({
        businessId: business._id,
        roomId: { $in: lodgingRoomIds },
        bookingStatus: { $in: ['confirmed', 'completed'] },
        checkinDate: { $lte: endDate },
        checkoutDate: { $gte: startDate }
      });

      const lodgingOccupancyRate = lodgingTotalRooms > 0 
        ? (lodgingBookings / lodgingTotalRooms) * 100 
        : 0;

      const lodging = await Lodging.findById(lodgingId).select('lodgingName').lean();

      return {
        lodgingId,
        lodgingName: lodging?.lodgingName || 'Unknown',
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

