// ===================================================================
// بازی آنلاین زنده‌ی دو نفره با Socket.IO.
// سرور «قاضی» اصلیه: هر حرکت رو سرور چک می‌کنه و برای هر دو نفر
// پخش می‌کنه، پس تقلب یا دیدن صفحه‌ی اشتباه ممکن نیست.
// ===================================================================

const PIECE_ICONS = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PLAYER_KEY = "cl-player-name";

const socket = io();

let game = new Chess();
let myColor = null;      // "w" یا "b"
let roomCode = null;
let selectedSquare = null;
let legalTargets = [];
let pendingPromotion = null;
let historyList = [];

function squareName(row, col) {
  return FILES[col] + (8 - row);
}

const lobbyCard = document.getElementById("lobbyCard");
const waitingCard = document.getElementById("waitingCard");
const playArea = document.getElementById("playArea");
const nameInput = document.getElementById("nameInput");
const lobbyMsg = document.getElementById("lobbyMsg");

nameInput.value = localStorage.getItem(PLAYER_KEY) || "";

document.getElementById("createRoomBtn").addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (!name) {
    lobbyMsg.textContent = "اول اسمتو بنویس.";
    return;
  }
  localStorage.setItem(PLAYER_KEY, name);
  socket.emit("create_room", { name });
});

document.getElementById("joinRoomBtn").addEventListener("click", () => {
  const name = nameInput.value.trim();
  const code = document.getElementById("joinCodeInput").value.trim().toUpperCase();
  if (!name) {
    lobbyMsg.textContent = "اول اسمتو بنویس.";
    return;
  }
  if (!code) {
    lobbyMsg.textContent = "کد اتاق رو بنویس.";
    return;
  }
  localStorage.setItem(PLAYER_KEY, name);
  socket.emit("join_room", { code, name });
});

document.getElementById("copyRoomCodeBtn").addEventListener("click", () => {
  navigator.clipboard.writeText(roomCode);
  alert("کد کپی شد!");
});

document.getElementById("resignBtn").addEventListener("click", () => {
  if (confirm("مطمئنی می‌خوای تسلیم بشی؟")) socket.emit("resign", { roomCode });
});

document.querySelectorAll(".promo-choices button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    pendingPromotion = null;
    document.getElementById("promoModal").classList.add("hidden");
    socket.emit("make_move", { roomCode, from, to, promotion: btn.dataset.p });
  });
});

// ---------- رویدادهای سرور ----------
socket.on("room_created", (data) => {
  roomCode = data.roomCode;
  myColor = data.color;
  game = new Chess(data.fen);
  historyList = data.history || [];
  lobbyCard.style.display = "none";
  waitingCard.style.display = "block";
  document.getElementById("roomCodeDisplay").textContent = roomCode;
});

socket.on("room_joined", (data) => {
  roomCode = data.roomCode;
  myColor = data.color;
  game = new Chess(data.fen);
  historyList = data.history || [];
  lobbyCard.style.display = "none";
  waitingCard.style.display = "none";
  playArea.style.display = "block";
  render();
});

socket.on("opponent_joined", () => {
  waitingCard.style.display = "none";
  playArea.style.display = "block";
  render();
});

socket.on("room_error", (data) => {
  lobbyMsg.textContent = "❌ " + data.message;
});

socket.on("move_made", (data) => {
  game = new Chess(data.fen);
  historyList = data.history || [];
  selectedSquare = null;
  legalTargets = [];
  render();
});

socket.on("move_rejected", (data) => {
  alert(data.message);
});

socket.on("game_over", (data) => {
  const bar = document.getElementById("statusBar");
  bar.classList.remove("check");
  bar.classList.add("over");
  const resultFa =
    data.result === "draw" ? "بازی مساوی شد" : data.result === "white" ? "برنده: سفید 🏆" : "برنده: سیاه 🏆";
  bar.textContent = resultFa + (data.reason === "resign" ? " (حریف تسلیم شد)" : "");
});

socket.on("opponent_left", () => {
  alert("حریف از بازی خارج شد / قطع شد.");
});

// ---------- رسم تخته ----------
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

  // اگه بازیکن سیاهه، تخته رو واسش معکوس نشون می‌دیم (مهره‌های خودش پایین باشن)
  const flip = myColor === "b";

  for (let rr = 0; rr < 8; rr++) {
    for (let cc = 0; cc < 8; cc++) {
      const r = flip ? 7 - rr : rr;
      const c = flip ? 7 - cc : cc;
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
}

function onSquareClick(sq) {
  if (pendingPromotion) return;
  if (game.game_over()) return;
  if (game.turn() !== myColor) return; // نوبت تو نیست، سرور هم همینو رد می‌کنه ولی بهتره اینجا هم چک کنیم

  if (!selectedSquare) {
    const piece = game.get(sq);
    if (piece && piece.color === myColor) {
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
    const piece = game.get(sq);
    selectedSquare = null;
    legalTargets = [];
    if (piece && piece.color === myColor) {
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
    pendingPromotion = { from, to: sq };
    render();
    document.getElementById("promoModal").classList.remove("hidden");
    return;
  }

  // توجه: خود تخته رو بازسازی نمی‌کنیم؛ منتظر تایید سرور (رویداد move_made) می‌مونیم
  socket.emit("make_move", { roomCode, from, to: sq });
}

function updateStatusBar() {
  const bar = document.getElementById("statusBar");
  bar.classList.remove("check", "over");

  if (game.game_over()) return; // متن نهایی رو رویداد game_over از سرور می‌نویسه

  const myTurn = game.turn() === myColor;
  if (game.in_check()) {
    bar.textContent = myTurn ? "کیش! نوبت توئه" : "کیش! نوبت حریف";
    bar.classList.add("check");
  } else {
    bar.textContent = myTurn ? "نوبت توئه" : "نوبت حریف، منتظر بمون";
  }
}

function updateHistory() {
  const box = document.getElementById("historyList");
  if (historyList.length === 0) {
    box.textContent = "—";
    return;
  }
  let out = "";
  for (let i = 0; i < historyList.length; i += 2) {
    const num = i / 2 + 1;
    out += `${num}. ${historyList[i] || ""} ${historyList[i + 1] || ""}<br>`;
  }
  box.innerHTML = out;
}
