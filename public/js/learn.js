// ===================================================================
// موتور صفحه‌ی آموزش: بین دو مجموعه درس (مقدماتی/حرفه‌ای) سوییچ می‌کنه،
// درس‌ها رو یکی‌یکی نشون می‌ده، و با دکمه یا کلید Enter جلو می‌ره.
// ===================================================================

const LEARN_KEY = "cl-learn";
let currentSet = LESSONS_BASIC;
let currentIndex = 0;
(function restoreProgress() {
  // آخرین بخش و درسی که کاربر دیده رو برمی‌گردونیم
  try {
    const saved = JSON.parse(CLPrefs.get(LEARN_KEY, "null"));
    if (saved && saved.set === "pro") currentSet = LESSONS_PRO;
    if (saved && Number.isInteger(saved.i) && saved.i >= 0 && saved.i < currentSet.length) currentIndex = saved.i;
  } catch (e) {}
})();
function saveProgress() {
  CLPrefs.set(LEARN_KEY, JSON.stringify({ set: currentSet === LESSONS_PRO ? "pro" : "basic", i: currentIndex }));
}
let lessonRenderer = null;

const tabBasic = document.getElementById("tabBasic");
const tabPro = document.getElementById("tabPro");

function showLesson() {
  const lesson = currentSet[currentIndex];
  document.getElementById("lessonTitle").textContent = lesson.title;
  document.getElementById("lessonText").textContent = lesson.text;
  document.getElementById("lessonProgress").textContent = `درس ${currentIndex + 1} از ${currentSet.length}`;

  const boardBox = document.getElementById("lessonBoard");
  if (lesson.fen) {
    boardBox.style.display = "block";
    boardBox.innerHTML = "";
    const g = new Chess(lesson.fen);
    lessonRenderer = createBoardRenderer(boardBox, { flip: false, onSquareClick: () => {} });
    lessonRenderer.renderBoard(g.board(), {});
  } else {
    boardBox.style.display = "none";
    boardBox.innerHTML = "";
  }

  document.getElementById("prevBtn").disabled = currentIndex === 0;
  const last = currentIndex === currentSet.length - 1;
  document.getElementById("nextBtn").textContent = last ? "پایان ✓" : "بعدی →";
  document.getElementById("lessonDone").style.display = last ? "block" : "none";
  tabBasic.classList.toggle("active", currentSet === LESSONS_BASIC);
  tabPro.classList.toggle("active", currentSet === LESSONS_PRO);
  saveProgress();
}

function goNext() {
  if (currentIndex < currentSet.length - 1) {
    currentIndex++;
    showLesson();
  }
}
function goPrev() {
  if (currentIndex > 0) {
    currentIndex--;
    showLesson();
  }
}

document.getElementById("nextBtn").addEventListener("click", goNext);
document.getElementById("prevBtn").addEventListener("click", goPrev);

document.addEventListener("keydown", (e) => {
  if (e.target && /^(INPUT|TEXTAREA|BUTTON|A)$/.test(e.target.tagName)) return;
  if (e.key === "Enter") {
    e.preventDefault();
    goNext();
  } else if (e.key === "ArrowRight") {
    goPrev(); // راست = قبلی (چون صفحه راست‌به‌چپه)
  } else if (e.key === "ArrowLeft") {
    goNext();
  }
});

tabBasic.addEventListener("click", () => {
  currentSet = LESSONS_BASIC;
  currentIndex = 0;
  tabBasic.classList.add("active");
  tabPro.classList.remove("active");
  showLesson();
});
tabPro.addEventListener("click", () => {
  currentSet = LESSONS_PRO;
  currentIndex = 0;
  tabPro.classList.add("active");
  tabBasic.classList.remove("active");
  showLesson();
});

showLesson();
