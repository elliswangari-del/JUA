(function () {
  var dashboard = document.getElementById("dashboard-view");
  var assistant = document.getElementById("assistant-view");
  var backButton = document.getElementById("back-dashboard");
  var openButtons = document.querySelectorAll("[data-open-assistant]");
  var menuButton = document.getElementById("mobile-menu-toggle");
  var primaryLinks = document.getElementById("primary-links");

  function closeMobileMenu(returnFocus) {
    if (!menuButton || !primaryLinks) return;
    primaryLinks.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation menu");
    if (returnFocus) menuButton.focus();
  }

  function showAssistant() {
    dashboard.hidden = true;
    assistant.hidden = false;
    document.body.classList.add("assistant-mode");
    window.scrollTo({ top: 0, behavior: "auto" });
    document.title = "Jua | AI Cyber Safety Assistant";
  }

  function showDashboard(scrollToTop) {
    assistant.hidden = true;
    dashboard.hidden = false;
    document.body.classList.remove("assistant-mode");
    if (scrollToTop) window.scrollTo({ top: 0, behavior: "auto" });
    document.title = "Jua | Your Digital Safety Hub";
  }

  openButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      if (window.location.hash !== "#assistant") {
        window.history.pushState({ juaRoute: "assistant" }, "", "#assistant");
      }
      showAssistant();
    });
  });

  if (menuButton && primaryLinks) {
    menuButton.addEventListener("click", function () {
      var isOpen = menuButton.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        closeMobileMenu(false);
      } else {
        primaryLinks.classList.add("is-open");
        menuButton.setAttribute("aria-expanded", "true");
        menuButton.setAttribute("aria-label", "Close navigation menu");
      }
    });
    primaryLinks.querySelectorAll("a, button").forEach(function (item) {
      item.addEventListener("click", function () { closeMobileMenu(false); });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") closeMobileMenu(true);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 620) closeMobileMenu(false);
    });
  }

  backButton.addEventListener("click", function () {
    if (window.history.state && window.history.state.juaRoute === "assistant") {
      window.history.back();
    } else {
      window.history.replaceState({ juaRoute: "dashboard" }, "", "#dashboard");
      showDashboard();
    }
  });

  // The browser back and forward buttons switch between the dashboard and assistant views.
  window.addEventListener("popstate", function () {
    if (window.location.hash === "#assistant") showAssistant();
    else showDashboard();
  });

  // The Jua logo in the assistant header returns to the dashboard as well.
  document.querySelectorAll('a[href="#dashboard"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (!assistant.hidden) {
        event.preventDefault();
        backButton.click();
      }
    });
  });

  if (window.location.hash === "#assistant") showAssistant();
  else showDashboard(false);

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Reveal content gently, while leaving it visible if motion or observer APIs are unavailable.
  var revealItems = document.querySelectorAll(".reveal");
  if (!window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (item) { item.classList.add("is-visible"); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });
    revealItems.forEach(function (item) { observer.observe(item); });
  }

  // The report form is intentionally local-only until secure review infrastructure exists.
  var reportForm = document.getElementById("report-form");
  if (reportForm) {
    reportForm.addEventListener("submit", function (event) {
      event.preventDefault();
      document.getElementById("report-message").textContent =
        "Prototype only: this report was not sent, saved, or published. A secure backend and moderation are needed before real submissions.";
      reportForm.reset();
    });
  }
})();
