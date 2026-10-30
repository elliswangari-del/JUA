(function () {
  "use strict";

  var message = document.getElementById("account-message");
  var authForms = document.getElementById("account-auth-forms");
  var accountDashboard = document.getElementById("account-dashboard");
  var roleNameLabels = {
    moderator: "Moderator",
    analyst: "Scam analyst",
    platform_admin: "Platform administrator"
  };
  var reportLabels = {
    mobile_money: "Mobile money",
    phishing: "Phishing message",
    fake_job: "Fake job or advance fee",
    online_shop: "Online shop or marketplace",
    investment_impersonation: "Investment or impersonation",
    other: "Other"
  };
  var supabase = null;
  var currentUser = null;
  var renderVersion = 0;

  function showMessage(element, text, kind) {
    if (!element) return;
    element.textContent = text;
    element.dataset.kind = kind || "";
  }

  function pageMessage(text, kind) {
    showMessage(message, text, kind);
  }

  function safeError(error, fallback) {
    var messageText = error && typeof error.message === "string" ? error.message : "";
    if (/email not confirmed/i.test(messageText)) return "Confirm your email using the link we sent before logging in.";
    if (/invalid login credentials/i.test(messageText)) return "The email or password was not accepted.";
    if (/password should be at least/i.test(messageText)) return "Use a longer password that meets the requirements shown by Supabase.";
    if (/user already registered/i.test(messageText)) return "If this address can be registered, Supabase will send a confirmation email.";
    return messageText || fallback;
  }

  function setBusy(form, busy, label) {
    var button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? label : button.dataset.idleLabel;
    form.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function emailRedirectUrl() {
    return window.location.origin + window.location.pathname + "#account";
  }

  function currentUserMessage(text, kind) {
    var target = document.getElementById("account-message");
    showMessage(target, text, kind);
  }

  function textNode(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function reportTypeLabel(type) {
    return reportLabels[type] || "Scam report";
  }

  function formatDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
  }

  function buildReportCard(report, moderator) {
    var card = document.createElement("article");
    card.className = "account-report";
    var heading = document.createElement("div");
    heading.className = "account-report-heading";
    heading.append(
      textNode("strong", "", report.title || reportTypeLabel(report.scam_type)),
      textNode("span", "", "Status: " + report.status)
    );
    card.appendChild(heading);
    card.appendChild(textNode("p", "", report.description));
    
    card.appendChild(textNode("time", "", formatDate(report.created_at)));

    if (moderator && (report.status === "pending" || report.status === "under_review")) {
      var controls = document.createElement("div");
      controls.className = "account-review-controls";
      var select = document.createElement("select");
      select.setAttribute("aria-label", "New report status");
      [
        ["confirmed", "Confirm scam"],
        ["rejected", "Reject report"],
        ["needs_more_information", "Needs more information"]
      ].forEach(function (decision) {
        var option = document.createElement("option");
        option.value = decision[0];
        option.textContent = decision[1];
        select.appendChild(option);
      });
      var button = document.createElement("button");
      button.type = "button";
      button.className = "button-secondary";
      button.textContent = "Record review";
      button.addEventListener("click", function () {
        updateReportStatus(report.id, select.value, button);
      });
      controls.append(select, button);
      card.appendChild(controls);
    }
    return card;
  }

  async function loadOwnedReports(user, version) {
    var container = document.getElementById("my-reports-list");
    container.replaceChildren(textNode("p", "account-muted", "Loading your reports…"));
    var result = await supabase
      .from("scam_reports")
      .select("id, scam_type, title, description, status, created_at")
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (version !== renderVersion) return;
    container.replaceChildren();
    if (result.error) {
      container.appendChild(textNode("p", "account-muted", "Reports error: " + result.error.message + " (" + result.error.code + ")"));
      return;
    }
    if (!result.data || result.data.length === 0) {
      container.appendChild(textNode("p", "account-muted", "No reports are linked to this account."));
      return;
    }
    result.data.forEach(function (report) { container.appendChild(buildReportCard(report, false)); });
  }

  function addRolePlaceholder(container, title, detail) {
    var item = document.createElement("div");
    item.className = "role-placeholder";
    item.append(textNode("strong", "", title + ": "), document.createTextNode(detail));
    container.appendChild(item);
  }

  async function loadRoleAreas(user, version) {
    var area = document.getElementById("account-role-area");
    var summary = document.getElementById("account-role-summary");
    var placeholders = document.getElementById("role-placeholder-list");
    var moderatorWorkspace = document.getElementById("moderator-workspace");
    area.hidden = true;
    moderatorWorkspace.hidden = true;
    placeholders.replaceChildren();

    var rolesResult = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (version !== renderVersion) return;
    if (rolesResult.error) {
      area.hidden = false;
      summary.textContent = "Role query error: " + rolesResult.error.message + " (" + rolesResult.error.code + "). Privileged workspaces remain hidden.";
      addRolePlaceholder(placeholders, "Access unavailable", "Check the database migration and RLS grants. This message does not change backend permissions.");
      return;
    }

    var roles = (rolesResult.data || []).map(function (row) { return row.role; });
    var membershipsResult = await supabase
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("user_id", user.id);
    if (version !== renderVersion) return;
    var memberships = membershipsResult.error ? [] : membershipsResult.data || [];
    if (!roles.length && !memberships.length && !membershipsResult.error) return;

    area.hidden = false;
    area.dataset.authorized = String(roles.includes("admin") || roles.includes("analyst"));
    document.querySelectorAll("[data-review-nav]").forEach(function (link) {
      link.hidden = !(roles.includes("admin") || roles.includes("analyst"));
    });
    summary.textContent = roles.length
      ? "Backend-assigned roles for this account: " + roles.map(function (role) { return roleNameLabels[role] || role; }).join(", ") + "."
      : membershipsResult.error ? "Your organization membership information could not be loaded; organization tools remain hidden." : "This account has organization-scoped access only.";

    roles.forEach(function (role) {
      if (role === "admin" || role === "analyst") {
        moderatorWorkspace.hidden = false;
      }
      if (role === "analyst") {
        addRolePlaceholder(placeholders, "Scam analyst", "Investigation tools are not implemented yet. The backend limits this role to reports assigned to the analyst's organization; this interface does not show investigation records.");
      } else if (role === "admin") {
        addRolePlaceholder(placeholders, "Platform administrator", "The administration interface is not implemented. No platform-wide actions are available here.");
      }
    });

    memberships.forEach(function (membership) {
      if (membership.role === "admin") {
        addRolePlaceholder(placeholders, "Organization administrator", "Organization administration is not implemented. This role is scoped to one organization and grants no platform-wide access.");
      } else if (membership.role === "analyst") {
        addRolePlaceholder(placeholders, "Organization scam analyst", "Investigation tools are not implemented yet. The backend limits this role to reports assigned to this organization; this interface does not show investigation records.");
      }
    });

    if ((roles.includes("admin") || roles.includes("analyst"))) await loadModeratorQueue(version);
  }

  async function loadModeratorQueue(version) {
    var container = document.getElementById("moderator-report-list");
    var messageNode = document.getElementById("moderator-message");
    container.replaceChildren(textNode("p", "account-muted", "Loading the review queue…"));
    var result = await supabase
      .from("scam_reports")
      .select("id, scam_type, title, description, status, created_at")
      .in("status", ["pending", "under_review"])
      .order("created_at", { ascending: true })
      .limit(50);
    if (version !== renderVersion) return;
    container.replaceChildren();
    if (result.error) {
      container.appendChild(textNode("p", "account-muted", "The review queue could not be loaded. Database authorization remains authoritative."));
      showMessage(messageNode, "Could not load reports. Confirm the migration and moderator assignment.", "error");
      return false;
    }
    if (!result.data || result.data.length === 0) {
      container.appendChild(textNode("p", "account-muted", "The review queue is empty."));
      return true;
    }
    result.data.forEach(function (report) { container.appendChild(buildReportCard(report, true)); });
    return true;
  }

  async function updateReportStatus(reportId, newStatus, button) {
    var messageNode = document.getElementById("moderator-message");
    button.disabled = true;
    showMessage(messageNode, "Saving review decision…", "loading");
    var result = await supabase.rpc("review_scam_report", {
      p_report_id: reportId,
      p_decision: newStatus,
      p_notes: null
    });
    button.disabled = false;
    if (result.error) {
      showMessage(messageNode, "The review could not be saved. Confirm that your moderator role is active.", "error");
      return;
    }
    if (!result.data) {
      showMessage(messageNode, "That report is no longer available in the review queue.", "error");
      return;
    }
    var version = renderVersion;
    if (await loadModeratorQueue(version)) {
      showMessage(messageNode, "Review status updated and added to the review history.", "success");
    }
  }

  async function renderSession(user, eventName) {
    renderVersion += 1;
    var version = renderVersion;
    currentUser = user || null;
    var isSignedIn = Boolean(currentUser);
    authForms.hidden = isSignedIn;
    accountDashboard.hidden = !isSignedIn;
    if (!isSignedIn) {
      document.querySelectorAll("[data-review-nav]").forEach(function (link) { link.hidden = true; });
      pageMessage("You can use Jua's public tools without an account. Log in only when you need your profile or own report history.", "");
      return;
    }

    document.getElementById("account-email").textContent = currentUser.email || "Signed-in account";
    var verified = Boolean(currentUser.email_confirmed_at || currentUser.confirmed_at);
    document.getElementById("account-verification").textContent = verified
      ? "Email confirmed by Supabase"
      : "Email not confirmed. Check your inbox before relying on email-based account recovery.";
    var passwordForm = document.getElementById("auth-update-password-form");
    passwordForm.hidden = eventName !== "PASSWORD_RECOVERY" && document.body.dataset.page !== "settings";
    pageMessage("Signed in. Your private account data is protected by database policies.", "success");

    var profile = await supabase.from("profiles").select("full_name").eq("id", currentUser.id).maybeSingle();
    if (version !== renderVersion) return;
    if (profile.error) {
      showMessage(document.getElementById("profile-message"), "Profile query error: " + profile.error.message + " (" + profile.error.code + ").", "error");
    } else {
      document.getElementById("profile-display-name").value = profile.data && profile.data.full_name || "";
      showMessage(document.getElementById("profile-message"), "", "");
    }

    await Promise.all([loadOwnedReports(currentUser, version), loadRoleAreas(currentUser, version)]);
  }

  async function initialize() {
    var config = window.JUA_SUPABASE_CONFIG || {};
    var url = typeof config.url === "string" ? config.url.trim().replace(/\/$/, "") : "";
    var key = typeof config.publishableKey === "string" ? config.publishableKey.trim() : "";
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !key) {
      authForms.hidden = false;
      pageMessage("Account and database features need the JUA Supabase project URL and publishable key in supabase-config.js. Public tools remain available.", "error");
      return null;
    }

    var module;
    try {
      module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm");
    } catch (error) {
      authForms.hidden = false;
      pageMessage("The Supabase client could not load. Check the network and the configured CDN policy.", "error");
      return null;
    }

    supabase = module.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.JUA_SUPABASE = supabase;
    var sessionResult = await supabase.auth.getSession();
    if (sessionResult.error) {
      authForms.hidden = false;
      pageMessage("Supabase Auth could not restore a session. Please try again.", "error");
    } else {
      await renderSession(sessionResult.data.session && sessionResult.data.session.user, "INITIAL_SESSION");
    }
    supabase.auth.onAuthStateChange(function (event, session) {
      window.setTimeout(function () { renderSession(session && session.user, event); }, 0);
    });
    return supabase;
  }

  window.JUA_SUPABASE_READY = initialize().catch(function () {
    authForms.hidden = false;
    pageMessage("Supabase could not be initialized. Check the project configuration and network, then reload.", "error");
    return null;
  });

  document.getElementById("auth-sign-in-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var form = this;
    var email = document.getElementById("auth-sign-in-email").value.trim().toLowerCase();
    var passwordInput = document.getElementById("auth-sign-in-password");
    var password = passwordInput.value;
    var status = document.getElementById("auth-sign-in-message");
    setBusy(form, true, "Logging in…");
    showMessage(status, "", "");
    try {
      var client = await window.JUA_SUPABASE_READY;
      if (!client) throw new Error("Account sign-in is not configured yet.");
      var result = await client.auth.signInWithPassword({ email: email, password: password });
      if (result.error) throw result.error;
      showMessage(status, "Login successful.", "success");
    } catch (error) {
      showMessage(status, safeError(error, "Login failed. Check your details and try again."), "error");
    } finally {
      passwordInput.value = "";
      setBusy(form, false);
    }
  });

  document.getElementById("auth-sign-up-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var form = this;
    var email = document.getElementById("auth-sign-up-email").value.trim().toLowerCase();
    var name = document.getElementById("auth-sign-up-name").value.trim();
    var passwordInput = document.getElementById("auth-sign-up-password");
    var password = passwordInput.value;
    var status = document.getElementById("auth-sign-up-message");
    setBusy(form, true, "Creating account…");
    showMessage(status, "", "");
    try {
      var client = await window.JUA_SUPABASE_READY;
      if (!client) throw new Error("Account registration is not configured yet.");
      var result = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          data: name ? { full_name: name } : {},
          emailRedirectTo: emailRedirectUrl()
        }
      });
      if (result.error) throw result.error;
      if (result.data.session && result.data.user && (result.data.user.email_confirmed_at || result.data.user.confirmed_at)) {
        showMessage(status, "Account created and email confirmed by Supabase.", "success");
      } else {
        showMessage(status, "If this address can be registered, Supabase will send a confirmation email. You are not signed in or marked verified until Supabase confirms it.", "success");
      }
    } catch (error) {
      showMessage(status, safeError(error, "Account creation failed. Check the details and try again."), "error");
    } finally {
      passwordInput.value = "";
      setBusy(form, false);
    }
  });

  document.getElementById("auth-reset-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var form = this;
    var email = document.getElementById("auth-reset-email").value.trim().toLowerCase();
    var status = document.getElementById("auth-reset-message");
    setBusy(form, true, "Sending…");
    showMessage(status, "", "");
    try {
      var client = await window.JUA_SUPABASE_READY;
      if (!client) throw new Error("Password recovery is not configured yet.");
      var result = await client.auth.resetPasswordForEmail(email, { redirectTo: emailRedirectUrl() });
      if (result.error) throw result.error;
      showMessage(status, "If an account uses that address, Supabase will send a password reset link.", "success");
    } catch (error) {
      showMessage(status, safeError(error, "The reset request could not be sent. Try again later."), "error");
    } finally {
      setBusy(form, false);
    }
  });

  document.getElementById("auth-update-password-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var form = this;
    var passwordInput = document.getElementById("auth-new-password");
    var status = document.getElementById("auth-update-password-message");
    setBusy(form, true, "Updating…");
    showMessage(status, "", "");
    try {
      var client = await window.JUA_SUPABASE_READY;
      if (!client) throw new Error("Password recovery is not configured yet.");
      var result = await client.auth.updateUser({ password: passwordInput.value });
      if (result.error) throw result.error;
      showMessage(status, "Supabase confirmed the password update.", "success");
      passwordInput.value = "";
      form.hidden = true;
    } catch (error) {
      showMessage(status, safeError(error, "The password could not be updated. Follow the latest reset link and try again."), "error");
    } finally {
      passwordInput.value = "";
      setBusy(form, false);
    }
  });

  document.getElementById("auth-sign-out").addEventListener("click", async function () {
    var button = this;
    button.disabled = true;
    try {
      if (!supabase) throw new Error("Sign-out is not configured.");
      var result = await supabase.auth.signOut();
      if (result.error) throw result.error;
      pageMessage("You are signed out.", "success");
    } catch (error) {
      pageMessage(safeError(error, "Sign-out failed. Please try again."), "error");
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("profile-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var form = this;
    var status = document.getElementById("profile-message");
    var displayName = document.getElementById("profile-display-name").value.trim();
    if (displayName.length > 80) {
      showMessage(status, "Display name must be 80 characters or fewer.", "error");
      return;
    }
    setBusy(form, true, "Saving…");
    showMessage(status, "", "");
    try {
      if (!supabase || !currentUser) throw new Error("Log in before saving profile changes.");
      var result = await supabase.from("profiles").update({ full_name: displayName || null }).eq("id", currentUser.id).select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("No profile row was updated. Apply the account migration and reload your account.");
      showMessage(status, "Profile saved.", "success");
    } catch (error) {
      showMessage(status, safeError(error, "Profile could not be saved. Check the database setup."), "error");
    } finally {
      setBusy(form, false);
    }
  });
})();
