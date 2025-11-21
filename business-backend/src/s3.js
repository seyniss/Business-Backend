const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// S3 클라이언트 생성 (환경 변수에서 자격 증명 가져오기)
const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

/**
 * S3에 파일 업로드를 위한 presigned URL 생성
 * @param {string} key - S3 객체 키 (파일 경로)
 * @param {string} contentType - 파일의 MIME 타입
 * @param {number} expiresIn - URL 만료 시간 (초 단위, 기본값: 3600초 = 1시간)
 * @returns {Promise<string>} presigned URL
 */
async function presignPut(key, contentType, expiresIn = 3600) {
  if (!BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.');
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
}

/**
 * S3에서 객체 삭제
 * @param {string} key - S3 객체 키 (파일 경로)
 * @returns {Promise<void>}
 */
async function deleteObject(key) {
  if (!BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET_NAME 환경 변수가 설정되지 않았습니다.');
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

module.exports = { presignPut, deleteObject };
