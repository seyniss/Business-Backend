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

  // 오늘의 매출 계산
  const todayBookingsForRevenue = await Booking.find({
    businessUserId: user._id,
    bookingStatus: { $in: ['confirmed', 'completed'] },
    createdAt: { $gte: today, $lt: tomorrow }
  }).select('_id').lean();

  const todayBookingIdsForRevenue = todayBookingsForRevenue.map(b => b._id);
  const todayPayments = await Payment.find({
    bookingId: { $in: todayBookingIdsForRevenue }
  }).lean();

  const todayRevenue = todayPayments.reduce((sum, p) => sum + (p.paid || 0), 0);

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

  // 최근 6개월의 모든 월 목록 생성 (예약이 없는 월도 포함)
  const allMonths = [];
  const currentDate = new Date();
  currentDate.setDate(1);
  currentDate.setHours(0, 0, 0, 0);
  
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(currentDate);
    monthDate.setMonth(monthDate.getMonth() - i);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthLabel = `${month}월`;
    allMonths.push({ key: monthKey, label: monthLabel });
  }

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

  // 월별 데이터를 Map으로 변환 (빠른 조회를 위해)
  const monthlyStatsMap = new Map();
  monthlyStats.forEach(stat => {
    monthlyStatsMap.set(stat._id, stat);
  });

  // 각 월별 매출 계산 (모든 월 포함)
  const revenueTrend = await Promise.all(
    allMonths.map(async (monthInfo) => {
      const monthStat = monthlyStatsMap.get(monthInfo.key);
      
      if (!monthStat || !monthStat.bookingIds || monthStat.bookingIds.length === 0) {
        // 예약이 없는 월
        return {
          month: monthInfo.key,
          monthLabel: monthInfo.label,
          revenue: 0,
          bookings: 0
        };
      }

      // 예약이 있는 월: 매출 계산
      const payments = await Payment.find({
        bookingId: { $in: monthStat.bookingIds }
      }).lean();
      const revenue = payments.reduce((sum, p) => sum + (p.paid || 0), 0);
      
      // bookingCount를 명시적으로 확인 (0도 유효한 값)
      // bookingIds 배열의 길이를 직접 사용하는 것이 가장 정확함
      const bookingCount = monthStat.bookingIds && Array.isArray(monthStat.bookingIds)
        ? monthStat.bookingIds.length
        : (monthStat.bookingCount !== undefined && monthStat.bookingCount !== null
          ? Number(monthStat.bookingCount)
          : 0);
      
      return {
        month: monthInfo.key,
        monthLabel: monthInfo.label,
        revenue: revenue,
        bookings: bookingCount
      };
    })
  );

  // 최근 예약 정보 (최근 10개)
  const recentBookings = await Booking.find({
    businessUserId: user._id
  })
    .populate('roomId', 'name lodgingId')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  // lodging ID 목록 수집 (중복 제거)
  const recentLodgingIdStrings = recentBookings
    .map(b => {
      const lodgingId = b.roomId?.lodgingId;
      if (!lodgingId) return null;
      // ObjectId 객체이거나 문자열일 수 있으므로 toString()으로 통일
      return lodgingId.toString ? lodgingId.toString() : String(lodgingId);
    })
    .filter(id => id !== null);
  
  // 중복 제거
  const uniqueLodgingIdStrings = [...new Set(recentLodgingIdStrings)];
  
  // lodging 정보 일괄 조회 (문자열 ID로도 조회 가능)
  const lodgings = uniqueLodgingIdStrings.length > 0
    ? await Lodging.find({ _id: { $in: uniqueLodgingIdStrings } })
        .select('_id lodgingName')
        .lean()
    : [];
  
  const lodgingMap = new Map(lodgings.map(l => [l._id.toString(), l.lodgingName]));

  // 최근 예약 정보 포맷팅 (프론트엔드 요구 형식)
  const formattedRecentBookings = recentBookings.map((booking) => {
    const lodgingId = booking.roomId?.lodgingId?.toString();
    const lodgingName = lodgingId ? (lodgingMap.get(lodgingId) || 'Unknown') : 'Unknown';
    const guestName = booking.userId?.name || 'Unknown';

    return {
      _id: booking._id,
      id: booking._id.toString(),
      bookingNumber: booking.bookingNumber || null,
      lodgingName: lodgingName,
      hotelName: lodgingName,
      guest: {
        name: guestName
      },
      guestName: guestName,
      user: {
        name: guestName
      },
      status: booking.bookingStatus || 'pending'
    };
  });

  // chartData 형식 변환 (한글 월 라벨)
  const chartData = {
    labels: revenueTrend.map(item => item.monthLabel),
    revenue: revenueTrend.map(item => item.revenue),
    bookings: revenueTrend.map(item => item.bookings)
  };

  // hotel 객체 구성 (프론트엔드 요구 형식)
  const hotel = {
    todayBookings: todayBookings,
    totalRevenue: totalRevenue,
    totalRooms: totalRooms,
    activeRooms: activeRooms,
    newMembers: newMembers,
    newUsers: newMembers, // newMembers와 동일
    today: {
      bookings: todayBookings,
      revenue: todayRevenue
    }
  };

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  return {
    hotel: hotel,
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
        bookingIds: { $push: '$_id' },
        bookingCount: { $sum: 1 }
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
      
      // bookingIds 배열의 길이를 직접 사용 (가장 정확함)
      const bookingCount = day.bookingIds && Array.isArray(day.bookingIds)
        ? day.bookingIds.length
        : (day.bookingCount !== undefined && day.bookingCount !== null
          ? Number(day.bookingCount)
          : 0);
      
      return {
        date: day._id,
        revenue,
        bookings: bookingCount
      };
    })
  );

  // 프론트엔드 요구사항에 맞게 응답 형식 변환
  return {
    labels: dailyRevenueWithAmount.map(item => item.date),
    revenue: dailyRevenueWithAmount.map(item => item.revenue),
    bookings: dailyRevenueWithAmount.map(item => item.bookings)
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

