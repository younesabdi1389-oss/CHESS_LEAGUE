// ===================================================================
// حالا این فایل سعی می‌کنه داده‌ی واقعی رو از سرور (/api/dashboard)
// بگیره. اگه دیتابیس هنوز وصل نشده باشه (DATABASE_URL تنظیم نشده)،
// به‌جاش داده‌ی نمونه (fakeData) نشون می‌ده تا صفحه خالی نمونه.
// ===================================================================

const PLAYER_KEY = "cl-player-name";

const fakeData = {
  username: "مهمان",
  stats: { players: 0, gamesPlayed: 0, points: 0, rank: "-" },
  inviteLink: "هنوز آنلاین نشده",
  leagueTable: [],
  recentGames: [],
};

function getPlayerName() {
  let name = localStorage.getItem(PLAYER_KEY);
  if (!name) {
    name = (window.prompt("اسمتو بنویس تا تو لیگ شناخته بشی:") || "").trim();
    if (name) localStorage.setItem(PLAYER_KEY, name);
  }
  return name || "";
}

async function registerPlayer(name) {
  if (!name) return;
  try {
    await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch (err) {
    // دیتابیس وصل نیست؛ مشکلی نیست، فعلاً نادیده می‌گیریم
  }
}

function rankBadge(rank) {
  if (rank === 1) return `🥇`;
  if (rank === 2) return `🥈`;
  if (rank === 3) return `🥉`;
  return rank;
}

function renderDashboard(data) {
  document.getElementById("welcomeText").textContent = `سلام، ${data.username} 👋`;
  document.getElementById("usernameText").textContent = data.username;
  document.getElementById("avatarBox").innerHTML = avatarHTML(data.avatar || getSavedAvatar());

  document.getElementById("statPlayers").textContent = data.stats.players;
  document.getElementById("statGames").textContent = data.stats.gamesPlayed;
  document.getElementById("statPoints").innerHTML = fmtPoints(data.stats.points);
  document.getElementById("statRank").textContent = data.stats.rank;

  document.getElementById("inviteLink").textContent = data.inviteLink;

  // انیمیشن ورود کارت‌های آماری (fade-up پشت‌سرهم)
  document.querySelectorAll(".stat-card").forEach((card, i) => {
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = `fadeUp .4s ease ${i * 0.06}s both`;
  });

  const tbody = document.getElementById("leagueTableBody");
  tbody.innerHTML = data.leagueTable.length
    ? data.leagueTable
        .map(
          (row, i) => `
    <tr class="${row.isMe ? "me" : ""}" style="animation:fadeUp .35s ease ${i * 0.05}s both">
      <td>${rankBadge(row.rank)}</td>
      <td style="display:flex; align-items:center; gap:8px; justify-content:center">${avatarHTML(row.avatar || 0, "avatar-sm")} ${escapeHTML(row.name)}</td>
      <td>${row.played}</td>
      <td>${row.won}</td>
      <td>${row.draw}</td>
      <td>${row.lost}</td>
      <td>${fmtPoints(row.points)}</td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="7" style="color:var(--text2)">هنوز هیچ بازیکن/بازی‌ای تو لیگ ثبت نشده</td></tr>`;

  const gamesBox = document.getElementById("recentGames");
  gamesBox.innerHTML = data.recentGames.length
    ? data.recentGames
        .map(
          (g) => `
    <div class="game-row">
      <span>${escapeHTML(g.players)}</span>
      <span class="result ${g.type}">${escapeHTML(g.result)}</span>
    </div>`
        )
        .join("")
    : `<div style="color:var(--text2); font-size:13px">هنوز بازی‌ای ثبت نشده</div>`;
}

async function loadDashboardData() {
  const name = getPlayerName();
  await registerPlayer(name);

  try {
    const res = await fetch(`/api/dashboard?name=${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error("db-not-ready");
    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    renderDashboard({ ...fakeData, username: name || "مهمان" });
  }
}

// ---------- دکمه‌ی کپی لینک دعوت ----------
document.getElementById("copyInviteBtn").addEventListener("click", () => {
  const link = document.getElementById("inviteLink").textContent;
  navigator.clipboard.writeText(link);
  alert("لینک کپی شد!");
});

loadDashboardData();


// ---------- نکته‌ی روز (هر روز یکی، بدون نیاز به سرور) ----------
const TIPS = [
  "مرکز تخته (e4, d4, e5, d5) رو زود کنترل کن؛ مهره‌هات اونجا قدرت بیشتری دارن.",
  "اسب‌ها و فیل‌ها رو قبل از وزیر و رخ‌ها بازی بده (توسعه‌ی مهره‌ها).",
  "قبل از هر حرکت بپرس: حریف با این حرکت چه تهدیدی می‌تونه بسازه؟",
  "زود قلعه‌روی کن تا شاهت امن باشه و رخ‌ها وارد بازی بشن.",
  "وزیر رو خیلی زود وارد بازی نکن؛ با حمله‌ی مهره‌های کوچیک‌تر وقت از دست می‌دی.",
  "در پایان بازی، شاه یه مهره‌ی قدرتمنده؛ بیارش وسط تخته.",
  "یه رخ روی ستون باز، خیلی قوی‌تر از رخ پشت سربازهاست.",
  "اگه از نظر مادی جلویی، معامله‌ی مهره‌ها به نفعته.",
  "سربازها نمی‌تونن عقب برن؛ هر حرکتشون رو با دقت انتخاب کن.",
  "بعد از هر حرکت حریف، اول ببین چی رو تهدید می‌کنه، بعد نقشه‌ی خودت رو ادامه بده.",
];
(function showTip() {
  const el = document.getElementById("tipText");
  if (!el) return;
  const day = Math.floor(Date.now() / 86400000);
  el.textContent = TIPS[day % TIPS.length];
})();
