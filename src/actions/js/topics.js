import { CACHE_KEYS, MESSAGE_TYPES, STORAGE_KEYS } from '../../utils/constants.js';
import { Storage } from './storage.js';
import { Cache } from './cache.js';
import { UI } from './ui.js';
import { parseNumber, formatNumber, isCloudflareResponse } from '../../utils/helpers.js';

export const Topics = {
  currentTab: 'gundem',
  cachedTopics: [],
  cachedDebe: [],

  // Ekşi Sözlük'ten Gündem başlıklarını doğrudan DOMParser ile çekip parse eden fonksiyon
  async fetchTopicsDirectly() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch('https://eksisozluk.com/basliklar/gundem', {
        signal: controller.signal,
        credentials: 'include',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      clearTimeout(timeoutId);

      const html = await response.text();

      if (!response.ok || isCloudflareResponse(response.status, html)) {
        if (isCloudflareResponse(response.status, html)) {
          const cfErr = new Error('Cloudflare challenge detected');
          cfErr.isCloudflare = true;
          throw cfErr;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const titleElements = doc.querySelectorAll('ul.topic-list.partial > li > a');
      if (!titleElements || titleElements.length === 0) {
        if (isCloudflareResponse(response.status, html)) {
          const cfErr = new Error('Cloudflare challenge detected');
          cfErr.isCloudflare = true;
          throw cfErr;
        }
        throw new Error('Gündem başlık listesi DOM içinde bulunamadı');
      }

      return Array.from(titleElements)
        .filter(a => !a.closest('li[id*="sponsored"]') && !a.closest('li[id*="nativespot"]'))
        .map(a => {
          const entryCountElement = a.querySelector('small');
          const title = a.childNodes[0]?.textContent?.trim() || '';
          const entryCount = entryCountElement ? entryCountElement.textContent.trim() : '0';
          const entryCountParsed = parseNumber(entryCount);
          const formattedEntryCount = formatNumber(entryCountParsed);

          const href = a.getAttribute('href') || '';
          const fullUrl = href.startsWith('http')
            ? href
            : `https://eksisozluk.com${href.startsWith('/') ? href : '/' + href}`;

          return {
            title,
            entryCount: formattedEntryCount,
            url: fullUrl
          };
        })
        .filter(item => item.title && item.url);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  },

  // Ekşi Sözlük'ten DEBE başlıklarını doğrudan DOMParser ile çekip parse eden fonksiyon
  async fetchDebeDirectly() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch('https://eksisozluk.com/debe', {
        signal: controller.signal,
        credentials: 'include',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      clearTimeout(timeoutId);

      const html = await response.text();

      if (!response.ok || isCloudflareResponse(response.status, html)) {
        if (isCloudflareResponse(response.status, html)) {
          const cfErr = new Error('Cloudflare challenge detected');
          cfErr.isCloudflare = true;
          throw cfErr;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const titleElements = doc.querySelectorAll('ul.topic-list > li > a, ol.topic-list > li > a, #content-body ul.topic-list > li > a');
      if (!titleElements || titleElements.length === 0) {
        if (isCloudflareResponse(response.status, html)) {
          const cfErr = new Error('Cloudflare challenge detected');
          cfErr.isCloudflare = true;
          throw cfErr;
        }
        throw new Error('DEBE listesi DOM içinde bulunamadı');
      }

      let rank = 1;
      return Array.from(titleElements)
        .filter(a => !a.closest('li[id*="sponsored"]') && !a.closest('li[id*="nativespot"]'))
        .map(a => {
          const caption = a.querySelector('.caption')?.textContent?.trim();
          const title = caption || a.childNodes[0]?.textContent?.trim() || '';
          
          const href = a.getAttribute('href') || '';
          const fullUrl = href.startsWith('http')
            ? href
            : `https://eksisozluk.com${href.startsWith('/') ? href : '/' + href}`;

          const item = {
            title,
            entryCount: `#${rank}`,
            url: fullUrl
          };
          rank++;
          return item;
        })
        .filter(item => item.title && item.url);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  },

  async loadGundem() {
    this.currentTab = 'gundem';
    let hasRenderedCache = false;

    try {
      const cachedData = await Cache.get(CACHE_KEYS.TOPICS);
      const cacheAge = await Cache.getAge(CACHE_KEYS.TOPICS);
      const maxAge = 2 * 60 * 1000; // 2 dakika

      if (Array.isArray(cachedData) && cachedData.length > 0) {
        this.cachedTopics = cachedData;
        await this.render(cachedData);
        hasRenderedCache = true;

        if (cacheAge < maxAge) {
          return;
        }
      } else {
        UI.showLoading();
      }

      const titles = await this.fetchTopicsDirectly();
      if (Array.isArray(titles) && titles.length > 0) {
        this.cachedTopics = titles;
        await Cache.set(CACHE_KEYS.TOPICS, titles);
        await Cache.setAge(CACHE_KEYS.TOPICS);
        if (this.currentTab === 'gundem') {
          await this.render(titles);
        }
      } else if (!hasRenderedCache) {
        UI.showError();
      }
    } catch (error) {
      console.warn('Direct topics fetch failed, checking background fallback:', error);
      if (error?.isCloudflare) {
        UI.showCloudflareChallenge();
        return;
      }

      if (!hasRenderedCache) {
        try {
          const response = await chrome.runtime.sendMessage({ action: MESSAGE_TYPES.FETCH_TOPICS });
          if (response && Array.isArray(response.titles) && response.titles.length > 0) {
            this.cachedTopics = response.titles;
            await Cache.set(CACHE_KEYS.TOPICS, response.titles);
            await Cache.setAge(CACHE_KEYS.TOPICS);
            if (this.currentTab === 'gundem') {
              await this.render(response.titles);
            }
            return;
          }
        } catch (bgError) {}
        UI.showError();
      }
    }
  },

  async loadDebe() {
    this.currentTab = 'debe';
    let hasRenderedCache = false;

    try {
      const cachedData = await Cache.get(CACHE_KEYS.DEBE);
      const cacheAge = await Cache.getAge(CACHE_KEYS.DEBE);
      const maxAge = 5 * 60 * 1000; // DEBE için 5 dakika önbellek

      if (Array.isArray(cachedData) && cachedData.length > 0) {
        this.cachedDebe = cachedData;
        await this.render(cachedData);
        hasRenderedCache = true;

        if (cacheAge < maxAge) {
          return;
        }
      } else {
        UI.showLoading();
      }

      const debeList = await this.fetchDebeDirectly();
      if (Array.isArray(debeList) && debeList.length > 0) {
        this.cachedDebe = debeList;
        await Cache.set(CACHE_KEYS.DEBE, debeList);
        await Cache.setAge(CACHE_KEYS.DEBE);
        if (this.currentTab === 'debe') {
          await this.render(debeList);
        }
      } else if (!hasRenderedCache) {
        UI.showError();
      }
    } catch (error) {
      console.error('DEBE fetch error:', error);
      if (error?.isCloudflare) {
        UI.showCloudflareChallenge();
        return;
      }
      if (!hasRenderedCache) {
        UI.showError();
      }
    }
  },

  async load(tab = 'gundem') {
    if (tab === 'debe') {
      await this.loadDebe();
    } else {
      await this.loadGundem();
    }
  },

  async render(titles) {
    if (!Array.isArray(titles)) {
      console.error('Titles must be an array');
      return;
    }
    const favorites = await Storage.getFavorites();
    const filteredTitles = await this.filter(titles);
    await UI.renderTopics(filteredTitles, favorites);
  },
  
  async filter(titles) {
    if (!Array.isArray(titles)) {
      return [];
    }
    const filteredWords = await Storage.get(STORAGE_KEYS.FILTERED_WORDS) || [];
    return titles.filter(item => {
      const titleLower = item.title.toLowerCase();
      for (const word of filteredWords) {
        if (titleLower.includes(word.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  },

  getCurrentList() {
    return this.currentTab === 'debe' ? this.cachedDebe : this.cachedTopics;
  },

  async getTopicByUrl(url) {
    const list = this.getCurrentList();
    return list.find(topic => topic.url === url);
  },
  
  async addToFavorites(topic) {
    const result = await Storage.addFavorite(topic);
    if (result) {
      await UI.renderLists();
      await this.render(this.getCurrentList());
    }
    return result;
  },
  
  async removeFromFavorites(url) {
    await Storage.removeFavorite(url);
    await UI.renderLists();
    await this.render(this.getCurrentList());
  },

  async refresh() {
    UI.showLoading();
    const refreshIcon = UI.elements.refreshBtn?.querySelector('.material-icons');
    if (refreshIcon) {
      refreshIcon.classList.add('rotating');
    }
    
    try {
      if (this.currentTab === 'debe') {
        const debeList = await this.fetchDebeDirectly();
        if (Array.isArray(debeList) && debeList.length > 0) {
          this.cachedDebe = debeList;
          await Cache.set(CACHE_KEYS.DEBE, debeList);
          await Cache.setAge(CACHE_KEYS.DEBE);
          await this.render(debeList);
        } else {
          UI.showError();
        }
      } else {
        const titles = await this.fetchTopicsDirectly();
        if (Array.isArray(titles) && titles.length > 0) {
          this.cachedTopics = titles;
          await Cache.set(CACHE_KEYS.TOPICS, titles);
          await Cache.setAge(CACHE_KEYS.TOPICS);
          await this.render(titles);
        } else {
          UI.showError();
        }
      }
    } catch (error) {
      console.error('Refresh error:', error);
      if (error?.isCloudflare) {
        UI.showCloudflareChallenge();
      } else {
        UI.showError();
      }
    } finally {
      if (refreshIcon) {
        setTimeout(() => {
          refreshIcon.classList.remove('rotating');
        }, 800);
      }
    }
  },

  async addFilterWord(word) {
    const filteredWords = await Storage.get(STORAGE_KEYS.FILTERED_WORDS) || [];
    if (!filteredWords.includes(word)) {
      filteredWords.push(word);
      await Storage.set(STORAGE_KEYS.FILTERED_WORDS, filteredWords);
      await UI.renderFilterTags();
      await this.render(this.getCurrentList());
    }
  },

  async loadFilterWords() {
    const filteredWords = await Storage.get(STORAGE_KEYS.FILTERED_WORDS) || [];
    await this.render(this.getCurrentList());
    return filteredWords;
  }
};