import { BaseAIProvider } from '../BaseAIProvider.js';

/**
 * Provider for Official Google Gemini API (Gemini 1.5 / 2.0 Flash)
 * Uses free API keys from Google AI Studio.
 */
export class GeminiAPIProvider extends BaseAIProvider {
  constructor(apiKey = '') {
    super('gemini-cloud');
    this.apiKey = apiKey;
  }

  async getApiKey() {
    if (this.apiKey && this.apiKey.trim().length > 10) {
      return this.apiKey.trim();
    }

    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const stored = await chrome.storage.local.get('gemini_api_key');
        if (stored?.gemini_api_key) {
          this.apiKey = stored.gemini_api_key.trim();
          return this.apiKey;
        }
      }
    } catch (e) { }

    return '';
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey ? apiKey.trim() : '';
  }

  async isAvailable() {
    const key = await this.getApiKey();
    const hasKey = Boolean(key && key.length > 10);
    return {
      available: hasKey,
      status: hasKey ? 'ready' : 'key_missing',
      reason: hasKey
        ? 'Gemini API Key hazır.'
        : 'Gemini API Key bulunamadı. Lütfen Google AI Studio\'dan aldığınız ücretsiz API anahtarınızı girin.'
    };
  }

  /**
   * Validate API Key by sending a tiny test request
   */
  async testApiKey(testKey) {
    const key = testKey || await this.getApiKey();
    if (!key) throw new Error('API Anahtarı boş olamaz.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 5 }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API Hatası: HTTP ${response.status}`);
    }

    return true;
  }

  /**
   * Summarize prompt using Google Gemini
   */
  async summarize(prompt, options = {}) {
    const key = await this.getApiKey();
    if (!key) {
      throw new Error('Gemini API Key eksik. Lütfen Google AI Studio\'dan aldığınız ücretsiz API anahtarınızı girin.');
    }

    const systemInstruction = options.systemPrompt || 
      'Sen Ekşi Sözlük entry ve tartışmalarını tarafsız, akıcı ve yapılandırılmış şekilde özetleyen bir yapay zeka asistanısın. Yanıtlarını her zaman Türkçe, net ve madde madde Markdown formatında üret.';

    const modelName = (options.model || 'gemini-3.5-flash-lite').trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.maxOutputTokens ?? 2048
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.error?.message || `Gemini API Hatası: HTTP ${response.status}`;
      if (response.status === 400 || response.status === 403) {
        throw new Error(`Gemini API Anahtarı geçersiz veya yetkisiz: ${msg}`);
      }
      throw new Error(msg);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!resultText) {
      throw new Error('Gemini API boş yanıt döndürdü.');
    }
    return resultText;
  }
}
