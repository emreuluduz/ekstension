export class Cache {
  static async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || []);
      });
    });
  }

  static async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: Array.isArray(value) ? value : [] }, resolve);
    });
  }

  static async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }
} 