import { MESSAGE_TYPES } from '../utils/constants.js';

export const Topics = {
  cachedTitles: [],
  
  async fetch() {
    try {
      await this.createOffscreenDocument();
      chrome.runtime.sendMessage({ action: MESSAGE_TYPES.FETCH_TOPICS });
      
      const titles = await new Promise((resolve) => {
        // Offscreen'den gelen mesajı bekle
        chrome.runtime.onMessage.addListener(function listener(message) {
          if (message.action === MESSAGE_TYPES.SET_TOPIC_TITLES) {
            chrome.runtime.onMessage.removeListener(listener);
            resolve(message.titles);
          }
        });
      });
      
      this.cachedTitles = titles;
      return titles;
    } catch (error) {
      console.error('Fetch error:', error);
      return [];
    }
  },
  
  async parse(html, url) {
    try {
      await this.createOffscreenDocument();
      
      return new Promise((resolve) => {
        chrome.runtime.onMessage.addListener(function listener(message) {
          if (message.action === MESSAGE_TYPES.PARSE_HTML_RESULT) {
            chrome.runtime.onMessage.removeListener(listener);
            resolve(message.result);
          }
        });
        
        chrome.runtime.sendMessage({
          action: MESSAGE_TYPES.PARSE_HTML,
          html,
          url
        });
      });
    } catch (error) {
      console.error('Parse error:', error, {
        url,
        htmlPreview: html.substring(0, 500)
      });
      return {
        success: false,
        error: error.message
      };
    }
  },

  async createOffscreenDocument() {
    try {
      if (await chrome.offscreen.hasDocument()) {
        return true;
      }
      
      await chrome.offscreen.createDocument({
        url: 'src/offscreen/offscreen.html',
        reasons: ['DOM_PARSER'],
        justification: 'Parse Ekşi Sözlük topics page'
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    } catch (error) {
      console.error('Offscreen document creation error:', error);
      return false;
    }
  }
}; 