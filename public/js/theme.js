// ===================================================================
// تم روز/شب + ذخیره‌ی امن تنظیمات (CLPrefs) برای کل سایت.
// این فایل باید اولین اسکریپت هر صفحه باشه.
// ===================================================================

window.CLPrefs = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (e) {
      /* حالت خصوصی مرورگر؛ مشکلی نیست */
    }
  },
};

(function () {
  const STORAGE_KEY = "cl-theme";
  document.documentElement.setAttribute("data-theme", CLPrefs.get(STORAGE_KEY, "dark"));

  function updateIcon() {
    const btn = document.getElementById("themeToggleBtn");
    if (!btn) return;
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    btn.textContent = dark ? "🌙" : "☀️";
    btn.title = dark ? "رفتن به حالت روشن" : "رفتن به حالت تاریک";
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    CLPrefs.set(STORAGE_KEY, next);
    updateIcon();
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateIcon();
    const btn = document.getElementById("themeToggleBtn");
    if (btn) btn.addEventListener("click", toggleTheme);
  });
})();
