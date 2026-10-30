(function () {
  "use strict";
  var count = document.getElementById("quiz-completions");
  if (count) count.textContent = window.localStorage.getItem("jua.quizRoundsCompleted") || "0";
  var items = document.querySelectorAll(".reveal");
  if (!window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    items.forEach(function (item) { item.classList.add("is-visible"); });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } });
  }, { threshold: 0.12 });
  items.forEach(function (item) { observer.observe(item); });
})();
