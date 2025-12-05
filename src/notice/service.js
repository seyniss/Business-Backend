const Notice = require("./model");
const Room = require("../room/model");
const Lodging = require("../lodging/model");
const BusinessUser = require("../auth/model");

// 공지사항 생성/수정
const createOrUpdateNotice = async (noticeData, userId) => {
  const { room_id, content, usage_guide, introduction } = noticeData;

  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const room = await Room.findById(room_id).populate('lodgingId');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodgingId);
  if (!lodging || String(lodging.businessId) !== String(user._id)) {
    throw new Error("UNAUTHORIZED");
  }

  let notice = await Notice.findOne({ roomId: room_id });
  
  if (notice) {
    if (content !== undefined) notice.content = content;
    if (usage_guide !== undefined) notice.usage_guide = usage_guide;
    if (introduction !== undefined) notice.introduction = introduction;
    await notice.save();
  } else {
    notice = await Notice.create({
      roomId: room_id,
      content: content || "",
      usage_guide: usage_guide || "",
      introduction: introduction || ""
    });
  }

  return notice;
};

// 객실별 공지사항 조회
const getNoticeByRoom = async (roomId, userId) => {
  const room = await Room.findById(roomId).populate('lodgingId');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodgingId);
  if (!lodging || String(lodging.businessId) !== String(user._id)) {
    throw new Error("UNAUTHORIZED");
  }

  const notice = await Notice.findOne({ roomId: roomId });
  return notice || null;
};

// 공지사항 수정
const updateNotice = async (noticeId, noticeData, userId) => {
  const { content, usage_guide, introduction } = noticeData;

  const notice = await Notice.findById(noticeId);
  if (!notice) {
    throw new Error("NOTICE_NOT_FOUND");
  }

  const room = await Room.findById(notice.roomId).populate('lodgingId');
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const user = await BusinessUser.findById(userId);
  if (!user || user.role !== 'business') {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  const lodging = await Lodging.findById(room.lodgingId);
  if (!lodging || String(lodging.businessId) !== String(user._id)) {
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

