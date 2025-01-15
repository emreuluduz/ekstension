class Storage {
  static async get(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([key], (result) => {
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
    return await this.get('favorites') || [];
  }

  static async addFavorite(title) {
    const favorites = await this.getFavorites();
    if (!favorites.find(f => f.url === title.url)) {
      favorites.push(title);
      await this.set('favorites', favorites);
    }
  }

  static async removeFavorite(url) {
    const favorites = await this.getFavorites();
    await this.set('favorites', favorites.filter(f => f.url !== url));
  }

  static async getFollowing() {
    return await this.get('following') || [];
  }

  static async addFollowing(title) {
    const following = await this.getFollowing();
    if (!following.find(f => f.url === title.url)) {
      following.push({
        ...title,
        lastChecked: Date.now(),
        lastEntryCount: title.entryCount
      });
      await this.set('following', following);
    }
  }

  static async removeFollowing(url) {
    const following = await this.getFollowing();
    await this.set('following', following.filter(f => f.url !== url));
  }

  static async exportData() {
    const data = await chrome.storage.sync.get(null);
    return JSON.stringify(data);
  }

  static async importData(jsonData) {
    const data = JSON.parse(jsonData);
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(data);
  }
} 