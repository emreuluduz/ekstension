/**
 * ek$tension - Shared Entry Fetcher
 * Extracts entries from current page DOM and crawls remaining pages.
 * Used by AI Summarizer and Knowledge Filter.
 */
(function () {

  /** Mevcut sayfadaki DOM'dan entry'leri çıkar */
  function extractEntriesFromDOM(rootDoc = document) {
    const lis = rootDoc.querySelectorAll('#entry-item-list > li, li[data-id], li.entry');
    const entries = [];
    const seenIds = new Set();
    lis.forEach(li => {
      const id = li.getAttribute('data-id') || li.id?.replace('entry-item-', '') || '';
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);

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

  /** Mevcut başlığın slug'ını al (a=popular, a=dailynice gibi filtreli görünümleri de destekler) */
  function getTopicSlug(mode = '') {
    try {
      const pathname = window.location.pathname.replace(/^\//, '');
      const baseSlug = pathname.split('?')[0] || 'default_topic';
      const search = window.location.search || '';
      const filterMatch = search.match(/a=([a-z0-9_-]+)/i);
      const activeMode = mode || (filterMatch ? filterMatch[1] : '');
      return activeMode ? `${baseSlug}_${activeMode}` : baseSlug;
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
   * Çok sayfalı başlıklarda dönemsel temsili sağlayacak dinamik örnek sayfaları hesapla.
   * Sayfa sayısına göre kademeli ölçeklenir (15 sayfaya kadar tam tarama, 10.000 sayfaya kadar 50-60 sayfa örneklem).
   * @param {number} totalPages
   * @returns {number[]}
   */
  function getSampledPageNumbers(totalPages) {
    if (totalPages <= 15) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set();
    let targetCount = 20;
    let edgeCount = 3;

    if (totalPages <= 50) {
      targetCount = 18;
      edgeCount = 3;
    } else if (totalPages <= 200) {
      targetCount = 28;
      edgeCount = 4;
    } else if (totalPages <= 1000) {
      targetCount = 38;
      edgeCount = 5;
    } else {
      // 1000+ sayfa (devasa / onlarca yıllık başlıklar, örn. 7751 sayfa)
      targetCount = 50;
      edgeCount = 5;
    }

    // 1. İlk Dönem (Başlangıç yılları)
    for (let i = 1; i <= edgeCount; i++) {
      if (i <= totalPages) pages.add(i);
    }

    // 2. Güncel Dönem (Son sayfalar)
    for (let i = totalPages - edgeCount + 1; i <= totalPages; i++) {
      if (i > 0) pages.add(i);
    }

    // 3. Kronolojik Ara Dönemler (Eşit aralıklı adımlar)
    const remainingSlots = targetCount - pages.size;
    if (remainingSlots > 0) {
      const startPage = edgeCount + 1;
      const endPage = totalPages - edgeCount;
      if (endPage > startPage) {
        const step = (endPage - startPage) / (remainingSlots + 1);
        for (let i = 1; i <= remainingSlots; i++) {
          const samplePage = Math.round(startPage + step * i);
          if (samplePage > edgeCount && samplePage < totalPages - edgeCount + 1) {
            pages.add(samplePage);
          }
        }
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }

  /**
   * Tüm sayfalardan entry'leri topla (Çok sayfalı başlıklarda Dinamik Örnekleme ve Eşzamanlı İstek Havuzu destekli).
   * @param {Object} options
   * @param {string} options.mode - 'full' | 'popular'
   * @param {boolean} [options.enableSampling=false] - 15+ sayfalarda akıllı örnekleme aktif olsun mu (Yapay zeka özeti için)
   * @param {function({stage, progress, message})} options.onProgress
   * @param {string} [options.progressLabel] - İlerleme mesajı etiketi
   * @returns {Promise<{entries: Array, totalPages: number, sampledPages: number[]|null, isSampled: boolean, title: string, slug: string}>}
   */
  async function fetchAllEntries(options = {}) {
    const onProgress = options.onProgress || (() => {});
    const label = options.progressLabel || 'Taranıyor';
    const enableSampling = options.enableSampling === true;

    const slug = getTopicSlug();
    const title = getTopicTitle();

    const currentUrl = new URL(window.location.href);
    const currentPageNum = parseInt(currentUrl.searchParams.get('p') || '1', 10);

    const currentDomEntries = extractEntriesFromDOM(document);
    const totalPages = extractTotalPages(document);

    const isSampled = enableSampling && totalPages > 15;
    const targetPages = isSampled ? getSampledPageNumbers(totalPages) : Array.from({ length: totalPages }, (_, i) => i + 1);

    const allEntriesMap = new Map();

    // Mevcut sayfadaki entry'leri ekle
    currentDomEntries.forEach(e => allEntriesMap.set(e.id, e));

    // Çekilecek sayfaları filtrele (mevcut DOM'da olanı hariç tut)
    const pagesToFetch = targetPages.filter(p => p !== currentPageNum || currentDomEntries.length === 0);

    if (pagesToFetch.length > 0) {
      const getPageUrl = (p) => {
        const url = new URL(window.location.href);
        url.searchParams.set('p', p);
        return url.toString();
      };

      const concurrency = 5; // 5'li paralel istek havuzu
      let completedCount = 0;

      for (let i = 0; i < pagesToFetch.length; i += concurrency) {
        const batch = pagesToFetch.slice(i, i + concurrency);

        await Promise.all(batch.map(async (page) => {
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
              pageEntries.forEach(e => allEntriesMap.set(e.id, e));
            }
          } catch (pageErr) {
            console.warn(`[ek$tension] Page ${page} crawl error:`, pageErr);
          } finally {
            completedCount++;
          }
        }));

        const crawlPercent = 10 + Math.round((completedCount / pagesToFetch.length) * 60);
        const samplingText = isSampled
          ? ` (Akıllı Örneklem: ${completedCount}/${pagesToFetch.length} sayfa)`
          : `: Sayfa ${completedCount}/${pagesToFetch.length}`;

        onProgress({
          stage: 'crawling',
          progress: crawlPercent,
          message: `${label}${samplingText} taranıyor (${allEntriesMap.size} entry)...`
        });

        // Nezaket gecikmesi
        if (i + concurrency < pagesToFetch.length) {
          await new Promise(r => setTimeout(r, 80));
        }
      }
    }

    const allEntries = Array.from(allEntriesMap.values());
    return {
      entries: allEntries,
      totalPages,
      sampledPages: isSampled ? targetPages : null,
      isSampled,
      title,
      slug
    };
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
    getSampledPageNumbers,
    getTopicSlug,
    getTopicTitle,
    isFilteredView
  };
})();
