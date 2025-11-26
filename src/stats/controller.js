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

module.exports = {
  getDashboardStats
};

