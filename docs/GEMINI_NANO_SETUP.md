# 🧠 Chrome Built-in AI (Gemini Nano / LanguageModel) Kurulum Rehberi

Google Chrome, tarayıcının içerisine yerleşik **Gemini Nano** temel modelini entegre etmiştir. Bu model sayesinde eklenti, hiçbir API anahtarı veya harici sunucuya ihtiyaç duymadan **%100 yerel ve ücretsiz** olarak çalışır.

Eğer eklentide *"Gemini Nano / LanguageModel bulunamadı"* uyarısı alıyorsanız, aşağıdaki 2 dakikalık adımları takip ederek tarayıcınızda yerel yapay zekayı aktif edebilirsiniz.

---

## 📋 1. Adım: Chrome Flags Ayarları

Chrome adres çubuğuna aşağıdaki adresleri tek tek yapıştırıp ayarları değiştirin:

1. **Prompt API'yi Açın:**
   * Adres çubuğuna yazın: `chrome://flags/#prompt-api-for-gemini-nano`
   * Seçeneği **`Enabled`** yapın.

2. **On-Device Model Desteğini Açın:**
   * Adres çubuğuna yazın: `chrome://flags/#optimization-guide-on-device-model`
   * Seçeneği **`Enabled BypassPerfRequirement`** yapın.

3. **Chrome'u Yeniden Başlatın:**
   * Sayfanın sağ altında beliren mavi **"Relaunch" (Yeniden Başlat)** butonuna tıklayın.

---

## 📦 2. Adım: Modelin İndirilmesi

1. Chrome adres çubuğuna şunu yazın:
   * `chrome://components`
2. Sayfada **"Optimization Guide On Device Model"** satırını bulun.
3. Versiyon numarası `0.0.0.0` ise:
   * **"Check for update" (Güncellemeleri denetle)** butonuna tıklayın.
   * Model arka planda inmeye başlayacaktır (~1.5 GB). İndirme bittiğinde versiyon numarası güncellenecektir (örn: `2024.x.x.x`).

---

## ✅ 3. Adım: Doğrulama (Test)

Herhangi bir sekmede Geliştirici Konsolunu açın (`F12` veya `Ctrl+Shift+I` / `Cmd+Opt+I` -> **Console**):

```javascript
await LanguageModel.availability()
```
veya
```javascript
await ai.languageModel.capabilities()
```

* Çıktı olarak `"available"` veya `{ available: "readily" }` görüyorsanız Gemini Nano başarıyla kurulmuştur!

---

## ⚡ 4. Adım: Eklentiyi Test Etme

1. `chrome://extensions/` sayfasında **ek$tension** eklentisinin yanındaki **Yenile (Refresh)** butonuna basın.
2. Ekşi Sözlük'te herhangi bir başlığa gidin.
3. Başlık üstündeki **`[ ⚡ Başlığı Özetle (AI) ]`** butonuna veya uzun entry'lerin altındaki **`[ ⚡ Özetle ]`** butonuna tıklayın.
