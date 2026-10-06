// ===================================================================
// بازی آنلاین زنده‌ی دو نفره با Socket.IO. سرور قاضیه (قوانین، نوبت، ساعت
// و نتیجه)؛ این فایل فقط نمایش می‌ده و «درخواست حرکت» می‌فرسته.
// پشتیبانی از قطع/وصل شدن و رفرش: هر مرورگر یه playerId ثابت داره و بعد از
// اتصال دوباره، به همون بازی برمی‌گرده.
// ===================================================================

const PLAYER_KEY = "cl-player-name";
const PID_KEY = "cl-player-id";

function getPlayerId() {
  let id = CLPrefs.get(PID_KEY, "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const rnd =
      window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    id = rnd.replace(/[^A-Za-z0-9_-]/g, "");
    CLPrefs.set(PID_KEY, id);
  }
  return id;
}
const playerId = getPlayerId();

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const $ = (id) => document.getElementById(id);
const lobbyCard = $("lobbyCard");
const waitingCard = $("waitingCard");
const playArea = $("playArea");
const nameInput = $("nameInput");
const lobbyMsg = $("lobbyMsg");
const connBanner = $("connBanner");

let socket = null;
let game = new Chess();
let myColor = null;
let roomCode = null;
let roomStatus = null; // waiting | playing | over
let roomWithTimer = false;
let selectedSquare = null;
let pendingPromotion = null;
let historyList = [];
let lastMove = null;
let confettiFired = false;
let overHandled = false;
let moveInFlight = false;
let moveInFlightTimer = null;
let wantTimer = CLPrefs.get("cl-timer-pref", "0") === "1";
let renderer = null;
let rendererColor = null;
let resignArmed = null;
let opponentConnected = true;
let hadConnection = false;
let chatIds = new Set();
let lastChatSentAt = 0;
let previewCode = null;
let clockDisplay = null;

// ---------- ابزارهای کوچیک UI ----------
let toastTimer = null;
function toast(text) {
  let el = $("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.display = "none"), 2600);
}

function setLoading(btn, on) {
  if (!btn) return;
  btn.classList.toggle("loading", on);
  btn.disabled = on;
  if (on) {
    clearTimeout(btn._lt);
    btn._lt = setTimeout(() => setLoading(btn, false), 8000);
  } else {
    clearTimeout(btn._lt);
  }
}

function showBanner(text, ok) {
  connBanner.textContent = text;
  connBanner.classList.toggle("ok", !!ok);
  connBanner.classList.add("show");
}
function hideBanner() {
  connBanner.classList.remove("show");
}

function timerBadgeText() {
  return roomWithTimer ? "⏱️ بازی با تایمر (۱۰ دقیقه برای هر نفر)" : "⏱️ بازی بدون تایمر";
}

function enableLobby(on) {
  ["createRoomBtn", "joinRoomBtn"].forEach((id) => {
    const b = $(id);
    if (b) b.disabled = !on;
  });
}

function showScreen(name) {
  lobbyCard.style.display = name === "lobby" ? "block" : "none";
  waitingCard.style.display = name === "waiting" ? "block" : "none";
  playArea.style.display = name === "play" ? "block" : "none";
}

function resetToLobby() {
  roomCode = null;
  roomStatus = null;
  myColor = null;
  game = new Chess();
  selectedSquare = null;
  pendingPromotion = null;
  lastMove = null;
  historyList = [];
  confettiFired = false;
  overHandled = false;
  moveInFlight = false;
  chatIds = new Set();
  $("chatLog").textContent = "";
  $("previewBox").style.display = "none";
  previewCode = null;
  if (clockDisplay) clockDisplay.stopTimer();
  $("promoModal").classList.add("hidden");
  showScreen("lobby");
  setLoading($("createRoomBtn"), false);
  setLoading($("joinRoomBtn"), false);
  enableLobby(!!(socket && socket.connected));
}

// ---------- لابی ----------
nameInput.value = CLPrefs.get(PLAYER_KEY, "");
$("timerOnBtn").classList.toggle("active", wantTimer);
$("timerOffBtn").classList.toggle("active", !wantTimer);

$("timerOffBtn").addEventListener("click", function () {
  wantTimer = false;
  CLPrefs.set("cl-timer-pref", "0");
  this.classList.add("active");
  $("timerOnBtn").classList.remove("active");
});
$("timerOnBtn").addEventListener("click", function () {
  wantTimer = true;
  CLPrefs.set("cl-timer-pref", "1");
  this.classList.add("active");
  $("timerOffBtn").classList.remove("active");
});

function getName() {
  const name = nameInput.value.trim().slice(0, 20);
  if (!name) {
    lobbyMsg.textContent = "اول اسمتو بنویس.";
    nameInput.focus();
    return null;
  }
  CLPrefs.set(PLAYER_KEY, name);
  return name;
}

$("createRoomBtn").addEventListener("click", () => {
  const name = getName();
  if (!name || !socket || !socket.connected) return;
  lobbyMsg.textContent = "";
  setLoading($("createRoomBtn"), true);
  socket.emit("create_room", { playerId, name, withTimer: wantTimer });
});

$("joinRoomBtn").addEventListener("click", () => {
  const name = getName();
  const code = $("joinCodeInput").value.trim().toUpperCase();
  if (!name) return;
  if (!code) {
    lobbyMsg.textContent = "کد اتاق رو بنویس.";
    return;
  }
  if (!socket || !socket.connected) return;
  lobbyMsg.textContent = "";
  setLoading($("joinRoomBtn"), true);
  socket.emit("peek_room", { code });
});

$("confirmJoinBtn").addEventListener("click", () => {
  const name = getName();
  if (!name || !previewCode || !socket.connected) return;
  setLoading($("confirmJoinBtn"), true);
  socket.emit("join_room", { playerId, code: previewCode, name });
});

$("copyRoomCodeBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(roomCode);
    toast("کد کپی شد ✅");
  } catch (e) {
    toast("کد: " + roomCode);
  }
});

$("backToLobbyBtn").addEventListener("click", resetToLobby);

// ---------- تسلیم (دو مرحله‌ای، بدون پنجره‌ی confirm) ----------
$("resignBtn").addEventListener("click", function () {
  if (roomStatus !== "playing") return;
  if (!resignArmed) {
    this.textContent = "مطمئنی؟ دوباره بزن";
    resignArmed = setTimeout(disarmResign, 3000);
    return;
  }
  disarmResign();
  socket.emit("resign", { roomCode });
});
function disarmResign() {
  clearTimeout(resignArmed);
  resignArmed = null;
  $("resignBtn").textContent = "تسلیم شدن";
}

// ---------- ترفیع سرباز ----------
document.querySelectorAll(".promo-choices button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    pendingPromotion = null;
    $("promoModal").classList.add("hidden");
    sendMove(from, to, btn.dataset.p);
  });
});

// ---------- شکلک‌های زنده (ری‌اکشن) ----------
document.querySelectorAll(".emoji-bar button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!roomCode || !socket.connected) return;
    const emoji = btn.dataset.emoji;
    socket.emit("send_reaction", { roomCode, emoji });
    showFloatingEmoji(emoji);
  });
});

function showFloatingEmoji(emoji) {
  const el = document.createElement("div");
  el.textContent = emoji;
  el.style.cssText = `position:fixed; left:50%; bottom:140px; font-size:40px; transform:translateX(-50%);
    pointer-events:none; z-index:450; transition:transform 1.3s ease-out, opacity 1.3s ease-out; will-change:transform,opacity;`;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = "translateX(-50%) translateY(-150px)";
    el.style.opacity = "0";
  });
  setTimeout(() => el.remove(), 1400);
}

// ---------- گفتگو ----------
function addChatLine(m, silent) {
  if (m.id && chatIds.has(m.id)) return; // جلوگیری از پیام تکراری
  if (m.id) chatIds.add(m.id);
  const box = $("chatLog");
  const row = document.createElement("div");
  row.className = "chat-msg" + (m.color === myColor ? " mine" : "");
  const who = document.createElement("b");
  who.textContent = m.from + ": ";
  const txt = document.createElement("span");
  txt.textContent = m.text; // textContent ⇒ هیچ HTMLی اجرا نمی‌شه
  row.append(who, txt);
  box.appendChild(row);
  while (box.children.length > 60) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
  if (!silent && m.color !== myColor) playMessageSound();
}

function sendChat() {
  const input = $("chatInput");
  const text = input.value.trim();
  if (!text || !roomCode) return;
  if (!socket.connected) return toast("اتصال قطعه؛ پیام ارسال نشد.");
  if (Date.now() - lastChatSentAt < 450) return; // ضدِ کلیک پشت‌سرهم
  lastChatSentAt = Date.now();
  socket.emit("chat_message", { roomCode, text: text.slice(0, 300), id: uid() });
  input.value = "";
  input.focus();
}
$("chatSendBtn").addEventListener("click", sendChat);
$("chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendChat();
  }
});
document.querySelectorAll(".chat-emojis button").forEach((b) => {
  b.addEventListener("click", () => {
    const input = $("chatInput");
    input.value = (input.value + b.textContent).slice(0, 300);
    input.focus();
  });
});

// ---------- ساعت ----------
function setClocks(timeLeft, active) {
  $("clockRow").style.display = roomWithTimer ? "flex" : "none";
  if (!roomWithTimer) return;
  if (!clockDisplay) clockDisplay = createClockDisplay({ w: $("clockWhite"), b: $("clockBlack") });
  clockDisplay.set(timeLeft, active);
}

// ---------- وضعیت کامل اتاق از سرور (ساخت / پیوستن / برگشت) ----------
function applyRoomState(d) {
  roomCode = d.roomCode;
  myColor = d.color;
  roomStatus = d.status;
  roomWithTimer = !!d.withTimer;
  game = new Chess(d.fen);
  historyList = d.history || [];
  lastMove = d.lastMove ? { from: d.lastMove.from, to: d.lastMove.to } : null;
  selectedSquare = null;
  pendingPromotion = null;
  moveInFlight = false;
  opponentConnected = d.opponentConnected !== false;
  setLoading($("createRoomBtn"), false);
  setLoading($("joinRoomBtn"), false);
  setLoading($("confirmJoinBtn"), false);

  $("chatLog").textContent = "";
  chatIds = new Set();
  (d.chat || []).forEach((m) => addChatLine(m, true));

  $("timerBadge").textContent = timerBadgeText();
  $("waitTimerBadge").textContent = timerBadgeText();
  $("vsLine").textContent = `سفید: ${d.whiteName}  ·  سیاه: ${d.blackName || "—"}`;

  if (d.status === "waiting") {
    $("roomCodeDisplay").textContent = roomCode;
    showScreen("waiting");
    return;
  }

  showScreen("play");
  ensureRenderer();
  setClocks(d.timeLeft, d.status === "playing" ? game.turn() : null);
  render();

  if (d.status === "over") {
    handleGameOver({ result: d.result, reason: d.reason, timeLeft: d.timeLeft }, true);
  } else {
    overHandled = false;
    $("resignBtn").disabled = false;
    $("backToLobbyBtn").style.display = "none";
  }
  if (!opponentConnected && d.status === "playing") showBanner("حریف قطع شده؛ منتظر برگشتنش هستیم…");
}

// ---------- پایان بازی ----------
function handleGameOver(data, silent) {
  roomStatus = "over";
  selectedSquare = null;
  moveInFlight = false;
  if (clockDisplay && data.timeLeft) clockDisplay.set(data.timeLeft, null);
  const bar = $("statusBar");
  bar.classList.remove("check", "warn");
  bar.classList.add("over");
  const reasonFa =
    data.reason === "resign"
      ? " (تسلیم)"
      : data.reason === "timeout"
      ? " (اتمام وقت ⏱️)"
      : data.reason === "abandon"
      ? " (حریف از بازی خارج شد)"
      : "";
  const resultFa =
    data.result === "draw" ? "بازی مساوی شد" : data.result === "white" ? "برنده: سفید 🏆" : "برنده: سیاه 🏆";
  bar.textContent = resultFa + reasonFa;
  $("resignBtn").disabled = true;
  $("backToLobbyBtn").style.display = "inline-block";
  hideBanner();
  render();
  if (overHandled || silent) {
    overHandled = true;
    return;
  }
  overHandled = true;
  if (data.reason === "timeout") playFlagSound();
  else if (data.result !== "draw") playCheckmateSound();
  else playCheckSound();
  if (!confettiFired && data.result !== "draw") {
    confettiFired = true;
    burstConfetti();
  }
}

// ---------- ارسال حرکت ----------
function sendMove(from, to, promotion) {
  if (!socket.connected) return toast("اتصال قطعه؛ منتظر وصل شدن بمون.");
  if (moveInFlight) return;
  moveInFlight = true;
  clearTimeout(moveInFlightTimer);
  moveInFlightTimer = setTimeout(() => (moveInFlight = false), 4000);
  socket.emit("make_move", { roomCode, from, to, promotion });
}

// ---------- رسم تخته ----------
function ensureRenderer() {
  if (renderer && rendererColor === myColor) return;
  renderer = createBoardRenderer($("board"), {
    flip: myColor === "b",
    onSquareClick,
  });
  rendererColor = myColor;
}

function findCheckSquare() {
  if (!game.in_check()) return null;
  const boardState = game.board();
  const turnColor = game.turn();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = boardState[r][c];
      if (p && p.type === "k" && p.color === turnColor) return FILES[c] + (8 - r);
    }
  }
  return null;
}

function render() {
  if (!renderer) return;
  renderer.renderBoard(game.board(), { selected: selectedSquare, checkSquare: findCheckSquare(), lastMove });
  updateStatusBar();
  updateHistory();
}

function onSquareClick(sq) {
  if (pendingPromotion || moveInFlight) return;
  if (roomStatus !== "playing" || game.game_over()) return;
  if (game.turn() !== myColor) return;

  const mine = (s) => {
    const p = game.get(s);
    return p && p.color === myColor;
  };

  if (!selectedSquare) {
    if (mine(sq)) selectedSquare = sq;
    render();
    return;
  }
  if (sq === selectedSquare) {
    selectedSquare = null;
    render();
    return;
  }

  const candidates = game.moves({ square: selectedSquare, verbose: true }).filter((m) => m.to === sq);
  if (candidates.length === 0) {
    selectedSquare = mine(sq) ? sq : null;
    render();
    return;
  }

  const from = selectedSquare;
  selectedSquare = null;
  if (candidates[0].promotion) {
    pendingPromotion = { from, to: sq };
    render();
    $("promoModal").classList.remove("hidden");
    return;
  }
  render();
  sendMove(from, sq);
}

function updateStatusBar() {
  const bar = $("statusBar");
  if (roomStatus === "over") return;
  bar.classList.remove("check", "over", "warn");
  const myTurn = game.turn() === myColor;
  if (game.in_check()) {
    bar.textContent = myTurn ? "کیش! نوبت توئه" : "کیش! نوبت حریف";
    bar.classList.add("check");
  } else {
    bar.textContent = myTurn ? "نوبت توئه" : "نوبت حریف، منتظر بمون";
  }
}

function updateHistory() {
  const box = $("historyList");
  if (historyList.length === 0) {
    box.textContent = "—";
    return;
  }
  let out = "";
  for (let i = 0; i < historyList.length; i += 2) {
    out += `${i / 2 + 1}. ${historyList[i] || ""} ${historyList[i + 1] || ""}<br>`;
  }
  box.innerHTML = out; // فقط نمادهای SAN که از chess.js میان (بدون ورودی کاربر)
  box.scrollTop = box.scrollHeight;
}

// ===================================================================
// اتصال Socket.IO و رویدادها
// ===================================================================
function connect() {
  if (typeof io !== "function") {
    showBanner("اتصال به سرور برقرار نشد (کتابخونه‌ی Socket.IO لود نشد). صفحه رو رفرش کن.");
    return;
  }
  showBanner("در حال اتصال به سرور…");
  enableLobby(false);

  socket = io({ reconnectionDelay: 500, reconnectionDelayMax: 4000, timeout: 8000 });

  socket.on("connect", () => {
    const wasDown = hadConnection;
    hadConnection = true;
    enableLobby(true);
    // همیشه سعی می‌کنیم به بازی قبلی برگردیم (رفرش یا قطع شدن اینترنت)
    socket.emit("rejoin_room", { playerId });
    if (wasDown) {
      showBanner("دوباره وصل شدی ✅", true);
      setTimeout(() => {
        if (connBanner.classList.contains("ok")) hideBanner();
      }, 1800);
    } else {
      hideBanner();
    }
  });

  socket.on("disconnect", () => {
    enableLobby(false);
    moveInFlight = false;
    showBanner("اتصال قطع شد؛ در حال اتصال مجدد… (بازی از بین نمی‌ره)");
  });
  socket.on("connect_error", () => {
    enableLobby(false);
    showBanner("سرور در دسترس نیست؛ دوباره تلاش می‌کنیم…");
  });

  socket.on("room_state", applyRoomState);

  socket.on("no_active_room", () => {
    if (roomCode) {
      toast("اون بازی دیگه وجود نداره.");
      resetToLobby();
    }
  });

  socket.on("room_preview", (d) => {
    setLoading($("joinRoomBtn"), false);
    previewCode = d.code;
    roomWithTimer = !!d.withTimer;
    $("previewText").textContent = `اتاق ${d.code} (سازنده: ${d.hostName}) — ${
      d.withTimer ? "با تایمر ۱۰ دقیقه‌ای برای هر نفر" : "بدون تایمر"
    }`;
    $("previewBox").style.display = "block";
  });

  socket.on("opponent_joined", (d) => {
    toast("حریف وارد شد — بازی شروع شد! ♟️");
    applyRoomState(d);
  });

  socket.on("opponent_status", (d) => {
    opponentConnected = !!d.connected;
    if (roomStatus !== "playing") return;
    if (d.connected) {
      showBanner("حریف دوباره وصل شد ✅", true);
      setTimeout(() => connBanner.classList.contains("ok") && hideBanner(), 1800);
    } else {
      showBanner(`حریف قطع شد؛ تا ${Math.round((d.graceMs || 90000) / 1000)} ثانیه منتظر برگشتنش هستیم…`);
    }
  });

  socket.on("room_expired", () => {
    toast("اتاق منقضی شد (حریفی وارد نشد).");
    resetToLobby();
  });

  socket.on("room_error", (d) => {
    setLoading($("createRoomBtn"), false);
    setLoading($("joinRoomBtn"), false);
    setLoading($("confirmJoinBtn"), false);
    lobbyMsg.textContent = "❌ " + d.message;
    toast(d.message);
  });

  socket.on("move_made", (d) => {
    moveInFlight = false;
    clearTimeout(moveInFlightTimer);
    game = new Chess(d.fen);
    historyList = d.history || [];
    lastMove = d.lastMove ? { from: d.lastMove.from, to: d.lastMove.to } : null;
    selectedSquare = null;
    if (roomWithTimer && d.timeLeft) setClocks(d.timeLeft, game.game_over() ? null : game.turn());
    if (!game.in_checkmate()) {
      if (d.inCheck) playCheckSound();
      else if (d.lastMove && d.lastMove.captured) playCaptureSound();
      else playMoveSound();
    }
    render();
  });

  socket.on("move_rejected", (d) => {
    moveInFlight = false;
    selectedSquare = null;
    toast(d.message || "حرکت پذیرفته نشد.");
    render();
  });

  socket.on("game_over", (d) => handleGameOver(d, false));

  socket.on("chat_message", (m) => addChatLine(m, false));
  socket.on("reaction", (d) => showFloatingEmoji(d.emoji));
}

// وقتی کاربر به تب برمی‌گرده و سوکت قطعه، سریع دوباره وصل شو
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && socket && !socket.connected) socket.connect();
});
window.addEventListener("online", () => {
  if (socket && !socket.connected) socket.connect();
});

connect();
