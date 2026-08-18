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

  async getBlockedAuthors() {
    return await this.get(STORAGE_KEYS.BLOCKED_AUTHORS) || [];
  },

  async addBlockedAuthor(author) {
    const authors = await this.getBlockedAuthors();
    const cleanAuthor = (author || '').trim().toLowerCase();
    if (cleanAuthor && !authors.some(a => a.toLowerCase() === cleanAuthor)) {
      authors.push(cleanAuthor);
      await this.set(STORAGE_KEYS.BLOCKED_AUTHORS, authors);
      return true;
    }
    return false;
  },

  async removeBlockedAuthor(author) {
    const authors = await this.getBlockedAuthors();
    const cleanAuthor = (author || '').trim().toLowerCase();
    const filtered = authors.filter(a => a.toLowerCase() !== cleanAuthor);
    await this.set(STORAGE_KEYS.BLOCKED_AUTHORS, filtered);
  }
};