export const Cache = {
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key]);
      });
    });
  },

  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },

  async getAge(key) {
    const timestamp = await this.get(`${key}_timestamp`);
    if (!timestamp) return Infinity;
    return Date.now() - timestamp;
  },

  async setAge(key) {
    await this.set(`${key}_timestamp`, Date.now());
  },

  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key, `${key}_timestamp`], resolve);
    });
  },

  async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }
}; 