// ===================================================================
// موزیک پس‌زمینه‌ی ساده‌ی داشبورد — کاملاً با کد ساخته می‌شه (Web Audio)،
// فایل صوتی خارجی نداره، پس هیچ مشکل کپی‌رایتی نداره. یه ملودی آروم و
// کوتاه که در حلقه پخش می‌شه. با دکمه روشن/خاموش می‌شه، وضعیتش ذخیره می‌شه.
// ===================================================================

(function () {
  const MUSIC_KEY = "cl-music-on";
  let audioCtx = null;
  let playing = false;
  let stepTimer = null;

  // یه ملودی آروم و کوتاه (نت‌ها به هرتز) — پنتاتونیک، گوش‌نواز و تکرارشونده
  const NOTES = [392.0, 440.0, 523.25, 587.33, 659.25, 587.33, 523.25, 440.0];
  let noteIndex = 0;

  function playNote(freq) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.9);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.9);
  }

  function tick() {
    playNote(NOTES[noteIndex % NOTES.length]);
    noteIndex++;
    stepTimer = setTimeout(tick, 650);
  }

  function updateButtons() {
    document.querySelectorAll("#musicToggleBtn").forEach((btn) => {
      btn.textContent = playing ? "🔇" : "🎵";
      btn.title = playing ? "قطع موزیک" : "پخش موزیک";
    });
  }

  function startMusic() {
    if (playing) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    playing = true;
    localStorage.setItem(MUSIC_KEY, "1");
    tick();
    updateButtons();
  }

  function stopMusic() {
    playing = false;
    localStorage.setItem(MUSIC_KEY, "0");
    clearTimeout(stepTimer);
    updateButtons();
  }

  function toggleMusic() {
    if (playing) stopMusic();
    else startMusic();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("#musicToggleBtn").forEach((btn) => {
      btn.addEventListener("click", toggleMusic);
    });
    updateButtons();
    // توجه: مرورگرها صدا رو بدون یه کلیک کاربر پخش نمی‌کنن، پس خودکار شروع نمی‌شه
    // حتی اگه قبلاً روشن بوده — کاربر باید یه‌بار دکمه رو بزنه.
  });
})();
