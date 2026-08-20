import { BaseAIProvider } from '../BaseAIProvider.js';

/**
 * Provider for Cloud Google Gemini Flash API (via User API Key)
 * Ready for future extension without core architecture changes
 */
export class GeminiAPIProvider extends BaseAIProvider {
  constructor(apiKey = '') {
    super('gemini-cloud');
    this.apiKey = apiKey;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  async isAvailable() {
    const hasKey = Boolean(this.apiKey && this.apiKey.trim().length > 10);
    return {
      available: hasKey,
      status: hasKey ? 'ready' : 'key_missing',
      reason: hasKey ? 'Gemini API Key hazır.' : 'Gemini API Key bulunamadı.'
    };
  }

  async summarize(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('Gemini API Key eksik. Lütfen eklenti ayarlarından API anahtarınızı girin.');
    }

    const systemInstruction = options.systemPrompt || 
      'Sen Ekşi Sözlük entry ve tartışmalarını tarafsız, akıcı ve yapılandırılmış şekilde özetleyen bir yapay zeka asistanısın. Yanıtlarını her zaman Türkçe, net ve madde madde Markdown formatında üret.';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(this.apiKey.trim())}`;
    
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
          temperature: options.temperature ?? 0.3
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API Hatası: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  }
}
