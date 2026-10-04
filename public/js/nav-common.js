// ===================================================================
// رفتار مشترک بین همه‌ی صفحات داشبورد: باز/بسته‌شدن منوی کناری موبایل.
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  if (!sidebar || !overlay || !hamburgerBtn) return;

  hamburgerBtn.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("show");
  });
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  });
});
