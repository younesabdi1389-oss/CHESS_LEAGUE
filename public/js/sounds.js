// ===================================================================
// صداهای بازی (حرکت، گرفتن مهره، کیش، پایان بازی، اتمام زمان، پیام چت)
// کاملاً با Web Audio ساخته می‌شن؛ فایل صوتی یا کتابخونه‌ی خارجی نداریم.
// وضعیت روشن/خاموش با کلید cl-sound ذخیره می‌شه.
// ===================================================================

const SOUND_KEY = "cl-sound";
let _sfxCtx = null;
let _lastSfxAt = 0;

function isSoundOn() {
  return (window.CLPrefs ? CLPrefs.get(SOUND_KEY, "1") : "1") !== "0";
}

function setSoundOn(on) {
  if (window.CLPrefs) CLPrefs.set(SOUND_KEY, on ? "1" : "0");
  document.querySelectorAll("[data-sound-toggle]").forEach(updateSoundButton);
}

function updateSoundButton(btn) {
  const on = isSoundOn();
  btn.textContent = on ? "🔊 صدا روشن" : "🔇 صدا خاموش";
  btn.setAttribute("aria-pressed", on ? "true" : "false");
}

function initSoundToggles() {
  document.querySelectorAll("[data-sound-toggle]").forEach((btn) => {
    updateSoundButton(btn);
    btn.addEventListener("click", () => {
      setSoundOn(!isSoundOn());
      if (isSoundOn()) playMoveSound(true);
    });
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSoundToggles);
else initSoundToggles();

function _ctx() {
  if (!_sfxCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _sfxCtx = new AC();
  }
  if (_sfxCtx.state === "suspended") _sfxCtx.resume().catch(() => {});
  return _sfxCtx;
}

function _tone(freq, duration, type, gainValue, delay) {
  if (!isSoundOn()) return;
  const ctx = _ctx();
  if (!ctx) return;
  const t0 = ctx.currentTime + (delay || 0) / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "triangle";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue || 0.09, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

// جلوگیری از انباشته شدن صدا اگه چند رویداد پشت‌سرهم بیاد
function _throttle(minGap) {
  const now = Date.now();
  if (now - _lastSfxAt < minGap) return false;
  _lastSfxAt = now;
  return true;
}

function playMoveSound(force) {
  if (!force && !_throttle(60)) return;
  _tone(320, 0.07, "triangle", 0.1);
  _tone(220, 0.09, "sine", 0.06, 30);
}
function playCaptureSound() {
  if (!_throttle(60)) return;
  _tone(190, 0.1, "square", 0.08);
  _tone(130, 0.14, "square", 0.07, 40);
}
function playCheckSound() {
  _tone(660, 0.12, "sine", 0.08);
  _tone(880, 0.16, "sine", 0.08, 110);
}
function playFlagSound() {
  _tone(220, 0.2, "sawtooth", 0.08);
  _tone(160, 0.3, "sawtooth", 0.08, 180);
  _tone(100, 0.4, "sawtooth", 0.08, 380);
}
function playCheckmateSound() {
  [523, 659, 784].forEach((f, i) => _tone(f, 0.3, "sine", 0.08, i * 150));
}
function playMessageSound() {
  _tone(740, 0.08, "sine", 0.05);
}
