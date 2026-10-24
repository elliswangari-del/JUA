 Jua — Cyber Scam Awareness Assistant

Jua is a beginner-friendly website for learning how to spot online scams, review suspicious messages, practice safer choices, and find practical next steps. The current project is a static HTML, CSS, and JavaScript site. It has no build step and no package dependencies.

Run the website locally

1. Open the XAMPP Control Panel and start Apache.
2. Open [http://localhost/Jua%20Websie/](http://localhost/Jua%20Websie/) in your browser.
3. To open the OSINT center directly, use [http://localhost/Jua%20Websie/#osint](http://localhost/Jua%20Websie/#osint).

Keep the project folder name in the URL in sync if you rename the folder. The website can also be opened by opening `index.html`, but running it through Apache is closer to a normal hosted website. The Jotform assistant and DNS lookup need an internet connection.

 What is included

- Dashboard and responsive navigation: page sections for the tools, learning content, help guidance, and reporting prototype. The mobile menu can be opened with its menu button; Escape closes it.
- Message checker: a local, rule-based review of a few text patterns. It is not AI and does not verify senders or links.
- Awareness quiz: five scenarios with answer feedback, explanations, score, and restart. The browser stores only the number of completed quiz rounds.
- Scam library: six short articles with text search and topic filtering.
- “I’ve been scammed” guidance: practical first steps and links to Kenyan service and agency guidance.
- OSINT Investigation Centre: a public DNS lookup plus clearly marked links to third-party services. Details are in the section below.
- Jotform AI assistant: the real Jua agent in its own view, with a way back to the dashboard.
- Report form: a local preview only. It does not submit or store reports.

Project files

| File or folder | Purpose |
| --- | --- |
| `index.html` | Main page, dashboard sections, assistant view, and Jotform embed |
| `css/style.css` | Gold-and-obsidian design, responsive layouts, focus styles, and reduced-motion rules |
| `js/main.js` | Assistant routing, browser history, mobile navigation, reveals, and report preview |
| `js/checker.js` | Rule-based message checker |
| `js/quiz.js` | Quiz questions, scoring, explanations, and local completion count |
| `js/library.js` | Library search and category filter |
| `js/osint.js` | DNS lookup and external-provider handoffs |
| `index backup.html` | Older, unused version; it is not the active page |

Jotform assistant

The assistant is the actual Jotform AI Agent, not a local mockup. Its iframe, agent ID, permissions, official embed-handler script, and initialization are in `index.html`. The frame opens in a dedicated view when an **Open assistant** button is selected. Its cross-origin contents are hosted by Jotform and cannot be styled by this website. Avoid changing or duplicating the iframe or handler unless you are intentionally updating the integration.

Do not include passwords, PINs, one-time codes, or sensitive personal information in chat. The chat is hosted by Jotform, so review the relevant privacy terms before making promises about how chat data is handled.

OSINT: what runs here and what does not

- DNS lookup: after you confirm, the browser requests A, AAAA, MX, NS, TXT, and CAA records from Cloudflare DNS over HTTPS. Jua displays the source and time. The domain is sent to Cloudflare. DNS records can be incomplete or change, and they are not a safety verdict. No API key is required. See [Cloudflare's DNS-over-HTTPS documentation](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/).
- VirusTotal, Google Safe Browsing, urlscan.io, and Have I Been Pwned: these are provider handoffs, not checks performed by Jua. The user chooses a provider and continues on its website. Jua does not send an email to HIBP and does not submit a urlscan scan. Some urlscan visibility options can make scan information public; check the provider's current visibility rules before submitting. See [urlscan visibility](https://docs.urlscan.io/pages/visibility).
- Registration and certificate searches: ICANN Lookup and Certificate Transparency links open separate websites. Jua does not fetch or interpret those results.

No third-party API keys are configured in this project. If you later add provider APIs, use a server-side function such as a Netlify Function, store credentials in the host's protected environment settings, and review the provider's current API requirements, pricing, quotas, privacy terms, and permitted uses. Never put API secrets in browser JavaScript or HTML. See official documentation for [VirusTotal](https://docs.virustotal.com/docs/api-overview), [Google Safe Browsing](https://developers.google.com/safe-browsing/reference), [urlscan](https://docs.urlscan.io/), and [Have I Been Pwned](https://haveibeenpwned.com/API/V3).

Privacy and feature limits

- The message checker processes text in the page and does not save or transmit it. Remove personal details before checking anyway.
- Quiz progress is stored only in the current browser. It is not an account, cross-device sync, or a saved history of answers.
- The report form is a prototype. It only previews a response and does not send, publish, or store it. Real reports would need a secure backend, privacy information, abuse controls, and moderation.
- OSINT results and external services cannot guarantee that a website, message, or account is safe. Review results carefully and verify through a trusted channel.

Accessibility and responsive design

The stylesheet includes layouts for narrower screens, visible keyboard focus indicators, and a reduced-motion preference. The mobile menu has an accessible label and expanded state. A full browser, screen-reader, contrast, and device test has not been completed; check these before publishing.

Test before publishing

1. Start Apache in XAMPP and open the local URL above.
2. Check the navigation and mobile menu, including opening and closing the menu with a keyboard.
3. Try the checker, complete and restart the quiz, filter the library, and open the report preview.
4. With an internet connection, open the Jotform assistant and try a public-domain DNS lookup after reading its sharing notice.
5. Check the page at desktop and phone widths and look for horizontal overflow or browser console errors.

Static hosting and Netlify

The site has no build command: publish the project folder with `index.html` at the site root and keep `css/` and `js/` alongside it. No backend or API credentials are currently required. The project has not been deployed or verified on Netlify. Keep the report feature labeled as a prototype unless a secure submission service is implemented.
