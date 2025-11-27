const statsService = require("./service");
const { successResponse, errorResponse } = require("../common/response");

// 대시보드 통계
const getDashboardStats = async (req, res) => {
  try {
    const result = await statsService.getDashboardStats(req.user.id);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 통계 조회
const getStatistics = async (req, res) => {
  try {
    const result = await statsService.getStatistics(req.user.id, req.query);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 매출 통계
const getRevenueStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const result = await statsService.getRevenueStats(req.user.id, period);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 예약 통계
const getBookingStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const result = await statsService.getBookingStats(req.user.id, period);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

// 점유율 통계
const getOccupancyStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const result = await statsService.getOccupancyStats(req.user.id, period);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    if (error.message === "BUSINESS_NOT_FOUND") {
      return res.status(404).json(errorResponse("사업자 정보를 찾을 수 없습니다.", 404));
    }
    return res.status(500).json(errorResponse("서버 오류", 500, error.message));
  }
};

module.exports = {
  getDashboardStats,
  getStatistics,
  getRevenueStats,
  getBookingStats,
  getOccupancyStats
};

