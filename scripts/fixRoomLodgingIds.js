require('dotenv').config();
const mongoose = require("mongoose");
const { connectDB } = require("../src/config/db");

const Lodging = require("../src/lodging/model");
const Room = require("../src/room/model");

async function fixRoomLodgingIds() {
  try {
    await connectDB();
    console.log("MongoDB 연결 성공\n");

    // 모든 숙소 조회 (생성일 순)
    const lodgings = await Lodging.find()
      .sort({ _id: 1 })
      .lean();
    
    console.log(`총 숙소 수: ${lodgings.length}개\n`);

    if (lodgings.length === 0) {
      console.log("숙소가 없습니다.");
      await mongoose.disconnect();
      return;
    }

    // 모든 객실 조회 (생성일 순)
    const rooms = await Room.find()
      .sort({ _id: 1 })
      .lean();
    
    console.log(`총 객실 수: ${rooms.length}개\n`);

    if (rooms.length === 0) {
      console.log("객실이 없습니다.");
      await mongoose.disconnect();
      return;
    }

    // 숙소별로 그룹화 (각 숙소당 6개 객실)
    const roomsPerLodging = 6;
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    console.log("객실 lodgingId 수정 시작...\n");

    // 각 숙소별로 처리
    for (let i = 0; i < lodgings.length; i++) {
      const lodging = lodgings[i];
      const lodgingId = lodging._id;
      
      // 해당 숙소에 속해야 할 객실들 (순서대로 6개씩)
      const startIndex = i * roomsPerLodging;
      const endIndex = startIndex + roomsPerLodging;
      const targetRooms = rooms.slice(startIndex, endIndex);

      if (targetRooms.length === 0) {
        console.log(`⏭️  [${i + 1}] ${lodging.lodgingName}: 매칭할 객실 없음`);
        skippedCount++;
        continue;
      }

      console.log(`\n📌 [${i + 1}] ${lodging.lodgingName} (ID: ${lodgingId})`);
      console.log(`   매칭할 객실: ${targetRooms.length}개`);

      // 각 객실의 lodgingId 업데이트
      for (let j = 0; j < targetRooms.length; j++) {
        const room = targetRooms[j];
        
        try {
          // 현재 lodgingId 확인
          const currentLodgingId = room.lodgingId ? room.lodgingId.toString() : '없음';
          const targetLodgingId = lodgingId.toString();
          
          // 이미 올바른 lodgingId인지 확인
          if (currentLodgingId === targetLodgingId) {
            console.log(`   ✅ [${j + 1}] ${room.roomName || room.name || `객실 ${j + 1}`}: 이미 올바른 lodgingId`);
            continue;
          }

          // lodgingId 업데이트
          await Room.updateOne(
            { _id: room._id },
            { $set: { lodgingId: lodgingId } }
          );

          console.log(`   ✅ [${j + 1}] ${room.roomName || room.name || `객실 ${j + 1}`}: lodgingId 수정 (${currentLodgingId} → ${targetLodgingId})`);
          successCount++;

        } catch (error) {
          console.error(`   ❌ [${j + 1}] 객실 ${room._id} 수정 실패:`, error.message);
          errorCount++;
        }
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 처리 완료:`);
    console.log(`  ✅ 수정된 객실: ${successCount}개`);
    console.log(`  ⏭️  스킵된 객실: ${skippedCount}개`);
    console.log(`  ❌ 실패한 객실: ${errorCount}개`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // 검증: 각 숙소의 객실 수 확인
    console.log("검증: 각 숙소의 객실 수 확인\n");
    for (let i = 0; i < lodgings.length; i++) {
      const lodging = lodgings[i];
      const roomCount = await Room.countDocuments({ lodgingId: lodging._id });
      console.log(`  [${i + 1}] ${lodging.lodgingName}: ${roomCount}개 객실`);
    }

    await mongoose.disconnect();
    console.log("\nMongoDB 연결 종료");
  } catch (err) {
    console.error("❌ 오류 발생:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixRoomLodgingIds();

