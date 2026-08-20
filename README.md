# ek$tension

Chrome extension for Ekşi Sözlük that provides fast trending topics, in-page power tools (author blocking, media previews, media-only entry filter), enhanced search functionality, and multi-site integration.

## Features

### In-Page Power Tools (Ekşi Sözlük Web Sitesi Araçları)
- **Entry Bkz Hover Preview (Entry Önizleme)**: Entry içindeki `(bkz: #173073218)` veya doğrudan entry referans linklerinin üzerine gelindiğinde sayfadan ayrılmadan entry metnini, yazarını ve tarihini gösteren hızlı önizleme kartı.
- **Media & Link-Only Filter**: Toggle button (`[ 🎬 Sadece Medya & Linkler ]`) on topic pages to instantly filter out text-only entries and show only entries containing images, videos, or external links.
- **Inline Media Previews**: View images (`soz.lk`, `eksisozluk.com/img/`, `.jpg`, `.png`, `hizliresim`, `imgur`, `ibb.co`, `resmim.net`) and play YouTube videos directly inside entries without leaving the page.
- **Author / Troll Blocker**: Block unwanted authors with 1-click (`🚫`) directly on the entry header or from the settings panel. Blocked authors are hidden with an expandable notice.
- **Topic Keyword Filtering**: Filter out unwanted topics from the sidebar and homepage based on keywords.

### Search & Navigation
- **Quick Search**: Right-click on any selected text on any webpage to search it directly on Ekşi Sözlük.
- **Enhanced Search UI**: Modern search interface with real-time autocomplete results for titles and authors.
- **Multi-site Support**: Integration with popular platforms:
  - YouTube
  - Wikipedia
  - IMDb
  - Steam
  - Epic Games

### Content Management & Settings
- **Favorites**: Save and manage your favorite topics for one-click access.
- **Backup & Restore**: Export all your favorites, blocked words, and blocked authors to a JSON file and restore anytime.
- **Theme Support**: Dark, Light, and Automatic (System) theme modes.

## Installation

1. Clone this repository or download as ZIP
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory