(function () {
  "use strict";

  var form = document.getElementById("report-form");
  var message = document.getElementById("report-message");
  if (!form || !message) return;

  var allowedTypes = ["mobile_money", "phishing", "fake_job", "online_shop", "investment_impersonation", "other"];
  var sending = false;
  var idleButtonText = form.querySelector('button[type="submit"]').textContent;

  function showMessage(text, kind) {
    message.textContent = text;
    message.dataset.kind = kind;
  }

  function getConfig() {
    return window.JUA_SUPABASE_READY || Promise.resolve(null);
  }

  function setSending(value) {
    sending = value;
    var button = form.querySelector('button[type="submit"]');
    button.disabled = value;
    button.textContent = value ? "Submitting…" : idleButtonText;
    form.setAttribute("aria-busy", value ? "true" : "false");
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (sending) return;

    var type = document.getElementById("report-type").value;
    var description = document.getElementById("report-description").value.trim();
    var details = document.getElementById("report-details").value.trim();
    if (!allowedTypes.includes(type)) {
      showMessage("Choose a scam type from the list.", "error");
      document.getElementById("report-type").focus();
      return;
    }
    if (description.length < 20 || description.length > 1200) {
      showMessage("Describe what happened in 20 to 1,200 characters, without personal or account details.", "error");
      document.getElementById("report-description").focus();
      return;
    }
    if (details.length > 600) {
      showMessage("Optional context must be 600 characters or fewer.", "error");
      document.getElementById("report-details").focus();
      return;
    }

    setSending(true);
    showMessage("Submitting your report…", "loading");
    try {
      var client = await getConfig();
      if (!client) throw new Error("Report submission is not configured yet. Add the Jua Supabase project URL and publishable key to supabase-config.js.");
      var session = await client.auth.getSession();
      if (session.error) throw session.error;
      var user = session.data && session.data.session && session.data.session.user;
      if (!user) {
        throw new Error("Please log in before submitting a scam report.");
      }

      var readableType = type.replace(/_/g, " ");
      var fullDescription = details
        ? description + "\\n\\nAdditional details: " + details
        : description;

      var payload = {
        reporter_id: user.id,
        scam_type: type,
        title: readableType + " scam report",
        description: fullDescription
      };

      var result = await client.from("scam_reports").insert(payload);
      if (result.error) {
        if (result.error.code === "PGRST205" || result.error.code === "42P01") {
          throw new Error("The scam_reports table or Data API endpoint was not found. Apply the Supabase migration and check Data API exposure.");
        }
        if (result.error.code === "42501") {
          throw new Error("Supabase rejected this submission. Check the project key, table grants, and Row Level Security policies.");
        }
        if (/network|fetch/i.test(result.error.message || "")) {
          throw new Error("Could not reach Supabase. Check your internet connection and project configuration.");
        }
        throw result.error;
      }

      showMessage("Thank you. Supabase confirmed that your report was saved for review.", "success");
      form.reset();
    } catch (error) {
      showMessage(error && error.message ? error.message : "The report could not be submitted. Please try again.", "error");
    } finally {
      setSending(false);
    }
  });
})();
