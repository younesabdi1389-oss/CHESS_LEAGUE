// ===================================================================
// ساعت شطرنج (۱۰ دقیقه برای هر نفر) — بدون Drift.
// به‌جای کم‌کردن ۱ از شمارنده در هر tick، زمان واقعی گذشته با
// performance.now() حساب می‌شه؛ پس لگ یا tab پس‌زمینه ساعت رو خراب نمی‌کنه.
// ===================================================================

const CLOCK_START_SECONDS = 600; // ۱۰ دقیقه

function formatClock(seconds) {
  seconds = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// کنترل یک ساعت «نمایشی» که از روی زمان باقی‌مونده‌ی هر رنگ + رنگِ فعال
// خودش رو هر ۲۵۰ms آپدیت می‌کنه. هم محلی هم آنلاین ازش استفاده می‌کنن.
function createClockDisplay(clockEls) {
  let base = { w: CLOCK_START_SECONDS * 1000, b: CLOCK_START_SECONDS * 1000 };
  let running = null;
  let startedAt = 0;
  let timer = null;
  let lastShown = { w: "", b: "" };
  let lastFlags = "";

  function remaining(color) {
    let ms = base[color];
    if (running === color) ms -= performance.now() - startedAt;
    return Math.max(0, ms);
  }

  function paint() {
    const wMs = remaining("w");
    const bMs = remaining("b");
    const wTxt = formatClock(wMs / 1000);
    const bTxt = formatClock(bMs / 1000);
    // فقط عدد رو عوض می‌کنیم (بدون پاک‌کردن برچسب «سفید/سیاه»)
    if (wTxt !== lastShown.w) {
      setClockText(clockEls.w, wTxt);
      lastShown.w = wTxt;
    }
    if (bTxt !== lastShown.b) {
      setClockText(clockEls.b, bTxt);
      lastShown.b = bTxt;
    }
    const flags = `${running}|${wMs <= 30000}|${bMs <= 30000}`;
    if (flags !== lastFlags) {
      lastFlags = flags;
      clockEls.w.classList.toggle("clock-active", running === "w");
      clockEls.b.classList.toggle("clock-active", running === "b");
      clockEls.w.classList.toggle("clock-low", wMs <= 30000);
      clockEls.b.classList.toggle("clock-low", bMs <= 30000);
    }
    return { w: wMs, b: bMs };
  }

  function setClockText(el, txt) {
    const node = el.firstChild;
    if (node && node.nodeType === 3) node.nodeValue = txt;
    else el.insertBefore(document.createTextNode(txt), el.firstChild);
  }

  function ensureTimer(onTick) {
    if (timer) return;
    timer = setInterval(() => {
      const r = paint();
      if (onTick) onTick(r);
    }, 250);
  }

  return {
    // زمان باقی‌مونده (میلی‌ثانیه) و رنگ فعال رو ست کن؛ running=null یعنی متوقف
    set(timeLeftMs, activeColor, onTick) {
      base = { w: timeLeftMs.w, b: timeLeftMs.b };
      running = activeColor || null;
      startedAt = performance.now();
      lastFlags = "";
      if (running) ensureTimer(onTick);
      else this.stopTimer();
      paint();
    },
    stopTimer() {
      clearInterval(timer);
      timer = null;
    },
    remaining,
    paint,
  };
}

// ساعت بازی محلی (دو نفره / بات): خودش رنگ فعال رو نگه می‌داره.
function createLocalClock(clockEls, onFlag, cfg) {
  const display = createClockDisplay(clockEls);
  cfg = cfg || {};
  let inc = (cfg.inc || 0) * 1000; // ثانیه‌ی اضافه بعد از هر حرکت
  let startMs = (cfg.minutes || 10) * 60 * 1000;
  let time = { w: startMs, b: startMs };
  let running = null;
  let startedAt = 0;
  let flagged = false;

  function checkFlag(r) {
    if (!running || flagged) return;
    if (r[running] <= 0) {
      const loser = running;
      flagged = true;
      time[loser] = 0;
      running = null;
      display.set(time, null);
      onFlag(loser);
    }
  }

  function commit() {
    if (running) {
      time[running] = Math.max(0, time[running] - (performance.now() - startedAt));
    }
  }

  function start(color) {
    if (flagged) return;
    const prev = running;
    commit();
    if (prev && prev !== color) time[prev] += inc; // جایزه‌ی زمانی بعد از حرکت
    running = color;
    startedAt = performance.now();
    display.set(time, running, checkFlag);
  }

  function stop() {
    commit();
    running = null;
    display.set(time, null);
  }

  function reset(minutes, increment) {
    if (minutes) startMs = minutes * 60 * 1000;
    if (increment !== undefined) inc = increment * 1000;
    running = null;
    flagged = false;
    time = { w: startMs, b: startMs };
    display.set(time, null);
  }

  display.set(time, null);
  return { start, switchTurn: start, stop, reset };
}
