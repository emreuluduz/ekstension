import { STORAGE_KEYS } from '../../utils/constants.js';

export const Storage = {
  async get(key) {
    const result = await chrome.storage.local.get(key);
    return result[key];
  },

  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },

  async remove(key) {
    await chrome.storage.local.remove(key);
  },

  async clear() {
    await chrome.storage.local.clear();
  },

  async getFavorites() {
    return await this.get(STORAGE_KEYS.FAVORITES) || [];
  },

  async getFollowing() {
    return await this.get(STORAGE_KEYS.FOLLOWING) || [];
  },

  async addFavorite(topic) {
    const favorites = await this.getFavorites();
    const exists = favorites.some(f => f.url === topic.url);
    if (!exists) {
      favorites.push(topic);
      await this.set(STORAGE_KEYS.FAVORITES, favorites);
    }
    return !exists;
  },

  async removeFavorite(url) {
    const favorites = await this.getFavorites();
    const filtered = favorites.filter(f => f.url !== url);
    await this.set(STORAGE_KEYS.FAVORITES, filtered);
  },

  async addFollowing(topic) {
    const following = await this.getFollowing();
    const exists = following.some(f => f.url === topic.url);
    if (!exists) {
      following.push(topic);
      await this.set(STORAGE_KEYS.FOLLOWING, following);
    }
    return !exists;
  },

  async removeFollowing(url) {
    const following = await this.getFollowing();
    const filtered = following.filter(f => f.url !== url);
    await this.set(STORAGE_KEYS.FOLLOWING, filtered);
  },

  async updateFollowing(topic) {
    const following = await this.getFollowing();
    const index = following.findIndex(f => f.url === topic.url);
    if (index !== -1) {
      following[index] = topic;
      await this.set(STORAGE_KEYS.FOLLOWING, following);
    }
  }
};