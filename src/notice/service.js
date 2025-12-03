const Notice = require("./model");
const Room = require("../room/model");
const Lodging = require("../lodging/model");
const Business = require("../auth/business");

// 공지사항 생성/수정
const createOrUpdateNotice = async (noticeData, userId) => {
  const { room_id, content, usage_guide, introduction } = noticeData;

  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const room = await Room.findById(room_id).populate('lodging_id');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodging_id);
  if (!lodging || String(lodging.business_id) !== String(business._id)) {
    throw new Error("UNAUTHORIZED");
  }

  let notice = await Notice.findOne({ room_id });
  
  if (notice) {
    if (content !== undefined) notice.content = content;
    if (usage_guide !== undefined) notice.usage_guide = usage_guide;
    if (introduction !== undefined) notice.introduction = introduction;
    await notice.save();
  } else {
    notice = await Notice.create({
      room_id,
      content: content || "",
      usage_guide: usage_guide || "",
      introduction: introduction || ""
    });
  }

  return notice;
};

// 객실별 공지사항 조회
const getNoticeByRoom = async (roomId, userId) => {
  const room = await Room.findById(roomId).populate('lodging_id');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodging_id);
  if (!lodging || String(lodging.business_id) !== String(business._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const notice = await Notice.findOne({ room_id: roomId });
  return notice || null;
};

// 공지사항 수정
const updateNotice = async (noticeId, noticeData, userId) => {
  const { content, usage_guide, introduction } = noticeData;

  const notice = await Notice.findById(noticeId);
  if (!notice) {
    throw new Error("NOTICE_NOT_FOUND");
  }

  const room = await Room.findById(notice.room_id).populate('lodging_id');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const business = await Business.findOne({ loginId: userId });
  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodging_id);
  if (!lodging || String(lodging.business_id) !== String(business._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const updates = {};
  if (content !== undefined) updates.content = content;
  if (usage_guide !== undefined) updates.usage_guide = usage_guide;
  if (introduction !== undefined) updates.introduction = introduction;

  const updated = await Notice.findByIdAndUpdate(
    noticeId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  return updated;
};

module.exports = {
  createOrUpdateNotice,
  getNoticeByRoom,
  updateNotice
};

