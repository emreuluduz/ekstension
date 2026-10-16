# Design Document: Sponsorlu Entry Sansürleme ve Gizleme

**Tarih:** 2026-10-16  
**Durum:** Onaylandı (Approved)  
**Kapsam:** Ekşi Sözlük Sponsorlu Entry'lerinin Sansürlenmesi ve Kullanıcı Kontrollü Gösterimi

---

## 1. Genel Bakış ve Amaç
Ekşi Sözlük üzerinde yer alan kurumsal veya bireysel sponsorlu entry'ler (`#corporate-content-sponsored-entry`, `span.sponsored`), sözlük akışında kullanıcı deneyimini olumsuz etkileyebilmektedir. Bu özelliğin amacı:
- Sponsorlu entry'leri otomatik olarak tespit etmek,
- Entry metnini ve footer bileşenlerini varsayılan olarak gizlemek,
- Mevcut `ek$tension` arayüz tasarım diliyle (%100 uyumlu) bir placeholder ("📢 Sponsorlu içerik gizlendi (@yazar)") ve "Göster / Gizle" butonu sunmak,
- Eklenti ayarları (Popup -> Settings -> General) içerisinden bu özelliğin açılıp kapatılabilmesini sağlamak.

---

## 2. Mimari ve Bileşenler

### 2.1 DOM Tespit ve Seçici Mantığı
Ekşi Sözlük entry'leri `#entry-item-list > li` (veya `li[data-id]`) elemanlarıdır. Bir entry'nin sponsorlu olduğu aşağıdaki eleman varlıklarıyla doğrulanır:
- `entry.querySelector('#corporate-content-sponsored-entry, .sponsored, span[id*="sponsored"]')`
- Entry footer'ında veya başlığında bulunan sponsorlu göstergeleri.

### 2.2 Filtreleme & Yaşam Döngüsü (`src/content/filter.js`)
- `state.censorSponsored`: Varsayılan olarak `true` (Storage'dan okunur).
- `applySponsoredEntryCensoring()` fonksiyonu:
  1. Entry'leri tarar; sponsorlu olanları tespit eder.
  2. Eğer entry yazar engellemesi (`applyAuthorBlocking`) tarafından zaten gizlenmişse çakışma önlenir.
  3. `.content` ve `footer` elemanlarını gizler (`style.display = 'none'`).
  4. `.ekstension-sponsored-blocked-placeholder` elemanını entry'nin en üstüne yerleştirir.
  5. Butona basıldığında `.content` ve `footer` toggle edilerek "Göster" / "Gizle" durumu güncellenir.
  6. Sonsuz kaydırma (infinite scroll) ve yeni entry yüklemelerinde `runAllEnhancements()` ve `MutationObserver` üzerinden otomatik çalışır.

### 2.3 UI & Stil Şablonu (`src/content/content.css`)
```html
<div class="ekstension-sponsored-blocked-placeholder">
  <div class="ekstension-sponsored-info">
    <span class="ekstension-sponsored-icon">📢</span>
    <span>Sponsorlu içerik gizlendi (<strong class="ekstension-author-name">@${author}</strong>)</span>
    <span class="ekstension-sponsored-badge">sponsorlu</span>
  </div>
  <div class="ekstension-placeholder-actions">
    <button class="ekstension-toggle-sponsored-entry" type="button">Göster</button>
  </div>
</div>
```
- `.ekstension-author-blocked-placeholder` ile aynı border-radius, font-size ve boşluk oranlarını taşır.
- Açık temada temiz gri/sarımsı badge ve kesikli kenarlık; koyu temada (`body.theme-dark`, `body[data-theme="dark"]`) uyumlu koyu transparan zemin ve yumuşak kenarlık uygulanır.

### 2.4 Eklenti Ayarları & Depolama (`src/actions/` & `_locales/`)
- `chrome.storage.sync` (fallback: `local`) anahtarı: `censor_sponsored_entries` (boolean, default: `true`).
- Popup ayarlarındaki Genel sekmesine açık/kapalı toggle kutusu eklenir.
- `_locales/tr/messages.json` ve `_locales/en/messages.json` dosyalarına `censor_sponsored_label` ve `censor_sponsored_desc` eklenir.
- Ayar değiştiğinde `chrome.storage.onChanged` veya doğrudan mesajlaşma ile sekmelere anında yansıtılır.

---

## 3. Test ve Doğrulama Kriterleri
1. Örnek sponsorlu entry (`timurun fillerinin bakicisi`, `#corporate-content-sponsored-entry`) içeren entry'nin içeriği sayfa açıldığında gizlenmeli.
2. Placeholder üzerinde yazar adı ve rozet doğru görünmeli.
3. "Göster" butonuna tıklandığında metin ve footer açılmalı, buton "Gizle" olmalı.
4. "Gizle" butonuna tıklandığında tekrar kapanmalı.
5. Popup ayarlarından özellik kapatıldığında tüm sponsorlu entry'ler normal görünümüne dönmeli.
6. Sonsuz kaydırma ile gelen sponsorlu entry'ler de gecikmesiz filtrelenmeli.
