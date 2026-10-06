// ===================================================================
// رسم مشترک صفحه‌ی شطرنج (بازی محلی، آنلاین و آموزش).
// - خونه‌ها فقط یک‌بار ساخته می‌شن و فقط کلاسشون در صورت تغییر آپدیت می‌شه.
// - مهره‌ها یه لایه‌ی جدا هستن و با transform (GPU) سر می‌خورن، نه left/top.
// - هیچ نشانگر حرکت ممکن (نقطه/هایلایت خونه‌ی مقصد) نمایش داده نمی‌شه.
//   فقط خونه‌ی مهره‌ی انتخاب‌شده، آخرین حرکت و کیش مشخص می‌شن.
// ===================================================================

// همیشه از مهره‌های «توپر» استفاده می‌کنیم (رنگ با CSS داده می‌شه) تا
// مهره‌ی سفید توخالی/نیمه‌شفاف نشه. \uFE0E یعنی «حالت متنی، نه ایموجی».
const PIECE_GLYPH = { p: "♟\uFE0E", n: "♞\uFE0E", b: "♝\uFE0E", r: "♜\uFE0E", q: "♛\uFE0E", k: "♚\uFE0E" };
const PIECE_ICONS = { w: PIECE_GLYPH, b: PIECE_GLYPH };
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function squareName(row, col) {
  return FILES[col] + (8 - row);
}

function createBoardRenderer(boardEl, options) {
  const flip = !!(options && options.flip);
  const onSquareClick = (options && options.onSquareClick) || function () {};

  boardEl.textContent = "";

  const pieceLayer = document.createElement("div");
  pieceLayer.className = "piece-layer";

  const squareEls = {};
  const squareClass = {};
  const frag = document.createDocumentFragment();
  for (let rr = 0; rr < 8; rr++) {
    for (let cc = 0; cc < 8; cc++) {
      const r = flip ? 7 - rr : rr;
      const c = flip ? 7 - cc : cc;
      const sq = squareName(r, c);
      const div = document.createElement("div");
      div.className = "sq " + ((r + c) % 2 === 0 ? "light" : "dark");
      div.dataset.sq = sq;
      frag.appendChild(div);
      squareEls[sq] = div;
      squareClass[sq] = div.className;
    }
  }
  boardEl.appendChild(frag);
  boardEl.appendChild(pieceLayer);

  // یک شنونده برای کل تخته (به‌جای ۶۴ تا) — روی لمس و ماوس یکسان کار می‌کنه
  boardEl.addEventListener("click", (e) => {
    const t = e.target.closest(".sq");
    if (t && t.dataset.sq) onSquareClick(t.dataset.sq);
  });

  let pieceEls = []; // [{el, color, type, r, c}]

  function translateFor(r, c) {
    const dr = flip ? 7 - r : r;
    const dc = flip ? 7 - c : c;
    // درصدِ translate نسبت به اندازه‌ی خود مهره‌ست (۱۲.۵٪ تخته) ⇒ ضرب در ۱۰۰٪.
    // چون صفحه RTL هست، جهت افقی تخته LTR نگه داشته شده (direction:ltr در CSS).
    return `translate(${dc * 100}%, ${dr * 100}%)`;
  }

  function renderBoard(boardState, ui) {
    ui = ui || {};
    const selected = ui.selected || null;
    const checkSquare = ui.checkSquare || null;
    const lastMove = ui.lastMove || null;

    // ---------- خونه‌ها ----------
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = squareName(r, c);
        let cls = "sq " + ((r + c) % 2 === 0 ? "light" : "dark");
        if (lastMove && (sq === lastMove.from || sq === lastMove.to)) cls += " last-move";
        if (sq === selected) cls += " selected";
        if (sq === checkSquare) cls += " in-check";
        if (squareClass[sq] !== cls) {
          squareEls[sq].className = cls;
          squareClass[sq] = cls;
        }
      }
    }

    // ---------- مهره‌ها ----------
    const newPieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = boardState[r][c];
        if (p) newPieces.push({ r, c, color: p.color, type: p.type });
      }
    }

    const usedOld = new Set();
    const usedNew = new Set();

    // ۱. مهره‌ای که رو همون خونه مونده
    pieceEls.forEach((old, oi) => {
      for (let ni = 0; ni < newPieces.length; ni++) {
        if (usedNew.has(ni)) continue;
        const np = newPieces[ni];
        if (old.r === np.r && old.c === np.c && old.color === np.color && old.type === np.type) {
          usedOld.add(oi);
          usedNew.add(ni);
          old.matchedTo = np;
          break;
        }
      }
    });

    // ۲. بقیه به نزدیک‌ترین مهره‌ی هم‌نوع وصل می‌شن (حرکت عادی، قلعه‌روی)
    pieceEls.forEach((old, oi) => {
      if (usedOld.has(oi)) return;
      let bestNi = -1,
        bestDist = Infinity;
      newPieces.forEach((np, ni) => {
        if (usedNew.has(ni) || np.color !== old.color || np.type !== old.type) return;
        const d = Math.abs(np.r - old.r) + Math.abs(np.c - old.c);
        if (d < bestDist) {
          bestDist = d;
          bestNi = ni;
        }
      });
      if (bestNi >= 0) {
        usedOld.add(oi);
        usedNew.add(bestNi);
        old.matchedTo = newPieces[bestNi];
      }
    });

    const nextPieceEls = [];

    pieceEls.forEach((old, oi) => {
      if (usedOld.has(oi)) {
        const np = old.matchedTo;
        if (old.r !== np.r || old.c !== np.c) {
          old.el.style.transform = translateFor(np.r, np.c);
          old.r = np.r;
          old.c = np.c;
        }
        nextPieceEls.push(old);
      } else {
        // مهره‌ی گرفته‌شده: محو بشه و بعد حذف
        old.el.style.opacity = "0";
        old.el.style.transform = translateFor(old.r, old.c) + " scale(.5)";
        const dead = old.el;
        setTimeout(() => dead.remove(), 220);
      }
    });

    newPieces.forEach((np, ni) => {
      if (usedNew.has(ni)) return;
      const el = document.createElement("div");
      el.className = "p piece-" + np.color;
      el.textContent = PIECE_GLYPH[np.type];
      el.style.transform = translateFor(np.r, np.c);
      el.style.opacity = "0";
      pieceLayer.appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = "1";
      });
      nextPieceEls.push({ el, color: np.color, type: np.type, r: np.r, c: np.c });
    });

    pieceEls = nextPieceEls;
  }

  return { renderBoard };
}

// ---------- افکت کوچیک موقع برد (حداکثر یک‌بار در هر ثانیه‌ی مفید) ----------
let _confettiBusy = false;
function burstConfetti() {
  if (_confettiBusy) return;
  _confettiBusy = true;
  const colors = ["#e3b862", "#c58140", "#f5e9d3", "#8aae6e", "#d4593f"];
  const frag = document.createDocumentFragment();
  const els = [];
  for (let i = 0; i < 22; i++) {
    const el = document.createElement("div");
    el.textContent = Math.random() < 0.5 ? "★" : "✦";
    el.style.cssText = `position:fixed; left:50%; top:38%; font-size:${14 + Math.random() * 14}px;
      color:${colors[i % colors.length]}; pointer-events:none; z-index:999; will-change:transform,opacity;
      transition:transform 1s ease-out, opacity 1s ease-out;`;
    frag.appendChild(el);
    els.push(el);
  }
  document.body.appendChild(frag);
  requestAnimationFrame(() => {
    els.forEach((el) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 160;
      el.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist - 70}px) rotate(${Math.random() * 360}deg)`;
      el.style.opacity = "0";
    });
  });
  setTimeout(() => {
    els.forEach((el) => el.remove());
    _confettiBusy = false;
  }, 1100);
}
