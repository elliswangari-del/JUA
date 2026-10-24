(function () {
  var form = document.getElementById("checker-form");
  var input = document.getElementById("message-text");
  var result = document.getElementById("checker-result");
  if (!form || !input || !result) return;

  var rules = [
    { label: "Urgency or pressure", pattern: /\b(urgent|immediately|act now|final warning|limited time|within \d+ (hours?|minutes?)|account (will be )?suspended|haraka|sasa hivi)\b/i },
    { label: "A link that deserves independent checking", pattern: /https?:\/\/|www\.|\b(bit\.ly|tinyurl\.com|t\.co|cutt\.ly)\b/i },
    { label: "Impersonation or account-verification language", pattern: /\b(safaricom|m-?pesa|bank|kra|e?citizen|delivery|police|support team|customer care)\b.{0,70}\b(verify|confirm|update|unlock|suspend|claim|account|payment)\b|\b(verify|confirm|update|unlock|suspend|claim|account|payment)\b.{0,70}\b(safaricom|m-?pesa|bank|kra|e?citizen|delivery|police|support team|customer care)\b/i },
    { label: "A request for a PIN, password, or one-time code", pattern: /\b(pin|password|passcode|one[- ]time (code|password)|otp|verification code|login details|security code)\b/i },
    { label: "An advance or upfront payment request", pattern: /\b(upfront|advance|registration|processing|activation|clearance|training) fee\b|\b(pay|send|deposit)\b.{0,45}\b(before|to unlock|to release|to get the job|to receive)\b/i }
  ];

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = input.value.trim();
    result.replaceChildren();
    result.hidden = false;

    if (!text) {
      result.dataset.level = "few";
      var emptyTitle = document.createElement("h3");
      emptyTitle.textContent = "Add a message to review";
      result.appendChild(emptyTitle);
      var emptyCopy = document.createElement("p");
      emptyCopy.textContent = "Paste text after removing personal information, then analyse it.";
      result.appendChild(emptyCopy);
      input.focus();
      return;
    }

    var matches = rules.filter(function (rule) { return rule.pattern.test(text); });
    var level = matches.length >= 3 ? "several" : matches.length ? "few" : "few";
    result.dataset.level = level;

    var heading = document.createElement("h3");
    heading.textContent = matches.length >= 3 ? "Several warning signs found" : matches.length ? "Some warning signs found" : "Few common warning signs found";
    result.appendChild(heading);
    var summary = document.createElement("p");
    summary.textContent = matches.length
      ? "This message contains " + matches.length + " pattern(s) worth checking. This is not proof that it is fraudulent."
      : "These simple rules did not find common patterns. That does not prove the message is safe.";
    result.appendChild(summary);

    if (matches.length) {
      var list = document.createElement("ul");
      matches.forEach(function (match) {
        var item = document.createElement("li");
        item.textContent = match.label;
        list.appendChild(item);
      });
      result.appendChild(list);
    }
    var limitation = document.createElement("p");
    limitation.textContent = "Rule-based demonstration only: Jua does not verify the sender, inspect a link, or use AI. Verify through a trusted channel you find independently.";
    result.appendChild(limitation);
  });
})();
