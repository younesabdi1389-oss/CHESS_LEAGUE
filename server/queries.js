// ===================================================================
// تمام کوئری‌های دیتابیس (پیدا/ساخت بازیکن، ثبت بازی، محاسبه‌ی جدول
// امتیازات و تاریخچه). قوانین امتیازدهی: برد=۳، مساوی=۱، باخت=۰.
// ===================================================================

const { pool } = require("./db");

async function findOrCreatePlayer(name, avatar) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("نام بازیکن نمی‌تونه خالی باشه");

  const existing = await pool.query("SELECT id, name, avatar FROM players WHERE name = $1", [trimmed]);
  if (existing.rows.length) {
    if (avatar !== undefined && avatar !== null) {
      const updated = await pool.query(
        "UPDATE players SET avatar = $1 WHERE name = $2 RETURNING id, name, avatar",
        [avatar, trimmed]
      );
      return updated.rows[0];
    }
    return existing.rows[0];
  }

  const inserted = await pool.query(
    "INSERT INTO players (name, avatar) VALUES ($1, $2) RETURNING id, name, avatar",
    [trimmed, avatar || 0]
  );
  return inserted.rows[0];
}

async function listPlayers() {
  const r = await pool.query("SELECT id, name, avatar FROM players ORDER BY name ASC");
  return r.rows;
}

async function recordGame(whiteName, blackName, result) {
  const white = whiteName.trim();
  const black = blackName.trim();
  await findOrCreatePlayer(white);
  await findOrCreatePlayer(black);

  const r = await pool.query(
    "INSERT INTO games (white_name, black_name, result) VALUES ($1,$2,$3) RETURNING *",
    [white, black, result]
  );
  return r.rows[0];
}

async function getRecentGames(limit = 20) {
  const r = await pool.query("SELECT * FROM games ORDER BY played_at DESC LIMIT $1", [limit]);
  return r.rows;
}

// جدول امتیازات رو از روی تمام بازی‌های ثبت‌شده محاسبه می‌کنه (نه از یه فیلد جداگانه)
// سیستم امتیاز: برد +۱ ، مساوی ۰ ، باخت −۱ (پس امتیاز می‌تونه منفی هم بشه).
// چون از روی بازی‌ها حساب می‌شه، بازی‌های قدیمی هم خودکار با این قانون دوباره امتیاز می‌گیرن.
const SCORE = { win: 1, draw: 0, loss: -1 };

async function getLeaderboard() {
  const players = await listPlayers();
  const games = (await pool.query("SELECT * FROM games ORDER BY played_at ASC, id ASC")).rows;

  const blank = (name, avatar) => ({ name, avatar: avatar || 0, played: 0, won: 0, draw: 0, lost: 0, points: 0, form: [] });
  const stats = {};
  players.forEach((p) => {
    stats[p.name] = blank(p.name, p.avatar);
  });

  const add = (row, outcome) => {
    row.played++;
    if (outcome === "W") {
      row.won++;
      row.points += SCORE.win;
    } else if (outcome === "L") {
      row.lost++;
      row.points += SCORE.loss;
    } else {
      row.draw++;
      row.points += SCORE.draw;
    }
    row.form.push(outcome);
    if (row.form.length > 5) row.form.shift(); // فقط ۵ نتیجه‌ی آخر
  };

  games.forEach((g) => {
    [g.white_name, g.black_name].forEach((n) => {
      if (!stats[n]) stats[n] = blank(n);
    });
    const w = stats[g.white_name];
    const b = stats[g.black_name];
    if (g.result === "draw") {
      add(w, "D");
      add(b, "D");
    } else if (g.result === "white") {
      add(w, "W");
      add(b, "L");
    } else {
      add(b, "W");
      add(w, "L");
    }
  });

  const table = Object.values(stats);
  table.forEach((r) => (r.winRate = r.played ? Math.round((r.won / r.played) * 100) : 0));
  // رتبه‌بندی: امتیاز بیشتر، بعد برد بیشتر، بعد باخت کمتر، بعد اسم
  table.sort((a, b) => b.points - a.points || b.won - a.won || a.lost - b.lost || a.name.localeCompare(b.name));
  table.forEach((row, i) => (row.rank = i + 1));
  return table;
}

module.exports = { findOrCreatePlayer, listPlayers, recordGame, getRecentGames, getLeaderboard };
