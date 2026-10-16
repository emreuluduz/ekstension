# AI Başlık Özetlerinde Ekşi Sözlük Tarzı Gizli Bkz (Hidden Bkz) Tasarım Dokümanı

- **Tarih:** 2026-09-19
- **Durum:** Onaylandı

## 1. Genel Bakış ve Amaç
Ekşi Sözlük başlık özetleme özelliği çalıştığında, başlığın kilit kavramları ve sözlükte karşılığı olabilecek anahtar sözcük grupları Ekşi Sözlük'ün özgün gizli bkz (`kelime*`) formatıyla entegre edilir. Böylece okuyucu hem sözlük ruhuna uygun bir formatla karşılaşır hem de özet kartından ayrılmadan veya mevcut sayfa kaybolmadan ilgili kavramları yeni sekmede Ekşi Sözlük araması (`/?q=kavram`) olarak açabilir.

## 2. Mimari ve Tasarım Bileşenleri

### A. AI Prompt Mimarisi (`src/services/ai/AIService.js`)
- Gemini Flash özet prompt'una Ekşi Sözlük gizli bkz kuralı eklenir:
  - Özette geçen anahtar kavramlar, kişi/olay adları ve terimler `[kavram]*` formatında işaretlenir (örn: `[enflasyon]*`, `[merkez bankası]*`).
  - `**kalın**` formatı ise salt dikkat çekme ve yapısal başlıklar (`**Hâkim Görüş:**` vb.) için ayrılır.
  - Bu sayede yapısal etiketler ile sözlük başlığı referansları birbirine karışmaz.

### B. Markdown & Metin Ayrıştırma Motoru (`src/content/filter.js`)
- `formatSummaryMarkdown` fonksiyonunda gizli bkz formatı regex ile yakalanır:
  - Birincil format: `\[(.*?)\]\*`
  - Tolerans / Fallback formatları: `\`(.*?)\`` veya `\(bkz:\s*(.*?)\)\*`
- Eşleşen ifadeler güvenli HTML bağlantılarına dönüştürülür:
  ```html
  <a href="https://eksisozluk.com/?q=${encodeURIComponent(kavram)}" 
     class="ekst-hidden-bkz" 
     target="_blank" 
     rel="noopener noreferrer" 
     title="bkz: ${kavram}">
    ${kavram}<sup class="ekst-bkz-asterisk">*</sup>
  </a>
  ```
- URL encode işlemi yapılarak Türkçe karakterler ve boşluklar güvenle sözlük arama URL'ine taşınır.
- XSS koruması için mevcut escape yapısı korunur.

### C. Arayüz ve Stil (`src/content/content.css`)
- `.ekst-hidden-bkz`:
  - Ekşi Sözlük'ün kurumsal yeşil link rengi (`#81c14b` veya açık/koyu temaya uygun yeşil tonu).
  - Kelimenin altında hafif noktalı çizgi (`border-bottom: 1px dotted currentColor`).
  - Tıklanabilir el imleci (`cursor: pointer`).
  - Text-decoration: none.
  - Hover durumunda renk parlaklığı artışı veya arka plan hafif aydınlatması.
- `.ekst-bkz-asterisk`:
  - Üst simge (`<sup>`) veya `vertical-align: super`, hafif font boyutu, yeşil renk, sağa hafif boşluk.
- Native `title="bkz: kavram"` özniteliği ile tarayıcının yerel araç ipucu (tooltip) gösterimi.

## 3. Doğrulama ve Test Kriterleri
1. **Bkz Dönüşüm Doğruluğu:** `[kavram]*` metinlerinin HTML'e doğru `a.ekst-hidden-bkz` olarak dönüştüğünün birim testi ile doğrulanması.
2. **Yapısal Etiket Bütünlüğü:** `**Hâkim Görüş:**` gibi yapısal kalın metinlerin bozulmadan kalması.
3. **Fallback Toleransı:** `\`kavram\`` ve `(bkz: kavram)*` varyasyonlarının doğru işlenmesi.
4. **URL Encoding:** Türkçe karakterli terimlerin (örn: `[türk lirası]*`) `https://eksisozluk.com/?q=t%C3%BCrk%20liras%C4%B1` şeklinde doğru kodlanması.
5. **Yeni Sekme Güvenliği:** `target="_blank"` ve `rel="noopener noreferrer"` özniteliklerinin varlığı.
