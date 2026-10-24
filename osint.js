(function () {
  "use strict";

  var urlForm = document.getElementById("osint-url-form");
  var emailForm = document.getElementById("osint-email-form");
  var dnsForm = document.getElementById("osint-dns-form");
  if (!urlForm || !emailForm || !dnsForm) return;

  function setMessage(id, message, kind) {
    var element = document.getElementById(id);
    element.textContent = message;
    element.dataset.kind = kind || "";
  }

  function isPrivateHost(host) {
    var value = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (!value || value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local") || value.endsWith(".internal") || value.endsWith(".test")) return true;
    if (value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/i.test(value)) return true;
    if (value.startsWith("::ffff:")) {
      var mapped = value.slice(7).split(".").map(Number);
      if (mapped.length === 4 && (mapped[0] === 10 || mapped[0] === 127 || (mapped[0] === 192 && mapped[1] === 168) || (mapped[0] === 172 && mapped[1] >= 16 && mapped[1] <= 31) || (mapped[0] === 169 && mapped[1] === 254))) return true;
    }
    var parts = value.split(".");
    if (parts.length === 4 && parts.every(function (part) { return /^\d{1,3}$/.test(part) && Number(part) <= 255; })) {
      var octets = parts.map(Number);
      return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || octets[0] >= 224 ||
        (octets[0] === 169 && octets[1] === 254) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
        (octets[0] === 192 && (octets[1] === 168 || octets[1] === 0 || octets[1] === 2)) ||
        (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
        (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19 || (octets[1] === 51 && octets[2] === 100))) ||
        (octets[0] === 203 && octets[1] === 0 && octets[2] === 113);
    }
    return false;
  }

  function publicUrl(raw) {
    var parsed;
    try { parsed = new URL(raw.trim()); } catch (error) { return null; }
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password || isPrivateHost(parsed.hostname)) return null;
    return parsed;
  }

  function publicDomain(raw) {
    var domain = raw.trim().toLowerCase().replace(/\.$/, "");
    if (!domain || domain.length > 253 || domain.includes(":") || domain.includes("/") || domain.includes("@") || domain.includes("\\") || isPrivateHost(domain)) return null;
    var labels = domain.split(".");
    if (labels.length < 2 || labels.some(function (label) { return !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label); })) return null;
    if (!/^[a-z]{2,63}$/.test(labels[labels.length - 1]) && !/^xn--[a-z0-9-]{2,59}$/.test(labels[labels.length - 1])) return null;
    return domain;
  }

  function nowLabel() {
    return "Prepared " + new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date());
  }

  urlForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var parsed = publicUrl(document.getElementById("osint-url").value);
    var consent = document.getElementById("osint-url-consent").checked;
    var results = document.getElementById("osint-url-results");
    results.hidden = true;
    if (!parsed) {
      setMessage("osint-url-message", "Enter a valid public http or https URL. Local and private network addresses are not accepted.", "error");
      return;
    }
    if (!consent) {
      setMessage("osint-url-message", "Please review and accept the sharing notice before preparing provider links.", "error");
      document.getElementById("osint-url-consent").focus();
      return;
    }
    var url = parsed.href;
    document.getElementById("osint-google-link").href = "https://transparencyreport.google.com/safe-browsing/search?url=" + encodeURIComponent(url);
    document.getElementById("osint-copy-url").dataset.url = url;
    document.getElementById("osint-url-time").textContent = nowLabel();
    results.hidden = false;
    setMessage("osint-url-message", "Ready. Jua validated the URL format only; no reputation scan was performed.", "success");
  });

  document.getElementById("osint-copy-url").addEventListener("click", async function () {
    var url = this.dataset.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("osint-url-message", "URL copied. It has not been sent to a provider by Jua.", "success");
    } catch (error) {
      setMessage("osint-url-message", "Clipboard access is unavailable. Select and copy the URL from the field above.", "error");
    }
  });

  emailForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var input = document.getElementById("osint-email");
    var results = document.getElementById("osint-email-results");
    results.hidden = true;
    if (!input.validity.valid || !input.value.trim()) {
      setMessage("osint-email-message", "Enter a valid email address.", "error");
      input.focus();
      return;
    }
    if (!document.getElementById("osint-email-consent").checked) {
      setMessage("osint-email-message", "Please confirm permission and review the privacy notice before continuing.", "error");
      document.getElementById("osint-email-consent").focus();
      return;
    }
    document.getElementById("osint-email-time").textContent = nowLabel();
    results.hidden = false;
    setMessage("osint-email-message", "Ready. Jua has not sent or stored this address and has not checked breach data.", "success");
  });

  var recordTypes = [
    { type: "A", code: 1, label: "IPv4 (A)" }, { type: "AAAA", code: 28, label: "IPv6 (AAAA)" },
    { type: "MX", code: 15, label: "Mail servers (MX)" }, { type: "NS", code: 2, label: "Name servers (NS)" },
    { type: "TXT", code: 16, label: "Text records (TXT)" }, { type: "CAA", code: 257, label: "Certificate authorities (CAA)" }
  ];

  async function queryDns(domain, type) {
    var endpoint = "https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent(domain) + "&type=" + type;
    var response = await fetch(endpoint, { headers: { Accept: "application/dns-json" }, mode: "cors", cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }

  function renderDns(domain, results) {
    var container = document.getElementById("osint-dns-results");
    container.replaceChildren();
    var heading = document.createElement("div");
    heading.className = "osint-result-meta";
    var source = document.createElement("span");
    source.textContent = "Source: Cloudflare DNS over HTTPS";
    var time = document.createElement("span");
    time.textContent = "Checked " + new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date());
    heading.append(source, time);
    container.appendChild(heading);

    var records = document.createElement("div");
    records.className = "osint-record-grid";
    results.forEach(function (result, index) {
      var card = document.createElement("section");
      card.className = "osint-record";
      var title = document.createElement("h4");
      title.textContent = recordTypes[index].label;
      var list = document.createElement("ul");
      var answers = (result.data && result.data.Answer || []).filter(function (answer) { return answer.type === recordTypes[index].code; });
      answers.forEach(function (answer) {
        var item = document.createElement("li");
        item.textContent = answer.data + " · TTL " + answer.TTL + "s";
        list.appendChild(item);
      });
      if (!answers.length) {
        var empty = document.createElement("li");
        empty.textContent = result.error ? "Lookup failed: " + result.error : result.data && result.data.Status === 3 ? "No record found (NXDOMAIN)." : "No record returned.";
        empty.className = result.error ? "osint-record-error" : "";
        list.appendChild(empty);
      }
      card.append(title, list);
      records.appendChild(card);
    });
    container.appendChild(records);
    var caveat = document.createElement("p");
    caveat.className = "osint-result-caveat";
    caveat.textContent = "DNS answers can change and may vary by resolver or location. No answer is not a safety verdict. Registration and certificate links below are separate external lookups.";
    container.appendChild(caveat);
    container.hidden = false;

    var encodedDomain = encodeURIComponent(domain);
    document.getElementById("osint-rdap-link").href = "https://lookup.icann.org/en/lookup?name=" + encodedDomain;
    document.getElementById("osint-cert-link").href = "https://crt.sh/?q=" + encodedDomain;
  }

  document.getElementById("osint-domain").addEventListener("input", function () {
    var domain = publicDomain(this.value);
    if (!domain) return;
    var encodedDomain = encodeURIComponent(domain);
    document.getElementById("osint-rdap-link").href = "https://lookup.icann.org/en/lookup?name=" + encodedDomain;
    document.getElementById("osint-cert-link").href = "https://crt.sh/?q=" + encodedDomain;
  });

  dnsForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var domain = publicDomain(document.getElementById("osint-domain").value);
    var results = document.getElementById("osint-dns-results");
    var button = dnsForm.querySelector('button[type="submit"]');
    results.hidden = true;
    if (!domain) {
      setMessage("osint-dns-message", "Enter a public domain such as example.com. IP addresses, local names, and private network targets are not accepted.", "error");
      return;
    }
    if (!document.getElementById("osint-dns-consent").checked) {
      setMessage("osint-dns-message", "Please confirm that Cloudflare may receive the domain for DNS queries.", "error");
      document.getElementById("osint-dns-consent").focus();
      return;
    }
    button.disabled = true;
    button.textContent = "Looking up…";
    dnsForm.setAttribute("aria-busy", "true");
    setMessage("osint-dns-message", "Querying public DNS records via Cloudflare…", "loading");
    try {
      var responses = await Promise.all(recordTypes.map(async function (record) {
        try { return { type: record.type, data: await queryDns(domain, record.type) }; }
        catch (error) { return { type: record.type, error: "Could not reach resolver." }; }
      }));
      renderDns(domain, responses);
      var failures = responses.filter(function (item) { return item.error; }).length;
      setMessage("osint-dns-message", failures ? "Lookup finished with " + failures + " record type(s) unavailable. See the results for details." : "DNS lookup complete. Results below are from Cloudflare; this is not a security scan.", failures ? "error" : "success");
    } catch (error) {
      setMessage("osint-dns-message", "DNS lookup could not be completed. Check your connection and try again.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Look up DNS";
      dnsForm.removeAttribute("aria-busy");
    }
  });
})();
