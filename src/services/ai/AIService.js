import { GeminiNanoProvider } from './providers/GeminiNanoProvider.js';
import { GeminiAPIProvider } from './providers/GeminiAPIProvider.js';

export class AIService {
  constructor() {
    this.nanoProvider = new GeminiNanoProvider();
    this.cloudProvider = new GeminiAPIProvider();
    this.currentProvider = this.nanoProvider;
  }

  /**
   * Set API Key for future cloud fallback
   */
  setCloudApiKey(apiKey) {
    this.cloudProvider.setApiKey(apiKey);
  }

  /**
   * Switch active provider or auto-select based on availability
   */
  async getActiveProvider() {
    const nanoCheck = await this.nanoProvider.isAvailable();
    if (nanoCheck.available) {
      return this.nanoProvider;
    }

    const cloudCheck = await this.cloudProvider.isAvailable();
    if (cloudCheck.available) {
      return this.cloudProvider;
    }

    // Default to nano even if not ready so error messages are descriptive
    return this.nanoProvider;
  }

  /**
   * Check if any AI capability is available
   */
  async checkAvailability() {
    const nanoStatus = await this.nanoProvider.isAvailable();
    if (nanoStatus.available) {
      return { ...nanoStatus, provider: 'gemini-nano' };
    }

    const cloudStatus = await this.cloudProvider.isAvailable();
    if (cloudStatus.available) {
      return { ...cloudStatus, provider: 'gemini-cloud' };
    }

    return { ...nanoStatus, provider: 'gemini-nano' };
  }

  /**
   * Summarize a single long entry (>500 chars)
   */
  async summarizeSingleEntry(entryText, author = '', options = {}) {
    const provider = await this.getActiveProvider();

    const prompt = `Aşağıdaki Ekşi Sözlük entry'sini analiz et ve 2-3 maddelik kısa, tarafsız ve net bir özet çıkar.

Yazar: ${author || 'Bilinmeyen Yazar'}
Entry Metni:
"${entryText.trim()}"

Lütfen doğrudan özet maddelerini ver:`;

    return await provider.summarize(prompt, {
      systemPrompt: 'Sen Ekşi Sözlük entrylerini tarafsız ve özlü biçimde özetleyen bir asistansın.',
      ...options
    });
  }

  /**
   * Summarize all entries from a topic using Map-Reduce Chunking
   * @param {Array<{id: string, author: string, date: string, content: string, favCount?: string}>} entries
   * @param {string} topicTitle
   * @param {function({stage: string, progress: number, message: string}): void} onProgress
   */
  async summarizeTopic(entries, topicTitle, onProgress = () => {}) {
    if (!entries || entries.length === 0) {
      throw new Error('Özetlenecek entry bulunamadı.');
    }

    const provider = await this.getActiveProvider();
    const availability = await provider.isAvailable();
    if (!availability.available && availability.status !== 'ready' && availability.status !== 'needs_download') {
      throw new Error(availability.reason || 'Yapay zeka modeli kullanılamıyor.');
    }

    // Clean text & format entries
    const formattedEntries = entries.map((e, idx) => {
      const cleanContent = e.content
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      return `[Entry #${idx + 1} | Yazar: @${e.author || 'yazar'} | ${e.date || ''}]:\n${cleanContent}`;
    });

    const CHUNK_SIZE = 12; // 12 entries per block to stay safely under local token limit

    // If small topic, summarize in 1 direct step
    if (formattedEntries.length <= CHUNK_SIZE) {
      onProgress({
        stage: 'analyzing',
        progress: 80,
        message: 'Entry\'ler Gemini Nano ile analiz ediliyor...'
      });

      const prompt = `Başlık: "${topicTitle}"
Toplam Entry Sayısı: ${formattedEntries.length}

Aşağıdaki Ekşi Sözlük başlığında yazılan tüm entry'leri oku ve tarafsız, kapsamlı ve yapılandırılmış bir özet çıkar.

ENTRY'LER:
${formattedEntries.join('\n\n---\n\n')}

Lütfen yanıtını tam olarak şu Markdown başlıkları altında düzenle:
📌 **Konu Nedir / Olayın Özeti**
(Başlığın ve konunun ne hakkında olduğunu 2-3 net cümleyle açıkla)

⚖️ **Farklı Görüşler & Tartışmalar**
(Yazarlar arasındaki farklı bakış açılarını, savunan ve eleştiren tarafların ana argümanlarını maddeler halinde yaz)

💡 **Öne Çıkan Noktalar & Genel Kanı**
(Entry'lerde en çok vurgulanan detaylar veya ortak kanı)`;

      return await provider.summarize(prompt);
    }

    // Multi-chunk Map-Reduce
    const chunks = [];
    for (let i = 0; i < formattedEntries.length; i += CHUNK_SIZE) {
      chunks.push(formattedEntries.slice(i, i + CHUNK_SIZE));
    }

    const chunkSummaries = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkNumber = i + 1;
      const progressPercent = 50 + Math.round(((i + 1) / chunks.length) * 35);

      onProgress({
        stage: 'chunk_summarizing',
        progress: progressPercent,
        message: `Entry blokları analiz ediliyor: ${chunkNumber} / ${chunks.length}...`
      });

      const chunkPrompt = `Başlık: "${topicTitle}" (Blok ${chunkNumber}/${chunks.length})

Aşağıdaki entry grubunun ana fikirlerini, önemli tespitlerini ve öne çıkan argümanlarını 3-4 madde halinde özetle:

${chunks[i].join('\n\n---\n\n')}`;

      try {
        const chunkSummary = await provider.summarize(chunkPrompt);
        if (chunkSummary) {
          chunkSummaries.push(`[Blok ${chunkNumber} Özeti]:\n${chunkSummary}`);
        }
      } catch (err) {
        console.warn(`[AIService] Error summarizing chunk ${chunkNumber}:`, err);
      }
    }

    // Final Reduce Phase
    onProgress({
      stage: 'finalizing',
      progress: 92,
      message: 'Nihai özet birleştiriliyor...'
    });

    const masterPrompt = `Başlık: "${topicTitle}"
Toplam Taranan Entry: ${formattedEntries.length}

Aşağıda bu başlığın farklı sayfalarından çıkarılmış ara özetler bulunmaktadır. Tüm bu verileri sentezleyerek eksiksiz, tarafsız ve akıcı bir ana özet oluştur:

ARA ÖZETLER:
${chunkSummaries.join('\n\n---\n\n')}

Lütfen yanıtını tam olarak şu Markdown başlıkları altında düzenle:
📌 **Konu Nedir / Olayın Özeti**
(Konuyu ve olayı 2-3 net cümleyle açıkla)

⚖️ **Farklı Görüşler & Tartışmalar**
(Yazarlar arasındaki farklı görüşleri ve zıt argümanları maddeler halinde belirt)

💡 **Öne Çıkan Noktalar & Genel Kanı**
(Tüm tartışmadan çıkan ortak tespitler ve vurgulanan detaylar)`;

    return await provider.summarize(masterPrompt);
  }
}

export const aiService = new AIService();
