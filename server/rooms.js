// ===================================================================
// مدیریت اتاق‌های بازی آنلاین زنده (فقط تو حافظه‌ی سرور، نه دیتابیس).
// هر اتاق = یه بازی زنده‌ی دو نفره با یه نمونه‌ی مخصوص خودش از chess.js.
// وقتی بازی تموم بشه، نتیجه‌ش جداگانه تو دیتابیس (جدول games) ذخیره می‌شه.
// ===================================================================

const chessModule = require("chess.js");
const Chess = chessModule.Chess || chessModule;

const rooms = new Map(); // roomCode -> room

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // بدون حروف/عددهای شبیه‌به‌هم

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function createRoom(socketId, name) {
  const code = generateRoomCode();
  const room = {
    code,
    game: new Chess(),
    white: { socketId, name },
    black: null,
    status: "waiting", // waiting | playing | over
  };
  rooms.set(code, room);
  return room;
}

function joinRoom(code, socketId, name) {
  const room = rooms.get(code);
  if (!room) return { error: "اتاقی با این کد پیدا نشد." };
  if (room.black) return { error: "این اتاق پره." };
  if (room.white.socketId === socketId) return { error: "نمی‌تونی به اتاق خودت ملحق بشی." };
  room.black = { socketId, name };
  room.status = "playing";
  return { room };
}

function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.white?.socketId === socketId || room.black?.socketId === socketId) return room;
  }
  return null;
}

function colorOfSocket(room, socketId) {
  if (room.white?.socketId === socketId) return "w";
  if (room.black?.socketId === socketId) return "b";
  return null;
}

function removeRoom(code) {
  rooms.delete(code);
}

module.exports = { createRoom, joinRoom, findRoomBySocket, colorOfSocket, removeRoom, rooms };
