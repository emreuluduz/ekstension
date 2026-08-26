import { GeminiAPIProvider } from './providers/GeminiAPIProvider.js';

export class AIService {
  constructor() {
    this.cloudProvider = new GeminiAPIProvider();
  }

  /**
   * Set API Key
   */
  setCloudApiKey(apiKey) {
    this.cloudProvider.setApiKey(apiKey);
  }

  /**
   * Get active provider
   */
  async getActiveProvider() {
    return this.cloudProvider;
  }

  /**
   * Check if Gemini API is ready
   */
  async checkAvailability() {
    const status = await this.cloudProvider.isAvailable();
    return { ...status, provider: 'gemini-flash' };
  }

  /**
   * Summarize a single long entry (>500 chars)
   */
  async summarizeSingleEntry(entryText, author = '', options = {}) {
    const prompt = `Aşağıdaki uzun Ekşi Sözlük entry'sini EN FAZLA 2 KISA MADDEDE, çok net ve vurucu biçimde özetle. Özet kesinlikle kısa olmalı (en fazla 2 kısa cümle). Asla giriş cümlesi kurma, doğrudan maddeleri ver.

Yazar: @${author}
Entry:
"${entryText.trim()}"

Format:
• (Yazarın ana iddiası / savunduğu temel fikir - 1 kısa cümle)
• (Varsa öne sürdüğü en somut argüman veya örnek - 1 kısa cümle)`;

    return await this.cloudProvider.summarize(prompt, {
      systemPrompt: 'Sen Ekşi Sözlük için çalışan son derece özlü, tarafsız ve keskin bir yapay zeka asistanısın. ASLA gevezelik yapma; giriş/bağlaç cümleleri kullanma. Doğrudan ana fikri ve can alıcı noktaları net maddelerle ver.',
      ...options
    });
  }

  /**
   * Summarize all entries from a topic using Gemini Flash (1M Token Context)
   * @param {Array<{id: string, author: string, date: string, content: string, favCount?: string}>} entries
   * @param {string} topicTitle
   * @param {function({stage: string, progress: number, message: string}): void} onProgress
   * @param {Object} [options]
   * @param {number} [options.totalPages]
   * @param {number[]} [options.sampledPages]
   * @param {boolean} [options.isSampled]
   */
  async summarizeTopic(entries, topicTitle, onProgress = () => { }, options = {}) {
    if (!entries || entries.length === 0) {
      throw new Error('Özetlenecek entry bulunamadı.');
    }

    const availability = await this.cloudProvider.isAvailable();
    if (!availability.available) {
      throw new Error(availability.reason || 'Gemini API Key bulunamadı.');
    }

    onProgress({
      stage: 'analyzing',
      progress: 75,
      message: `${entries.length} entry Gemini Flash ile analiz ediliyor...`
    });

    // Clean text & format entries
    const formattedEntries = entries.map((e, idx) => {
      const cleanContent = e.content
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      return `[Entry #${idx + 1} | Yazar: @${e.author || 'yazar'} | ${e.date || ''}]:\n${cleanContent}`;
    });

    const isSampled = options.isSampled || false;
    const totalPages = options.totalPages || 1;
    const sampledPages = options.sampledPages || [];

    const metaLines = [`Başlık: "${topicTitle}"`, `İncelenen Entry Sayısı: ${formattedEntries.length}`];
    if (totalPages > 1) {
      if (isSampled && sampledPages.length > 0) {
        metaLines.push(`Toplam Sayfa Sayısı: ${totalPages} (Dönemsel Temsil / Akıllı Örneklem: Sayfa ${sampledPages.join(', ')})`);
      } else {
        metaLines.push(`Toplam Sayfa Sayısı: ${totalPages}`);
      }
    }

    const prompt = `${metaLines.join('\n')}

ENTRY'LER (Tarih ve yazarlarıyla birlikte):
${formattedEntries.join('\n\n---\n\n')}

Sen Ekşi Sözlük başlıklarını analiz eden kıdemli, tarafsız ve keskin bir asistansın.
Sana bir Ekşi Sözlük başlığının adı ve o başlıktaki entry'ler verildi.

GÖREVİN:
Entry'leri tek tek özetlemek veya "şu şöyle dedi" diye saymak değil; başlığın özünü, tartışma dinamiklerini ve varsa yıllar/dönemler içindeki evrimini (kümeleme / cluster) en net, taranabilir ve vurucu formatta sunmaktır.

UYULMASI ZORUNLU KURALLAR:
1. İRONİ, SARKAZM VE TROLLÜK AYRIMI: Ekşi Sözlük'e özgü mizah, taşlama, kinaye ve trolleri gerçek görüşlerden titizlikle ayır. Küfürleri ve kaba ifadeleri temizle.
2. POPÜLERLİK ≠ DOĞRULUK: Entry sayısı fazla olan görüşü otomatik olarak nesnel doğru kabul etme. "Sözlük çoğunluğunun eğilimi" veya "yaygın kanaat" olarak yansıt.
3. KİŞİSEL DENEYİMLERİ AYRIŞTIR: "Ben yaşadım", "bende şöyle oldu" gibi kişisel anekdotları genel gerçek gibi sunma; "bazı yazarların deneyimlerine göre" şeklinde konumlandır.
4. KÜMELEME (CLUSTER) STRATEJİSİ:
   * Eğer başlık yıllara yayılmışsa (veya farklı sayfalar/dönemler içeriyorsa), tartışmanın evrimini 2-4 mantıksal DÖNEME (örn. [2010-2017: İlk Dönem & Popülerlik], [2018-2022: Kriz & Eleştiriler], [2023-Günümüz: Son Durum]) ayır.
   * Eğer başlık tekil bir olayı veya ürünü anlatıyorsa, TEMATİK BOYUTLARA (örn. [Performans & Nitelik], [Fiyat & Değer Tartışması], [Kullanıcı Deneyimi]) ayır.
   * Eğer başlık kısa ve tek boyutluysa doğrudan ana görüş kutuplarına göre özetle.
5. TEKRARLARI BİRLEŞTİR: Aynı argümanı savunan onlarca entry'yi tek bir güçlü madde altında topla. "X şöyle demiş, Y böyle demiş" deme.
6. SOMUT BİLGİLERİ KORU: İsim, tarih, fiyat, model, yasa, istatistik gibi kritik veriler varsa koru. Doğrulanmamış spekülasyonları "iddia ediliyor" olarak belirt.
7. UYDURMA: Entry'lerde olmayan hiçbir bilgi veya şahsi yorum ekleme. Çelişkili görüşler varsa çelişkiyi koru.

ÇIKTI FORMATI (Aşağıdaki Markdown başlıklarını ve etiket formatını harfiyen uygula):

### 📌 Başlık Özeti
(Başlığın temel konusunu ve genel tartışmayı anlatan 2-3 net cümle. Anahtar kavramları **kalın** yap.)

### 🎭 Genel Hava
#etiket1 #etiket2 #etiket3 (Örn: #tartışmalı #mizahi #bilgilendirici #kutuplaşmış #deneyim-ağırlıklı #sitemkâr)

### 🧭 Tartışma Kırılımları & Kümeler
* **[Dönem veya Tema Adı - örn: 2012-2018: İlk Çıkış & Beğeni / veya Teknik Boyut]:**
  - **Hâkim Görüş:** Bu kümedeki ana fikir veya çoğunluk yaklaşımı.
  - **Eleştiri / Karşıt Bakış:** Varsa öne çıkan itirazlar veya farklı deneyimler.

* **[Dönem veya Tema Adı - örn: 2019-Günümüz: Kırılma ve Son Durum / veya Fiyat-Değer Dengesi]:**
  - **Hâkim Görüş:** Bu kümedeki ana fikir veya güncel durum.
  - **Eleştiri / Karşıt Bakış:** Varsa öne çıkan itirazlar veya karşıt sesler.

### 💡 Dikkat Çeken / Nüans
(Başlıkta genel eğilimden ayrılan, şaşırtıcı, azınlıkta kalan veya ufuk açıcı tek bir can alıcı tespit. Yoksa bu bölümü hiç yazma.)

ÖNEMLİ:
Çıktıda entry numarası veya yazar kullanıcı adı zikretme. Doğrudan yukarıdaki markdown formatında yanıt ver.
`;

    return await this.cloudProvider.summarize(prompt, {
      temperature: 0.2
    });
  }
}

export const aiService = new AIService();
