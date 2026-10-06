// ===================================================================
// منطق بازی شطرنج (دو نفره‌ی محلی، یا یک‌نفره مقابل بات)
// از chess.js برای قوانین استفاده می‌کنیم؛ رسم تخته (با انیمیشن نرم
// حرکت مهره‌ها) از js/board-render.js مشترکه.
// ===================================================================

let game = new Chess();
let selectedSquare = null;
let pendingPromotion = null;
let lastMove = null;
let confettiFired = false;

let mode = "local"; // "local" یا "bot"
let difficulty = "easy";
let botColor = "b";

let withTimer = CLPrefs.get("cl-timer-pref", "0") === "1";
let clock = null;
let botTimeout = null; // تایمر فکر کردن بات (برای پاک‌سازی موقع شروع دوباره)
let endSoundPlayed = false;
let gameEndedByTimeout = null; // رنگی که وقتش تموم شد (بازنده)

const boardEl = document.getElementById("board");
const renderer = createBoardRenderer(boardEl, {
  flip: false,
  onSquareClick: (sq) => onSquareClick(sq),
});

function render() {
  renderer.renderBoard(game.board(), {
    selected: selectedSquare,
    checkSquare: findCheckSquare(),
    lastMove,
  });
  updateStatusBar();
  updateHistory();
  updateResultPanel();
}

function findCheckSquare() {
  if (!game.in_check()) return null;
  const boardState = game.board();
  const turnColor = game.turn();
  const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = boardState[r][c];
      if (p && p.type === "k" && p.color === turnColor) return FILES[c] + (8 - r);
    }
  }
  return null;
}

function onSquareClick(sq) {
  if (pendingPromotion || gameEndedByTimeout) return;
  if (mode === "bot" && game.turn() === botColor) return;

  if (!selectedSquare) {
    const piece = game.get(sq);
    if (piece && piece.color === game.turn()) {
      selectedSquare = sq;
    }
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
    const piece = game.get(sq);
    selectedSquare = null;
    if (piece && piece.color === game.turn()) {
      selectedSquare = sq;
    }
    render();
    return;
  }

  const from = selectedSquare;
  selectedSquare = null;

  if (candidates[0].promotion) {
    pendingPromotion = { from, to: sq };
    render();
    showPromotionModal();
    return;
  }

  applyMove({ from, to: sq });
}

// اجرای یک حرکت (انسان یا بات) + صدا + ساعت + رسم
function applyMove(move) {
  const result = game.move(move);
  if (!result) return false;
  lastMove = { from: result.from, to: result.to };
  if (game.in_checkmate()) {
    /* صدای پایان در updateStatusBar پخش می‌شه */
  } else if (game.in_check()) playCheckSound();
  else if (result.captured) playCaptureSound();
  else playMoveSound();
  if (clock && withTimer) {
    if (game.game_over()) clock.stop();
    else clock.switchTurn(game.turn());
  }
  render();
  maybeTriggerBotMove();
  return true;
}

function showPromotionModal() {
  document.getElementById("promoModal").classList.remove("hidden");
}
function hidePromotionModal() {
  document.getElementById("promoModal").classList.add("hidden");
}

function completePromotion(pieceLetter) {
  if (!pendingPromotion) return;
  const { from, to } = pendingPromotion;
  pendingPromotion = null;
  hidePromotionModal();
  applyMove({ from, to, promotion: pieceLetter });
}

document.querySelectorAll(".promo-choices button").forEach((btn) => {
  btn.addEventListener("click", () => completePromotion(btn.dataset.p));
});

function maybeTriggerBotMove() {
  if (mode !== "bot") return;
  if (game.game_over() || gameEndedByTimeout) return;
  if (game.turn() !== botColor) return;
  if (botTimeout) return; // یه فکر کردن در حال انجامه

  const bar = document.getElementById("statusBar");
  bar.classList.add("thinking");
  bar.textContent = "بات داره فکر می‌کنه...";

  const thinkingGame = game; // اگه وسط فکر کردن بازی ریست شد، حرکت قدیمی اعمال نشه
  botTimeout = setTimeout(() => {
    botTimeout = null;
    if (thinkingGame !== game || game.game_over() || gameEndedByTimeout || game.turn() !== botColor) return;
    const m = getBotMove(game, difficulty);
    if (m) applyMove({ from: m.from, to: m.to, promotion: m.promotion || "q" });
    else render();
  }, 450);
}

function onClockFlag(color) {
  gameEndedByTimeout = color;
  selectedSquare = null;
  playFlagSound();
  endSoundPlayed = true;
  render();
}

function updateStatusBar() {
  const bar = document.getElementById("statusBar");
  bar.classList.remove("check", "over", "thinking");

  if (gameEndedByTimeout) {
    const winner = gameEndedByTimeout === "w" ? "سیاه" : "سفید";
    bar.textContent = `⏱️ اتمام وقت! برنده: ${winner} 🏆`;
    bar.classList.add("over");
    if (!confettiFired) {
      confettiFired = true;
      burstConfetti();
    }
  } else if (game.in_checkmate()) {
    const winner = game.turn() === "w" ? "سیاه" : "سفید";
    bar.textContent = `کیش و مات! برنده: ${winner} 🏆`;
    bar.classList.add("over");
    if (!endSoundPlayed) {
      endSoundPlayed = true;
      playCheckmateSound();
    }
    if (!confettiFired) {
      confettiFired = true;
      burstConfetti();
    }
  } else if (game.in_stalemate()) {
    bar.textContent = "پات (Stalemate) — بازی مساوی شد";
    bar.classList.add("over");
    if (!endSoundPlayed) {
      endSoundPlayed = true;
      playCheckSound();
    }
  } else if (game.in_draw()) {
    bar.textContent = "بازی مساوی شد";
    bar.classList.add("over");
    if (!endSoundPlayed) {
      endSoundPlayed = true;
      playCheckSound();
    }
  } else if (game.in_check()) {
    const turnFa = game.turn() === "w" ? "سفید" : "سیاه";
    bar.textContent = `کیش! نوبت: ${turnFa}`;
    bar.classList.add("check");
  } else {
    const turnFa = game.turn() === "w" ? "سفید" : "سیاه";
    bar.textContent = `نوبت: ${turnFa}`;
  }
}

function updateHistory() {
  const history = game.history();
  const box = document.getElementById("historyList");
  if (history.length === 0) {
    box.textContent = "—";
    return;
  }
  let out = "";
  for (let i = 0; i < history.length; i += 2) {
    const num = i / 2 + 1;
    out += `${num}. ${history[i] || ""} ${history[i + 1] || ""}<br>`;
  }
  box.innerHTML = out;
}

function updateResultPanel() {
  const card = document.getElementById("submitResultCard");
  if (!card) return;
  if (mode === "local" && (game.game_over() || gameEndedByTimeout)) {
    card.style.display = "block";
    const savedName = localStorage.getItem("cl-player-name") || "";
    const whiteInput = document.getElementById("whiteNameInput");
    if (whiteInput && !whiteInput.value) whiteInput.value = savedName;
  } else {
    card.style.display = "none";
  }
}

document.getElementById("submitResultBtn").addEventListener("click", async () => {
  const whiteName = document.getElementById("whiteNameInput").value.trim();
  const blackName = document.getElementById("blackNameInput").value.trim();
  const msg = document.getElementById("submitResultMsg");
  const btn = document.getElementById("submitResultBtn");

  if (!whiteName || !blackName) {
    msg.textContent = "اسم هر دو بازیکن رو وارد کن.";
    return;
  }
  if (whiteName === blackName) {
    msg.textContent = "اسم دو بازیکن نباید یکی باشه.";
    return;
  }

  if (btn.disabled) return;
  btn.disabled = true;
  btn.classList.add("loading");

  let result;
  if (gameEndedByTimeout) {
    result = gameEndedByTimeout === "w" ? "black" : "white";
  } else if (game.in_checkmate()) {
    result = game.turn() === "w" ? "black" : "white";
  } else {
    result = "draw";
  }

  try {
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whiteName, blackName, result }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "خطای نامشخص");
    msg.textContent = "✅ نتیجه ثبت شد و تو جدول امتیازات لیگ اعمال شد.";
  } catch (err) {
    msg.textContent = "❌ ثبت نشد: " + err.message;
    btn.disabled = false; // اجازه‌ی تلاش دوباره
  } finally {
    btn.classList.remove("loading");
  }
});

function resetGame() {
  clearTimeout(botTimeout);
  botTimeout = null;
  game = new Chess();
  selectedSquare = null;
  pendingPromotion = null;
  lastMove = null;
  confettiFired = false;
  endSoundPlayed = false;
  gameEndedByTimeout = null;
  hidePromotionModal();
  const sb = document.getElementById("submitResultBtn");
  sb.disabled = false;
  sb.classList.remove("loading");
  document.getElementById("submitResultMsg").textContent = "";

  const clockRow = document.getElementById("clockRow");
  if (withTimer) {
    clockRow.style.display = "flex";
    if (!clock) {
      clock = createLocalClock(
        { w: document.getElementById("clockWhite"), b: document.getElementById("clockBlack") },
        onClockFlag
      );
    } else {
      clock.reset();
    }
    clock.start("w");
  } else {
    clockRow.style.display = "none";
    if (clock) clock.stop();
  }

  render();
  maybeTriggerBotMove();
}

document.getElementById("resetBtn").addEventListener("click", resetGame);

document.getElementById("timerOffBtn").addEventListener("click", function () {
  withTimer = false;
  CLPrefs.set("cl-timer-pref", "0");
  this.classList.add("active");
  document.getElementById("timerOnBtn").classList.remove("active");
  resetGame();
});
document.getElementById("timerOnBtn").addEventListener("click", function () {
  withTimer = true;
  CLPrefs.set("cl-timer-pref", "1");
  this.classList.add("active");
  document.getElementById("timerOffBtn").classList.remove("active");
  resetGame();
});

const modeLocalBtn = document.getElementById("modeLocalBtn");
const modeBotBtn = document.getElementById("modeBotBtn");
const diffBar = document.getElementById("diffBar");

modeLocalBtn.addEventListener("click", () => {
  mode = "local";
  modeLocalBtn.classList.add("active");
  modeBotBtn.classList.remove("active");
  diffBar.classList.add("disabled");
  resetGame();
});

modeBotBtn.addEventListener("click", () => {
  mode = "bot";
  modeBotBtn.classList.add("active");
  modeLocalBtn.classList.remove("active");
  diffBar.classList.remove("disabled");
  resetGame();
});

diffBar.querySelectorAll("button[data-diff]").forEach((btn) => {
  btn.addEventListener("click", () => {
    difficulty = btn.dataset.diff;
    diffBar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// حالت اولیه‌ی دکمه‌های تایمر از تنظیم ذخیره‌شده
document.getElementById("timerOnBtn").classList.toggle("active", withTimer);
document.getElementById("timerOffBtn").classList.toggle("active", !withTimer);
resetGame();
