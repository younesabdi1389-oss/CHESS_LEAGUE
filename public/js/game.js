// ===================================================================
// منطق بازی شطرنج (دو نفره‌ی محلی، یا یک‌نفره مقابل بات)
// از chess.js برای تمام قوانین استفاده می‌کنیم: کیش، کیش‌مات، پات،
// روخ‌نشینی، آن‌پاسان و ترفیع سرباز. ما مسئول رسم تخته، گرفتن کلیک‌ها،
// نمایش پنجره‌ی انتخاب مهره هنگام ترفیع، و صدا زدن بات هستیم.
// ===================================================================

const PIECE_ICONS = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

let game = new Chess();
let selectedSquare = null;   // مثلاً "e2"
let legalTargets = [];       // خانه‌هایی که مهره‌ی انتخاب‌شده می‌تونه بره
let pendingPromotion = null; // { from, to } وقتی منتظر انتخاب مهره‌ی ترفیع هستیم

let mode = "local";          // "local" یا "bot"
let difficulty = "easy";     // "easy" | "medium" | "hard" (فقط تو حالت bot)
let botColor = "b";          // بات همیشه سیاه رو بازی می‌کنه

function squareName(row, col) {
  return FILES[col] + (8 - row);
}

function render() {
  const boardEl = document.getElementById("board");
  boardEl.innerHTML = "";
  const boardState = game.board();

  let kingInCheckSquare = null;
  if (game.in_check()) {
    const turnColor = game.turn();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = boardState[r][c];
        if (p && p.type === "k" && p.color === turnColor) kingInCheckSquare = squareName(r, c);
      }
    }
  }

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = squareName(r, c);
      const piece = boardState[r][c];
      const div = document.createElement("div");
      div.className = "sq " + ((r + c) % 2 === 0 ? "light" : "dark");

      if (sq === selectedSquare) div.classList.add("selected");
      if (legalTargets.includes(sq)) div.classList.add(piece ? "legal-capture" : "legal");
      if (sq === kingInCheckSquare) div.classList.add("in-check");

      if (piece) {
        const span = document.createElement("span");
        span.className = "piece-" + piece.color;
        span.textContent = PIECE_ICONS[piece.color][piece.type];
        div.appendChild(span);
      }

      div.addEventListener("click", () => onSquareClick(sq));
      boardEl.appendChild(div);
    }
  }

  updateStatusBar();
  updateHistory();
  updateResultPanel();
}

function onSquareClick(sq) {
  if (pendingPromotion) return; // تا وقتی مودال باز، کلیک رو تخته بی‌اثره
  if (mode === "bot" && game.turn() === botColor) return; // نوبت بات، کاربر کلیک نکنه

  if (!selectedSquare) {
    const piece = game.get(sq);
    if (piece && piece.color === game.turn()) {
      selectedSquare = sq;
      legalTargets = game.moves({ square: sq, verbose: true }).map((m) => m.to);
    }
    render();
    return;
  }

  if (sq === selectedSquare) {
    selectedSquare = null;
    legalTargets = [];
    render();
    return;
  }

  const candidates = game.moves({ square: selectedSquare, verbose: true }).filter((m) => m.to === sq);

  if (candidates.length === 0) {
    // حرکت غیرمجاز؛ شاید کاربر داره مهره‌ی دیگه‌ای از خودش رو انتخاب می‌کنه
    const piece = game.get(sq);
    selectedSquare = null;
    legalTargets = [];
    if (piece && piece.color === game.turn()) {
      selectedSquare = sq;
      legalTargets = game.moves({ square: sq, verbose: true }).map((m) => m.to);
    }
    render();
    return;
  }

  const from = selectedSquare;
  selectedSquare = null;
  legalTargets = [];

  if (candidates[0].promotion) {
    // این حرکت یعنی سرباز به آخر زمین می‌رسه -> باید کاربر مهره رو انتخاب کنه
    pendingPromotion = { from, to: sq };
    render();
    showPromotionModal();
    return;
  }

  game.move({ from, to: sq });
  render();
  maybeTriggerBotMove();
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
  game.move({ from, to, promotion: pieceLetter });
  render();
  maybeTriggerBotMove();
}

document.querySelectorAll(".promo-choices button").forEach((btn) => {
  btn.addEventListener("click", () => completePromotion(btn.dataset.p));
});

// بعد از هر حرکت انسان، اگه حالت بازی با بات باشه و نوبت بات برسه، بات حرکت می‌کنه
function maybeTriggerBotMove() {
  if (mode !== "bot") return;
  if (game.game_over()) return;
  if (game.turn() !== botColor) return;

  const bar = document.getElementById("statusBar");
  bar.classList.add("thinking");
  bar.textContent = "بات داره فکر می‌کنه...";

  setTimeout(() => {
    const m = getBotMove(game, difficulty);
    if (m) game.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
    render();
  }, 450);
}

function updateStatusBar() {
  const bar = document.getElementById("statusBar");
  bar.classList.remove("check", "over", "thinking");

  if (game.in_checkmate()) {
    const winner = game.turn() === "w" ? "سیاه" : "سفید";
    bar.textContent = `کیش و مات! برنده: ${winner} 🏆`;
    bar.classList.add("over");
  } else if (game.in_stalemate()) {
    bar.textContent = "پات (Stalemate) — بازی مساوی شد";
    bar.classList.add("over");
  } else if (game.in_draw()) {
    bar.textContent = "بازی مساوی شد";
    bar.classList.add("over");
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
    const white = history[i] || "";
    const black = history[i + 1] || "";
    out += `${num}. ${white} ${black}<br>`;
  }
  box.innerHTML = out;
}

// ---------- ثبت نتیجه‌ی بازی محلی دو نفره تو لیگ (دیتابیس واقعی) ----------
function updateResultPanel() {
  const card = document.getElementById("submitResultCard");
  if (!card) return;

  if (mode === "local" && game.game_over()) {
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

  let result;
  if (game.in_checkmate()) {
    result = game.turn() === "w" ? "black" : "white"; // نوبتِ کیش‌مات‌شده بازنده‌ست
  } else {
    result = "draw"; // پات یا هر نوع مساوی دیگه
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
    btn.disabled = true;
  } catch (err) {
    msg.textContent = "❌ ثبت نشد: " + err.message;
  }
});

function resetGame() {
  game = new Chess();
  selectedSquare = null;
  legalTargets = [];
  pendingPromotion = null;
  hidePromotionModal();
  document.getElementById("submitResultBtn").disabled = false;
  document.getElementById("submitResultMsg").textContent = "";
  render();
  maybeTriggerBotMove();
}

document.getElementById("resetBtn").addEventListener("click", resetGame);

// ---------- سوییچ حالت بازی: دو نفره / با بات ----------
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

render();
