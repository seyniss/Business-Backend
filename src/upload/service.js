const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { presignPut } = require('../../src/s3.js');

// Presign URL 생성
const generatePresignUrl = async (filename, contentType) => {
  const key = `hotels/${Date.now()}-${uuidv4()}${path.extname(filename)}`;
  const url = await presignPut(key, contentType);
  return { url, key };
};

module.exports = {
  generatePresignUrl
};

