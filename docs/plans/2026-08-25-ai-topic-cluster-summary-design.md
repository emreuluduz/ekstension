# AI Başlık Kümeleme (Cluster Modu) & Akıllı Örnekleme Tasarım Dokümanı

- **Tarih:** 2026-08-25
- **Durum:** Onaylandı

## 1. Genel Bakış ve Amaç
Ekşi Sözlük'te binlerce sayfaya ve 10-20 yıla yayılan devasa başlıkları tek tip, homojen bir metin olarak özetlemek bağlam kaybına yol açmaktadır. Bu tasarım; başlıkları zamansal (kronolojik dönemler) veya tematik boyutlara (farklı kutuplar/argümanlar) göre akıllıca kümeleyen (Cluster Modu), çok sayfalı başlıklarda 8-12 temsilci sayfa toplayan (Smart Sampling) ve UI'da modern renkli kartlar, etiket rozetleri ve nüans kutularıyla sunan uçtan uca bir sistem sunar.

## 2. Mimari Bileşenler

### A. AI Prompt Mimarisi & Cluster Stratejisi
- **İkili Ayrım:** Tekil güncel olaylarda argüman kutuplarına odaklanırken, yıllara yayılan başlıklarda 2-4 mantıksal döneme/kategoriye göre otomatik kümeleme.
- **Ekşi Jargonu & İroni Ayrımı:** Sarkazm, mizah ve trolleri gerçek görüşlerden filtreleme; popülerlik ile nesnel doğruluğu ayırt etme.
- **Yapılandırılmış Çıktı:**
  - `### 📌 Başlık Özeti` (2-3 vurucu cümle, kalın anahtar kelimeler)
  - `### 🎭 Genel Hava` (`#etiket1` `#etiket2` `#etiket3`)
  - `### 🧭 Tartışma Kırılımları & Kümeler` (Dönemsel / Tematik bloklar)
  - `### 💡 Dikkat Çeken / Nüans` (Sıra dışı veya azınlıkta kalan kilit tespit)

### B. Akıllı Veri Örnekleme (Smart Sampling - EntryFetcher.js)
- **1 - 10 Sayfa:** Eksiksiz tam tarama.
- **11+ Sayfa (Smart Sampling):**
  - **İlk Dönem:** 1, 2, 3. sayfalar.
  - **Ara Dönemler (Milestones):** Eşit aralıklı 3-4 orta sayfa.
  - **Güncel Dönem:** Son 3 sayfa.
  - Toplam 8-12 sayfa taranarak ~2 saniyede veri toplanır.
- Sayfa ve dönem dağılımı AI prompt'una metadata olarak iletilerek modelin kronolojik çıkarım doğruluğu maksimize edilir.

### C. UI & Markdown Parser (filter.js & content.css)
- `formatSummaryMarkdown` fonksiyonu; `#etiket` yapılarını pill badge'lere (`.ekst-mood-badge`), küme başlıklarını ayrılmış kart bloklarına (`.ekst-cluster-card`), nüans bölümünü ise çağrı kutusuna (`.ekst-nuance-callout`) çevirir.
- Açık ve koyu tema uyumluluğu sağlanır.

## 3. Doğrulama Kriterleri
- Çok sayfalı başlıklarda tarama süresinin <3 saniye olması.
- Gemini Flash'ın dönemleri doğru kronolojik veya tematik bloklarla ayrıştırması.
- UI'da genel hava rozetleri ve küme kartlarının görsel olarak kusursuz render edilmesi.
