// ===================================================================
// مدیریت حالت روز/شب (Light/Dark) برای کل سایت.
// انتخاب کاربر توی localStorage ذخیره می‌شه تا در بازدیدهای بعدی حفظ بشه.
// این فایل باید تو <head> یا همون اول <body> همه‌ی صفحات لود بشه.
// ===================================================================

(function () {
  const STORAGE_KEY = "cl-theme";
  const saved = localStorage.getItem(STORAGE_KEY) || "dark";
  document.documentElement.setAttribute("data-theme", saved);

  function updateIcon() {
    const btn = document.getElementById("themeToggleBtn");
    if (!btn) return;
    const current = document.documentElement.getAttribute("data-theme");
    btn.textContent = current === "dark" ? "🌙" : "☀️";
    btn.title = current === "dark" ? "رفتن به حالت روشن" : "رفتن به حالت تاریک";
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
    updateIcon();
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateIcon();
    const btn = document.getElementById("themeToggleBtn");
    if (btn) btn.addEventListener("click", toggleTheme);
  });
})();
