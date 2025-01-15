import { STORAGE_KEYS } from '../../utils/constants.js';

export class Storage {
  static async get(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(key, (result) => {
        resolve(result[key]);
      });
    });
  }

  static async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, resolve);
    });
  }

  static async getFavorites() {
    return await this.get(STORAGE_KEYS.FAVORITES) || [];
  }

  static async getFollowing() {
    return await this.get(STORAGE_KEYS.FOLLOWING) || [];
  }

  static async addFavorite(topic) {
    const favorites = await this.getFavorites();
    const exists = favorites.some(f => f.url === topic.url);
    if (!exists) {
      favorites.push(topic);
      await this.set(STORAGE_KEYS.FAVORITES, favorites);
    }
    return !exists;
  }

  static async removeFavorite(url) {
    const favorites = await this.getFavorites();
    const filtered = favorites.filter(f => f.url !== url);
    await this.set(STORAGE_KEYS.FAVORITES, filtered);
  }

  static async addFollowing(topic) {
    const following = await this.getFollowing();
    const exists = following.some(f => f.url === topic.url);
    if (!exists) {
      following.push(topic);
      await this.set(STORAGE_KEYS.FOLLOWING, following);
    }
    return !exists;
  }

  static async removeFollowing(url) {
    const following = await this.getFollowing();
    const filtered = following.filter(f => f.url !== url);
    await this.set(STORAGE_KEYS.FOLLOWING, filtered);
  }

  static async updateFollowing(topic) {
    const following = await this.getFollowing();
    const index = following.findIndex(f => f.url === topic.url);
    if (index !== -1) {
      following[index] = topic;
      await this.set(STORAGE_KEYS.FOLLOWING, following);
    }
  }
} 