const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// filter.js içerisindeki formatSummaryMarkdown fonksiyonunu yükle
// filter.js content script olduğundan, izole context sağlamak için vm veya doğrudan require kullanabiliriz.
let formatSummaryMarkdown;
try {
  const filterModule = require('../src/content/filter.js');
  formatSummaryMarkdown = filterModule.formatSummaryMarkdown;
} catch (e) {
  // Eğer module.exports henüz eklenmemişse filter.js metninden fonksiyonu çıkar
  const filterCode = fs.readFileSync(path.join(__dirname, '../src/content/filter.js'), 'utf8');
  const fnMatch = filterCode.match(/function formatSummaryMarkdown\(mdText\) \{[\s\S]*?\n\}/);
  if (fnMatch) {
    const fnWrapper = new Function(`
      ${fnMatch[0]}
      return formatSummaryMarkdown;
    `);
    formatSummaryMarkdown = fnWrapper();
  }
}

test('formatSummaryMarkdown: [kavram]* formatını gizli bkz linkine dönüştürür', () => {
  const input = 'Türkiye ekonomisinde [enflasyon]* ve [merkez bankası]* kararları belirleyici oldu.';
  const output = formatSummaryMarkdown(input);

  // Link formatı: <a href="https://eksisozluk.com/?q=..." class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: ...">...</a>
  assert.match(
    output,
    /<a href="https:\/\/eksisozluk\.com\/\?q=enflasyon" class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: enflasyon">enflasyon<\/a>/
  );
  assert.match(
    output,
    /<a href="https:\/\/eksisozluk\.com\/\?q=merkez%20bankas%C4%B1" class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: merkez bankası">merkez bankası<\/a>/
  );
});

test('formatSummaryMarkdown: Türkçe karakterli terimleri doğru URL encode eder', () => {
  const input = 'Tartışmalarda [türk lirası]* ve [faiz artışı]* öne çıkıyor.';
  const output = formatSummaryMarkdown(input);

  assert.match(output, /https:\/\/eksisozluk\.com\/\?q=t%C3%BCrk%20liras%C4%B1/);
  assert.match(output, /https:\/\/eksisozluk\.com\/\?q=faiz%20art%C4%B1%C5%9F%C4%B1/);
  assert.match(output, /title="bkz: türk lirası"/);
});

test('formatSummaryMarkdown: fallback olarak `kavram` ve (bkz: kavram)* formatlarını da yakalar', () => {
  const input = 'Bazı yazarlar `asgari ücret` ve (bkz: alım gücü)* konularına değindi.';
  const output = formatSummaryMarkdown(input);

  assert.match(output, /https:\/\/eksisozluk\.com\/\?q=asgari%20%C3%BCcret/);
  assert.match(output, /https:\/\/eksisozluk\.com\/\?q=al%C4%B1m%20g%C3%BCc%C3%BC/);
});

test('formatSummaryMarkdown: yapısal etiketler ve küme başlıkları [kavram]* regexinden etkilenmez', () => {
  const input = `### 🧭 Tartışma Kırılımları & Kümeler
* **[2012-2018: İlk Çıkış & Beğeni]:**
  - **Hâkim Görüş:** [dolar kuru]* etkisi hissedilmeye başlandı.
  - **Eleştiri / Karşıt Bakış:** Bazı itirazlar yükseldi.`;

  const output = formatSummaryMarkdown(input);

  // Küme kartı oluşmalı
  assert.match(output, /class="ekst-cluster-card"/);
  assert.match(output, /2012-2018: İlk Çıkış &amp; Beğeni/);

  // **Hâkim Görüş:** strong kalmalı
  assert.match(output, /<strong>Hâkim Görüş:<\/strong>/);

  // [dolar kuru]* gizli bkz'ye dönüşmeli
  assert.match(output, /class="ekst-hidden-bkz"/);
  assert.match(output, /q=dolar%20kuru/);
});

test('formatSummaryMarkdown: zararlı HTML karakterlerini güvenle escape eder', () => {
  const input = 'Kullanıcı [test <script>alert(1)</script>]* hakkında yazdı.';
  const output = formatSummaryMarkdown(input);

  assert.doesNotMatch(output, /<script>/);
  assert.match(output, /&lt;script&gt;/);
});

test('formatSummaryMarkdown: tam ölçekli başlık özeti çıktısını kusursuz ayrıştırır', () => {
  const fullSummaryMarkdown = `### 📌 Başlık Özeti
Tartışma genel olarak [yapay zeka]* teknolojilerinin iş gücü üzerindeki etkisi ve [türkiye]* pazarındaki yansımaları etrafında şekilleniyor. **Verimlilik artışı** temel argüman olarak sunuluyor.

### 🎭 Genel Hava
#teknoloji #tartışmalı #endişe #gelecek

### 🧭 Tartışma Kırılımları & Kümeler
* **[2023-2024: İlk Heyecan & Hızlı Adaptasyon]:**
  - **Hâkim Görüş:** Birçok yazar [chatgpt]* ve üretken modellerin günlük işleri hızlandırdığını savunuyor.
  - **Eleştiri / Karşıt Bakış:** Bazı kullanıcılar ise telif hakları ve [etik sorunlar]* sebebiyle tepkili.

### 💡 Dikkat Çeken / Nüans
Geliştiricilerin büyük kısmı bu dönüşümün meslekleri yok etmek yerine [yeni uzmanlık alanları]* yaratacağına inanıyor.`;

  const output = formatSummaryMarkdown(fullSummaryMarkdown);

  // 1. Başlık bölümleri
  assert.match(output, /<div class="ekst-summary-section-title">📌 Başlık Özeti<\/div>/);
  assert.match(output, /<div class="ekst-mood-badges-container">/);
  assert.match(output, /<span class="ekst-mood-badge">#teknoloji<\/span>/);
  assert.match(output, /<span class="ekst-mood-badge">#tartışmalı<\/span>/);

  // 2. Küme kartı
  assert.match(output, /<div class="ekst-cluster-card">/);
  assert.match(output, /<div class="ekst-cluster-title">🔹 2023-2024: İlk Heyecan &amp; Hızlı Adaptasyon<\/div>/);
  assert.match(output, /<strong>Hâkim Görüş:<\/strong>/);

  // 3. Nüans çağrı kutusu
  assert.match(output, /<div class="ekst-nuance-callout">/);
  assert.match(output, /<div class="ekst-nuance-title">💡 Dikkat Çeken \/ Nüans<\/div>/);

  // 4. Gizli bkz'ler
  assert.match(output, /<a href="https:\/\/eksisozluk\.com\/\?q=yapay%20zeka" class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: yapay zeka">yapay zeka<\/a>/);
  assert.match(output, /<a href="https:\/\/eksisozluk\.com\/\?q=t%C3%BCrkiye" class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: türkiye">türkiye<\/a>/);
  assert.match(output, /<a href="https:\/\/eksisozluk\.com\/\?q=chatgpt" class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: chatgpt">chatgpt<\/a>/);
  assert.match(output, /<a href="https:\/\/eksisozluk\.com\/\?q=etik%20sorunlar" class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: etik sorunlar">etik sorunlar<\/a>/);
  assert.match(output, /<a href="https:\/\/eksisozluk\.com\/\?q=yeni%20uzmanl%C4%B1k%20alanlar%C4%B1" class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: yeni uzmanlık alanları">yeni uzmanlık alanları<\/a>/);

  // 5. Normal kalın vurgular korunmalı
  assert.match(output, /<strong>Verimlilik artışı<\/strong>/);
});

test('formatSummaryMarkdown: dizi/film ve sanat bağlamındaki yönetmen, oyuncu ve platform bkzlerini doğru ayrıştırır', () => {
  const filmSummaryMarkdown = `### 📌 Başlık Özeti
Yönetmenliğini [christopher nolan]*'ın üstlendiği ve [cillian murphy]*'nin başrolde yer aldığı yapım, [netflix]* ve sinema gösterimleriyle geniş yankı buldu. **Görsel efektler** ve kurgu başarısı övülüyor.

### 🧭 Tartışma Kırılımları & Kümeler
* **[Oyunculuk & Yönetmenlik]:**
  - **Hâkim Görüş:** [robert downey jr]*'ın performansı dönüm noktası olarak görülüyor.`;

  const output = formatSummaryMarkdown(filmSummaryMarkdown);

  assert.match(output, /<a href="https:\/\/eksisozluk\.com\/\?q=christopher%20nolan" class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: christopher nolan">christopher nolan<\/a>/);
  assert.match(output, /<a href="https:\/\/eksisozluk\.com\/\?q=cillian%20murphy" class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: cillian murphy">cillian murphy<\/a>/);
  assert.match(output, /<a href="https:\/\/eksisozluk\.com\/\?q=netflix" class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: netflix">netflix<\/a>/);
  assert.match(output, /<a href="https:\/\/eksisozluk\.com\/\?q=robert%20downey%20jr" class="ekst-hidden-bkz" target="_blank" rel="noopener noreferrer" title="bkz: robert downey jr">robert downey jr<\/a>/);
  assert.match(output, /<strong>Görsel efektler<\/strong>/);
});

test('formatSummaryMarkdown: parantezsiz bold küme başlıklarını ve madde işaretsiz alt satırları da kart olarak ayrıştırır', () => {
  const markdownWithoutBrackets = `🎭 Genel Hava
#hayal-kırıklığı #eleştirel #teknik-tartışma #fiyat-performans

🧭 Tartışma Kırılımları & Kümeler

Genel Performans ve Rakip Kıyaslaması:
Hâkim Görüş: Aracın özellikle son dönemde belirgin şekilde gerilediği yönündedir.
Eleştiri / Karşıt Bakış: Yazarların bir kısmı [google one]* paketleri sayesinde kullanışlı olduğunu savunmaktadır.

Politika Değişiklikleri ve Maliyet Optimizasyonu:
Hâkim Görüş: Google'ın maliyetleri düşürmek amacıyla kısıtladığı iddia edilmektedir.
Eleştiri / Karşıt Bakış: Bazı kullanıcılar yeni sürümlerle düzeleceğini öngörmektedir.

💡 DİKKAT ÇEKEN / NÜANS
Yazarlar arasında "adamına göre muamele" teorisi öne sürülmüştür.`;

  const output = formatSummaryMarkdown(markdownWithoutBrackets);

  // Genel hava rozetleri
  assert.match(output, /<span class="ekst-mood-badge">#hayal-kırıklığı<\/span>/);

  // 1. Küme kartı oluşmalı
  assert.match(output, /<div class="ekst-cluster-card">/);
  assert.match(output, /<div class="ekst-cluster-title">🔹 Genel Performans ve Rakip Kıyaslaması<\/div>/);

  // 2. Küme kartı oluşmalı
  assert.match(output, /<div class="ekst-cluster-title">🔹 Politika Değişiklikleri ve Maliyet Optimizasyonu<\/div>/);

  // Nüans kartı oluşmalı
  assert.match(output, /<div class="ekst-nuance-callout">/);
});
