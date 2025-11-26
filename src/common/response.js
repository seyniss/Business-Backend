// 모든 API 응답을 동일한 구조로 반환하기 위한 유틸 함수
// Controller에서 successResponse / errorResponse 형태로 사용

// 성공 응답
const successResponse = (data, message = "SUCCESS", resultCode = 200) => {
  return {
    data,
    message,
    resultCode,
  };
};

// 실패·에러 응답
const errorResponse = (message = "FAIL", resultCode = 400, data = null) => {
  return {
    data,
    message,
    resultCode,
  };
};

module.exports = { successResponse, errorResponse };
  