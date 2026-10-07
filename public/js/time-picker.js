// ===================================================================
// انتخاب‌گر تایمر مشترک (بازی محلی، آنلاین، تنظیمات):
// بدون تایمر / با تایمر + زمان دلخواه (۱ تا ۱۸۰ دقیقه) + ثانیه‌ی اضافه بعد از هر حرکت.
// انتخاب‌ها تو localStorage ذخیره می‌شن.
// ===================================================================

const TIMER_KEYS = { on: "cl-timer-pref", min: "cl-timer-min", inc: "cl-timer-inc" };

function describeTimer(minutes, inc) {
  return `${minutes} دقیقه` + (inc ? ` + ${inc} ثانیه بعد از هر حرکت` : "");
}

function createTimePicker(root, onChange) {
  const PRESETS = [1, 3, 5, 10, 15, 30];
  const INCS = [0, 2, 5, 10, 30];
  const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);

  let enabled = CLPrefs.get(TIMER_KEYS.on, "0") === "1";
  let minutes = clamp(parseInt(CLPrefs.get(TIMER_KEYS.min, "10")), 1, 180, 10);
  let inc = clamp(parseInt(CLPrefs.get(TIMER_KEYS.inc, "0")), 0, 60, 0);

  root.innerHTML = `
    <div class="timer-toggle">
      <button type="button" data-t="off">⏱️ بدون تایمر</button>
      <button type="button" data-t="on">⏱️ با تایمر</button>
    </div>
    <div class="time-config">
      <div class="tc-label">زمان هر نفر (دقیقه)</div>
      <div class="tc-chips" data-kind="min">
        ${PRESETS.map((m) => `<button type="button" data-v="${m}">${m}</button>`).join("")}
        <input type="number" inputmode="numeric" min="1" max="180" class="tc-input" placeholder="دلخواه" aria-label="زمان دلخواه به دقیقه">
      </div>
      <div class="tc-label">ثانیه‌ی اضافه بعد از هر حرکت</div>
      <div class="tc-chips" data-kind="inc">
        ${INCS.map((s) => `<button type="button" data-v="${s}">${s === 0 ? "ندارد" : "+" + s}</button>`).join("")}
      </div>
      <div class="tc-summary"></div>
    </div>`;

  const cfgBox = root.querySelector(".time-config");
  const input = root.querySelector(".tc-input");
  const summary = root.querySelector(".tc-summary");

  function paint() {
    root.querySelector('[data-t="off"]').classList.toggle("active", !enabled);
    root.querySelector('[data-t="on"]').classList.toggle("active", enabled);
    cfgBox.style.display = enabled ? "block" : "none";
    root.querySelectorAll('[data-kind="min"] button').forEach((b) => b.classList.toggle("active", +b.dataset.v === minutes));
    root.querySelectorAll('[data-kind="inc"] button').forEach((b) => b.classList.toggle("active", +b.dataset.v === inc));
    input.classList.toggle("active", !PRESETS.includes(minutes));
    if (document.activeElement !== input) input.value = PRESETS.includes(minutes) ? "" : minutes;
    summary.textContent = "⏱️ " + describeTimer(minutes, inc);
  }
  function save() {
    CLPrefs.set(TIMER_KEYS.on, enabled ? "1" : "0");
    CLPrefs.set(TIMER_KEYS.min, minutes);
    CLPrefs.set(TIMER_KEYS.inc, inc);
    paint();
    if (onChange) onChange(get());
  }
  const get = () => ({ enabled, minutes, inc });

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.t) enabled = b.dataset.t === "on";
    else if (b.parentElement.dataset.kind === "min") minutes = +b.dataset.v;
    else if (b.parentElement.dataset.kind === "inc") inc = +b.dataset.v;
    save();
  });
  input.addEventListener("input", () => {
    const v = parseInt(input.value);
    if (Number.isFinite(v) && v >= 1) {
      minutes = clamp(v, 1, 180, 10);
      CLPrefs.set(TIMER_KEYS.min, minutes);
      paint();
      if (onChange) onChange(get());
    }
  });
  input.addEventListener("blur", () => {
    if (!input.value) return;
    minutes = clamp(parseInt(input.value), 1, 180, 10);
    save();
  });

  paint();
  return { get };
}
