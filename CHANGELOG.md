# 변경 이력 (Changelog) - 2025.11.25

## [최신] 데이터 모델 리팩토링 - User & Business 분리

### 🎯 주요 목표
- User 모델 도입으로 통합 사용자 관리
- 권한 체계 개선 (USER, BUSINESS, ADMIN)
- 관계 데이터 정규화로 코드 복잡성 감소

---

## 📝 변경 내용

### 🆕 신규 추가

1. **User.js 모델 생성** (`models/User.js`)
   - 모든 사용자(일반, 사업자, 관리자) 통합 관리
   - 권한별 상태 관리 (active, inactive, suspended, pending)
   - 비밀번호 해싱 메서드 포함

2. **MIGRATION_GUIDE.md 작성**
   - 전체 마이그레이션 전략 문서화
   - API 변경사항 상세 설명
   - 데이터 마이그레이션 스크립트 샘플

3. **requireAdmin 미들웨어 추가** (`middlewares/roles.js`)
   - ADMIN 권한 확인 기능

### 🔄 수정됨

#### 모델
- **Business.js 축소**
  - 기존 필드: email, passwordHash, businessName, ownerName, phone, businessNumber, businessType, verification 등 (복잡)
  - 신규 필드: business_id, login_id (FK), business_name, business_number (간결)
  - User 모델과 1:1 관계 설정

#### 라우트 (모두 User → Business ID 변환 로직 추가)
- `routes/auth.js`
  - 회원가입: USER/BUSINESS 선택 가능
  - 로그인: User 모델 기반 인증
  - 내 정보: BUSINESS인 경우 business 데이터도 포함

- `routes/hotels.js`
  - GET /, GET /:id, POST /, PUT /:id, DELETE /:id
  - 모든 라우트에서 req.user.id → Business._id 변환

- `routes/rooms.js`
  - GET /hotel/:hotelId에서 Business 참조 추가

- `routes/reservations.js`
  - GET / 에서 Business 참조로 예약 조회

- `routes/stats.js`
  - GET /dashboard, GET /revenue에서 Business 참조

- `routes/facilities.js`
  - POST /에서 호텔 소유권 확인 시 Business 참조

- `routes/notices.js`
  - POST /에서 호텔 소유권 확인 시 Business 참조

- `routes/pictures.js`
  - GET /own-hotel/:ownHotelId, POST /, DELETE /:id에서 Business 참조

#### 미들웨어
- `middlewares/auth.js`
  - Business 모델 → User 모델로 변경
  - tokenVersion 검증 로직 유지

- `middlewares/roles.js`
  - requireBusiness 체크: 'business' → 'BUSINESS' (대문자)
  - requireAdmin 추가

---

## 📊 영향받는 엔티티

| 컬렉션 | 변경 | 영향 범위 |
|--------|------|---------|
| Users | 🆕 새로 생성 | 모든 인증 로직 |
| Business | 🔄 필드 축소 | User와 1:1 관계 |
| Hotels | ⚠️ 간접 영향 | business_id는 유지 |
| OwnHotels | ⚠️ 간접 영향 | 변경 없음 |
| Reservations | ⚠️ 간접 영향 | business_id는 유지 |
| Payments | - 변경 없음 | - |
| Facilities | - 변경 없음 | - |
| OwnHotelPictures | - 변경 없음 | - |
| Notices | - 변경 없음 | - |

---

## 🔐 권한 체계 변경

### Before
```
Business.role = "business" (단일 역할만 지원)
Business.isActive = boolean (활성/비활성만)
```

### After
```
User.role = "USER" | "BUSINESS" | "ADMIN" (세 가지 역할)
User.status = "active" | "inactive" | "suspended" | "pending" (세분화된 상태)

BUSINESS 사용자:
- status='pending' → 관리자 승인 대기 중 (로그인 불가)
- status='active' → 정상 사용 가능
- status='suspended' → 관리자 정지 (로그인 불가)
```

---

## 🧪 테스트 필수 항목

- [ ] USER 회원가입 및 로그인
- [ ] BUSINESS 회원가입 및 로그인 (미승인)
- [ ] BUSINESS 승인 후 로그인
- [ ] 토큰 검증 및 로그아웃
- [ ] 사업자 호텔 CRUD
- [ ] 예약 목록 조회 (권한 확인)
- [ ] 통계 대시보드 조회
- [ ] 비인가 사용자 접근 차단

---

## ⚠️ Breaking Changes

1. **회원가입 API 변경**
   - `POST /api/auth/register` 요청 형식 변경
   - 기존: businessName 필수
   - 신규: user_name 필수, BUSINESS 역할 선택 시 business_name, business_number 필수

2. **role 값 대소문자 변경**
   - 기존: 'business'
   - 신규: 'BUSINESS', 'USER', 'ADMIN' (모두 대문자)

3. **토큰 페이로드 구조 변경**
   - User 정보 기반 토큰 생성
   - Business 정보 접근 시 별도 조회 필요

---

## 📈 향후 개선사항

- [ ] Business 승인/거절 관리자 API 추가
- [ ] User 프로필 수정 API 추가
- [ ] 권한별 대시보드 커스터마이징
- [ ] 감사 로그(Audit Log) 시스템 구축
- [ ] 비밀번호 변경/재설정 기능
- [ ] 이메일 인증 프로세스

---

## 🔗 참고 문서

- [마이그레이션 가이드](./MIGRATION_GUIDE.md)
- [User 모델](./business-backend/models/User.js)
- [Business 모델](./business-backend/models/Business.js)
- [인증 라우트](./business-backend/routes/auth.js)

---

## 📞 연락처 / 질문사항

마이그레이션 관련 문제 발생 시 MIGRATION_GUIDE.md의 "문제 해결" 섹션을 참고하세요.

