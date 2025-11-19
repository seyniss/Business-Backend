const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Lodging = require("../models/Lodging");
const Room = require("../models/Room");
const Business = require("../models/Business");
const { authenticateToken } = require("../middlewares/auth");
const { requireBusiness } = require("../middlewares/roles");
const mongoose = require("mongoose");

// 모든 라우트는 인증 및 사업자 권한 필요
router.use(authenticateToken);
router.use(requireBusiness);

// 대시보드 통계
router.get("/dashboard", async (req, res) => {
  try {
    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
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

    // 예약과 결제를 조인하여 매출 계산
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

    res.json({
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
    });
  } catch (error) {
    console.error("GET /api/stats/dashboard 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

// 매출 통계 (기간별)
router.get("/revenue", async (req, res) => {
  try {
    // User ID로부터 Business ID 조회
    const business = await Business.findOne({ login_id: req.user.id });
    if (!business) {
      return res.status(404).json({ message: "사업자 정보를 찾을 수 없습니다." });
    }

    const { startDate, endDate, groupBy = 'day' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "시작일과 종료일이 필요합니다." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'month') {
      dateFormat = '%Y-%m';
    } else if (groupBy === 'year') {
      dateFormat = '%Y';
    }

    const bookings = await Booking.find({
      business_id: business._id,
      booking_status: { $in: ['confirmed', 'completed'] },
      createdAt: { $gte: start, $lte: end }
    }).select('_id createdAt').lean();

    const bookingIds = bookings.map(b => b._id);
    const payments = await Payment.find({
      booking_id: { $in: bookingIds }
    }).lean();

    // 예약 ID로 결제 매핑
    const paymentMap = {};
    payments.forEach(p => {
      paymentMap[p.booking_id.toString()] = p.paid || 0;
    });

    // 날짜별로 그룹화
    const revenueMap = {};
    bookings.forEach(b => {
      const dateKey = groupBy === 'month' 
        ? b.createdAt.toISOString().substring(0, 7)
        : groupBy === 'year'
        ? b.createdAt.toISOString().substring(0, 4)
        : b.createdAt.toISOString().substring(0, 10);
      
      if (!revenueMap[dateKey]) {
        revenueMap[dateKey] = { totalRevenue: 0, bookingCount: 0 };
      }
      revenueMap[dateKey].totalRevenue += paymentMap[b._id.toString()] || 0;
      revenueMap[dateKey].bookingCount += 1;
    });

    const revenue = Object.entries(revenueMap).map(([date, data]) => ({
      _id: date,
      totalRevenue: data.totalRevenue,
      bookingCount: data.bookingCount,
      averagePrice: data.bookingCount > 0 ? data.totalRevenue / data.bookingCount : 0
    })).sort((a, b) => a._id.localeCompare(b._id));

    res.json({ revenue });
  } catch (error) {
    console.error("GET /api/stats/revenue 실패", error);
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});

module.exports = router;

