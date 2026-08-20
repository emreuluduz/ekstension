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
    const prompt = `Aşağıdaki Ekşi Sözlük entry'sini analiz et ve 2-3 maddelik kısa, tarafsız ve net bir özet çıkar.

Yazar: ${author || 'Bilinmeyen Yazar'}
Entry Metni:
"${entryText.trim()}"

Lütfen doğrudan özet maddelerini ver:`;

    return await this.cloudProvider.summarize(prompt, {
      systemPrompt: 'Sen Ekşi Sözlük entrylerini tarafsız ve özlü biçimde özetleyen bir asistansın.',
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
Toplam İncelenen Entry Sayısı: ${formattedEntries.length}

Aşağıdaki Ekşi Sözlük başlığında yazılan entry'leri oku ve tarafsız, kapsamlı ve yapılandırılmış bir özet çıkar.

ENTRY'LER:
${formattedEntries.join('\n\n---\n\n')}

Lütfen yanıtını tam olarak şu Markdown başlıkları altında düzenle:
📌 **Konu Nedir / Olayın Özeti**
(Başlığın ve konunun ne hakkında olduğunu 2-3 net cümleyle açıkla)

⚖️ **Farklı Görüşler & Tartışmalar**
(Yazarlar arasındaki farklı bakış açılarını, savunan ve eleştiren tarafların ana argümanlarını maddeler halinde yaz)

💡 **Öne Çıkan Noktalar & Genel Kanı**
(Entry'lerde en çok vurgulanan detaylar, dikkat çeken tespitler veya ortak kanı)`;

    return await this.cloudProvider.summarize(prompt, {
      temperature: 0.3
    });
  }
}

export const aiService = new AIService();
