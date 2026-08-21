/**
 * ek$tension - Shared Entry Fetcher
 * Extracts entries from current page DOM and crawls remaining pages.
 * Used by AI Summarizer and Knowledge Filter.
 */
(function () {

  /** Mevcut sayfadaki DOM'dan entry'leri çıkar */
  function extractEntriesFromDOM(rootDoc = document) {
    const lis = rootDoc.querySelectorAll('#entry-item-list > li');
    const entries = [];
    lis.forEach(li => {
      const id = li.getAttribute('data-id') || li.id?.replace('entry-item-', '') || '';
      const author = li.getAttribute('data-author') || li.querySelector('.entry-author')?.textContent?.trim() || '';
      const contentEl = li.querySelector('.content');
      const dateEl = li.querySelector('.entry-date');
      const favCount = li.getAttribute('data-favorite-count') || '0';
      if (contentEl) {
        entries.push({
          id,
          author,
          date: dateEl ? dateEl.textContent.trim() : '',
          content: contentEl.innerHTML,
          favCount
        });
      }
    });
    return entries;
  }

  /** Mevcut sayfadaki toplam sayfa sayısını bul */
  function extractTotalPages(rootDoc = document) {
    const pager = rootDoc.querySelector('.pager');
    if (pager && pager.getAttribute('data-pagecount')) {
      return parseInt(pager.getAttribute('data-pagecount'), 10) || 1;
    }
    const lastLink = rootDoc.querySelector('.pager a.last');
    if (lastLink) {
      return parseInt(lastLink.textContent.trim(), 10) || 1;
    }
    const select = rootDoc.querySelector('select#select-page');
    if (select && select.options.length > 0) {
      return select.options.length;
    }
    return 1;
  }

  /** Mevcut başlığın slug'ını al */
  function getTopicSlug(mode = '') {
    try {
      const pathname = window.location.pathname.replace(/^\//, '');
      const baseSlug = pathname.split('?')[0] || 'default_topic';
      return mode ? `${baseSlug}_${mode}` : baseSlug;
    } catch (e) {
      return mode ? `default_topic_${mode}` : 'default_topic';
    }
  }

  /** Mevcut başlığın title'ını al */
  function getTopicTitle() {
    const h1 = document.querySelector('#topic h1');
    if (!h1) return document.title || 'Ekşi Sözlük Başlığı';
    const clone = h1.cloneNode(true);
    const small = clone.querySelector('small');
    if (small) small.remove();
    return clone.textContent.trim();
  }

  /** Filtered view mi kontrol et */
  function isFilteredView() {
    const search = window.location.search || '';
    return search.includes('a=popular') || search.includes('a=dailynice') || search.includes('a=nice');
  }

  /**
   * Tüm sayfalardan entry'leri topla.
   * @param {Object} options
   * @param {string} options.mode - 'full' | 'popular'
   * @param {function({stage, progress, message})} options.onProgress
   * @param {string} [options.progressLabel] - İlerleme mesajı etiketi
   * @returns {Promise<{entries: Array, totalPages: number, title: string, slug: string}>}
   */
  async function fetchAllEntries(options = {}) {
    const mode = options.mode || 'full';
    const onProgress = options.onProgress || (() => {});
    const label = options.progressLabel || 'Taranıyor';

    const slug = getTopicSlug(mode === 'popular' ? 'popular' : '');
    const title = getTopicTitle();

    // 1. Sayfa 1'i mevcut DOM'dan oku
    const allEntries = extractEntriesFromDOM(document);
    const totalPages = extractTotalPages(document);

    // 2. Sayfa 2..N'yi fetch ile çek
    if (totalPages > 1) {
      const baseCleanUrl = window.location.href.split('?')[0];
      const queryParams = mode === 'popular' ? 'a=popular' : '';
      const getPageUrl = (p) => {
        if (queryParams) return `${baseCleanUrl}?${queryParams}&p=${p}`;
        return `${baseCleanUrl}?p=${p}`;
      };

      for (let page = 2; page <= totalPages; page++) {
        const crawlPercent = 10 + Math.round(((page - 1) / totalPages) * 60);
        onProgress({
          stage: 'crawling',
          progress: crawlPercent,
          message: `${label}: Sayfa ${page} / ${totalPages} taranıyor (${allEntries.length} entry)...`
        });

        // Polite delay
        await new Promise(r => setTimeout(r, 250));

        try {
          const resp = await fetch(getPageUrl(page), {
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
          });
          if (resp.ok) {
            const html = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const pageEntries = extractEntriesFromDOM(doc);
            allEntries.push(...pageEntries);
          }
        } catch (pageErr) {
          console.warn('[ek$tension] Page crawl error:', pageErr);
        }
      }
    }

    return { entries: allEntries, totalPages, title, slug };
  }

  /**
   * DOM'daki belirli entry ID'lerin verilerini çıkar (artımlı analiz için).
   * @param {string[]} entryIds
   * @returns {Array}
   */
  function extractEntriesById(entryIds) {
    const idSet = new Set(entryIds);
    const entries = [];
    const lis = document.querySelectorAll('#entry-item-list > li');
    lis.forEach(li => {
      const id = li.getAttribute('data-id') || '';
      if (!idSet.has(id)) return;
      const author = li.getAttribute('data-author') || li.querySelector('.entry-author')?.textContent?.trim() || '';
      const contentEl = li.querySelector('.content');
      const dateEl = li.querySelector('.entry-date');
      if (contentEl) {
        entries.push({
          id,
          author,
          date: dateEl ? dateEl.textContent.trim() : '',
          content: contentEl.innerHTML
        });
      }
    });
    return entries;
  }

  // Global erişim
  window.EkstensionEntryFetcher = {
    fetchAllEntries,
    extractEntriesFromDOM,
    extractEntriesById,
    extractTotalPages,
    getTopicSlug,
    getTopicTitle,
    isFilteredView
  };
})();
