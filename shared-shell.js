(function () {
  "use strict";
  var labels = [
    ["index.html", "Dashboard"], ["checker.html", "Message Checker"], ["quiz.html", "Quiz"],
    ["learn.html", "Learn"], ["osint.html", "OSINT Tools"], ["report.html", "Report a Scam"],
    ["my-reports.html", "My Reports"], ["help.html", "Get Help"], ["account.html", "My Account"], ["settings.html", "Settings"]
  ];
  var path = location.pathname.split("/").pop() || "index.html";
  document.body.dataset.page = path.replace(/\.html$/, "");
  var title = path === "assistant.html" ? "AI Cyber Safety Assistant" : path === "review.html" ? "Report Review" : ((labels.find(function (entry) { return entry[0] === path; }) || ["", "Dashboard"])[1]);
  var header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = '<nav class="site-nav" aria-label="Main navigation"><a class="brand" href="index.html" aria-label="Jua dashboard"><span class="brand-mark" aria-hidden="true">✳</span><span class="brand-name">Jua</span></a><div class="nav-links" id="primary-links"></div><button class="mobile-menu-toggle" id="mobile-menu-toggle" type="button" aria-label="Open navigation menu" aria-controls="primary-links" aria-expanded="false"><span></span><span></span></button></nav>';
  var nav = header.querySelector("#primary-links");
  labels.forEach(function (entry) {
    var link = document.createElement("a"); link.href = entry[0]; link.textContent = entry[1];
    if (path === entry[0]) link.setAttribute("aria-current", "page");
    nav.appendChild(link);
  });
  var reviewLink = document.createElement("a"); reviewLink.href = "review.html"; reviewLink.textContent = "Report Review"; reviewLink.hidden = true; reviewLink.dataset.reviewNav = "true"; nav.appendChild(reviewLink);
  var assistant = document.createElement("a"); assistant.href = "assistant.html"; assistant.className = "nav-cta"; assistant.textContent = "Open assistant ↗"; nav.appendChild(assistant);
  document.body.prepend(header);
  var main = document.querySelector("main");
  if (main) {
    main.classList.add("page-content");
    var topbar = document.createElement("div"); topbar.className = "app-topbar";
    topbar.innerHTML = '<span class="app-page-title"></span><span class="app-account-shortcut">Digital safety, made practical</span>';
    topbar.querySelector(".app-page-title").textContent = title;
    main.prepend(topbar);
  }
  var toggle = header.querySelector("#mobile-menu-toggle");
  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") === "true";
    nav.classList.toggle("is-open", !open); toggle.setAttribute("aria-expanded", String(!open));
    toggle.setAttribute("aria-label", open ? "Open navigation menu" : "Close navigation menu");
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); toggle.focus();
    }
  });
})();
