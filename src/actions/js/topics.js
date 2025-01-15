import { CACHE_KEYS, MESSAGE_TYPES, STORAGE_KEYS } from '../../utils/constants.js';
import { Storage } from './storage.js';
import { Cache } from './cache.js';
import { UI } from './ui.js';

export const Topics = {
  cachedTopics: [],

  async load() {
    UI.showLoading();
    
    try {
      // Önce cache'e bak
      const cachedData = await Cache.get(CACHE_KEYS.TOPICS);
      const cacheAge = await Cache.getAge(CACHE_KEYS.TOPICS);
      const maxAge = 5 * 60 * 1000; // 5 dakika
      
      if (Array.isArray(cachedData) && cachedData.length > 0 && cacheAge < maxAge) {
        this.cachedTopics = cachedData;
        await this.render(cachedData);
        return;
      }

      // Cache'de yoksa veya eskiyse API'den al
      const response = await chrome.runtime.sendMessage({ action: MESSAGE_TYPES.FETCH_TOPICS });
      if (response && Array.isArray(response.titles) && response.titles.length > 0) {
        this.cachedTopics = response.titles;
        await Cache.set(CACHE_KEYS.TOPICS, response.titles);
        await Cache.setAge(CACHE_KEYS.TOPICS);
        await this.render(response.titles);
      } else {
        UI.showError();
      }
    } catch (error) {
      console.error('Topics load error:', error);
      UI.showError();
    }
  },

  async render(titles) {
    if (!Array.isArray(titles)) {
      console.error('Titles must be an array');
      return;
    }
    const favorites = await Storage.getFavorites();
    const following = await Storage.getFollowing();
    const filteredTitles = await this.filter(titles);
    await UI.renderTopics(filteredTitles, favorites, following);
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

  async getTopicByUrl(url) {
    return this.cachedTopics.find(topic => topic.url === url);
  },
  
  async addToFavorites(topic) {
    const result = await Storage.addFavorite(topic);
    if (result) {
      await UI.renderLists();
      await this.render(this.cachedTopics);
    }
    return result;
  },
  
  async removeFromFavorites(url) {
    await Storage.removeFavorite(url);
    await UI.renderLists();
    await this.render(this.cachedTopics);
  },
  
  async addToFollowing(topic) {
    const newTopic = {
      ...topic,
      lastChecked: Date.now(),
      lastEntryCount: parseInt(topic.entryCount)
    };

    const result = await Storage.addFollowing(newTopic);
    if (result) {
      await UI.renderLists();
      await this.render(this.cachedTopics);
      
      // Test bildirimi gönder
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon_48.png',
        title: chrome.i18n.getMessage('notification_success'),
        message: chrome.i18n.getMessage('notification_success_message').replace('%1', topic.title),
        priority: 2,
        requireInteraction: false
      });
    }
    return result;
  },
  
  async removeFromFollowing(url) {
    await Storage.removeFollowing(url);
    await UI.renderLists();
    await this.render(this.cachedTopics);
  },

  async refresh() {
    UI.showLoading();
    await Cache.clear();
    
    // API'den yeni verileri al
    const response = await chrome.runtime.sendMessage({ action: MESSAGE_TYPES.FETCH_TOPICS });
    if (response && Array.isArray(response.titles) && response.titles.length > 0) {
      this.cachedTopics = response.titles;
      await Cache.set(CACHE_KEYS.TOPICS, response.titles);
      await Cache.setAge(CACHE_KEYS.TOPICS);
      await this.render(response.titles);
    } else {
      UI.showError();
    }
    
    const refreshIcon = UI.elements.refreshBtn.querySelector('.material-icons');
    refreshIcon.classList.add('rotating');
    setTimeout(() => {
      refreshIcon.classList.remove('rotating');
    }, 1000);
  },

  async addFilterWord(word) {
    const filteredWords = await Storage.get(STORAGE_KEYS.FILTERED_WORDS) || [];
    if (!filteredWords.includes(word)) {
      filteredWords.push(word);
      await Storage.set(STORAGE_KEYS.FILTERED_WORDS, filteredWords);
      await UI.renderFilterTags();
      await this.render(this.cachedTopics);
    }
  },

  async loadFilterWords() {
    const filteredWords = await Storage.get(STORAGE_KEYS.FILTERED_WORDS) || [];
    await this.render(this.cachedTopics);
    return filteredWords;
  }
}; 