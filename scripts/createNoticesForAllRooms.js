require('dotenv').config();
const mongoose = require("mongoose");
const { connectDB } = require("../src/config/db");

const Lodging = require("../src/lodging/model");
const Room = require("../src/room/model");
const Notice = require("../src/notice/model");

// category_id를 카테고리 이름으로 매핑
const categoryIdToName = {
  "657000000000000000000001": "호텔",
  "657000000000000000000002": "모텔",
  "657000000000000000000003": "리조트",
  "657000000000000000000004": "펜션/풀빌라",
  "657000000000000000000005": "게스트하우스",
  "657000000000000000000006": "에어비앤비"
};

// 숙소 카테고리별 공지사항 템플릿
const noticeTemplatesByCategory = {
  "호텔": {
    standard: {
      content: "체크인 시간은 오후 3시부터입니다. 프론트 데스크에서 체크인을 진행해주세요.",
      usageGuide: "객실 내 금연입니다. 흡연 시 추가 청소비가 발생할 수 있습니다.",
      introduction: "편안하고 쾌적한 숙박을 위해 최선을 다하겠습니다."
    },
    deluxe: {
      content: "체크인 시간은 오후 3시부터입니다. 프리미엄 라운지 이용 가능합니다.",
      usageGuide: "객실 내 시설물 사용 시 주의해주시기 바랍니다. 미니바는 유료입니다.",
      introduction: "프리미엄 서비스로 최고의 숙박 경험을 제공합니다."
    },
    suite: {
      content: "체크인 시간은 오후 2시부터입니다. 버틀러 서비스 이용 가능합니다.",
      usageGuide: "스위트 객실 내 모든 시설을 자유롭게 이용하실 수 있습니다.",
      introduction: "럭셔리 스위트에서 특별한 경험을 선사합니다."
    }
  },
  "모텔": {
    standard: {
      content: "체크인 시간은 오후 2시부터입니다. 24시간 운영합니다.",
      usageGuide: "객실 내 취사는 불가능합니다. 주변 식당을 이용해주세요.",
      introduction: "깨끗하고 편안한 휴식을 제공합니다."
    },
    deluxe: {
      content: "체크인 시간은 오후 2시부터입니다. 주차 공간이 제공됩니다.",
      usageGuide: "객실 내 금연입니다. 흡연은 지정된 장소에서만 가능합니다.",
      introduction: "편리한 위치와 쾌적한 시설을 자랑합니다."
    },
    suite: {
      content: "체크인 시간은 오후 2시부터입니다. 넓은 공간을 제공합니다.",
      usageGuide: "객실 내 모든 시설을 자유롭게 이용하실 수 있습니다.",
      introduction: "넓고 편안한 공간에서 휴식을 즐기세요."
    }
  },
  "리조트": {
    standard: {
      content: "체크인 시간은 오후 3시부터입니다. 리조트 시설 이용 가능합니다.",
      usageGuide: "수영장 이용 시 수영복을 착용해주세요. 타월은 대여 가능합니다.",
      introduction: "자연 속에서 편안한 휴식을 즐기실 수 있습니다."
    },
    deluxe: {
      content: "체크인 시간은 오후 3시부터입니다. 프리미엄 리조트 시설 이용 가능합니다.",
      usageGuide: "객실 내 미니바와 커피머신을 자유롭게 이용하실 수 있습니다.",
      introduction: "프리미엄 리조트에서 특별한 휴식을 경험하세요."
    },
    suite: {
      content: "체크인 시간은 오후 2시부터입니다. 프라이빗 테라스 이용 가능합니다.",
      usageGuide: "스위트 객실 내 모든 시설과 리조트 시설을 자유롭게 이용하실 수 있습니다.",
      introduction: "럭셔리 스위트에서 최고의 리조트 경험을 선사합니다."
    }
  },
  "게스트하우스": {
    standard: {
      content: "체크인 시간은 오후 2시부터입니다. 셀프 체크인 가능합니다.",
      usageGuide: "공용 공간 이용 시 다른 게스트를 배려해주세요. 조용히 이용해주세요.",
      introduction: "친근하고 편안한 분위기에서 지내실 수 있습니다."
    },
    deluxe: {
      content: "체크인 시간은 오후 2시부터입니다. 프라이빗 공간을 제공합니다.",
      usageGuide: "공용 주방 이용 시 사용 후 정리해주세요. 식기류는 세척 후 보관해주세요.",
      introduction: "편안하고 따뜻한 분위기에서 휴식을 즐기세요."
    },
    suite: {
      content: "체크인 시간은 오후 2시부터입니다. 독립적인 공간을 제공합니다.",
      usageGuide: "객실 내 모든 시설을 자유롭게 이용하실 수 있습니다.",
      introduction: "독립적인 공간에서 자유롭게 지내실 수 있습니다."
    }
  },
  "에어비앤비": {
    standard: {
      content: "체크인 시간은 오후 3시부터입니다. 셀프 체크인 가이드를 확인해주세요.",
      usageGuide: "객실 내 취사 가능합니다. 사용 후 정리해주세요. 쓰레기는 분리수거해주세요.",
      introduction: "로컬 경험을 즐길 수 있는 편안한 공간입니다."
    },
    deluxe: {
      content: "체크인 시간은 오후 3시부터입니다. 넓은 공간과 주방을 제공합니다.",
      usageGuide: "주방 시설을 자유롭게 이용하실 수 있습니다. 사용 후 정리 부탁드립니다.",
      introduction: "집처럼 편안한 공간에서 휴식을 즐기세요."
    },
    suite: {
      content: "체크인 시간은 오후 3시부터입니다. 프라이빗 공간과 테라스를 제공합니다.",
      usageGuide: "모든 시설을 자유롭게 이용하실 수 있습니다. 퇴실 시 정리 부탁드립니다.",
      introduction: "독립적인 공간에서 자유롭고 편안한 시간을 보내세요."
    }
  },
  "펜션/풀빌라": {
    standard: {
      content: "체크인 시간은 오후 3시부터입니다. 프라이빗 공간을 제공합니다.",
      usageGuide: "객실 내 취사 가능합니다. 사용 후 정리해주세요. 쓰레기는 분리수거해주세요.",
      introduction: "프라이빗한 공간에서 힐링을 즐기실 수 있습니다."
    },
    deluxe: {
      content: "체크인 시간은 오후 3시부터입니다. 넓은 공간과 주방을 제공합니다.",
      usageGuide: "주방과 바베큐 시설을 자유롭게 이용하실 수 있습니다. 사용 후 정리 부탁드립니다.",
      introduction: "넓고 편안한 공간에서 가족과 함께 즐거운 시간을 보내세요."
    },
    suite: {
      content: "체크인 시간은 오후 2시부터입니다. 프라이빗 풀빌라를 제공합니다.",
      usageGuide: "모든 시설을 자유롭게 이용하실 수 있습니다. 퇴실 시 정리 부탁드립니다.",
      introduction: "럭셔리 풀빌라에서 특별한 힐링 경험을 선사합니다."
    }
  }
};

// 기본 템플릿 (카테고리가 없거나 매칭되지 않는 경우)
const defaultTemplates = {
  standard: {
    content: "체크인 시간은 오후 3시부터입니다.",
    usageGuide: "객실 내 시설물 사용 시 주의해주시기 바랍니다.",
    introduction: "편안하고 쾌적한 숙박을 위해 최선을 다하겠습니다."
  },
  deluxe: {
    content: "체크인 시간은 오후 3시부터입니다. 프리미엄 서비스를 제공합니다.",
    usageGuide: "객실 내 모든 시설을 자유롭게 이용하실 수 있습니다.",
    introduction: "프리미엄 서비스로 최고의 숙박 경험을 제공합니다."
  },
  suite: {
    content: "체크인 시간은 오후 2시부터입니다. 스위트 전용 서비스를 제공합니다.",
    usageGuide: "스위트 객실 내 모든 시설을 자유롭게 이용하실 수 있습니다.",
    introduction: "럭셔리 스위트에서 특별한 경험을 선사합니다."
  }
};

// 공지사항 생성 함수
function getNoticeForRoom(lodging, room, roomIndex) {
  // lodging이 lean() 객체일 수 있으므로 안전하게 접근
  // 실제 데이터에는 category_id가 있음
  let category = "호텔"; // 기본값
  if (lodging.category_id) {
    const categoryIdStr = lodging.category_id.toString();
    category = categoryIdToName[categoryIdStr] || lodging.category || "호텔";
  } else if (lodging.category) {
    category = lodging.category;
  }
  
  // room이 Mongoose 문서일 수 있으므로 안전하게 접근
  // 실제 데이터에는 type이 없을 수 있으므로 기본값 "standard" 사용
  const roomType = (room.type || "standard");
  
  // 카테고리별 템플릿 가져오기
  const categoryTemplates = noticeTemplatesByCategory[category] || noticeTemplatesByCategory["호텔"];
  const template = categoryTemplates[roomType] || defaultTemplates[roomType] || defaultTemplates.standard;
  
  // 숙소 이름을 활용한 개인화 (선택적)
  const lodgingName = lodging.lodgingName || '';
  let personalizedContent = template.content;
  if (lodgingName) {
    personalizedContent = template.content.replace(
      "체크인 시간은",
      `${lodgingName} 체크인 시간은`
    );
  }
  
  // maxlength 100 제한 확인
  if (personalizedContent.length > 100) {
    personalizedContent = personalizedContent.substring(0, 97) + '...';
  }
  
  return {
    content: personalizedContent,
    usageGuide: template.usageGuide.length > 100 ? template.usageGuide.substring(0, 97) + '...' : template.usageGuide,
    introduction: template.introduction.length > 100 ? template.introduction.substring(0, 97) + '...' : template.introduction
  };
}

async function createNoticesForAllRooms() {
  try {
    await connectDB();
    console.log("MongoDB 연결 성공\n");

    // 모든 숙소 조회
    const lodgings = await Lodging.find()
      .sort({ _id: 1 })
      .lean();
    
    console.log(`총 숙소 수: ${lodgings.length}개`);
    
    // Notice 테이블 상태 확인
    const existingNoticeCount = await Notice.countDocuments();
    console.log(`현재 Notice 테이블 문서 수: ${existingNoticeCount}개`);
    
    // 모든 Notice의 roomId를 Set으로 저장 (빠른 조회를 위해)
    const allNotices = await Notice.find({}, { roomId: 1 }).lean();
    const existingRoomIds = new Set(allNotices.map(n => n.roomId.toString()));
    console.log(`기존 Notice roomId 수: ${existingRoomIds.size}개\n`);

    if (lodgings.length === 0) {
      console.log("숙소가 없습니다.");
      await mongoose.disconnect();
      return;
    }

    let totalNoticesCreated = 0;
    let totalNoticesSkipped = 0;
    let totalRoomsProcessed = 0;
    let lodgingsProcessed = 0;

    // 각 숙소별로 처리
    for (const lodging of lodgings) {
      lodgingsProcessed++;
      
      // 해당 숙소의 모든 객실 조회
      // lean()을 사용하지 않아서 Mongoose 문서 객체로 반환 (room._id가 ObjectId)
      const rooms = await Room.find({ lodgingId: lodging._id })
        .sort({ _id: 1 });
      
      // category_id를 카테고리 이름으로 변환
      let categoryName = '카테고리 없음';
      if (lodging.category_id) {
        const categoryIdStr = lodging.category_id.toString();
        categoryName = categoryIdToName[categoryIdStr] || lodging.category || '카테고리 없음';
      } else if (lodging.category) {
        categoryName = lodging.category;
      }

      if (rooms.length === 0) {
        console.log(`⏭️  [${lodgingsProcessed}] ${lodging.lodgingName || lodging._id} (${categoryName}): 객실 없음`);
        continue;
      }

      console.log(`\n📌 [${lodgingsProcessed}] ${lodging.lodgingName || lodging._id} (${categoryName})`);
      console.log(`   객실 수: ${rooms.length}개`);

      // 각 객실에 공지사항 생성
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        totalRoomsProcessed++;

        try {
          // 이미 공지사항이 있는지 확인
          const roomId = room._id;
          
          // 실제 데이터에는 roomName이 있음
          const roomName = room.roomName || room.name || `객실 ${i + 1}`;
          const roomType = room.type || 'standard';
          
          // roomId를 ObjectId로 명시적으로 변환
          const roomIdObj = roomId instanceof mongoose.Types.ObjectId 
            ? roomId 
            : new mongoose.Types.ObjectId(roomId.toString());
          
          const roomIdStr = roomIdObj.toString();
          
          // 디버깅: 모든 객실에 대해 로그 출력
          console.log(`   [DEBUG ${i + 1}] ${roomName} - roomId: ${roomIdStr}`);
          
          // Set을 사용하여 빠르게 확인 (쿼리 없이)
          if (existingRoomIds.has(roomIdStr)) {
            console.log(`   [DEBUG ${i + 1}] existingNotice 발견! (Set에서 확인)`);
            console.log(`   ⏭️  [${i + 1}] ${roomName} (${roomType}): 공지사항 이미 존재`);
            totalNoticesSkipped++;
            continue;
          } else {
            console.log(`   [DEBUG ${i + 1}] existingNotice 없음 - 새로 생성 가능`);
          }

          // 숙소별, 객실 타입별 공지사항 생성
          const noticeData = getNoticeForRoom(lodging, room, i);

          // Notice 모델에 공지사항 생성
          // roomIdObj를 사용 (이미 위에서 변환됨)
          await Notice.create({
            roomId: roomIdObj,
            content: noticeData.content,
            usageGuide: noticeData.usageGuide,
            introduction: noticeData.introduction
          });
          
          // 생성 성공 시 Set에 추가
          existingRoomIds.add(roomIdStr);

          console.log(`   ✅ [${i + 1}] ${roomName} (${roomType}): 공지사항 생성 완료`);
          totalNoticesCreated++;

        } catch (error) {
          if (error.code === 11000) {
            // 중복 키 오류 (이미 존재)
            const roomName = room.roomName || room.name || `객실 ${i + 1}`;
            console.log(`   ⏭️  [${i + 1}] ${roomName}: 공지사항 이미 존재 (중복 키)`);
            totalNoticesSkipped++;
          } else {
            const roomName = room.roomName || room.name || `객실 ${i + 1}`;
            console.error(`   ❌ [${i + 1}] ${roomName}: 공지사항 생성 실패 - ${error.message}`);
          }
        }
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 처리 완료:`);
    console.log(`  🏨 처리된 숙소 수: ${lodgingsProcessed}개`);
    console.log(`  🚪 처리된 객실 수: ${totalRoomsProcessed}개`);
    console.log(`  📝 생성된 공지사항: ${totalNoticesCreated}개`);
    console.log(`  ⏭️  스킵된 공지사항: ${totalNoticesSkipped}개 (이미 존재)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    await mongoose.disconnect();
    console.log("MongoDB 연결 종료");
  } catch (err) {
    console.error("❌ 오류 발생:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createNoticesForAllRooms();

