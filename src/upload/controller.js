const uploadService = require("./service");
const { successResponse, errorResponse } = require("../common/response");

// Presign URL 생성
const generatePresignUrl = async (req, res) => {
  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json(errorResponse('filename/contentType은 필수입니다.', 400));
    }

    const result = await uploadService.generatePresignUrl(filename, contentType);
    return res.status(200).json(successResponse(result, "SUCCESS", 200));
  } catch (error) {
    return res.status(500).json(errorResponse("presign 생성 실패", 500, error.message));
  }
};

// Ping
const ping = async (req, res) => {
  return res.status(200).json(successResponse({ ok: true }, "SUCCESS", 200));
};

module.exports = {
  generatePresignUrl,
  ping
};

