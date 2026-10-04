// ===================================================================
// موتور ساده‌ی بات شطرنج (برای حالت «بازی با بات»)
// بات همیشه مهره‌های سیاه رو بازی می‌کنه.
// سه سطح سختی:
//   - ایزی:   کاملاً تصادفی از بین حرکت‌های مجاز
//   - میدیوم: حریص (Greedy) - حرکتی که بیشترین امتیاز مادی رو همین الان بده
//   - هارد:   مینی‌مکس دو نیم‌حرکته - حرکتی که حتی بعد از بهترین پاسخ حریف
//             هم بهترین وضعیت رو برای بات نگه می‌داره
// ===================================================================

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function materialScore(chessGame) {
  const board = chessGame.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_VALUES[p.type];
      score += p.color === "w" ? val : -val;
    }
  }
  return score; // مثبت یعنی به نفع سفید، منفی یعنی به نفع سیاه
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function easyMove(chessGame) {
  const moves = chessGame.moves({ verbose: true });
  return pickRandom(moves);
}

function mediumMove(chessGame) {
  const moves = chessGame.moves({ verbose: true });
  const botColor = chessGame.turn();
  let best = [];
  let bestScore = -Infinity;

  moves.forEach((m) => {
    chessGame.move(m);
    let sc = materialScore(chessGame);
    sc = botColor === "w" ? sc : -sc; // تبدیل به دید بات
    chessGame.undo();

    if (sc > bestScore) {
      bestScore = sc;
      best = [m];
    } else if (sc === bestScore) {
      best.push(m);
    }
  });

  return pickRandom(best.length ? best : moves);
}

function hardMove(chessGame) {
  const moves = chessGame.moves({ verbose: true });
  const botColor = chessGame.turn();
  let best = [];
  let bestScore = -Infinity;

  moves.forEach((m) => {
    chessGame.move(m);

    let worstReply;
    if (chessGame.game_over()) {
      let sc = materialScore(chessGame);
      worstReply = botColor === "w" ? sc : -sc;
    } else {
      worstReply = Infinity;
      const replies = chessGame.moves({ verbose: true });
      replies.forEach((r) => {
        chessGame.move(r);
        let sc = materialScore(chessGame);
        sc = botColor === "w" ? sc : -sc;
        chessGame.undo();
        if (sc < worstReply) worstReply = sc;
      });
    }

    chessGame.undo();

    if (worstReply > bestScore) {
      bestScore = worstReply;
      best = [m];
    } else if (worstReply === bestScore) {
      best.push(m);
    }
  });

  return pickRandom(best.length ? best : moves);
}

// difficulty: "easy" | "medium" | "hard"
function getBotMove(chessGame, difficulty) {
  if (difficulty === "medium") return mediumMove(chessGame);
  if (difficulty === "hard") return hardMove(chessGame);
  return easyMove(chessGame);
}
