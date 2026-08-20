import { BaseAIProvider } from '../BaseAIProvider.js';

/**
 * Provider for Chrome Built-in AI (Gemini Nano / LanguageModel & Prompt API)
 * Supports both new W3C LanguageModel standard and legacy ai.languageModel APIs,
 * with automatic Offscreen Document fallback if running in Service Worker.
 */
export class GeminiNanoProvider extends BaseAIProvider {
  constructor() {
    super('gemini-nano');
  }

  /**
   * Helper to resolve the global LanguageModel or ai.languageModel reference
   */
  getLanguageModelInterface() {
    // 1. New W3C / Chrome standard: global LanguageModel
    if (typeof LanguageModel !== 'undefined') {
      return LanguageModel;
    }
    if (typeof globalThis !== 'undefined' && globalThis.LanguageModel) {
      return globalThis.LanguageModel;
    }
    if (typeof window !== 'undefined' && window.LanguageModel) {
      return window.LanguageModel;
    }
    if (typeof self !== 'undefined' && self.LanguageModel) {
      return self.LanguageModel;
    }

    // 2. Legacy / Alternative: ai.languageModel
    if (typeof ai !== 'undefined' && ai?.languageModel) {
      return ai.languageModel;
    }
    if (typeof globalThis !== 'undefined' && globalThis.ai?.languageModel) {
      return globalThis.ai.languageModel;
    }
    if (typeof window !== 'undefined' && window.ai?.languageModel) {
      return window.ai.languageModel;
    }
    if (typeof self !== 'undefined' && self.ai?.languageModel) {
      return self.ai.languageModel;
    }

    return null;
  }

  /**
   * Ensure offscreen document is active (used when running from background Service Worker)
   */
  async ensureOffscreenDocument() {
    if (typeof chrome !== 'undefined' && chrome.offscreen?.createDocument) {
      try {
        const hasDoc = await chrome.offscreen.hasDocument();
        if (!hasDoc) {
          await chrome.offscreen.createDocument({
            url: 'src/offscreen/offscreen.html',
            reasons: ['DOM_PARSER', 'WORKERS'],
            justification: 'Running Chrome Built-in AI (LanguageModel) in DOM window context'
          });
        }

        // Handshake: Wait for offscreen.js to be loaded and ready
        for (let i = 0; i < 15; i++) {
          try {
            const isReady = await new Promise((resolve) => {
              chrome.runtime.sendMessage({ action: 'PING_OFFSCREEN' }, (resp) => {
                if (chrome.runtime.lastError || !resp?.ready) {
                  resolve(false);
                } else {
                  resolve(true);
                }
              });
            });
            if (isReady) return;
          } catch (e) {}
          await new Promise(r => setTimeout(r, 80));
        }
      } catch (err) {
        if (!err.message?.includes('single offscreen')) {
          console.warn('[GeminiNanoProvider] Offscreen creation notice:', err);
        }
      }
    }
  }

  /**
   * Local availability check in current execution context
   */
  async isLocalAvailable() {
    const lm = this.getLanguageModelInterface();
    if (!lm) {
      return {
        available: false,
        status: 'not_supported',
        reason: 'Tarayıcınızda yerleşik Prompt API (Gemini Nano / LanguageModel) bulunamadı. Chrome Dev/Canary veya flags aktif edilmelidir.'
      };
    }

    try {
      // 1. New availability() method
      if (typeof lm.availability === 'function') {
        const avail = await lm.availability();
        if (avail === 'available' || avail === 'readily') {
          return {
            available: true,
            status: 'ready',
            reason: 'Gemini Nano (LanguageModel) kullanıma hazır.'
          };
        } else if (avail === 'downloadable' || avail === 'after-download' || avail === 'downloading') {
          return {
            available: true,
            status: 'needs_download',
            reason: 'Gemini Nano modeli tarayıcınız tarafından indiriliyor veya indirme bekleniyor.'
          };
        } else {
          return {
            available: false,
            status: 'unavailable',
            reason: `Gemini Nano durumu: ${avail}`
          };
        }
      }

      // 2. Legacy capabilities() method
      if (typeof lm.capabilities === 'function') {
        const caps = await lm.capabilities();
        const available = caps?.available;
        if (available === 'readily' || available === 'available') {
          return {
            available: true,
            status: 'ready',
            reason: 'Gemini Nano kullanıma hazır.'
          };
        } else if (available === 'after-download' || available === 'downloadable') {
          return {
            available: true,
            status: 'needs_download',
            reason: 'Gemini Nano modeli tarayıcınız tarafından indiriliyor.'
          };
        }
      }

      // 3. Fallback: if create() exists
      if (typeof lm.create === 'function') {
        return {
          available: true,
          status: 'ready',
          reason: 'Gemini Nano hazır.'
        };
      }

      return {
        available: false,
        status: 'not_supported',
        reason: 'LanguageModel arayüzü desteklenmiyor.'
      };
    } catch (e) {
      return {
        available: false,
        status: 'error',
        reason: `Gemini Nano durumu denetlenirken hata: ${e.message}`
      };
    }
  }

  /**
   * Check if Gemini Nano is supported and downloaded (with offscreen bridge fallback)
   */
  async isAvailable() {
    const local = await this.isLocalAvailable();
    if (local.available) {
      return local;
    }

    // If running in background service worker and local failed, try via offscreen document
    if (typeof window === 'undefined' && typeof chrome !== 'undefined' && chrome.offscreen) {
      try {
        await this.ensureOffscreenDocument();
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'OFFSCREEN_AI_AVAILABILITY' }, (resp) => {
            if (resp && resp.success && resp.status) {
              resolve(resp.status);
            } else {
              resolve(local);
            }
          });
        });
      } catch (e) {
        return local;
      }
    }

    return local;
  }

  /**
   * Execute prompt locally on the available LanguageModel session
   */
  async summarizeLocal(prompt, options = {}) {
    const lm = this.getLanguageModelInterface();
    if (!lm) {
      throw new Error('Tarayıcınızda yerleşik Prompt API (Gemini Nano / LanguageModel) bulunamadı.');
    }

    const systemPrompt = options.systemPrompt || 
      'Sen Ekşi Sözlük entry ve tartışmalarını tarafsız, akıcı ve yapılandırılmış şekilde özetleyen bir yapay zeka asistanısın. Yanıtlarını her zaman Türkçe, net ve madde madde Markdown formatında üret.';

    let session = null;
    try {
      try {
        session = await lm.create({
          systemPrompt,
          temperature: options.temperature ?? 0.3,
          topK: options.topK ?? 3
        });
      } catch (errCreate) {
        try {
          session = await lm.create({
            initialPrompts: [{ role: 'system', content: systemPrompt }]
          });
        } catch (errFallback) {
          session = await lm.create();
        }
      }

      const response = await session.prompt(prompt);
      return response ? response.trim() : '';
    } catch (error) {
      console.error('[GeminiNanoProvider] Error in summarizeLocal:', error);
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
   * Summarize prompt using local Gemini Nano session or offscreen bridge
   */
  async summarize(prompt, options = {}) {
    const lm = this.getLanguageModelInterface();
    if (lm) {
      return await this.summarizeLocal(prompt, options);
    }

    // If in service worker, bridge through offscreen document
    if (typeof window === 'undefined' && typeof chrome !== 'undefined' && chrome.offscreen) {
      await this.ensureOffscreenDocument();
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'OFFSCREEN_AI_SUMMARIZE',
          prompt,
          options
        }, (resp) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (resp && resp.success) {
            resolve(resp.summary);
          } else {
            reject(new Error(resp?.error || 'Offscreen AI yanıt veremedi.'));
          }
        });
      });
    }

    throw new Error('Tarayıcınızda yerleşik Prompt API (Gemini Nano / LanguageModel) bulunamadı. Chrome flags aktif edilmelidir.');
  }

  /**
   * Stream prompt summary
   */
  async summarizeStream(prompt, onChunk, options = {}) {
    const lm = this.getLanguageModelInterface();
    if (!lm) {
      const full = await this.summarize(prompt, options);
      if (typeof onChunk === 'function') onChunk(full);
      return full;
    }

    const systemPrompt = options.systemPrompt || 
      'Sen Ekşi Sözlük entry ve tartışmalarını tarafsız, akıcı ve yapılandırılmış şekilde özetleyen bir yapay zeka asistanısın. Yanıtlarını her zaman Türkçe, net ve madde madde Markdown formatında üret.';

    let session = null;
    try {
      try {
        session = await lm.create({
          systemPrompt,
          temperature: options.temperature ?? 0.3,
          topK: options.topK ?? 3
        });
      } catch (errCreate) {
        try {
          session = await lm.create({
            initialPrompts: [{ role: 'system', content: systemPrompt }]
          });
        } catch (errFallback) {
          session = await lm.create();
        }
      }

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
