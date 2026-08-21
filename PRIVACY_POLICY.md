# Privacy Policy for ek\$tension (Gizlilik Politikası)

*Last updated: August 18, 2026*

**ek\$tension** is an open-source browser extension designed to enhance the reading, filtering, and navigation experience for Ekşi Sözlük users. We take user privacy very seriously.

---

## 1. Information Collection and Use

- **No Personal Data Collected:** We do NOT collect, store, transmit, or sell any personal data, browsing history, or personally identifiable information (PII).
- **Local Storage:** All user preferences (such as selected theme, blocked keyword filters, blocked author lists, favorite topics, saved entries / reading lists, and zen mode preferences) are stored strictly locally on your device via Chrome's `chrome.storage.local` API. This data never leaves your browser.
- **Third-Party Transmission:** No analytics, tracking pixels, or third-party telemetry services are embedded within this extension.

---

## 2. Permissions Justification (İzin Açıklamaları)

The extension requests only the minimum permissions necessary to function:

| Permission | Purpose |
| :--- | :--- |
| `storage` | To store user preferences (theme, blocked keyword filters, blocked authors, favorite topics, saved entries/reading lists, zen mode settings) locally on your device. |
| `contextMenus` | To provide a "Search on Ekşi Sözlük" shortcut when you right-click on selected text. |
| `tabs` | To open search results or topic pages in a new tab upon user click. |
| `offscreen` | To parse public HTML search results from Ekşi Sözlük safely in Manifest V3 without blocking the background service worker. |
| `declarativeNetRequest` | To modify response headers for sub_frames so Ekşi Sözlük inline media previews and solvers function properly. |

---

## 3. Host Permissions (Site İzinleri)

The extension requests access to:
- `https://eksisozluk.com/*`: To fetch public gündem topics, perform autocomplete searches, and filter topics/authors on the website.
- `https://*.youtube.com/*`, `https://*.wikipedia.org/*`, `https://*.imdb.com/*`, `https://*.steampowered.com/*`, `https://*.epicgames.com/*`: To detect page titles on supported platforms and check if relevant discussions exist on Ekşi Sözlük.

---

## 4. Open Source and Transparency

This extension is completely open-source. The code is available for auditing to ensure that privacy and security guarantees are maintained at all times.

---

## 5. Contact

If you have any questions or concerns regarding this privacy policy, please open an issue in the project's repository.
