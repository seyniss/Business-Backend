const Booking = require("../booking/model");
const Payment = require("../booking/payment");
const Lodging = require("../lodging/model");
const Room = require("../room/model");
const BusinessUser = require("../auth/model");

// 대시보드 통계
const getDashboardStats = async (userId) => {
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 오늘 날짜 범위
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 이번 달 시작일
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  // 전월 시작일 및 종료일
  const lastMonthStart = new Date(thisMonthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonthEnd = new Date(thisMonthStart);
  lastMonthEnd.setDate(0); // 전월 마지막 날
  lastMonthEnd.setHours(23, 59, 59, 999);

  // 기본 통계
  const lodgingIds = await Lodging.find({ businessId: user._id }).distinct('_id');
  
  const [totalLodgings, totalRooms, todayBookings, pendingBookings, activeRooms] = await Promise.all([
    Lodging.countDocuments({ businessId: user._id }),
    Room.countDocuments({ lodgingId: { $in: lodgingIds } }),
    Booking.countDocuments({
      businessUserId: user._id,
      createdAt: { $gte: today }
    }),
    Booking.countDocuments({
      businessUserId: user._id,
      bookingStatus: 'pending'
    }),
    // 활성객실: 현재 체크인되어 있는 예약 수
    Booking.countDocuments({
      businessUserId: user._id,
      bookingStatus: { $in: ['confirmed', 'completed'] },
      checkinDate: { $lte: today },
      checkoutDate: { $gte: today }
    })
  ]);

  // 전월 오늘 예약 수 (비교용)
  const lastMonthTodayStart = new Date(lastMonthStart);
  lastMonthTodayStart.setDate(today.getDate());
  const lastMonthTodayEnd = new Date(lastMonthTodayStart);
  lastMonthTodayEnd.setHours(23, 59, 59, 999);
  
  const lastMonthTodayBookings = await Booking.countDocuments({
    businessUserId: user._id,
    createdAt: { 
      $gte: lastMonthTodayStart, 
      $lte: lastMonthTodayEnd 
    }
  });

  // 전월 대비 오늘 예약 증감률 계산
  const todayBookingsChange = lastMonthTodayBookings > 0 
    ? Math.round(((todayBookings - lastMonthTodayBookings) / lastMonthTodayBookings) * 100)
    : (todayBookings > 0 ? 100 : 0);

  // 전월 활성객실 (전월 마지막 날 기준)
  const lastMonthLastDay = new Date(lastMonthEnd);
  lastMonthLastDay.setHours(0, 0, 0, 0);
  const lastMonthActiveRooms = await Booking.countDocuments({
    businessUserId: user._id,
    bookingStatus: { $in: ['confirmed', 'completed'] },
    checkinDate: { $lte: lastMonthLastDay },
    checkoutDate: { $gte: lastMonthLastDay }
  });

  // 전월 대비 활성객실 증감
  const activeRoomsChange = activeRooms - lastMonthActiveRooms;

  // 총매출 (전체 기간 누적 매출)
  const allBookings = await Booking.find({
    businessUserId: user._id,
    bookingStatus: { $in: ['confirmed', 'completed'] }
  }).select('_id').lean();

  const allBookingIds = allBookings.map(b => b._id);
  const allPayments = await Payment.find({
    bookingId: { $in: allBookingIds }
  }).lean();

  const totalRevenue = allPayments.reduce((sum, p) => sum + (p.paid || 0), 0);

  // 매출 통계 (이번 달)
  const thisMonthBookings = await Booking.find({
    businessUserId: user._id,
    bookingStatus: { $in: ['confirmed', 'completed'] },
    createdAt: { $gte: thisMonthStart }
  }).select('_id').lean();

  const thisMonthBookingIds = thisMonthBookings.map(b => b._id);
  const thisMonthPayments = await Payment.find({
    bookingId: { $in: thisMonthBookingIds }
  }).lean();

  const thisMonthRevenue = {
    total: thisMonthPayments.reduce((sum, p) => sum + (p.paid || 0), 0),
    count: thisMonthBookings.length
  };

  // 전월 매출
  const lastMonthBookings = await Booking.find({
    businessUserId: user._id,
    bookingStatus: { $in: ['confirmed', 'completed'] },
    createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
  }).select('_id').lean();

  const lastMonthBookingIds = lastMonthBookings.map(b => b._id);
  const lastMonthPayments = await Payment.find({
    bookingId: { $in: lastMonthBookingIds }
  }).lean();

  const lastMonthRevenue = lastMonthPayments.reduce((sum, p) => sum + (p.paid || 0), 0);

  // 전월 대비 총매출 증감률 계산 (이번 달 매출 vs 전월 매출)
  const totalRevenueChange = lastMonthRevenue > 0 
    ? Math.round(((thisMonthRevenue.total - lastMonthRevenue) / lastMonthRevenue) * 100)
    : (thisMonthRevenue.total > 0 ? 100 : 0);

  // 신규 회원 (이번 달에 예약한 새로운 사용자 수)
  const thisMonthUniqueUsers = await Booking.distinct('userId', {
    businessUserId: user._id,
    createdAt: { $gte: thisMonthStart }
  });

  const newMembers = thisMonthUniqueUsers.length;

  // 전월 신규 회원 수
  const lastMonthUniqueUsers = await Booking.distinct('userId', {
    businessUserId: user._id,
    createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
  });

  const lastMonthNewMembers = lastMonthUniqueUsers.length;

  // 전월 대비 신규 회원 증감률
  const newMembersChange = lastMonthNewMembers > 0 
    ? Math.round(((newMembers - lastMonthNewMembers) / lastMonthNewMembers) * 100)
    : (newMembers > 0 ? 100 : 0);

  // 매출 추이 (최근 6개월 월별 데이터)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const monthlyStats = await Booking.aggregate([
    {
      $match: {
        businessUserId: user._id,
        bookingStatus: { $in: ['confirmed', 'completed'] },
        createdAt: { $gte: sixMonthsAgo }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        bookingIds: { $push: '$_id' },
        bookingCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // 각 월별 매출 계산
  const revenueTrend = await Promise.all(
    monthlyStats.map(async (month) => {
      const payments = await Payment.find({
        bookingId: { $in: month.bookingIds }
      }).lean();
      const revenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
      return {
        month: month._id,
        revenue: revenue,
        bookings: month.bookingCount
      };
    })
  );

  // 최근 예약 정보 (최근 10개)
  const recentBookings = await Booking.find({
    businessUserId: user._id
  })
    .populate('roomId', 'name lodgingId')
    .populate('userId', 'name email')
    .sort({ bookingDate: -1 })
    .limit(10)
    .lean();

  // 최근 예약 정보 포맷팅
  const formattedRecentBookings = recentBookings.map(booking => ({
    bookingId: booking._id,
    roomName: booking.roomId?.roomName || booking.roomId?.name || 'Unknown',
    userName: booking.userId?.name || 'Unknown',
    userEmail: booking.userId?.email || '',
    checkinDate: booking.checkinDate,
    checkoutDate: booking.checkoutDate,
    bookingDate: booking.bookingDate,
    bookingStatus: booking.bookingStatus,
    adult: booking.adult,
    child: booking.child
  }));

  // 호텔 정보 조회 (getLodgings와 동일한 형식)
  const lodging = await Lodging.findOne({ businessId: user._id }).lean();
  const hotelInfo = lodging ? await require("../lodging/service").getLodgings(userId) : null;

  // chartData 형식 변환
  const chartData = {
    labels: revenueTrend.map(item => item.month),
    revenue: revenueTrend.map(item => item.revenue),
    bookings: revenueTrend.map(item => item.bookings)
  };

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  return {
    hotel: hotelInfo,
    recentBookings: formattedRecentBookings,
    chartData: chartData
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
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  // 기본 통계 (대시보드와 유사하지만 쿼리 파라미터로 필터링 가능)
  const lodgingIds = await Lodging.find({ businessId: user._id }).distinct('_id');
  
  const [totalLodgings, totalRooms] = await Promise.all([
    Lodging.countDocuments({ businessId: user._id }),
    Room.countDocuments({ lodgingId: { $in: lodgingIds } })
  ]);

  return {
    totalLodgings,
    totalRooms
  };
};

// 매출 통계
const getRevenueStats = async (userId, period = 'month') => {
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const { startDate, endDate } = getPeriodDates(period);

  const bookings = await Booking.find({
    businessUserId: user._id,
    bookingStatus: { $in: ['confirmed', 'completed'] },
    createdAt: { $gte: startDate, $lte: endDate }
  }).select('_id').lean();

  const bookingIds = bookings.map(b => b._id);
  const payments = await Payment.find({
    bookingId: { $in: bookingIds }
  }).lean();

  const totalRevenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
  const totalBookings = bookings.length;
  const averageRevenue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  // 일별/월별 매출 추이
  const dailyRevenue = await Booking.aggregate([
    {
      $match: {
        businessUserId: user._id,
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
        bookingId: { $in: day.bookingIds }
      }).lean();
      const revenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
      return {
        date: day._id,
        revenue
      };
    })
  );

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  return {
    labels: dailyRevenueWithAmount.map(item => item.date),
    revenue: dailyRevenueWithAmount.map(item => item.revenue),
    bookings: dailyRevenueWithAmount.map(item => {
      // 해당 날짜의 예약 수 계산
      const dayBookings = bookings.filter(b => {
        const bookingDate = new Date(b.createdAt);
        const dateStr = period === 'year' 
          ? `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`
          : `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}-${String(bookingDate.getDate()).padStart(2, '0')}`;
        return dateStr === item.date;
      });
      return dayBookings.length;
    })
  };
};

// 예약 통계
const getBookingStats = async (userId, period = 'month') => {
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const { startDate, endDate } = getPeriodDates(period);

  const [totalBookings, byStatus] = await Promise.all([
    Booking.countDocuments({
      businessUserId: user._id,
      createdAt: { $gte: startDate, $lte: endDate }
    }),
    Booking.aggregate([
      {
        $match: {
          businessUserId: user._id,
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
        businessUserId: user._id,
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

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  return {
    labels: dailyBookings.map(d => d._id),
    data: dailyBookings.map(d => d.count)
  };
};

// 점유율 통계
const getOccupancyStats = async (userId, period = 'month') => {
  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const { startDate, endDate } = getPeriodDates(period);

  // 전체 객실 수
  const lodgingIds = await Lodging.find({ businessId: user._id }).distinct('_id');
  const rooms = await Room.find({ lodgingId: { $in: lodgingIds } }).lean();
  const totalRooms = rooms.reduce((sum, r) => sum + (r.quantity || r.countRoom || 1), 0);

  // 기간 내 예약된 객실 수 (확정 및 완료된 예약만)
  const bookings = await Booking.find({
    businessUserId: user._id,
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
      const lodgingTotalRooms = lodgingRooms.reduce((sum, r) => sum + (r.quantity || r.countRoom || 1), 0);
      const lodgingRoomIds = lodgingRooms.map(r => r._id);
      
      const lodgingBookings = await Booking.countDocuments({
        businessUserId: user._id,
        roomId: { $in: lodgingRoomIds },
        bookingStatus: { $in: ['confirmed', 'completed'] },
        checkinDate: { $lte: endDate },
        checkoutDate: { $gte: startDate }
      });

      const lodgingOccupancyRate = lodgingTotalRooms > 0 
        ? (lodgingBookings / lodgingTotalRooms) * 100 
        : 0;

      const lodging = await Lodging.findById(lodgingId).select('name').lean();

      return {
        lodgingId,
        lodgingName: lodging?.lodgingName || 'Unknown',
        totalRooms: lodgingTotalRooms,
        occupiedRooms: lodgingBookings,
        occupancyRate: Math.round(lodgingOccupancyRate * 10) / 10
      };
    })
  );

  // 일별 점유율 계산
  const dailyOccupancy = await Booking.aggregate([
    {
      $match: {
        businessUserId: user._id,
        bookingStatus: { $in: ['confirmed', 'completed'] },
        checkinDate: { $lte: endDate },
        checkoutDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: period === 'year' ? '%Y-%m' : '%Y-%m-%d', date: '$checkinDate' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  return {
    labels: dailyOccupancy.map(d => d._id),
    data: dailyOccupancy.map(d => {
      // 점유율 계산 (예약된 객실 수 / 전체 객실 수)
      const rate = totalRooms > 0 ? (d.count / totalRooms) * 100 : 0;
      return Math.round(rate * 10) / 10;
    })
  };
};

module.exports = {
  getDashboardStats,
  getStatistics,
  getRevenueStats,
  getBookingStats,
  getOccupancyStats
};

