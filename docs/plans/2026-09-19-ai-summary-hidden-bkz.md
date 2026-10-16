# AI Başlık Özetlerinde Ekşi Sözlük Tarzı Gizli Bkz (Hidden Bkz) Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Ekşi Sözlük başlık özetlerinde geçen kilit kavram ve terimleri AI prompt kuralı (`[kavram]*`) ve güvenli Markdown regex ayrıştırıcısı ile Ekşi Sözlük'ün özgün gizli bkz (`kelime*`) formatına dönüştürerek, yeni sekmede ilgili başlığı açan ve hover'da tooltip gösteren entegrasyonu sağlamak.

**Architecture:** 
1. `AIService.js` ve `filter.js` içindeki Gemini Flash başlık özetleme prompt'larına `[kavram]*` gizli bkz kuralı eklenir.
2. `filter.js` içindeki `formatSummaryMarkdown` fonksiyonuna `[kavram]*` (ve `\`kavram\`` / `(bkz: kavram)*` fallback) kalıplarını güvenli HTML `<a>` linklerine çeviren ayrıştırıcı eklenir.
3. `content.css` içine `.ekst-hidden-bkz` ve `.ekst-bkz-asterisk` stilleri eklenir (Ekşi Sözlük yeşili, noktalı alt çizgi, hover efekti).
4. `tests/ai-summary-bkz.test.js` ile regex ayrıştırma, URL encoding, XSS koruması ve yapısal etiket bütünlüğü Node.js yerel test aracı ile test edilip doğrulanır.

**Tech Stack:** JavaScript (ES6 Modules & Vanilla JS), Node.js native test runner (`node --test`), Chrome Extension Manifest V3, CSS3.

---

### Task 1: Birim Test Paketi Oluşturma (TDD) - `tests/ai-summary-bkz.test.js`

**Files:**
- Create: `tests/ai-summary-bkz.test.js`

**Step 1: Test Dosyasını Yaz**
Aşağıdaki durumları test eden `tests/ai-summary-bkz.test.js` dosyasını oluştur:
- `[kavram]*` ifadesinin `<a href="https://eksisozluk.com/?q=..." class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: kavram">kavram<sup class="ekst-bkz-asterisk">*</sup></a>` yapısına dönüşmesi.
- Türkçe karakterler (`ş, ı, ğ, ç, ö, ü`) ve boşlukların URL encode edilmesi (`q=t%C3%BCrk%20liras%C4%B1`).
- Fallback desenleri: `\`kavram\`` ve `(bkz: kavram)*` ifadelerinin de aynı şekilde dönüştürülmesi.
- Yapısal etiketlerin (`**Hâkim Görüş:**`, `* **[2012-2018: İlk Çıkış & Beğeni]:**`) bozulmadan `<strong>` olarak korunması.
- XSS / zararlı karakterlerin escape edilmesi.

**Step 2: Testi Çalıştır ve Başarısız Olduğunu Gör**
Run: `node --test tests/ai-summary-bkz.test.js`
Expected: FAIL (fonksiyon henüz `[kavram]*` dönüşümü yapmadığı için)

---

### Task 2: Markdown Parser & Formatlayıcı Güncellemesi - `src/content/filter.js`

**Files:**
- Modify: `src/content/filter.js:1382-1430`

**Step 1: `formatSummaryMarkdown` İçine Gizli Bkz Mantığını Entegre Et**
- `&`, `<`, `>` escape işlemlerinden sonra ve `<strong>` etiketlerinin oluşturulmasıyla uyumlu biçimde:
  1. `\[([\p{L}\p{N}\s._-]+)\]\*` eşleşmesini yakala.
  2. `\`([\p{L}\p{N}\s._-]+)\`` (eğer kod bloğu değilse) ve `\(bkz:\s*([\p{L}\p{N}\s._-]+)\)\*` eşleşmelerini yakala.
  3. `cleanTerm = term.trim()`, `searchUrl = https://eksisozluk.com/?q=${encodeURIComponent(cleanTerm)}` oluştur.
  4. HTML çıktısını güvenli şekilde üret.

**Step 2: Testleri Tekrar Çalıştır ve Geçtiğini Doğrula**
Run: `node --test tests/ai-summary-bkz.test.js`
Expected: PASS

---

### Task 3: AI Prompt Kurallarının Güncellenmesi - `src/services/ai/AIService.js` & `src/content/filter.js`

**Files:**
- Modify: `src/services/ai/AIService.js:103-143`
- Modify: `src/content/filter.js:1956-1996`

**Step 1: `AIService.js` Prompt Güncellemesi**
`summarizeTopic` fonksiyonundaki sistem ve çıktı formatı talimatlarına kural 8'i ekle:
- "8. GİZLİ BKZ KULLANIMI: Özette geçen ve Ekşi Sözlük'te karşılığı olabilecek anahtar kavramları, kurum/kişi/olay adlarını `[kavram]*` formatında gizli bkz olarak işaretle (örn: `[enflasyon]*`, `[türk lirası]*`). Sıradan vurgular için `**kalın**` kullanmaya devam et."
- Çıktı formatındaki `### 📌 Başlık Özeti` altındaki açıklamaya `(Anahtar kavramları [kavram]* şeklinde gizli bkz yap.)` yönergesini yerleştir.

**Step 2: `filter.js` Prompt Senkronizasyonu**
`filter.js` içindeki `handleAISummarizeClick` altındaki prompt'u `AIService.js` ile birebir eşitle.

---

### Task 4: CSS Stillerinin Eklenmesi - `src/content/content.css`

**Files:**
- Modify: `src/content/content.css`

**Step 1: Gizli Bkz Stillerini Ekle**
- `.ekst-hidden-bkz`:
  - `color: #81c14b;` (Ekşi Sözlük yeşili)
  - `text-decoration: none;`
  - `border-bottom: 1px dotted rgba(129, 193, 75, 0.7);`
  - `cursor: pointer;`
  - `transition: color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;`
- `.ekst-hidden-bkz:hover`:
  - `color: #9ee35e;`
  - `border-bottom-color: #9ee35e;`
  - `opacity: 0.9;`
- `.ekst-bkz-asterisk`:
  - `font-size: 0.85em;`
  - `line-height: 1;`
  - `margin-left: 1px;`
  - `font-weight: bold;`
  - `color: inherit;`
- Koyu tema ve açık tema için değişken/kontrast uyumunu doğrula.

---

### Task 5: Bütünlük ve Uçtan Uca Doğrulama

**Files:**
- Verify: `tests/ai-summary-bkz.test.js`
- Verify: Syntax / Lint kontrolü (`node --check`)

**Step 1: Tüm Testleri Çalıştır**
Run: `node --test tests/ai-summary-bkz.test.js`

**Step 2: JavaScript Syntax Kontrolü**
Run: `node --check src/content/filter.js`
Run: `node --check src/services/ai/AIService.js`

**Step 3: Özet Kartı Örnek Çıktısının Doğrulanması**
Örnek AI özet metninin `formatSummaryMarkdown` fonksiyonundan geçirilerek hem `ekst-hidden-bkz` hem `ekst-mood-badge` hem de `ekst-cluster-card` yapılarının kusursuz şekilde bir arada çalıştığının onaylanması.
