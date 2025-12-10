# Business Backend

호텔 예약 시스템 - 사업자 백엔드 API

## 환경 변수 설정

`.env` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env
# MongoDB 연결 정보
MONGODB_URI=your_mongodb_connection_string

# 서버 포트
PORT=3000

# 프론트엔드 Origin
FRONT_ORIGIN=http://localhost:3001

# 카카오 맵 API 키 (REST API 키)
# 카카오 개발자 콘솔(https://developers.kakao.com)에서 발급받은 REST API 키를 입력하세요
# 주소를 좌표로 자동 변환하는 기능에 사용됩니다
# API 키가 없어도 서비스는 정상 작동하지만, 좌표 변환 기능만 비활성화됩니다
KAKAO_MAP_API_KEY=your_kakao_rest_api_key_here

# JWT Secret (인증 토큰)
JWT_SECRET=your_jwt_secret_key

# AWS S3 설정 (파일 업로드)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_S3_BUCKET=your_s3_bucket_name
```

## 주요 기능

- 호텔/숙소 등록 및 관리
- 객실 관리
- 예약 관리
- 리뷰 관리
- 통계 대시보드
- 주소 자동 좌표 변환 (카카오 맵 API)

## API 명세서

자세한 API 명세는 `API_SPECIFICATION.md` 파일을 참조하세요.
