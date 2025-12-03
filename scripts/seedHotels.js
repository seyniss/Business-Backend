require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { addressToCoordinates } = require('../src/common/kakaoMap');

// 모델 import
const User = require('../src/auth/model');
const Business = require('../src/auth/business');
const Lodging = require('../src/lodging/model');
const Amenity = require('../src/amenity/model');
const Room = require('../src/room/model');
const Booking = require('../src/booking/model');
const Review = require('../src/review/model');

// 객실 데이터 템플릿 (각 호텔마다 사용)
const roomTemplates = [
  {
    roomName: '스탠다드 트윈',
    roomSize: '28㎡',
    capacityMin: 1,
    capacityMax: 2,
    price: 150000,
    countRoom: 5,
    ownerDiscount: 5,
    platformDiscount: 0,
    roomImage: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304'
  },
  {
    roomName: '디럭스 더블',
    roomSize: '35㎡',
    capacityMin: 2,
    capacityMax: 3,
    price: 200000,
    countRoom: 4,
    ownerDiscount: 10,
    platformDiscount: 5,
    roomImage: 'https://images.unsplash.com/photo-1590490360182-c33d57733427'
  },
  {
    roomName: '스위트',
    roomSize: '50㎡',
    capacityMin: 2,
    capacityMax: 4,
    price: 350000,
    countRoom: 2,
    ownerDiscount: 15,
    platformDiscount: 10,
    roomImage: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32'
  },
  {
    roomName: '프리미엄 스위트',
    roomSize: '70㎡',
    capacityMin: 2,
    capacityMax: 4,
    price: 500000,
    countRoom: 1,
    ownerDiscount: 20,
    platformDiscount: 15,
    roomImage: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b'
  },
  {
    roomName: '패밀리 룸',
    roomSize: '45㎡',
    capacityMin: 3,
    capacityMax: 5,
    price: 280000,
    countRoom: 3,
    ownerDiscount: 12,
    platformDiscount: 8,
    roomImage: 'https://images.unsplash.com/photo-1566073771259-6a8506099945'
  }
];

// 리뷰 텍스트 템플릿
const reviewTemplates = [
  {
    rating: 5,
    content: '정말 만족스러운 숙박이었습니다. 깨끗하고 편안했어요. 직원분들도 친절하시고 시설도 최고였습니다. 다음에도 또 이용하고 싶어요!'
  },
  {
    rating: 5,
    content: '완벽한 호텔이었습니다. 위치도 좋고 룸도 넓고 깨끗했어요. 조식도 맛있고 서비스도 훌륭했습니다. 강력 추천합니다!'
  },
  {
    rating: 4,
    content: '전반적으로 좋은 경험이었습니다. 시설이 깨끗하고 직원분들이 친절하셨어요. 다만 조금 시끄러웠던 점이 아쉬웠습니다.'
  },
  {
    rating: 4,
    content: '가격 대비 만족스러운 호텔이었습니다. 위치가 좋아서 관광하기 편했고, 룸도 깨끗했습니다. 다음에 또 오고 싶어요.'
  },
  {
    rating: 5,
    content: '정말 최고의 호텔이었습니다! 뷰가 아름답고 시설도 최신식이었어요. 특히 스파 시설이 인상적이었습니다. 다시 방문하고 싶어요.'
  },
  {
    rating: 4,
    content: '좋은 호텔이었습니다. 깨끗하고 편안했어요. 다만 체크인 시간이 조금 늦었던 점이 아쉬웠습니다. 전반적으로는 만족합니다.'
  },
  {
    rating: 5,
    content: '완벽한 휴가였습니다! 호텔이 정말 좋았고 직원분들도 친절하셨어요. 특히 수영장과 피트니스 센터가 훌륭했습니다.'
  },
  {
    rating: 4,
    content: '만족스러운 숙박이었습니다. 위치가 좋고 시설도 깨끗했어요. 조식도 다양하고 맛있었습니다. 추천합니다!'
  },
  {
    rating: 5,
    content: '정말 특별한 경험이었습니다. 호텔의 모든 것이 완벽했어요. 특히 룸 서비스가 훌륭했고, 직원분들의 서비스도 최고였습니다.'
  },
  {
    rating: 4,
    content: '좋은 호텔이었습니다. 깨끗하고 편안했어요. 위치도 좋아서 관광하기 편했습니다. 다음에 또 이용하고 싶어요.'
  }
];

// 호텔 데이터 정의
const hotelData = [
  // 신라호텔
  {
    businessEmail: 'shilla@business.com',
    hotels: [
      {
        lodgingName: '신라호텔 서울',
        address: '서울특별시 중구 동호로 249',
        description: '서울 중심부에 위치한 럭셔리 호텔. 명동과 가까운 최고의 위치에서 편안한 휴식을 제공합니다.',
        rating: 4.8,
        minPrice: 280000,
        images: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945',
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b',
          'https://images.unsplash.com/photo-1611892440504-42a792e24d32'
        ],
        amenities: ['무료 WiFi', '수영장', '피트니스', '레스토랑', '주차장', '스파', '비즈니스 센터'],
        hashtag: ['럭셔리', '비즈니스', '명동'],
        category: '호텔',
        country: '대한민국',
        lat: 37.5665,
        lng: 126.9780
      },
      {
        lodgingName: '신라호텔 제주',
        address: '제주특별자치도 서귀포시 중문관광로 72번길 75',
        description: '제주 중문 리조트에 위치한 럭셔리 호텔. 아름다운 오션뷰와 최고급 시설을 자랑합니다.',
        rating: 4.7,
        minPrice: 320000,
        images: [
          'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa',
          'https://images.unsplash.com/photo-1578683010236-d716f9a3f461',
          'https://images.unsplash.com/photo-1615460549969-36fa19521a4f'
        ],
        amenities: ['무료 WiFi', '스파', '골프장', '해변 접근', '키즈클럽', '수영장', '레스토랑'],
        hashtag: ['럭셔리', '리조트', '신혼여행', '오션뷰'],
        category: '리조트',
        country: '대한민국',
        lat: 33.4996,
        lng: 126.5312
      }
    ]
  },
  // 롯데호텔
  {
    businessEmail: 'lotte@business.com',
    hotels: [
      {
        lodgingName: '롯데호텔 서울',
        address: '서울특별시 중구 을지로 30',
        description: '서울 중심부 명동에 위치한 5성급 호텔. 쇼핑과 관광에 최적의 위치를 제공합니다.',
        rating: 4.5,
        minPrice: 250000,
        images: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945',
          'https://images.unsplash.com/photo-1611892440504-42a792e24d32',
          'https://images.unsplash.com/photo-1590490360182-c33d57733427'
        ],
        amenities: ['무료 WiFi', '수영장', '피트니스', '레스토랑', '주차장', '비즈니스 센터'],
        hashtag: ['럭셔리', '비즈니스', '명동'],
        category: '호텔',
        country: '대한민국',
        lat: 37.5665,
        lng: 126.9780
      },
      {
        lodgingName: '롯데호텔 부산',
        address: '부산광역시 해운대구 해운대해변로 296',
        description: '해운대 해변이 한눈에 보이는 오션뷰 호텔. 가족 여행과 휴양에 최적화된 시설을 갖추고 있습니다.',
        rating: 4.3,
        minPrice: 180000,
        images: [
          'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb',
          'https://images.unsplash.com/photo-1631049307264-da0ec9d70304',
          'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6'
        ],
        amenities: ['무료 WiFi', '오션뷰', '조식 포함', '주차장', '수영장', '피트니스'],
        hashtag: ['오션뷰', '가족여행', '해운대'],
        category: '호텔',
        country: '대한민국',
        lat: 35.1796,
        lng: 129.0756
      }
    ]
  },
  // 조선 팰리스
  {
    businessEmail: 'josun@business.com',
    hotels: [
      {
        lodgingName: '조선 팰리스',
        address: '서울특별시 중구 소공로 70',
        description: '서울 명동에 위치한 프리미엄 호텔. 세련된 디자인과 최고급 서비스를 제공합니다.',
        rating: 4.6,
        minPrice: 270000,
        images: [
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b',
          'https://images.unsplash.com/photo-1611892440504-42a792e24d32',
          'https://images.unsplash.com/photo-1590490360182-c33d57733427'
        ],
        amenities: ['무료 WiFi', '수영장', '피트니스', '레스토랑', '주차장', '스파', '비즈니스 센터'],
        hashtag: ['럭셔리', '비즈니스', '프리미엄', '명동'],
        category: '호텔',
        country: '대한민국',
        lat: 37.5665,
        lng: 126.9780
      }
    ]
  }
];

// 메인 함수
const seedHotels = async () => {
  try {
    console.log('🔄 MongoDB 연결 중...');
    await connectDB();

    console.log('🏨 호텔 데이터 삽입 시작...\n');

    for (const businessGroup of hotelData) {
      // 사업자 계정 찾기
      const businessUser = await User.findOne({ email: businessGroup.businessEmail });
      if (!businessUser) {
        console.error(`❌ 사업자 계정을 찾을 수 없습니다: ${businessGroup.businessEmail}`);
        continue;
      }

      // Business 정보 찾기
      const business = await Business.findOne({ loginId: businessUser._id });
      if (!business) {
        console.error(`❌ Business 정보를 찾을 수 없습니다: ${businessGroup.businessEmail}`);
        continue;
      }

      console.log(`\n📌 ${business.businessName} 호텔 등록 시작...`);

      for (const hotel of businessGroup.hotels) {
        try {
          // 좌표 변환 (lat, lng가 제공되지 않은 경우)
          let coordinates = { lat: hotel.lat, lng: hotel.lng };
          if (!hotel.lat || !hotel.lng) {
            try {
              coordinates = await addressToCoordinates(hotel.address);
              console.log(`  ✓ 좌표 변환 완료: ${hotel.address} → lat: ${coordinates.lat}, lng: ${coordinates.lng}`);
            } catch (error) {
              console.warn(`  ⚠️  좌표 변환 실패 (${hotel.lodgingName}): ${error.message}. 기본 좌표 사용`);
              // 기본 좌표 (서울)
              coordinates = { lat: 37.5665, lng: 126.9780 };
            }
          }

          // Amenity 생성
          const amenityDetail = hotel.amenities.join(', ');
          let amenity = await Amenity.findOne({ amenityName: hotel.lodgingName });
          if (!amenity) {
            amenity = await Amenity.create({
              amenityName: hotel.lodgingName,
              amenityDetail: amenityDetail
            });
            console.log(`  ✓ 편의시설 생성: ${hotel.lodgingName}`);
          }

          // Lodging 생성
          const lodging = await Lodging.create({
            businessId: business._id,
            lodgingName: hotel.lodgingName,
            address: hotel.address,
            rating: hotel.rating,
            minPrice: hotel.minPrice,
            lat: coordinates.lat,
            lng: coordinates.lng,
            description: hotel.description,
            images: hotel.images,
            country: hotel.country,
            category: hotel.category,
            hashtag: hotel.hashtag || [],
            amenityId: amenity._id
            // reviewCount는 기본값 0으로 설정되며, 리뷰 생성 시 자동으로 증가
          });

          console.log(`  ✅ ${hotel.lodgingName} (${hotel.address}) 생성 완료`);

          // ===== 객실 생성 =====
          console.log(`  🛏️  ${hotel.lodgingName} 객실 등록 중...`);
          const rooms = [];
          
          // 각 호텔마다 3-5개의 객실 타입 생성
          const roomCount = Math.min(5, roomTemplates.length);
          for (let i = 0; i < roomCount; i++) {
            const template = roomTemplates[i];
            try {
              const room = await Room.create({
                lodgingId: lodging._id,
                roomName: template.roomName,
                roomSize: template.roomSize,
                capacityMin: template.capacityMin,
                capacityMax: template.capacityMax,
                checkInTime: '15:00',
                checkOutTime: '11:00',
                roomImage: template.roomImage,
                price: template.price,
                countRoom: template.countRoom,
                ownerDiscount: template.ownerDiscount,
                platformDiscount: template.platformDiscount,
                status: 'active'
              });
              rooms.push(room);
              console.log(`    ✓ ${template.roomName} 생성 완료`);
            } catch (error) {
              console.error(`    ❌ ${template.roomName} 생성 실패:`, error.message);
            }
          }
          
          console.log(`  ✅ ${hotel.lodgingName} 객실 ${rooms.length}개 생성 완료`);
        } catch (error) {
          console.error(`  ❌ ${hotel.lodgingName} 생성 실패:`, error.message);
        }
      }
    }

    // ===== 사용자 10명 찾기 =====
    console.log('\n👥 사용자 조회 중...');
    const userEmails = [
      'user1@test.com',
      'user2@test.com',
      'user3@test.com',
      'user4@test.com',
      'user5@test.com',
      'user6@test.com',
      'user7@test.com',
      'user8@test.com',
      'user9@test.com',
      'user10@test.com'
    ];
    
    const users = [];
    for (const email of userEmails) {
      const user = await User.findOne({ email });
      if (user) {
        users.push(user);
      }
    }
    console.log(`✅ 사용자 ${users.length}명 조회 완료\n`);

    // ===== 예약 및 리뷰 생성 =====
    console.log('📅 예약 및 리뷰 생성 시작...\n');
    
    const allLodgings = await Lodging.find({}).populate('businessId');
    let bookingCount = 0;
    let reviewCount = 0;
    
    for (const lodging of allLodgings) {
      console.log(`📌 ${lodging.lodgingName} 예약 생성 중...`);
      
      // 해당 호텔의 모든 객실 조회
      const rooms = await Room.find({ lodgingId: lodging._id, status: 'active' });
      
      if (rooms.length === 0) {
        console.log(`  ⚠️  객실이 없어 예약을 생성할 수 없습니다.`);
        continue;
      }
      
      // 각 객실마다 여러 예약 생성 (사용자 10명 활용)
      for (const room of rooms) {
        // 객실당 2-3개의 예약 생성
        const bookingsPerRoom = Math.min(3, users.length);
        
        for (let i = 0; i < bookingsPerRoom; i++) {
          const user = users[i % users.length]; // 사용자 순환
          
          // 날짜 생성 (과거부터 미래까지 분산)
          const today = new Date();
          const daysAgo = Math.floor(Math.random() * 60) - 30; // -30일 ~ +30일
          const checkinDate = new Date(today);
          checkinDate.setDate(today.getDate() + daysAgo);
          
          // 체크아웃 날짜 (1-3박)
          const nights = Math.floor(Math.random() * 3) + 1;
          const checkoutDate = new Date(checkinDate);
          checkoutDate.setDate(checkinDate.getDate() + nights);
          
          // duration 계산
          const duration = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
          
          // 인원 수 (객실 수용 인원 범위 내)
          const adult = Math.floor(Math.random() * (room.capacityMax - room.capacityMin + 1)) + room.capacityMin;
          const child = Math.floor(Math.random() * 2); // 0-1명
          
          try {
            // 예약 생성
            const booking = await Booking.create({
              roomId: room._id,
              userId: user._id,
              businessId: lodging.businessId._id,
              adult: adult,
              child: child,
              checkinDate: checkinDate,
              checkoutDate: checkoutDate,
              bookingDate: new Date(checkinDate.getTime() - (Math.random() * 7 + 1) * 24 * 60 * 60 * 1000), // 예약일은 체크인일보다 1-8일 전
              bookingStatus: checkoutDate < today ? 'completed' : (checkinDate < today ? 'confirmed' : 'pending'),
              paymentStatus: checkoutDate < today ? 'paid' : (checkinDate < today ? 'paid' : 'pending'),
              duration: duration
            });
            
            bookingCount++;
            
            // 완료된 예약에 대해서만 리뷰 생성
            if (booking.bookingStatus === 'completed') {
              const reviewTemplate = reviewTemplates[reviewCount % reviewTemplates.length];
              
              try {
                await Review.create({
                  lodgingId: lodging._id,
                  userId: user._id,
                  bookingId: booking._id,
                  rating: reviewTemplate.rating,
                  content: reviewTemplate.content,
                  images: [],
                  status: 'active'
                });
                
                reviewCount++;
                console.log(`    ✓ 예약 및 리뷰 생성 완료 (${user.name}, ${room.roomName})`);
              } catch (reviewError) {
                // 리뷰 생성 실패는 무시 (이미 존재할 수 있음)
                if (reviewError.code !== 11000) { // 중복 키 에러가 아닌 경우만 로그
                  console.warn(`    ⚠️  리뷰 생성 실패: ${reviewError.message}`);
                }
              }
            } else {
              console.log(`    ✓ 예약 생성 완료 (${user.name}, ${room.roomName}, ${booking.bookingStatus})`);
            }
          } catch (bookingError) {
            console.error(`    ❌ 예약 생성 실패: ${bookingError.message}`);
          }
        }
      }
    }

    console.log('\n🎉 호텔 데이터 삽입 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 생성된 데이터 요약:`);
    console.log(`  • 호텔: ${await Lodging.countDocuments()}개`);
    console.log(`  • 편의시설: ${await Amenity.countDocuments()}개`);
    console.log(`  • 객실: ${await Room.countDocuments()}개`);
    console.log(`  • 예약: ${bookingCount}개`);
    console.log(`  • 리뷰: ${reviewCount}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // MongoDB 연결 종료
    await mongoose.connection.close();
    console.log('✅ MongoDB 연결 종료');
    process.exit(0);
  } catch (error) {
    console.error('❌ 호텔 데이터 삽입 중 오류 발생:', error);
    // 에러 발생 시에도 연결 종료
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// 스크립트 실행
seedHotels();

