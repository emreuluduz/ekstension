class Cache {
  static async set(key, value, ttl = 300000) { // 5 dakika
    const item = {
      value,
      timestamp: Date.now(),
      ttl
    };
    await chrome.storage.local.set({ [key]: item });
  }

  static async get(key) {
    const result = await chrome.storage.local.get([key]);
    const item = result[key];
    
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      await chrome.storage.local.remove([key]);
      return null;
    }
    
    return item.value;
  }

  static async clear() {
    await chrome.storage.local.clear();
  }
} 