// ===================================================================
// ۲۰ آواتار آماده: ۸ مهره‌ی شطرنج (همون‌های قبلی، با همون ترتیب) + ۱۲ آواتار جدید.
// هر آواتار یه گرادیان دو رنگ و یه آیکون داره. همه‌چیز با CSS/Unicode ساخته شده.
// ===================================================================

const P = (c) => c + "\uFE0E"; // نمایش به‌صورت متن، نه ایموجی
const AVATAR_PRESETS = [
  { icon: P("♚"), c1: "#f6c85f", c2: "#c98a1e", kind: "piece" },
  { icon: P("♛"), c1: "#b48cf5", c2: "#6f3fc9", kind: "piece" },
  { icon: P("♜"), c1: "#6fa0ff", c2: "#2f5fd0", kind: "piece" },
  { icon: P("♝"), c1: "#4fd98a", c2: "#188a50", kind: "piece" },
  { icon: P("♞"), c1: "#ff8a7a", c2: "#d03e35", kind: "piece" },
  { icon: P("♟"), c1: "#4fe3d0", c2: "#16897d", kind: "piece" },
  { icon: P("♚"), c1: "#ffa04d", c2: "#d1560f", kind: "piece" },
  { icon: P("♛"), c1: "#ff7fbf", c2: "#c42a82", kind: "piece" },
  { icon: "🦁", c1: "#f4b860", c2: "#b9701c", kind: "emoji" },
  { icon: "🐺", c1: "#9aa7b8", c2: "#4c5a6e", kind: "emoji" },
  { icon: "🦅", c1: "#c79a6b", c2: "#7a4f2a", kind: "emoji" },
  { icon: "🐉", c1: "#6fd18a", c2: "#1d7a46", kind: "emoji" },
  { icon: "🦊", c1: "#ff9a5c", c2: "#c4521b", kind: "emoji" },
  { icon: "🐯", c1: "#ffc552", c2: "#c47a10", kind: "emoji" },
  { icon: "🦉", c1: "#b59a7a", c2: "#6a5238", kind: "emoji" },
  { icon: "🐻", c1: "#c08a5e", c2: "#7a4a26", kind: "emoji" },
  { icon: "🚀", c1: "#7fb2ff", c2: "#3a58c9", kind: "emoji" },
  { icon: "👑", c1: "#ffd76a", c2: "#c9951a", kind: "emoji" },
  { icon: "🔥", c1: "#ff8a4d", c2: "#d4331f", kind: "emoji" },
  { icon: "⚡", c1: "#ffe36a", c2: "#d0a010", kind: "emoji" },
];

function avatarHTML(index, extraClass) {
  const a = AVATAR_PRESETS[index] || AVATAR_PRESETS[0];
  return `<div class="avatar av-${a.kind} ${extraClass || ""}" style="--c1:${a.c1};--c2:${a.c2}">${a.icon}</div>`;
}

const AVATAR_KEY = "cl-player-avatar";

function getSavedAvatar() {
  const v = parseInt(CLPrefs.get(AVATAR_KEY, "0"));
  return isNaN(v) ? 0 : v;
}
function setSavedAvatar(index) {
  CLPrefs.set(AVATAR_KEY, String(index));
}

// ---------- ابزارهای مشترک نمایش ----------
// جلوگیری از اجرای HTML داخل اسم بازیکن‌ها
function escapeHTML(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// امتیاز با علامت: +۳ سبز، −۲ قرمز، ۰ خنثی
function fmtPoints(n) {
  n = Number(n) || 0;
  const cls = n > 0 ? "pts-pos" : n < 0 ? "pts-neg" : "pts-zero";
  const txt = n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0";
  return `<span class="pts ${cls}">${txt}</span>`;
}

// ۵ نتیجه‌ی آخر: W برد، D مساوی، L باخت
function formDots(form) {
  const f = form || [];
  return (
    `<span class="form">` +
    f.map((r) => `<i class="f-${r}" title="${r === "W" ? "برد" : r === "L" ? "باخت" : "مساوی"}"></i>`).join("") +
    `</span>`
  );
}

// لقب بر اساس امتیاز
function rankTitle(points) {
  if (points >= 15) return "🏆 استاد بزرگ";
  if (points >= 10) return "👑 استاد";
  if (points >= 6) return "⚔️ ماهر";
  if (points >= 3) return "📘 شاگرد";
  if (points >= 0) return "🌱 مبتدی";
  return "🧗 در حال تلاش";
}
