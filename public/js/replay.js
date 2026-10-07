// ===================================================================
// تماشای دوباره‌ی یک بازی ثبت‌شده: حرکت‌ها یکی‌یکی روی تخته پخش می‌شن
// (پخش خودکار، قدم‌به‌قدم، اسلایدر، سرعت، چرخاندن تخته، کلید جهت‌دار).
// حرکت‌ها از سرور به‌صورت آرایه‌ی SAN میان و اینجا با chess.js بازی می‌شن.
// ===================================================================

const $ = (id) => document.getElementById(id);
const gameId = parseInt(new URLSearchParams(location.search).get("id"));

let positions = []; // [{board, last, san, check, mate, captured}]
let cur = 0;
let playing = false;
let playTimer = null;
let speed = 900;
let flipped = false;
let renderer = null;
let meta = null;

function kingSquare(g) {
  const b = g.board();
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p && p.type === "k" && p.color === g.turn()) return FILES[c] + (8 - r);
    }
  return null;
}

function buildPositions(moves) {
  const g = new Chess();
  const list = [{ board: g.board(), last: null, san: null, checkSq: null }];
  for (const san of moves) {
    const m = g.move(san);
    if (!m) break;
    list.push({
      board: g.board(),
      last: { from: m.from, to: m.to },
      san: m.san,
      captured: !!m.captured,
      check: g.in_check(),
      mate: g.in_checkmate(),
      checkSq: g.in_check() ? kingSquare(g) : null,
    });
  }
  return list;
}

function makeRenderer() {
  renderer = createBoardRenderer($("board"), { flip: flipped, onSquareClick: () => {} });
}

function resultText() {
  if (!meta) return "";
  const reason =
    { checkmate: "کیش و مات", resign: "تسلیم", timeout: "اتمام وقت", abandon: "ترک بازی", draw: "مساوی" }[meta.reason] || "";
  if (meta.result === "draw") return "بازی مساوی شد" + (reason && reason !== "مساوی" ? ` (${reason})` : "");
  const w = meta.result === "white" ? meta.white_name : meta.black_name;
  return `برنده: ${w} 🏆` + (reason ? ` (${reason})` : "");
}

function show(i, withSound) {
  cur = Math.max(0, Math.min(positions.length - 1, i));
  const pos = positions[cur];
  renderer.renderBoard(pos.board, { selected: null, checkSquare: pos.checkSq, lastMove: pos.last });
  $("rpSlider").value = cur;

  const bar = $("statusBar");
  bar.classList.remove("check", "over");
  if (cur === 0) bar.textContent = "شروع بازی";
  else if (cur === positions.length - 1) {
    bar.textContent = resultText();
    bar.classList.add("over");
  } else {
    bar.textContent = `حرکت ${cur} از ${positions.length - 1}: ${pos.san}` + (pos.check ? " — کیش!" : "");
    if (pos.check) bar.classList.add("check");
  }

  if (withSound && cur > 0) {
    if (pos.mate) playCheckmateSound();
    else if (pos.check) playCheckSound();
    else if (pos.captured) playCaptureSound();
    else playMoveSound();
  }

  document.querySelectorAll("#rpMoves .mv").forEach((el) => el.classList.toggle("on", +el.dataset.i === cur));
  const on = document.querySelector("#rpMoves .mv.on");
  if (on) on.scrollIntoView({ block: "nearest" });
  $("rpPlay").textContent = playing ? "⏸" : "▶";
}

function stop() {
  playing = false;
  clearTimeout(playTimer);
  $("rpPlay").textContent = "▶";
}
function tick() {
  if (!playing) return;
  if (cur >= positions.length - 1) return stop();
  show(cur + 1, true);
  if (cur >= positions.length - 1) return stop();
  playTimer = setTimeout(tick, speed);
}
function play() {
  if (cur >= positions.length - 1) show(0); // اگه تموم شده، از اول
  playing = true;
  $("rpPlay").textContent = "⏸";
  playTimer = setTimeout(tick, 400);
}

function renderMoveList(moves) {
  let html = "";
  for (let i = 0; i < moves.length; i += 2) {
    html += `<div class="mrow"><span class="mn">${i / 2 + 1}.</span>
      <span class="mv" data-i="${i + 1}">${escapeHTML(moves[i])}</span>
      ${moves[i + 1] ? `<span class="mv" data-i="${i + 2}">${escapeHTML(moves[i + 1])}</span>` : ""}</div>`;
  }
  $("rpMoves").innerHTML = html || "—";
}

async function load() {
  if (!gameId) {
    $("rpPlayers").textContent = "شناسه‌ی بازی نامعتبره.";
    return;
  }
  try {
    const res = await fetch(`/api/games/${gameId}`);
    if (!res.ok) throw new Error((await res.json()).error || "خطا");
    meta = await res.json();
  } catch (e) {
    $("rpPlayers").textContent = "این بازی پیدا نشد یا دیتابیس وصل نیست.";
    return;
  }
  if (!meta.moves || meta.moves.length === 0) {
    $("rpPlayers").textContent = "برای این بازی حرکتی ذخیره نشده (فقط بازی‌های جدید قابل تماشان).";
    makeRenderer();
    renderer.renderBoard(new Chess().board(), {});
    return;
  }

  $("rpPlayers").innerHTML = `<span>⚪ ${escapeHTML(meta.white_name)}</span><b>vs</b><span>⚫ ${escapeHTML(meta.black_name)}</span>`;
  positions = buildPositions(meta.moves);
  $("rpSlider").max = positions.length - 1;
  renderMoveList(meta.moves);
  makeRenderer();
  show(0);
}

// ---------- کنترل‌ها ----------
$("rpPlay").addEventListener("click", () => (playing ? stop() : positions.length && play()));
$("rpPrev").addEventListener("click", () => { stop(); show(cur - 1, true); });
$("rpNext").addEventListener("click", () => { stop(); show(cur + 1, true); });
$("rpStart").addEventListener("click", () => { stop(); show(0); });
$("rpEnd").addEventListener("click", () => { stop(); show(positions.length - 1); });
$("rpSlider").addEventListener("input", (e) => { stop(); show(+e.target.value); });
$("rpMoves").addEventListener("click", (e) => {
  const mv = e.target.closest(".mv");
  if (mv) { stop(); show(+mv.dataset.i, true); }
});
$("rpSpeed").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  speed = +b.dataset.s;
  document.querySelectorAll("#rpSpeed button").forEach((x) => x.classList.toggle("active", x === b));
});
$("rpFlip").addEventListener("click", () => {
  flipped = !flipped;
  makeRenderer();
  show(cur);
});
document.addEventListener("keydown", (e) => {
  if (!positions.length) return;
  if (e.key === "ArrowLeft") { stop(); show(cur + 1, true); }
  else if (e.key === "ArrowRight") { stop(); show(cur - 1, true); }
  else if (e.key === " ") { e.preventDefault(); playing ? stop() : play(); }
});
window.addEventListener("pagehide", stop);

load();
