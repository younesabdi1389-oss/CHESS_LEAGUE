// ===================================================================
// مدیریت اتاق‌های بازی آنلاین زنده (فقط تو حافظه‌ی سرور، نه دیتابیس).
// هر بازیکن با یک playerId ثابت (ساخته‌شده تو مرورگر) شناخته می‌شه، نه با
// socket.id؛ پس بعد از رفرش یا قطع شدن اینترنت دوباره به همون بازی برمی‌گرده.
// ===================================================================

const chessModule = require("chess.js");
const Chess = chessModule.Chess || chessModule;

const rooms = new Map(); // roomCode -> room
const playerRoom = new Map(); // playerId -> roomCode

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // بدون حروف/عددهای شبیه‌به‌هم
const CLOCK_START_MS = 10 * 60 * 1000; // ۱۰ دقیقه

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (rooms.has(code));
  return code;
}

// حذف کاراکترهای کنترلی/جهت‌دهنده‌ی متن (برای نام و چت) + محدودیت طول
function cleanText(value, maxLen) {
  return String(value == null ? "" : value)
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function cleanName(name) {
  return cleanText(name, 20) || "مهمان";
}

function isValidPlayerId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(id);
}

function createRoom(playerId, socketId, name, withTimer) {
  const code = generateRoomCode();
  const room = {
    code,
    game: new Chess(),
    white: { playerId, socketId, name, connected: true, dropTimer: null },
    black: null,
    status: "waiting", // waiting | playing | over
    withTimer: !!withTimer,
    timeLeft: { w: CLOCK_START_MS, b: CLOCK_START_MS },
    turnStartedAt: null,
    timeoutHandle: null,
    result: null,
    reason: null,
    lastMove: null,
    chat: [],
    seenChatIds: new Set(),
    createdAt: Date.now(),
    cleanupTimer: null,
  };
  rooms.set(code, room);
  playerRoom.set(playerId, code);
  return room;
}

function joinRoom(code, playerId, socketId, name) {
  const room = rooms.get(code);
  if (!room) return { error: "اتاقی با این کد پیدا نشد." };
  if (room.status === "over") return { error: "این بازی تموم شده." };
  if (room.black) return { error: "این اتاق پره." };
  if (room.white.playerId === playerId) return { error: "نمی‌تونی به اتاق خودت ملحق بشی." };
  if (room.white.name.toLowerCase() === name.toLowerCase()) {
    return { error: "اسم تو با اسم سازنده‌ی اتاق یکیه؛ یه اسم دیگه بنویس." };
  }
  room.black = { playerId, socketId, name, connected: true, dropTimer: null };
  room.status = "playing";
  playerRoom.set(playerId, code);
  return { room };
}

function findRoomByPlayer(playerId) {
  const code = playerRoom.get(playerId);
  return code ? rooms.get(code) || null : null;
}

function seatOf(room, playerId) {
  if (room.white && room.white.playerId === playerId) return { seat: room.white, color: "w" };
  if (room.black && room.black.playerId === playerId) return { seat: room.black, color: "b" };
  return null;
}

function findSeatBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.white && room.white.socketId === socketId) return { room, seat: room.white, color: "w" };
    if (room.black && room.black.socketId === socketId) return { room, seat: room.black, color: "b" };
  }
  return null;
}

// زمان باقی‌مونده‌ی «زنده» (نوبت فعلی هنوز در حال کم شدنه)
function liveTimeLeft(room) {
  const t = { w: room.timeLeft.w, b: room.timeLeft.b };
  if (room.withTimer && room.status === "playing" && room.turnStartedAt) {
    const turn = room.game.turn();
    t[turn] = Math.max(0, t[turn] - (Date.now() - room.turnStartedAt));
  }
  return t;
}

function removeRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  clearTimeout(room.timeoutHandle);
  clearTimeout(room.cleanupTimer);
  [room.white, room.black].forEach((s) => {
    if (!s) return;
    clearTimeout(s.dropTimer);
    if (playerRoom.get(s.playerId) === code) playerRoom.delete(s.playerId);
  });
  rooms.delete(code);
}

module.exports = {
  createRoom,
  joinRoom,
  findRoomByPlayer,
  seatOf,
  findSeatBySocket,
  liveTimeLeft,
  removeRoom,
  cleanText,
  cleanName,
  isValidPlayerId,
  rooms,
  CLOCK_START_MS,
};
