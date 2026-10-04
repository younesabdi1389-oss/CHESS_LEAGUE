// سرور اصلی پروژه
// فاز ۴: دیتابیس واقعی (PostgreSQL) وصل شد — بازیکن‌ها، بازی‌ها و جدول
// امتیازات واقعاً ذخیره می‌شن.
// فاز ۵: بازی آنلاین زنده بین دو نفر با Socket.IO اضافه شد (اتاق‌های بازی).

const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const { ensureSchema, isConnected } = require("./db");
const queries = require("./queries");
const roomsManager = require("./rooms");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// مسیر تستی: وضعیت سرور + اینکه دیتابیس وصله یا نه
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Chess League server is running 🚀", db: isConnected() });
});

// اگه DATABASE_URL تنظیم نشده باشه، API دیتابیسی یه خطای واضح برمی‌گردونه
function requireDb(req, res, next) {
  if (!isConnected()) {
    return res.status(503).json({
      error:
        "دیتابیس وصل نیست. مقدار DATABASE_URL رو توی فایل .env بذار و سرور رو دوباره روشن کن.",
    });
  }
  next();
}

// پیدا یا ساختن بازیکن با اسم (شناسایی ساده، بدون رمز عبور فعلاً)
app.post("/api/players", requireDb, async (req, res) => {
  try {
    const player = await queries.findOrCreatePlayer(req.body.name);
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/players", requireDb, async (req, res) => {
  res.json(await queries.listPlayers());
});

app.get("/api/leaderboard", requireDb, async (req, res) => {
  res.json(await queries.getLeaderboard());
});

app.get("/api/history", requireDb, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(await queries.getRecentGames(limit));
});

// ثبت نتیجه‌ی یک بازی تموم‌شده
app.post("/api/games", requireDb, async (req, res) => {
  try {
    const { whiteName, blackName, result } = req.body;
    if (!whiteName || !blackName || !["white", "black", "draw"].includes(result)) {
      return res.status(400).json({ error: "اطلاعات بازی ناقصه (اسم سفید، اسم سیاه، نتیجه)" });
    }
    const game = await queries.recordGame(whiteName, blackName, result);
    res.json(game);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// داده‌ی ترکیبی داشبورد برای یک بازیکن خاص
app.get("/api/dashboard", requireDb, async (req, res) => {
  const name = (req.query.name || "").trim();
  const leaderboard = await queries.getLeaderboard();
  const recent = await queries.getRecentGames(5);
  const me = leaderboard.find((p) => p.name === name) || null;

  res.json({
    username: name || "مهمان",
    stats: {
      players: leaderboard.length,
      gamesPlayed: me ? me.played : 0,
      points: me ? me.points : 0,
      rank: me ? me.rank : "-",
    },
    leagueTable: leaderboard.map((p) => ({ ...p, isMe: p.name === name })),
    recentGames: recent.map((g) => ({
      players: `${g.white_name} vs ${g.black_name}`,
      result:
        g.result === "draw" ? "مساوی" : g.result === "white" ? `برد ${g.white_name}` : `برد ${g.black_name}`,
      type: g.result === "draw" ? "draw" : "win",
    })),
  });
});

// ---------- Socket.IO: بازی آنلاین زنده با اتاق‌های بازی ----------

async function finishRoomGame(room, result, reason) {
  room.status = "over";
  io.to(room.code).emit("game_over", { result, reason: reason || "normal" });

  if (isConnected() && room.black) {
    try {
      await queries.recordGame(room.white.name, room.black.name, result);
    } catch (err) {
      console.error("⚠️ ثبت نتیجه‌ی بازی آنلاین تو دیتابیس با خطا مواجه شد:", err.message);
    }
  }
}

io.on("connection", (socket) => {
  socket.on("create_room", ({ name }) => {
    const playerName = (name || "مهمان").trim() || "مهمان";
    const room = roomsManager.createRoom(socket.id, playerName);
    socket.join(room.code);
    socket.emit("room_created", {
      roomCode: room.code,
      color: "w",
      fen: room.game.fen(),
      status: room.status,
      history: room.game.history(),
    });
  });

  socket.on("join_room", ({ code, name }) => {
    const playerName = (name || "مهمان").trim() || "مهمان";
    const result = roomsManager.joinRoom((code || "").toUpperCase().trim(), socket.id, playerName);
    if (result.error) {
      socket.emit("room_error", { message: result.error });
      return;
    }
    const room = result.room;
    socket.join(room.code);
    socket.emit("room_joined", {
      roomCode: room.code,
      color: "b",
      fen: room.game.fen(),
      status: room.status,
      whiteName: room.white.name,
      blackName: room.black.name,
      history: room.game.history(),
    });
    socket.to(room.code).emit("opponent_joined", { blackName: room.black.name, status: room.status });
  });

  socket.on("make_move", ({ roomCode, from, to, promotion }) => {
    const room = roomsManager.rooms.get(roomCode);
    if (!room || room.status !== "playing") return;

    const myColor = roomsManager.colorOfSocket(room, socket.id);
    if (!myColor || room.game.turn() !== myColor) {
      socket.emit("move_rejected", { message: "نوبت تو نیست." });
      return;
    }

    const move = room.game.move({ from, to, promotion: promotion || "q" });
    if (!move) {
      socket.emit("move_rejected", { message: "این حرکت مجاز نیست." });
      return;
    }

    io.to(room.code).emit("move_made", {
      fen: room.game.fen(),
      lastMove: move,
      history: room.game.history(),
    });

    if (room.game.game_over()) {
      const result = room.game.in_checkmate() ? (room.game.turn() === "w" ? "black" : "white") : "draw";
      finishRoomGame(room, result);
    }
  });

  socket.on("resign", ({ roomCode }) => {
    const room = roomsManager.rooms.get(roomCode);
    if (!room || room.status !== "playing") return;
    const myColor = roomsManager.colorOfSocket(room, socket.id);
    if (!myColor) return;
    finishRoomGame(room, myColor === "w" ? "black" : "white", "resign");
  });

  socket.on("disconnect", () => {
    const room = roomsManager.findRoomBySocket(socket.id);
    if (!room) return;
    if (room.status === "playing") {
      socket.to(room.code).emit("opponent_left");
    }
    roomsManager.removeRoom(room.code);
  });
});

async function start() {
  await ensureSchema();
  server.listen(PORT, () => {
    console.log("✅ سرور روی آدرس زیر در حال اجراست:");
    console.log(`   http://localhost:${PORT}`);
    console.log(
      isConnected() ? "✅ دیتابیس وصله و جدول‌ها آماده‌ان" : "⚠️  DATABASE_URL تنظیم نشده — بخش دیتابیسی API غیرفعاله"
    );
    console.log("✅ Socket.IO فعاله — بازی آنلاین زنده آماده‌ست");
  });
}

start();
