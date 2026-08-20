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
   */
  async summarizeTopic(entries, topicTitle, onProgress = () => {}) {
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

    const prompt = `Başlık: "${topicTitle}"
İncelenen Entry Sayısı: ${formattedEntries.length}

Aşağıdaki Ekşi Sözlük başlığı altındaki entry'leri oku. Uzatmadan, lafı dolandırmadan son derece net ve öz bir özet çıkar.

ENTRY'LER:
${formattedEntries.join('\n\n---\n\n')}

Lütfen tam olarak şu kısa ve net formatta yaz:
📌 **Konu Nedir?**
(Olayı veya konunun ne olduğunu 1-2 net cümleyle açıkla)

⚖️ **Öne Çıkan Görüşler**
• **Savunanlar / Destekleyenler:** (Ana argümanı 1 kısa cümle)
• **Eleştirenler / Karşı Çıkanlar:** (Ana eleştiriyi 1 kısa cümle)
• **Farklı / İlginç Bakış:** (Varsa dikkat çeken farklı bir yaklaşım - 1 kısa cümle)

💡 **Genel Sonuç / Ortak Kanı**
(Sözlük yazarlarının ağırlıklı eğilimini 1 kısa cümleyle belirt)`;

    return await this.cloudProvider.summarize(prompt, {
      temperature: 0.2
    });
  }
}

export const aiService = new AIService();
