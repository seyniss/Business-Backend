require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');

// 모델 import
const User = require('../src/auth/model');
const Business = require('../src/auth/business');

// 메인 함수
const seedDatabase = async () => {
  try {
    console.log('🔄 MongoDB 연결 중...');
    await connectDB();

    // 기존 데이터 삭제
    console.log('🗑️  기존 데이터 삭제 중...');
    
    // Business 삭제 (null 포함)
    let deletedBusinesses = await Business.deleteMany({});
    console.log(`  ✓ Business 삭제 완료 (${deletedBusinesses.deletedCount}개)`);
    
    // loginId가 null인 Business도 별도로 삭제
    deletedBusinesses = await Business.deleteMany({ 
      $or: [
        { loginId: null },
        { loginId: { $exists: false } }
      ]
    });
    if (deletedBusinesses.deletedCount > 0) {
      console.log(`  ✓ null loginId Business 추가 삭제 (${deletedBusinesses.deletedCount}개)`);
    }
    
    // business 역할 User 삭제
    const deletedBusinessUsers = await User.deleteMany({ role: 'business' });
    console.log(`  ✓ business User 삭제 완료 (${deletedBusinessUsers.deletedCount}명)`);
    
    // 일반 user 삭제
    await User.deleteMany({ role: 'user' });
    console.log('  ✓ user 삭제 완료');
    
    console.log('✅ 기존 데이터 삭제 완료\n');

    // ===== 1. Business 데이터 정의 =====
    console.log('👤 사업자 데이터 준비 중...');
    
    // Business 생성 전에 한 번 더 완전히 정리 (null 포함)
    await Business.deleteMany({});
    const nullBusinesses = await Business.deleteMany({ 
      $or: [
        { loginId: null },
        { loginId: { $exists: false } }
      ]
    });
    if (nullBusinesses.deletedCount > 0) {
      console.log(`  ⚠️  추가로 null loginId Business ${nullBusinesses.deletedCount}개 삭제`);
    }
    
    const businessData = [
      {
        businessName: '신라호텔',
        businessNumber: '104-81-17709',
        email: 'shilla@business.com',
        name: '이부진',
        phoneNumber: '010-1000-0001'
      },
      {
        businessName: '롯데호텔',
        businessNumber: '120-88-00777',
        email: 'lotte@business.com',
        name: '정호석',
        phoneNumber: '010-1000-0002'
      },
      {
        businessName: '조선 팰리스',
        businessNumber: '120-88-00888',
        email: 'josun@business.com',
        name: '이정욱',
        phoneNumber: '010-1000-0003'
      }
    ];

    const businesses = [];
    
    // 각 사업자별로 User와 Business 생성
    for (const data of businessData) {
      // BUSINESS 역할 사용자 생성
      let businessUser = await User.findOne({ email: data.email });
      
      if (!businessUser) {
        businessUser = new User({
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          role: 'business',
          isActive: true
        });
        await businessUser.setPassword('password123');
        await businessUser.save();
        console.log(`✅ ${data.businessName} BUSINESS 사용자 생성 완료`);
      }

      // Business 정보 생성
      // 먼저 해당 businessUser와 관련된 모든 Business 삭제
      await Business.deleteMany({ loginId: businessUser._id });
      await Business.deleteMany({ businessNumber: data.businessNumber });
      
      // loginId가 null인 모든 Business 삭제 (unique 인덱스 충돌 방지)
      const nullDeleted = await Business.deleteMany({ 
        $or: [
          { loginId: null },
          { loginId: { $exists: false } }
        ]
      });
      if (nullDeleted.deletedCount > 0) {
        console.log(`  ⚠️  ${data.businessName} - null loginId Business ${nullDeleted.deletedCount}개 삭제`);
      }
      
      let business = await Business.findOne({ loginId: businessUser._id });
      if (!business) {
        
        try {
          business = await Business.create({
            loginId: businessUser._id,
            businessName: data.businessName,
            businessNumber: data.businessNumber
          });
          console.log(`✅ ${data.businessName} Business 정보 생성 완료`);
        } catch (error) {
          if (error.code === 11000) {
            // 중복 키 에러 발생 시, 더 강력하게 정리 후 재생성
            console.warn(`⚠️  ${data.businessName} Business 중복 감지, 기존 데이터 정리 후 재생성`);
            
            // 모든 가능한 중복 제거
            await Business.deleteMany({ 
              $or: [
                { loginId: null },
                { loginId: businessUser._id },
                { businessNumber: data.businessNumber }
              ]
            });
            
            // 잠시 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 100));
            
            business = await Business.create({
              loginId: businessUser._id,
              businessName: data.businessName,
              businessNumber: data.businessNumber
            });
            console.log(`✅ ${data.businessName} Business 정보 재생성 완료`);
          } else {
            throw error;
          }
        }
      } else {
        // 기존 Business가 있으면 사업자명 업데이트
        business.businessName = data.businessName;
        await business.save();
      }
      
      businesses.push({ business, businessUser });
    }

    console.log(`✅ 총 ${businesses.length}개 사업자 생성 완료\n`);

    // ===== 2. 사용자 데이터 생성 =====
    console.log('👥 사용자 데이터 삽입 중...');
    
    const userData = [
      {
        name: '김민수',
        email: 'user1@test.com',
        phoneNumber: '010-1111-1111'
      },
      {
        name: '이서연',
        email: 'user2@test.com',
        phoneNumber: '010-1111-1112'
      },
      {
        name: '박준형',
        email: 'user3@test.com',
        phoneNumber: '010-1111-1113'
      },
      {
        name: '최지아',
        email: 'user4@test.com',
        phoneNumber: '010-1111-1114'
      },
      {
        name: '정현우',
        email: 'user5@test.com',
        phoneNumber: '010-1111-1115'
      },
      {
        name: '한예린',
        email: 'user6@test.com',
        phoneNumber: '010-1111-1116'
      },
      {
        name: '오성민',
        email: 'user7@test.com',
        phoneNumber: '010-1111-1117'
      },
      {
        name: '윤다혜',
        email: 'user8@test.com',
        phoneNumber: '010-1111-1118'
      },
      {
        name: '장태훈',
        email: 'user9@test.com',
        phoneNumber: '010-1111-1119'
      },
      {
        name: '배지훈',
        email: 'user10@test.com',
        phoneNumber: '010-1111-1120'
      }
    ];

    for (const data of userData) {
      let user = await User.findOne({ email: data.email });
      if (!user) {
        user = new User({
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          role: 'user',
          isActive: true
        });
        await user.setPassword('password123');
        await user.save();
        console.log(`✅ 사용자 생성 완료: ${data.name} (${data.email})`);
      } else {
        console.log(`⚠️  사용자 이미 존재: ${data.email}`);
      }
    }

    console.log(`✅ 총 ${userData.length}명 사용자 생성 완료`);

    // ===== 최종 결과 출력 =====
    console.log('\n🎉 초기 데이터 삽입 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 생성된 데이터 요약:`);
    console.log(`  • 사용자: ${await User.countDocuments({ role: 'user' })}명`);
    console.log(`  • 사업자: ${await Business.countDocuments()}명`);
    console.log(`  • 사업자 계정: ${await User.countDocuments({ role: 'business' })}명`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // MongoDB 연결 종료
    await mongoose.connection.close();
    console.log('✅ MongoDB 연결 종료');
    process.exit(0);
  } catch (error) {
    console.error('❌ 데이터 삽입 중 오류 발생:', error);
    // 에러 발생 시에도 연결 종료
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// 스크립트 실행
seedDatabase();

