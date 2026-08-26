# AI Başlık Kümeleme (Cluster Modu) & Akıllı Örnekleme Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Ekşi Sözlük başlıklarını yıllara/dönemlere veya tematik boyutlara göre otomatik kümeleyen (Cluster Modu), 10+ sayfalı başlıklarda 8-12 temsilci sayfa toplayan (Smart Sampling) ve UI'da modern kartlar, rozetler ve nüans kutularıyla sunan uçtan uca özetleme sistemini uygulamak.

**Architecture:** 
1. `EntryFetcher.js` içerisine çok sayfalı başlıklarda ilk, ara ve son dönemleri temsil eden sayfaları seçen Smart Sampling algoritması eklenir.
2. `AIService.js` ve `filter.js` içindeki promptlar; Ekşi jargonu, ironi ayrımı, dinamik dönem/tema kümeleme (`### 🧭 Tartışma Kırılımları & Kümeler`) ve `#etiket` genel hava şablonuyla modernize edilir.
3. `filter.js` (`formatSummaryMarkdown`) ve `content.css` içerisine etiket rozetleri, ayrık küme kartları ve nüans kutuları için açık/koyu tema destekli görsel ayrıştırıcı eklenir.

**Tech Stack:** JavaScript (ES6 Modules & Vanilla JS), Chrome Extension Manifest V3, Google Gemini API, CSS3.

---

### Task 1: Akıllı Veri Örnekleme (Smart Sampling) - `src/services/EntryFetcher.js`

**Files:**
- Modify: `src/services/EntryFetcher.js`

**Step 1: Smart Sampling Fonksiyonunu Ekle**
`totalPages > 10` olduğunda ilk 3 sayfa, eşit aralıklı 3-4 ara sayfa ve son 3 sayfayı belirleyen `getSampledPageNumbers(totalPages)` mantığını ekle.

**Step 2: `fetchAllEntries` Entegrasyonu**
Tüm sayfaları gezmek yerine `isSampled` durumunda yalnızca belirlenen örnek sayfaları çek, ilerleme çubuğunda `(Örneklem: Sayfa X / Y)` mesajını ilet ve dönen objeye `{ entries, totalPages, sampledPages, isSampled, title, slug }` metadata'sını ekle.

**Step 3: Doğrulama**
10 sayfadan küçük ve 50+ sayfalık senaryolarda doğru sayfa dizilerinin üretildiğini doğrula.

---

### Task 2: AI Prompt & Kümeleme Mimarisi - `src/services/ai/AIService.js` & `src/content/filter.js`

**Files:**
- Modify: `src/services/ai/AIService.js:50-190`
- Modify: `src/content/filter.js:1850-1970`

**Step 1: AIService Prompt'unu Güncelle**
Prompt'a `### 📌 Başlık Özeti`, `### 🎭 Genel Hava`, `### 🧭 Tartışma Kırılımları & Kümeler`, `### 💡 Dikkat Çeken / Nüans` çıktı formatını, ironi/sarkazm kurallarını ve dönem metadata'sını entegre et.

**Step 2: filter.js Prompt'unu Eşitle**
`filter.js` içerisindeki doğrudan çağrılan prompt metnini `AIService.js` ile birebir senkronize et.

---

### Task 3: Görsel Markdown Parser & UI Kart Hiyerarşisi - `src/content/filter.js` & `src/content/content.css`

**Files:**
- Modify: `src/content/filter.js:1380-1425`
- Modify: `src/content/content.css:840-880`, `1090-1130`

**Step 1: `formatSummaryMarkdown` Fonksiyonunu Geliştir**
- `#etiket` ifadelerini `<span class="ekst-mood-badge">#etiket</span>` rozetlerine çevir.
- `* **[...]**:` veya `[Dönem]:` kalıplarını `<div class="ekst-cluster-card"><div class="ekst-cluster-title">...</div>...</div>` bloklarına çevir.
- `### 💡 Dikkat Çeken / Nüans` bölümünü `<div class="ekst-nuance-callout">...</div>` içine al.
- `### 📌`, `### 🎭`, `### 🧭` başlıklarını `.ekst-summary-section-title` olarak biçimlendir.

**Step 2: CSS Tasarımını Ekle (Açık ve Koyu Tema)**
- `.ekst-mood-badge`: Mor/mavi hafif arka planlı, yuvarlatılmış hap rozet.
- `.ekst-cluster-card`: Sol kenarı renkli vurgulu (`border-left: 3px solid #7c3aed`), yumuşak arka planlı kart.
- `.ekst-nuance-callout`: Amber tonlu (`#fef3c7` / dark: `#451a03`) dikkat çekici iç kutu.

**Step 3: Kart Başlığına Örneklem Bilgisini Ekle**
`renderSummaryCard` fonksiyonunda `isSampled` ise `[Akıllı Kümeleme • 120 sayfa / 98 entry]` rozetini göster.

---

### Task 4: Uçtan Uca Test & Doğrulama

**Files:**
- Verify: Extension genel çalışma durumu, hata yakalama, önbellek (`cacheKey`) yönetimi.
