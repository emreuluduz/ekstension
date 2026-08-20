import { BaseAIProvider } from '../BaseAIProvider.js';

/**
 * Provider for Chrome Built-in AI (Gemini Nano / Prompt API)
 */
export class GeminiNanoProvider extends BaseAIProvider {
  constructor() {
    super('gemini-nano');
  }

  /**
   * Helper to resolve the global AI reference across window / self / worker environments
   */
  getAIRef() {
    if (typeof ai !== 'undefined' && ai?.languageModel) {
      return ai;
    }
    if (typeof window !== 'undefined' && window.ai?.languageModel) {
      return window.ai;
    }
    if (typeof self !== 'undefined' && self.ai?.languageModel) {
      return self.ai;
    }
    return null;
  }

  /**
   * Check if Gemini Nano is supported and downloaded
   * @returns {Promise<{ available: boolean, status: string, reason?: string }>}
   */
  async isAvailable() {
    const aiRef = this.getAIRef();
    if (!aiRef || !aiRef.languageModel) {
      return {
        available: false,
        status: 'not_supported',
        reason: 'Tarayıcınızda yerleşik Prompt API (Gemini Nano) bulunamadı. Chrome Dev/Canary veya flags aktif edilmelidir.'
      };
    }

    try {
      const capabilities = await aiRef.languageModel.capabilities();
      const available = capabilities.available;

      if (available === 'readily') {
        return {
          available: true,
          status: 'ready',
          reason: 'Gemini Nano kullanıma hazır.'
        };
      } else if (available === 'after-download') {
        return {
          available: true,
          status: 'needs_download',
          reason: 'Gemini Nano modeli tarayıcınız tarafından indiriliyor veya indirme bekleniyor.'
        };
      } else {
        return {
          available: false,
          status: 'unavailable',
          reason: 'Gemini Nano bu cihazda kullanılamıyor (Donanım veya işletim sistemi kısıtlaması).'
        };
      }
    } catch (e) {
      return {
        available: false,
        status: 'error',
        reason: `Yapay zeka durumu denetlenirken hata oluştu: ${e.message}`
      };
    }
  }

  /**
   * Summarize prompt using local Gemini Nano session
   */
  async summarize(prompt, options = {}) {
    const aiRef = this.getAIRef();
    if (!aiRef || !aiRef.languageModel) {
      throw new Error('Gemini Nano bu tarayıcıda desteklenmiyor.');
    }

    const systemPrompt = options.systemPrompt || 
      'Sen Ekşi Sözlük entry ve tartışmalarını tarafsız, akıcı ve yapılandırılmış şekilde özetleyen bir yapay zeka asistanısın. Yanıtlarını her zaman Türkçe, net ve madde madde Markdown formatında üret.';

    let session = null;
    try {
      session = await aiRef.languageModel.create({
        systemPrompt,
        temperature: options.temperature ?? 0.3,
        topK: options.topK ?? 3
      });

      const response = await session.prompt(prompt);
      return response ? response.trim() : '';
    } catch (error) {
      console.error('[GeminiNanoProvider] Error generating summary:', error);
      throw error;
    } finally {
      if (session && typeof session.destroy === 'function') {
        try {
          session.destroy();
        } catch (e) {}
      }
    }
  }

  /**
   * Stream prompt summary
   */
  async summarizeStream(prompt, onChunk, options = {}) {
    const aiRef = this.getAIRef();
    if (!aiRef || !aiRef.languageModel) {
      throw new Error('Gemini Nano bu tarayıcıda desteklenmiyor.');
    }

    const systemPrompt = options.systemPrompt || 
      'Sen Ekşi Sözlük entry ve tartışmalarını tarafsız, akıcı ve yapılandırılmış şekilde özetleyen bir yapay zeka asistanısın. Yanıtlarını her zaman Türkçe, net ve madde madde Markdown formatında üret.';

    let session = null;
    try {
      session = await aiRef.languageModel.create({
        systemPrompt,
        temperature: options.temperature ?? 0.3,
        topK: options.topK ?? 3
      });

      if (typeof session.promptStreaming === 'function') {
        const stream = session.promptStreaming(prompt);
        let fullText = '';
        for await (const chunk of stream) {
          fullText = chunk;
          if (typeof onChunk === 'function') {
            onChunk(chunk);
          }
        }
        return fullText.trim();
      } else {
        const response = await session.prompt(prompt);
        if (typeof onChunk === 'function') {
          onChunk(response);
        }
        return response ? response.trim() : '';
      }
    } catch (error) {
      console.error('[GeminiNanoProvider] Error in summarizeStream:', error);
      throw error;
    } finally {
      if (session && typeof session.destroy === 'function') {
        try {
          session.destroy();
        } catch (e) {}
      }
    }
  }
}
