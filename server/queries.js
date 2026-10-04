// ===================================================================
// تمام کوئری‌های دیتابیس (پیدا/ساخت بازیکن، ثبت بازی، محاسبه‌ی جدول
// امتیازات و تاریخچه). قوانین امتیازدهی: برد=۳، مساوی=۱، باخت=۰.
// ===================================================================

const { pool } = require("./db");

async function findOrCreatePlayer(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("نام بازیکن نمی‌تونه خالی باشه");

  const existing = await pool.query("SELECT id, name FROM players WHERE name = $1", [trimmed]);
  if (existing.rows.length) return existing.rows[0];

  const inserted = await pool.query(
    "INSERT INTO players (name) VALUES ($1) RETURNING id, name",
    [trimmed]
  );
  return inserted.rows[0];
}

async function listPlayers() {
  const r = await pool.query("SELECT id, name FROM players ORDER BY name ASC");
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
async function getLeaderboard() {
  const players = await listPlayers();
  const games = (await pool.query("SELECT * FROM games")).rows;

  const stats = {};
  players.forEach((p) => {
    stats[p.name] = { name: p.name, played: 0, won: 0, draw: 0, lost: 0, points: 0 };
  });

  games.forEach((g) => {
    [g.white_name, g.black_name].forEach((n) => {
      if (!stats[n]) stats[n] = { name: n, played: 0, won: 0, draw: 0, lost: 0, points: 0 };
    });
    stats[g.white_name].played++;
    stats[g.black_name].played++;

    if (g.result === "draw") {
      stats[g.white_name].draw++;
      stats[g.black_name].draw++;
      stats[g.white_name].points += 1;
      stats[g.black_name].points += 1;
    } else if (g.result === "white") {
      stats[g.white_name].won++;
      stats[g.black_name].lost++;
      stats[g.white_name].points += 3;
    } else {
      stats[g.black_name].won++;
      stats[g.white_name].lost++;
      stats[g.black_name].points += 3;
    }
  });

  const table = Object.values(stats).sort((a, b) => b.points - a.points);
  table.forEach((row, i) => (row.rank = i + 1));
  return table;
}

module.exports = { findOrCreatePlayer, listPlayers, recordGame, getRecentGames, getLeaderboard };
