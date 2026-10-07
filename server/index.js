// سرور اصلی پروژه
// فاز ۴: دیتابیس واقعی (PostgreSQL) — بازیکن‌ها، بازی‌ها و جدول امتیازات.
// فاز ۵: بازی آنلاین زنده با Socket.IO. قوانین، نوبت، ساعت و نتیجه همه سمت
// سرور کنترل می‌شن؛ کلاینت فقط «درخواست حرکت» می‌فرسته و نتیجه رو نمی‌تونه جعل کنه.

const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const { ensureSchema, isConnected } = require("./db");
const queries = require("./queries");
const rm = require("./rooms");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 8000,
  pingTimeout: 7000,
  maxHttpBufferSize: 1e4, // پیام‌های بزرگ‌تر از ۱۰ کیلوبایت رد می‌شن
});
const PORT = process.env.PORT || 3000;

const RECONNECT_GRACE_MS = 90 * 1000; // مهلت برگشتن بازیکن قطع‌شده
const WAITING_ROOM_TTL_MS = 3 * 60 * 1000; // اتاق منتظر حریف
const OVER_ROOM_TTL_MS = 10 * 60 * 1000; // نگه‌داشتن نتیجه برای رفرش بعد از پایان
const REACTIONS = new Set(["👍", "😂", "😮", "🔥", "😢", "♟️", "👏", "🤝", "😎", "🙏"]);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});
app.use(express.json({ limit: "10kb" }));

// chess.js از خود پکیج نصب‌شده‌ی پروژه سرو می‌شه (بدون نیاز به CDN)
app.get("/vendor/chess.js", (req, res) => {
  try {
    res.type("application/javascript").sendFile(require.resolve("chess.js"));
  } catch (e) {
    res.status(404).end();
  }
});

app.use(
  express.static(path.join(__dirname, "..", "public"), {
    maxAge: "10m",
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Chess League server is running 🚀", db: isConnected() });
});

function requireDb(req, res, next) {
  if (!isConnected()) {
    return res.status(503).json({
      error: "دیتابیس وصل نیست. مقدار DATABASE_URL رو توی فایل .env بذار و سرور رو دوباره روشن کن.",
    });
  }
  next();
}

// محدودیت ساده‌ی تعداد درخواست نوشتن (بدون پکیج): هر IP در دقیقه
const writeHits = new Map();
function rateLimitWrites(max) {
  return (req, res, next) => {
    const now = Date.now();
    const rec = writeHits.get(req.ip) || { n: 0, t: now };
    if (now - rec.t > 60000) {
      rec.n = 0;
      rec.t = now;
    }
    rec.n++;
    writeHits.set(req.ip, rec);
    if (rec.n > max) return res.status(429).json({ error: "درخواست‌ها زیاده؛ کمی صبر کن و دوباره امتحان کن." });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of writeHits) if (now - rec.t > 120000) writeHits.delete(ip);
}, 120000).unref();

app.post("/api/players", requireDb, rateLimitWrites(30), async (req, res) => {
  try {
    const name = rm.cleanText(req.body.name, 20);
    const avatar = Number.isInteger(req.body.avatar) && req.body.avatar >= 0 && req.body.avatar < 20 ? req.body.avatar : undefined;
    const player = await queries.findOrCreatePlayer(name, avatar);
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/players", requireDb, async (req, res) => {
  try {
    res.json(await queries.listPlayers());
  } catch (err) {
    res.status(500).json({ error: "خطای دیتابیس" });
  }
});

app.get("/api/leaderboard", requireDb, async (req, res) => {
  try {
    res.json(await queries.getLeaderboard());
  } catch (err) {
    res.status(500).json({ error: "خطای دیتابیس" });
  }
});

app.get("/api/history", requireDb, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    res.json(await queries.getRecentGames(limit));
  } catch (err) {
    res.status(500).json({ error: "خطای دیتابیس" });
  }
});

// ثبت نتیجه‌ی بازی «محلی» (دو نفر روی یک دستگاه). این مسیر به اعتماد بین
// دوست‌ها تکیه داره؛ بازی‌های آنلاین نتیجه‌شون رو خود سرور ثبت می‌کنه.
app.post("/api/games", requireDb, rateLimitWrites(10), async (req, res) => {
  try {
    const whiteName = rm.cleanText(req.body.whiteName, 20);
    const blackName = rm.cleanText(req.body.blackName, 20);
    const { result } = req.body;
    if (!whiteName || !blackName || !["white", "black", "draw"].includes(result)) {
      return res.status(400).json({ error: "اطلاعات بازی ناقصه (اسم سفید، اسم سیاه، نتیجه)" });
    }
    if (whiteName.toLowerCase() === blackName.toLowerCase()) {
      return res.status(400).json({ error: "اسم دو بازیکن نباید یکی باشه." });
    }
    res.json(await queries.recordGame(whiteName, blackName, result));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/dashboard", requireDb, async (req, res) => {
  try {
    const name = rm.cleanText(req.query.name, 20);
    const leaderboard = await queries.getLeaderboard();
    const recent = await queries.getRecentGames(5);
    const me = leaderboard.find((p) => p.name === name) || null;

    res.json({
      username: name || "مهمان",
      avatar: me ? me.avatar : 0,
      stats: {
        players: leaderboard.length,
        gamesPlayed: me ? me.played : 0,
        points: me ? me.points : 0,
        rank: me ? me.rank : "-",
      },
      leagueTable: leaderboard.map((p) => ({ ...p, isMe: p.name === name })),
      recentGames: recent.map((g) => ({
        players: `${g.white_name} vs ${g.black_name}`,
        result: g.result === "draw" ? "مساوی" : g.result === "white" ? `برد ${g.white_name}` : `برد ${g.black_name}`,
        type: g.result === "draw" ? "draw" : "win",
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "خطای دیتابیس" });
  }
});

// ===================================================================
// Socket.IO: بازی آنلاین
// ===================================================================

function roomState(room, color) {
  const opp = color === "w" ? room.black : room.white;
  return {
    roomCode: room.code,
    color,
    fen: room.game.fen(),
    history: room.game.history(),
    status: room.status,
    withTimer: room.withTimer,
    minutes: room.minutes,
    inc: room.inc,
    timeLeft: rm.liveTimeLeft(room),
    whiteName: room.white.name,
    blackName: room.black ? room.black.name : null,
    lastMove: room.lastMove,
    chat: room.chat.slice(-30),
    result: room.result,
    reason: room.reason,
    opponentConnected: !!(opp && opp.connected),
  };
}

function clearFlagTimer(room) {
  clearTimeout(room.timeoutHandle);
  room.timeoutHandle = null;
}

// ساعت: وقتی نوبت یه رنگ شروع می‌شه، یه تایمر واقعی سمت سرور می‌ذاریم تا
// اگه تا آخر وقتش حرکت نزد، خودکار ببازه.
function scheduleFlagFall(room) {
  clearFlagTimer(room);
  if (!room.withTimer || room.status !== "playing") {
    room.turnStartedAt = null;
    return;
  }
  const color = room.game.turn();
  room.turnStartedAt = Date.now();
  room.timeoutHandle = setTimeout(() => {
    if (room.status !== "playing") return;
    room.timeLeft[color] = 0;
    finishRoomGame(room, color === "w" ? "black" : "white", "timeout");
  }, Math.max(0, room.timeLeft[color]) + 30);
}

async function finishRoomGame(room, result, reason) {
  if (room.status === "over") return; // جلوگیری از ثبت دوباره
  room.status = "over";
  room.result = result;
  room.reason = reason || "normal";
  clearFlagTimer(room);
  room.turnStartedAt = null;
  clearTimeout(room.white.dropTimer);
  if (room.black) clearTimeout(room.black.dropTimer);

  io.to(room.code).emit("game_over", { result, reason: room.reason, timeLeft: room.timeLeft });

  room.cleanupTimer = setTimeout(() => rm.removeRoom(room.code), OVER_ROOM_TTL_MS);
  if (room.cleanupTimer.unref) room.cleanupTimer.unref();

  if (isConnected() && room.black) {
    try {
      await queries.recordGame(room.white.name, room.black.name, result);
    } catch (err) {
      console.error("⚠️ ثبت نتیجه‌ی بازی آنلاین تو دیتابیس با خطا مواجه شد:", err.message);
    }
  }
}

function safe(socket, event, handler) {
  socket.on(event, (payload, ack) => {
    try {
      const p = payload && typeof payload === "object" ? payload : {};
      handler(p, typeof ack === "function" ? ack : () => {});
    } catch (err) {
      console.error(`⚠️ خطا در رویداد ${event}:`, err.message);
      socket.emit("room_error", { message: "خطای غیرمنتظره‌ی سرور؛ دوباره امتحان کن." });
    }
  });
}

// بازیکن به یک صندلی وصل می‌شه (ساخت/پیوستن/برگشت)
function attachSeat(socket, room, seat) {
  seat.socketId = socket.id;
  seat.connected = true;
  clearTimeout(seat.dropTimer);
  seat.dropTimer = null;
  socket.data.playerId = seat.playerId;
  socket.join(room.code);
}

io.on("connection", (socket) => {
  const lastAction = { chat: 0, reaction: 0, create: 0 };

  // سمت راست «اتاق فعلی» این بازیکن، فقط اگه واقعاً صاحب همین سوکت باشه
  function mySeat(roomCode) {
    const room = rm.rooms.get(String(roomCode || ""));
    if (!room || !socket.data.playerId) return null;
    const s = rm.seatOf(room, socket.data.playerId);
    if (!s || s.seat.socketId !== socket.id) return null;
    return { room, ...s };
  }

  safe(socket, "peek_room", ({ code }) => {
    const room = rm.rooms.get(String(code || "").toUpperCase().trim());
    if (!room || room.status === "over") return socket.emit("room_error", { message: "اتاقی با این کد پیدا نشد." });
    if (room.black) return socket.emit("room_error", { message: "این اتاق پره." });
    socket.emit("room_preview", { code: room.code, withTimer: room.withTimer, minutes: room.minutes, inc: room.inc, hostName: room.white.name });
  });

  safe(socket, "create_room", ({ playerId, name, withTimer, minutes, inc }) => {
    if (!rm.isValidPlayerId(playerId)) return socket.emit("room_error", { message: "شناسه‌ی بازیکن نامعتبره؛ صفحه رو رفرش کن." });
    if (Date.now() - lastAction.create < 800) return;
    lastAction.create = Date.now();

    // هر بازیکن فقط یک بازی فعال: اگه داره، همون رو برمی‌گردونیم (اتاق تکراری نمی‌سازیم)
    const existing = rm.findRoomByPlayer(playerId);
    if (existing && existing.status !== "over") {
      const { seat, color } = rm.seatOf(existing, playerId);
      attachSeat(socket, existing, seat);
      return socket.emit("room_state", roomState(existing, color));
    }
    if (existing) rm.removeRoom(existing.code);

    const room = rm.createRoom(playerId, socket.id, rm.cleanName(name), !!withTimer, minutes, inc);
    attachSeat(socket, room, room.white);
    room.cleanupTimer = setTimeout(() => {
      if (room.status === "waiting") {
        io.to(room.code).emit("room_expired");
        rm.removeRoom(room.code);
      }
    }, WAITING_ROOM_TTL_MS);
    socket.emit("room_state", roomState(room, "w"));
  });

  safe(socket, "join_room", ({ playerId, code, name }) => {
    if (!rm.isValidPlayerId(playerId)) return socket.emit("room_error", { message: "شناسه‌ی بازیکن نامعتبره؛ صفحه رو رفرش کن." });
    const roomCode = String(code || "").toUpperCase().trim();

    const existing = rm.findRoomByPlayer(playerId);
    if (existing && existing.status !== "over") {
      if (existing.code === roomCode) {
        const { seat, color } = rm.seatOf(existing, playerId);
        attachSeat(socket, existing, seat);
        return socket.emit("room_state", roomState(existing, color));
      }
      return socket.emit("room_error", { message: "تو الان تو یه بازی دیگه‌ای هستی؛ اول اون رو تموم کن." });
    }
    if (existing) rm.removeRoom(existing.code);

    const r = rm.joinRoom(roomCode, playerId, socket.id, rm.cleanName(name));
    if (r.error) return socket.emit("room_error", { message: r.error });
    const room = r.room;
    clearTimeout(room.cleanupTimer);
    attachSeat(socket, room, room.black);

    socket.emit("room_state", roomState(room, "b"));
    socket.to(room.code).emit("opponent_joined", roomState(room, "w"));
    scheduleFlagFall(room);
  });

  // برگشت بعد از رفرش / قطع شدن اینترنت
  safe(socket, "rejoin_room", ({ playerId }) => {
    if (!rm.isValidPlayerId(playerId)) return socket.emit("no_active_room");
    const room = rm.findRoomByPlayer(playerId);
    if (!room) return socket.emit("no_active_room");
    const { seat, color } = rm.seatOf(room, playerId);
    const oldSocketId = seat.socketId;
    if (oldSocketId && oldSocketId !== socket.id) {
      const old = io.sockets.sockets.get(oldSocketId);
      if (old) old.leave(room.code); // اتصال قدیمی تب دیگه دیگه پیام نگیره
    }
    attachSeat(socket, room, seat);
    socket.emit("room_state", roomState(room, color));
    socket.to(room.code).emit("opponent_status", { connected: true });
  });

  safe(socket, "make_move", ({ roomCode, from, to, promotion }) => {
    const me = mySeat(roomCode);
    if (!me) return socket.emit("move_rejected", { message: "تو عضو این بازی نیستی." });
    const { room, color } = me;
    if (room.status !== "playing") return socket.emit("move_rejected", { message: "بازی در حال انجام نیست." });
    if (room.game.turn() !== color) return socket.emit("move_rejected", { message: "نوبت تو نیست." });
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
      return socket.emit("move_rejected", { message: "حرکت نامعتبره." });
    }
    const promo = typeof promotion === "string" && /^[qrbn]$/.test(promotion) ? promotion : "q";

    // هزینه‌ی زمانی این نوبت از ساعت خودش کم می‌شه (سمت سرور)
    if (room.withTimer && room.turnStartedAt) {
      room.timeLeft[color] = Math.max(0, room.timeLeft[color] - (Date.now() - room.turnStartedAt));
      room.turnStartedAt = Date.now();
      if (room.timeLeft[color] <= 0) {
        finishRoomGame(room, color === "w" ? "black" : "white", "timeout");
        return;
      }
    }

    const move = room.game.move({ from, to, promotion: promo });
    if (!move) return socket.emit("move_rejected", { message: "این حرکت مجاز نیست." });

    if (room.withTimer) room.timeLeft[color] += room.inc * 1000; // جایزه‌ی زمانی بعد از حرکت
    room.lastMove = { from: move.from, to: move.to, captured: !!move.captured, san: move.san };
    io.to(room.code).emit("move_made", {
      fen: room.game.fen(),
      lastMove: room.lastMove,
      history: room.game.history(),
      timeLeft: room.timeLeft,
      inCheck: room.game.in_check(),
    });

    if (room.game.game_over()) {
      const result = room.game.in_checkmate() ? (room.game.turn() === "w" ? "black" : "white") : "draw";
      finishRoomGame(room, result, room.game.in_checkmate() ? "checkmate" : "draw");
    } else {
      scheduleFlagFall(room);
    }
  });

  safe(socket, "send_reaction", ({ roomCode, emoji }) => {
    const me = mySeat(roomCode);
    if (!me || !REACTIONS.has(emoji)) return;
    if (Date.now() - lastAction.reaction < 600) return;
    lastAction.reaction = Date.now();
    socket.to(me.room.code).emit("reaction", { emoji });
  });

  safe(socket, "chat_message", ({ roomCode, text, id }) => {
    const me = mySeat(roomCode);
    if (!me) return;
    const { room, seat, color } = me;
    const clean = rm.cleanText(text, 300);
    if (!clean) return;
    const msgId = typeof id === "string" && /^[A-Za-z0-9_-]{6,40}$/.test(id) ? id : null;
    if (msgId) {
      if (room.seenChatIds.has(msgId)) return; // پیام تکراری
      room.seenChatIds.add(msgId);
      if (room.seenChatIds.size > 200) room.seenChatIds.delete(room.seenChatIds.values().next().value);
    }
    if (Date.now() - lastAction.chat < 400) return;
    lastAction.chat = Date.now();

    const msg = { id: msgId || String(Date.now()) + color, from: seat.name, color, text: clean };
    room.chat.push(msg);
    if (room.chat.length > 50) room.chat.shift();
    io.to(room.code).emit("chat_message", msg);
  });

  safe(socket, "resign", ({ roomCode }) => {
    const me = mySeat(roomCode);
    if (!me || me.room.status !== "playing") return;
    finishRoomGame(me.room, me.color === "w" ? "black" : "white", "resign");
  });

  socket.on("disconnect", () => {
    const found = rm.findSeatBySocket(socket.id);
    if (!found) return;
    const { room, seat, color } = found;
    seat.connected = false;

    if (room.status === "playing") {
      socket.to(room.code).emit("opponent_status", { connected: false, graceMs: RECONNECT_GRACE_MS });
      clearTimeout(seat.dropTimer);
      seat.dropTimer = setTimeout(() => {
        if (room.status !== "playing" || seat.connected) return;
        const opp = color === "w" ? room.black : room.white;
        if (opp && opp.connected) finishRoomGame(room, color === "w" ? "black" : "white", "abandon");
        else rm.removeRoom(room.code); // هر دو رفتن؛ نتیجه‌ای ثبت نمی‌شه
      }, RECONNECT_GRACE_MS);
    }
    // اتاق منتظر و بازی تموم‌شده با تایمرهای خودشون پاک می‌شن
  });
});

async function start() {
  await ensureSchema();
  server.listen(PORT, () => {
    console.log("✅ سرور روی آدرس زیر در حال اجراست:");
    console.log(`   http://localhost:${PORT}`);
    console.log(isConnected() ? "✅ دیتابیس وصله و جدول‌ها آماده‌ان" : "⚠️  DATABASE_URL تنظیم نشده — بخش دیتابیسی API غیرفعاله");
    console.log("✅ Socket.IO فعاله — بازی آنلاین زنده آماده‌ست");
  });
}

start();
