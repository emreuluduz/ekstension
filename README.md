# ek$tension

Chrome extension for Ekşi Sözlük that provides fast trending topics, in-page power tools (author blocking, media previews, media-only entry filter), enhanced search functionality, and multi-site integration.

## Features

### ⚡ Google Gemini AI Özetleyici (Gemini 3.5 Flash Lite)
- **Başlık & Tartışma Özetleyici (`⚡ Başlığı Özetle`)**: Çok sayfalı başlıklar ve gündem başlıkları dahil tüm entry'leri tarar. Google'ın resmi **Gemini 3.5 Flash Lite** modeli ile tartışmanın ana fikrini, farklı görüşleri ve öne çıkan ortak kanıları saniyeler içinde son derece net ve madde madde özetler.
- **Tekil Entry Özetleyici (`⚡ Özetle`)**: 500 karakterden uzun olan kapsamlı entry'lerin altında çıkan buton ile anında 1-2 maddelik hap özet üretir.
- **Işık Hızında & Bilgisayarı Yormaz**: İşlem Google'ın bulut altyapısında çalıştığından bilgisayarınızın işlemcisi veya belleği hiç yorulmaz, 1.5 - 2 saniyede sonuç verir.
- **%100 Ücretsiz Kurulum**: Google AI Studio üzerinden alınan ücretsiz API anahtarı ile kolayca çalışır ([Kurulum Rehberi](docs/GEMINI_API_KEY_SETUP.md)).

### In-Page Power Tools (Ekşi Sözlük Web Sitesi Araçları)
- **Sonsuz Kaydırma & Canlı Akış (Infinite Scroll & Live Stream)**: Çok sayfalı başlıklarda alta kaydırdıkça sayfaları kesintisiz yükleme (`?p=2`); canlı maç veya olay başlıklarında sayfayı yenilemeden yeni entry'leri otomatik akıtma (`🔴 Canlı Akış`).
- **Tekil Entry Kaydetme & Okuma Listesi (Read Later)**: Entry altındaki `🔖 Kaydet` butonuyla tekil entry'leri yerel olarak arşivleme, yan çekmece (Slide Drawer) ve popup üzerinden yönetme, **Markdown (.md)** veya **JSON** formatında dışa aktarma.
- **Klavye Kısayolları (Power Navigator)**: Sayfada fareye dokunmadan ultra hızlı gezinme (`J` önceki, `K` sonraki entry, `S` kaydet, `E` Gemini AI ile özetle, `Z` zen modu, `?` kısayol rehberi).
- **Zen / Odaklanma Modu (Reader Mode)**: Reklamları, sol menüyü ve dikkat dağıtıcı öğeleri gizleyen; ayarlanabilir ferah genişlik ve tipografiye sahip temiz okuma modu (`🧘 Zen Modu` / `Z`).
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