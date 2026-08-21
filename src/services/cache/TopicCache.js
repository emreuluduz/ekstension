/**
 * ek$tension - Shared Topic Cache (Knowledge Filter, Media Filter, future features)
 * Stores per-entry flags (hasMedia, isInformative) keyed by topic slug.
 * All data persisted in chrome.storage.local under "tc:{slug}" keys.
 */
(function () {
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat
  const CACHE_PREFIX = 'tc:';

  class TopicCache {
    constructor(topicSlug) {
      this.topicSlug = topicSlug;
      this.storageKey = CACHE_PREFIX + topicSlug;
      this.data = null; // { entries: {}, meta: {} }
    }

    /** Cache'i chrome.storage.local'dan yükle. Yoksa boş oluştur. */
    async load() {
      try {
        const stored = await chrome.storage.local.get(this.storageKey);
        if (stored && stored[this.storageKey]) {
          this.data = stored[this.storageKey];
        }
      } catch (e) { }

      if (!this.data) {
        this.data = {
          entries: {},
          meta: {
            topicSlug: this.topicSlug,
            topicTitle: '',
            pagesAnalyzed: 0,
            totalPages: 0,
            lastUpdated: 0,
            expiresAt: 0
          }
        };
      }
      return this;
    }

    /** Cache'i kaydet */
    async save() {
      if (!this.data) return;
      this.data.meta.lastUpdated = Date.now();
      try {
        await chrome.storage.local.set({ [this.storageKey]: this.data });
      } catch (e) {
        console.warn('[ek$tension] TopicCache save error:', e);
      }
    }

    /** Cache TTL geçerli mi */
    isValid() {
      return this.data &&
        this.data.meta.expiresAt > Date.now() &&
        Object.keys(this.data.entries).length > 0;
    }

    /** Belirli bir flag tüm entry'ler için mevcut mu (analiz yapılmış mı) */
    hasFlagData(flagName) {
      if (!this.data || !this.data.entries) return false;
      const entries = Object.values(this.data.entries);
      return entries.length > 0 && entries.some(e => flagName in e);
    }

    /** Meta bilgilerini güncelle */
    setMeta(meta) {
      if (!this.data) return;
      Object.assign(this.data.meta, meta);
      this.data.meta.expiresAt = Date.now() + CACHE_TTL_MS;
    }

    /** Tek entry'ye tek flag ekle/güncelle */
    setEntryFlag(entryId, flagName, value) {
      if (!this.data) return;
      if (!this.data.entries[entryId]) {
        this.data.entries[entryId] = {};
      }
      this.data.entries[entryId][flagName] = value;
    }

    /** Toplu flag güncelle — { entryId: { flagName: value } } */
    setEntryFlags(flagsMap) {
      if (!this.data) return;
      for (const [entryId, flags] of Object.entries(flagsMap)) {
        if (!this.data.entries[entryId]) {
          this.data.entries[entryId] = {};
        }
        Object.assign(this.data.entries[entryId], flags);
      }
    }

    /** Tek entry'nin flag değerini oku */
    getEntryFlag(entryId, flagName) {
      return this.data?.entries?.[entryId]?.[flagName] ?? null;
    }

    /** Belirli flag = value olan tüm entry ID'leri */
    getEntryIdsByFlag(flagName, value) {
      if (!this.data?.entries) return [];
      return Object.entries(this.data.entries)
        .filter(([_, flags]) => flags[flagName] === value)
        .map(([id]) => id);
    }

    /** Cache'te flagName'i henüz belirlenmemiş entry ID'leri (artımlı analiz için) */
    getMissingEntryIds(allEntryIds, flagName) {
      if (!this.data?.entries) return allEntryIds;
      return allEntryIds.filter(id => {
        const entry = this.data.entries[id];
        return !entry || !(flagName in entry);
      });
    }

    /** Cache'i temizle */
    async clear() {
      this.data = null;
      try {
        await chrome.storage.local.remove(this.storageKey);
      } catch (e) { }
    }
  }

  // Global erişim (content script'ler ES module kullanamadığı için)
  window.EkstensionTopicCache = TopicCache;
})();
