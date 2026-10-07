// ===================================================================
// منوی مشترک همه‌ی صفحات: منوی کشویی (Drawer) + نوار پایین موبایل.
// - دسکتاپ (صفحه‌های داشبورد): منو ثابت کنار صفحه نشسته.
// - موبایل / صفحه‌های بازی: منو از سمت راست کشویی باز می‌شه
//   (از دکمه‌ی «منو»، یا کشیدن از لبه‌ی راست صفحه، بستن با Esc/لمس بیرون/کشیدن).
// هیچ دکمه‌ی همبرگری وجود نداره.
// ===================================================================

(function () {
  const svg = (p) =>
    `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

  const ICONS = {
    home: svg('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
    play: svg('<circle cx="12" cy="6.5" r="3"/><path d="M10.5 9.5L9.5 14h5l-1-4.5M8 14h8M7 21h10M9 21l.5-7M15 21l-.5-7"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
    book: svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>'),
    trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 21h8M10 17h4"/>'),
    chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
    menu: svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  };

  const NAV_ITEMS = [
    { href: "index.html", icon: "home", label: "خانه" },
    { href: "game.html", icon: "play", label: "بازی (محلی / با بات)" },
    { href: "online.html", icon: "globe", label: "بازی آنلاین (زنده)" },
    { href: "learn.html", icon: "book", label: "آموزش شطرنج" },
    { href: "league.html", icon: "trophy", label: "لیگ ۴ نفره" },
    { href: "leaderboard.html", icon: "chart", label: "جدول امتیازات" },
    { href: "history.html", icon: "history", label: "تاریخچه بازی‌ها" },
    { href: "profile.html", icon: "user", label: "پروفایل" },
    { href: "settings.html", icon: "gear", label: "تنظیمات" },
    { href: "about.html", icon: "info", label: "درباره‌ی ما" },
  ];

  const BOTTOM_ITEMS = [
    { href: "index.html", icon: "home", label: "خانه" },
    { href: "game.html", icon: "play", label: "بازی" },
    { href: "online.html", icon: "globe", label: "آنلاین" },
    { href: "learn.html", icon: "book", label: "آموزش" },
    { href: "league.html", icon: "trophy", label: "لیگ" },
    { href: "profile.html", icon: "user", label: "من" },
  ];

  const current = location.pathname.split("/").pop() || "index.html";
  const isGamePage = document.body.classList.contains("game-body");

  function build() {
    // اگه صفحه هنوز منوی استاتیک قدیمی داشت، حذفش کن تا دوتا نشه
    document.querySelectorAll("#sidebar, #overlay, .hamburger").forEach((el) => el.remove());

    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = "overlay";

    const drawer = document.createElement("aside");
    drawer.className = "sidebar";
    drawer.id = "sidebar";
    drawer.setAttribute("aria-label", "منوی اصلی");
    drawer.innerHTML = `
      <div class="brand"><div class="ic">♞</div><span>Chess League</span></div>
      <nav class="nav">
        ${NAV_ITEMS.map(
          (it) => `<a href="${it.href}" class="${current === it.href ? "active" : ""}">${ICONS[it.icon]}<span>${it.label}</span></a>`
        ).join("")}
      </nav>`;

    document.body.prepend(drawer);
    document.body.appendChild(overlay);

    // دکمه‌ی سه‌خطی (همبرگری) تو هدر هر صفحه، سمت راست
    const header = document.querySelector(".topbar") || document.querySelector(".top-row");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hamburger";
    btn.setAttribute("aria-label", "باز کردن منو");
    btn.innerHTML = "<span></span><span></span><span></span>";
    btn.addEventListener("click", open);
    if (header && header.firstElementChild) {
      const wrap = document.createElement("div");
      wrap.className = "hdr-start";
      header.insertBefore(wrap, header.firstElementChild);
      wrap.append(btn, wrap.nextElementSibling);
    } else {
      btn.classList.add("floating");
      document.body.appendChild(btn);
    }

    // نوار پایین موبایل
    const nav = document.createElement("nav");
    nav.className = "bottom-nav";
    nav.innerHTML =
      BOTTOM_ITEMS.map(
        (it) =>
          `<a href="${it.href}" class="${current === it.href ? "active" : ""}"><span class="bn-icon">${ICONS[it.icon]}</span><span class="bn-label">${it.label}</span></a>`
      ).join("");
    document.body.appendChild(nav);

    overlay.addEventListener("click", close);
    drawer.addEventListener("click", (e) => {
      if (e.target.closest("a")) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    // کشیدن از لبه‌ی راست = باز شدن، کشیدن منو به راست = بسته شدن
    let sx = null, sy = 0, mode = null;
    document.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches[0];
        sx = t.clientX;
        sy = t.clientY;
        if (drawer.classList.contains("open")) mode = "close";
        else if (sx > window.innerWidth - 22) mode = "open";
        else mode = null;
      },
      { passive: true }
    );
    document.addEventListener(
      "touchend",
      (e) => {
        if (sx === null || !mode) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx;
        const dy = Math.abs(t.clientY - sy);
        if (dy < 60) {
          if (mode === "open" && dx < -50) open();
          if (mode === "close" && dx > 50) close();
        }
        sx = null;
        mode = null;
      },
      { passive: true }
    );
  }

  function open() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("overlay").classList.add("show");
  }
  function close() {
    const d = document.getElementById("sidebar");
    const o = document.getElementById("overlay");
    if (d) d.classList.remove("open");
    if (o) o.classList.remove("show");
  }

  if (document.body) build();
  else document.addEventListener("DOMContentLoaded", build);
})();
