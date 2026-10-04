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

function renderDashboard(data) {
  document.getElementById("welcomeText").textContent = `سلام، ${data.username} 👋`;
  document.getElementById("usernameText").textContent = data.username;
  document.getElementById("avatarLetter").textContent = (data.username[0] || "?").toUpperCase();

  document.getElementById("statPlayers").textContent = data.stats.players;
  document.getElementById("statGames").textContent = data.stats.gamesPlayed;
  document.getElementById("statPoints").textContent = data.stats.points;
  document.getElementById("statRank").textContent = data.stats.rank;

  document.getElementById("inviteLink").textContent = data.inviteLink;

  const tbody = document.getElementById("leagueTableBody");
  tbody.innerHTML = data.leagueTable.length
    ? data.leagueTable
        .map(
          (row) => `
    <tr class="${row.isMe ? "me" : ""}">
      <td>${row.rank}</td>
      <td>${row.name}</td>
      <td>${row.played}</td>
      <td>${row.won}</td>
      <td>${row.draw}</td>
      <td>${row.lost}</td>
      <td>${row.points}</td>
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
      <span>${g.players}</span>
      <span class="result ${g.type}">${g.result}</span>
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
