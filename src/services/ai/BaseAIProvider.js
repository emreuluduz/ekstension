/**
 * Abstract Base AI Provider
 */
export class BaseAIProvider {
  constructor(name = 'base') {
    this.name = name;
  }

  /**
   * Check if the provider is available in the current environment
   * @returns {Promise<{ available: boolean, status: string, reason?: string }>}
   */
  async isAvailable() {
    throw new Error('isAvailable() must be implemented by subclass');
  }

  /**
   * Summarize given text or prompt
   * @param {string} prompt
   * @param {object} options
   * @returns {Promise<string>}
   */
  async summarize(prompt, options = {}) {
    throw new Error('summarize() must be implemented by subclass');
  }

  /**
   * Stream summary output chunk by chunk
   * @param {string} prompt
   * @param {function(string): void} onChunk
   * @param {object} options
   * @returns {Promise<string>}
   */
  async summarizeStream(prompt, onChunk, options = {}) {
    const result = await this.summarize(prompt, options);
    if (typeof onChunk === 'function') {
      onChunk(result);
    }
    return result;
  }
}
