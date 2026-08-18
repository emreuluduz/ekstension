import { MESSAGE_TYPES, SUPPORTED_SITES } from '../utils/constants.js';
import { turkishToLower } from '../utils/helpers.js';

export const Topics = {
  cachedTitles: [],
  
  async fetch() {
    try {
      await this.createOffscreenDocument();
      
      const titles = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          chrome.runtime.onMessage.removeListener(listener);
          resolve([]);
        }, 5000);

        function listener(message) {
          if (message.action === MESSAGE_TYPES.SET_TOPIC_TITLES) {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(listener);
            resolve(message.titles || []);
          }
        }

        // Önce listener'ı ekle, sonra mesajı gönder
        chrome.runtime.onMessage.addListener(listener);
        chrome.runtime.sendMessage({ action: MESSAGE_TYPES.FETCH_TOPICS }).catch(() => {});
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
        const timeout = setTimeout(() => {
          chrome.runtime.onMessage.removeListener(listener);
          resolve({ success: false, error: 'Parse timeout' });
        }, 5000);

        function listener(message) {
          if (message.action === MESSAGE_TYPES.PARSE_HTML_RESULT) {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(listener);
            resolve(message.result);
          }
        }

        // Önce listener'ı ekle, sonra mesajı gönder
        chrome.runtime.onMessage.addListener(listener);
        chrome.runtime.sendMessage({
          action: MESSAGE_TYPES.PARSE_HTML,
          html,
          url
        }).catch(() => {});
      });
    } catch (error) {
      console.error('Parse error:', error, {
        url,
        htmlPreview: html ? html.substring(0, 500) : ''
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
      
      // Belgenin hazır olması için kısa bir bekleme
      await new Promise(resolve => setTimeout(resolve, 150));
      return true;
    } catch (error) {
      // Zaten varsa hata vermeden devam et
      if (error.message?.includes('single offscreen')) {
        return true;
      }
      console.error('Offscreen document creation error:', error);
      return false;
    }
  }
};

export class SiteAnalyzer {
  constructor() {
    this.sites = SUPPORTED_SITES;
    this.cache = new Map();
    this.lastRequestTime = 0;
    this.MIN_REQUEST_INTERVAL = 1000;
    this.CACHE_DURATION = 5 * 60 * 1000;
    this.pendingUrls = new Set();
  }

  getCurrentSite(url) {
    try {
      if (!url || url === 'about:blank' || url === 'chrome://newtab/') {
        return null;
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (e) {
        return null;
      }

      const hostname = parsedUrl.hostname;
      return Object.entries(this.sites).find(([_, site]) => 
        hostname.includes(site.hostname)
      )?.[0];
    } catch (error) {
      console.log('Error in getCurrentSite:', error);
      return null;
    }
  }

  async extractPageData(siteType, customData = null) {
    try {
      if (customData) return customData;
      
      const site = this.sites[siteType];
      if (!site) {
        throw new Error(`Unsupported site type: ${siteType}`);
      }

      const data = {};
      for (const [key, selector] of Object.entries(site.selectors)) {
        const element = document.querySelector(selector);
        data[key] = element ? element.textContent.trim() : '';
      }
      
      if (siteType === 'YOUTUBE') {
        const {mainTitle, attrTitle, attrSubtitle, attrString} = data;
        if (!mainTitle && !attrTitle && !attrSubtitle && !attrString) {
          throw new Error('Could not extract any title information from YouTube');
        }
      } else if (!data.title) {
        throw new Error('Could not extract title from page');
      }
      
      return data;
    } catch (error) {
      console.error('Error extracting page data:', error);
      return null;
    }
  }

  async searchEksiSozluk(query) {
    try {
      const searchQuery = turkishToLower(query);
      const encodedQuery = encodeURIComponent(searchQuery);
      const url = `https://eksisozluk.com/?q=${encodedQuery}`;
      
      const response = await fetch(url);
      if (!response.ok) return null;
      const html = await response.text();
      
      await Topics.createOffscreenDocument();
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          chrome.runtime.onMessage.removeListener(listener);
          resolve(null);
        }, 5000);

        function listener(message) {
          if (message.action === MESSAGE_TYPES.PARSE_SEARCH_RESULTS_RESPONSE) {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(listener);
            
            if (!message.result?.success || message.result?.hasNoResults) {
              resolve(null);
              return;
            }

            resolve(message.result.titles);
          }
        }

        chrome.runtime.onMessage.addListener(listener);
        chrome.runtime.sendMessage({
          action: MESSAGE_TYPES.PARSE_SEARCH_RESULTS,
          html,
          url
        }).catch(() => {});
      });

    } catch (error) {
      console.error('Ekşi Sözlük arama hatası:', error);
      return null;
    }
  }

  async searchAllSelectors(pageData, currentUrl) {
    if (this.pendingUrls.has(currentUrl)) {
      console.log('Analysis already pending for URL:', currentUrl);
      return null;
    }

    this.pendingUrls.add(currentUrl);

    try {
      // Cache kontrolü
      if (this.cache.has(currentUrl)) {
        const { data, timestamp, pageDataHash } = this.cache.get(currentUrl);
        const currentHash = this.hashPageData(pageData);
        
        if (Date.now() - timestamp < this.CACHE_DURATION && pageDataHash === currentHash) {
          console.log('Cache hit for URL:', currentUrl);
          return data;
        }
        this.cache.delete(currentUrl);
      }

      const searchResults = new Map();
      const searchPromises = [];

      // Tüm aramaları paralel olarak başlat
      for (const [key, value] of Object.entries(pageData)) {
        if (!value) continue;

        if (Array.isArray(value)) {
          // Batch processing - her 3 istek için bir grup oluştur
          const batchSize = 3;
          for (let i = 0; i < value.length; i += batchSize) {
            const batch = value.slice(i, i + batchSize);
            const batchPromises = batch.map(item => 
              this.searchEksiSozluk(turkishToLower(item))
                .then(results => {
                  if (results?.length > 0) {
                    if (!searchResults.has(key)) {
                      searchResults.set(key, []);
                    }
                    searchResults.get(key).push({
                      term: item,
                      results
                    });
                  }
                })
            );
            
            // Her batch'i bekle ve sonra devam et
            searchPromises.push(Promise.all(batchPromises));
            await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting
          }
        } else {
          searchPromises.push(
            this.searchEksiSozluk(turkishToLower(value))
              .then(results => {
                if (results?.length > 0) {
                  searchResults.set(key, [{
                    term: value,
                    results
                  }]);
                }
              })
          );
        }
      }

      // Tüm aramaların tamamlanmasını bekle
      await Promise.all(searchPromises);

      if (searchResults.size > 0) {
        this.cache.set(currentUrl, {
          data: searchResults,
          timestamp: Date.now(),
          pageDataHash: this.hashPageData(pageData)
        });
      }

      return searchResults;
    } finally {
      this.pendingUrls.delete(currentUrl);
    }
  }

  // Sayfa içeriğinden hash oluştur
  hashPageData(pageData) {
    const str = JSON.stringify(pageData);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  // Cache boyutunu kontrol et ve eski girişleri temizle
  cleanCache() {
    const maxCacheSize = 50; // Maximum cache entry sayısı
    if (this.cache.size > maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      
      // En eski girişleri sil
      entries.slice(maxCacheSize).forEach(([key]) => {
        this.cache.delete(key);
      });
    }
  }
}

// Export the class
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SiteAnalyzer };
} 