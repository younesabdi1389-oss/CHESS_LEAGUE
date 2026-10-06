// ===================================================================
// ۸ آواتار آماده (مهره‌های شطرنج با رنگ‌های متفاوت) — به‌جای عکس پروفایل.
// ===================================================================

const AVATAR_PRESETS = [
  { icon: "♔", color: "#f2b84b" },
  { icon: "♕", color: "#a06cf2" },
  { icon: "♖", color: "#5b8def" },
  { icon: "♗", color: "#22c55e" },
  { icon: "♘", color: "#ff6b6b" },
  { icon: "♙", color: "#2dd4bf" },
  { icon: "♚", color: "#f97316" },
  { icon: "♛", color: "#ec4899" },
];

function avatarHTML(index, extraClass) {
  const a = AVATAR_PRESETS[index] || AVATAR_PRESETS[0];
  return `<div class="avatar ${extraClass || ""}" style="background:${a.color}">${a.icon}</div>`;
}

const AVATAR_KEY = "cl-player-avatar";

function getSavedAvatar() {
  const v = parseInt(localStorage.getItem(AVATAR_KEY));
  return isNaN(v) ? 0 : v;
}
function setSavedAvatar(index) {
  localStorage.setItem(AVATAR_KEY, String(index));
}
