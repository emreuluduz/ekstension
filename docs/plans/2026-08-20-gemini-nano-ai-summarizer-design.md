# ek$tension - Gemini Nano AI Başlık ve Entry Özetleyici Tasarım Dokümanı

**Tarih:** 2026-08-20  
**Durum:** Onaylandı  
**Yazar:** Antigravity & Emre Uluduz  

---

## 1. Genel Bakış ve Amaç
`ek$tension` eklentisine, Ekşi Sözlük başlıklarını (tüm sayfalarındaki tüm entry'leri tarayarak) ve uzun tekil entry'leri (>500 karakter) tamamen ücretsiz, sıfır harici sunucu maliyetli ve yerel çalışan Chrome **Gemini Nano** (Prompt API / Summarizer API) ile özetleyen akıllı bir yapay zeka sistemi entegre etmek.

Mimari, ileride tek bir ayar/sağlayıcı değişikliğiyle Google Gemini Flash / Cloud API Key entegrasyonuna imkan tanıyacak şekilde modüler (Provider pattern) tasarlanacaktır.

---

## 2. Mimari ve Bileşenler

```
src/
├── services/
│   └── ai/
│       ├── AIService.js              # Görev yöneticisi & sağlayıcı yönlendirici
│       ├── BaseAIProvider.js         # Ortak AI Arayüzü (isAvailable, summarize, summarizeStream)
│       └── providers/
│           ├── GeminiNanoProvider.js # [Aktif] Chrome Prompt/Summarizer API
│           └── GeminiAPIProvider.js  # [Gelecek Hazırlığı] Google AI Studio / Flash API
├── background/
│   ├── background.js                 # Mesaj yönlendirme & bildirim yönetimi
│   └── summarizer-task.js            # Arka plan tarama & kademeli özetleme orkestratörü
├── content/
│   ├── filter.js                     # Sözlük içi DOM entegrasyonu (Butonlar, Kartlar)
│   ├── components/
│   │   ├── summary-card.js           # Başlık üstü özet paneli
│   │   ├── floating-progress.js      # Yüzen ilerleme hapı (Floating progress pill)
│   │   └── toast-notification.js     # Sayfa içi tamamlama bildirimi
│   └── content.css                   # Özet paneli, floating pill & toast stilleri
```

---

## 3. Detaylı İşleyiş & Veri Akışı

### 3.1. Çok Sayfalı Başlıkların Taranması (Safe Crawler)
1. Kullanıcı başlık sayfasındaki `[ ⚡ Başlığı Özetle (AI) ]` butonuna basar.
2. İşlem Background Service Worker'a iletilir ve `chrome.storage.local` üzerinde task durumu başlatılır.
3. Crawler 1. sayfadan toplam sayfa sayısına kadar tüm sayfaları sırayla, Cloudflare ve hız limitlerine takılmamak adına 400-800ms jittered gecikmelerle arka planda çeker.
4. Her sayfa çekildiğinde kullanıcıya canlı ilerleme aktarılır (`Sayfa 3 / 12 taranıyor... %25`).

### 3.2. Kademeli Özetleme (Map-Reduce Chunking)
1. Çekilen tüm entry'ler reklam ve gereksiz HTML etiketlerinden arındırılarak 15-20 entry'lik bloklara (chunks) ayrılır.
2. Gemini Nano her blok için ana argümanları ve görüşleri içeren ara özetler üretir (`Blok 2/4 analiz ediliyor...`).
3. Tüm ara özetler birleştirilerek nihai master prompt ile yapılandırılmış tek bir özet haline getirilir:
   - 📌 **Konu Nedir / Olayın Özeti**
   - ⚖️ **Farklı Görüşler & Tartışmalar** (Lehte/Aleyhte görüşler)
   - 💡 **Öne Çıkan Detaylar / Ortak Kanı**

### 3.3. Tekil Entry Özetleme (>500 Karakter)
1. Metin uzunluğu 500 karakteri aşan entry'lerin araç çubuğuna `[ ⚡ Özetle ]` ikonu eklenir.
2. Tıklandığında sadece ilgili entry Gemini Nano'ya gönderilerek 1-2 saniye içinde entry altına şık bir özet kutusu olarak yerleştirilir.

### 3.4. Sekmeler Arası Süreklilik ve Çift Kademeli Bildirim
* Kullanıcı sayfayı kaydırsa veya başka sekmeye geçse dahi arka plan görevi kesintisiz devam eder.
* Sağ alttaki **Floating Progress Pill** üzerinden anlık durum izlenebilir veya `[ ✕ ]` ile iptal edilebilir.
* İşlem bittiğinde:
  - Kullanıcı sözlük sekmesindeyse: Sağ altta animasyonlu **Toast Bildirim** çıkar. Tıklanınca sayfayı özet kartına kaydırır.
  - Kullanıcı başka sekmedeyse: **Chrome Desktop Bildirimi** gönderilir. Tıklanınca sekmeye odaklanır.

---

## 4. Hata Yönetimi & Bellek (Caching)
* **Model Kontrolü:** `ai.languageModel.capabilities()` kontrol edilir; Gemini Nano aktif değilse kurulum adımlarını gösteren bilgilendirici modal açılır.
* **Cloudflare Dayanıklılığı:** Sayfa çekme esnasında challenge çıkarsa yerleşik offscreen solver devreye girer ve taramaya devam edilir.
* **Yerel Bellek (Cache):** Üretilen özetler `chrome.storage.local` içinde saklanır; aynı oturumda tekrar istendiğinde anında gösterilir (yenileme opsiyonuyla).

---

## 5. Başarı Kriterleri
- [x] Tüm sayfaların Cloudflare engeline takılmadan taranması
- [x] Sekmeler arası kesintisiz arka plan işleyişi
- [x] Gemini Nano ile %100 yerel ve ücretsiz özetleme
- [x] >500 karakterlik tekil entry'leri anında özetleyebilme
- [x] Şık UI (Özet kartı, yüzen ilerleme kapsülü, toast ve masaüstü bildirimi)
- [x] Gelecekte harici API Key eklenebilecek modüler mimari
