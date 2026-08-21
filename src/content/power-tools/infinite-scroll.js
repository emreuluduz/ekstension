/**
 * ek$tension - Infinite Scroll & Live Stream for Ekşi Sözlük
 */

(function () {
  let isLoading = false;
  let isLiveStreamActive = false;
  let liveStreamInterval = null;
  let currentPage = 1;
  let totalPages = 1;
  let sentinelObserver = null;
  let loaderElement = null;
  let toastElement = null;

  // Sayfa numarası ve toplam sayfa bilgisini DOM'dan çıkar
  function parsePaginationInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const pParam = parseInt(urlParams.get('p'), 10);

    const pagerEl = document.querySelector('.pager');
    if (pagerEl) {
      // Toplam sayfa sayısını bul
      const pageCountAttr = pagerEl.getAttribute('data-pagecount');
      if (pageCountAttr) {
        totalPages = parseInt(pageCountAttr, 10);
      } else {
        const lastPageOption = pagerEl.querySelector('select option:last-child');
        if (lastPageOption) {
          totalPages = parseInt(lastPageOption.value, 10);
        } else {
          const pageLinks = Array.from(pagerEl.querySelectorAll('a')).map(a => parseInt(a.textContent.trim(), 10)).filter(n => !isNaN(n));
          if (pageLinks.length > 0) {
            totalPages = Math.max(...pageLinks);
          }
        }
      }

      // Aktif sayfayı bul
      const currentOption = pagerEl.querySelector('select option[selected]');
      if (currentOption) {
        currentPage = parseInt(currentOption.value, 10);
      } else if (!isNaN(pParam) && pParam > 0) {
        currentPage = pParam;
      } else {
        const currentLink = pagerEl.querySelector('.current') || pagerEl.querySelector('a.active');
        if (currentLink) {
          currentPage = parseInt(currentLink.textContent.trim(), 10) || 1;
        } else {
          currentPage = 1;
        }
      }
    } else {
      currentPage = !isNaN(pParam) && pParam > 0 ? pParam : 1;
      totalPages = 1;
    }
  }

  // Sonraki sayfayı getir ve DOM'a ekle
  async function loadNextPage() {
    if (isLoading || currentPage >= totalPages) return;
    isLoading = true;

    const nextPage = currentPage + 1;
    showLoader(true, nextPage, totalPages);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('p', nextPage);

      // Kullanıcının sayfa yüklendiğini algılayabilmesi için en az 350ms akıcı bir geçiş süresi tanıyoruz
      const [response] = await Promise.all([
        fetch(url.toString(), {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }),
        new Promise(resolve => setTimeout(resolve, 380))
      ]);

      if (!response.ok) throw new Error('Sayfa getirilemedi: ' + response.status);

      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Toplam sayfa sayısını gelen sayfadan güncelle (yeni entry'ler eklenmiş olabilir)
      const newPager = doc.querySelector('.pager');
      if (newPager) {
        const pageCountAttr = newPager.getAttribute('data-pagecount');
        if (pageCountAttr) {
          totalPages = Math.max(totalPages, parseInt(pageCountAttr, 10));
        }
      }

      const newEntries = Array.from(doc.querySelectorAll('#entry-item-list > li[data-id]'));
      const targetList = document.querySelector('#entry-item-list');

      if (newEntries.length > 0 && targetList) {
        // Belirgin Sayfa Ayırıcı Banner Ekle
        const divider = document.createElement('div');
        divider.className = 'ekstension-page-divider';
        divider.innerHTML = `
          <div class="ekstension-page-divider-line"></div>
          <div class="ekstension-page-divider-badge">
            <span style="font-size: 14px;">📄</span>
            <span>Sayfa ${nextPage} / ${totalPages}</span>
            <span style="opacity: 0.65; font-size: 11px; font-weight: 500;">(${newEntries.length} entry)</span>
          </div>
          <div class="ekstension-page-divider-line"></div>
        `;
        targetList.appendChild(divider);

        // Mevcut olanları tekrar eklememek için filtrele
        const existingIds = new Set(Array.from(targetList.querySelectorAll('li[data-id]')).map(el => el.getAttribute('data-id')));

        const addedElements = [];
        newEntries.forEach(entryLi => {
          const id = entryLi.getAttribute('data-id');
          if (!existingIds.has(id)) {
            const importedNode = document.importNode(entryLi, true);
            importedNode.classList.add('ekstension-page-fade-in');
            targetList.appendChild(importedNode);
            addedElements.push(importedNode);
          }
        });

        currentPage = nextPage;
        window.history.replaceState(null, '', url.toString());

        // Toast bildirimi göster
        showToastNotification(`📄 Sayfa ${currentPage} yüklendi (${addedElements.length} entry)`);

        // Diğer modüllere yeni entry'lerin eklendiğini bildir
        window.dispatchEvent(new CustomEvent('ekstension:entries-added', {
          detail: { newEntries: addedElements, page: currentPage }
        }));
      }

      if (currentPage >= totalPages || newEntries.length === 0) {
        cleanupSentinel();
        showEndOfTopic();
      }
    } catch (err) {
      console.warn('ek$tension infinite scroll error:', err);
    } finally {
      isLoading = false;
      showLoader(false);
    }
  }

  // Sentinel temizle
  function cleanupSentinel() {
    if (sentinelObserver) {
      sentinelObserver.disconnect();
      sentinelObserver = null;
    }
    const sentinel = document.getElementById('ekstension-scroll-sentinel');
    if (sentinel) {
      sentinel.remove();
    }
  }

  // Yükleniyor spinner'ı göster/gizle
  function showLoader(show, targetPage = 0, total = 0) {
    if (!loaderElement) {
      loaderElement = document.createElement('div');
      loaderElement.className = 'ekstension-infinite-loader';
      loaderElement.id = 'ekstension-infinite-loader';
      loaderElement.innerHTML = `
        <div class="ekstension-spinner"></div>
        <span id="ekstension-loader-text">Sonraki entry'ler yükleniyor...</span>
      `;
      const entryList = document.querySelector('#entry-item-list');
      if (entryList) {
        entryList.parentElement.appendChild(loaderElement);
      }
    }

    if (show && targetPage > 0) {
      const textEl = loaderElement.querySelector('#ekstension-loader-text');
      if (textEl) {
        textEl.textContent = `📄 Sayfa ${targetPage} ${total > 0 ? `/ ${total} ` : ''}yükleniyor...`;
      }
    }

    if (show) {
      loaderElement.classList.add('show');
    } else {
      loaderElement.classList.remove('show');
    }
  }

  // Başlığın sonu göstergesi
  function showEndOfTopic() {
    showLoader(false);
    if (document.querySelector('.ekstension-end-of-topic-card')) return;

    const endCard = document.createElement('div');
    endCard.className = 'ekstension-end-of-topic-card';
    endCard.innerHTML = `
      <div style="font-size: 22px; margin-bottom: 6px;">✨</div>
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: inherit;">Başlığın sonuna ulaştınız</div>
      <div style="font-size: 12px; opacity: 0.75; margin-bottom: 8px;">Toplam ${totalPages} sayfa gösterildi.</div>
      <button class="ekstension-scroll-top-btn" type="button">⬆ Başa Dön</button>
    `;

    endCard.querySelector('.ekstension-scroll-top-btn').addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const entryList = document.querySelector('#entry-item-list');
    if (entryList) {
      entryList.parentElement.appendChild(endCard);
    }
  }

  // IntersectionObserver ile sayfa sonu sentinel'ini izle
  function setupInfiniteScroll() {
    parsePaginationInfo();

    if (totalPages <= 1 || currentPage >= totalPages) {
      showEndOfTopic();
      return;
    }

    let sentinel = document.getElementById('ekstension-scroll-sentinel');
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.id = 'ekstension-scroll-sentinel';
      sentinel.style.height = '40px';
      sentinel.style.marginTop = '20px';

      const entryList = document.querySelector('#entry-item-list');
      if (entryList) {
        entryList.parentElement.appendChild(sentinel);
      }
    }

    if (sentinelObserver) sentinelObserver.disconnect();

    sentinelObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isLoading && currentPage < totalPages) {
        loadNextPage();
      }
    }, { rootMargin: '300px' });

    if (sentinel) {
      sentinelObserver.observe(sentinel);
    }
  }

  // --------------------------------------------------------------------------
  // CANLI AKIŞ (LIVE STREAM) MODU
  // --------------------------------------------------------------------------

  async function checkLiveStreamUpdates() {
    if (!isLiveStreamActive) return;

    try {
      const url = new URL(window.location.href);
      if (totalPages > 1) {
        url.searchParams.set('p', totalPages);
      }

      const response = await fetch(url.toString(), {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });

      if (!response.ok) return;

      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      const newPager = doc.querySelector('.pager');
      if (newPager) {
        const newTotal = parseInt(newPager.getAttribute('data-pagecount'), 10) || totalPages;
        if (newTotal > totalPages) {
          totalPages = newTotal;
          url.searchParams.set('p', totalPages);
        }
      }

      const remoteEntries = Array.from(doc.querySelectorAll('#entry-item-list > li[data-id]'));
      const targetList = document.querySelector('#entry-item-list');
      if (!targetList || !remoteEntries.length) return;

      const existingIds = new Set(Array.from(targetList.querySelectorAll('li[data-id]')).map(el => el.getAttribute('data-id')));

      const newIncomingElements = [];
      remoteEntries.forEach(entryLi => {
        const id = entryLi.getAttribute('data-id');
        if (!existingIds.has(id)) {
          const importedNode = document.importNode(entryLi, true);
          importedNode.classList.add('ekstension-new-live-entry');
          targetList.appendChild(importedNode);
          newIncomingElements.push(importedNode);
        }
      });

      if (newIncomingElements.length > 0) {
        showToastNotification(`🔴 Canlı Akış: +${newIncomingElements.length} yeni entry geldi`);
        window.dispatchEvent(new CustomEvent('ekstension:entries-added', {
          detail: { newEntries: newIncomingElements, isLive: true }
        }));
      }
    } catch (e) {
      console.warn('ek$tension live stream poll error:', e);
    }
  }

  function toggleLiveStream() {
    isLiveStreamActive = !isLiveStreamActive;

    const btn = document.querySelector('.ekstension-stream-btn');
    if (btn) {
      btn.classList.toggle('active', isLiveStreamActive);
      btn.innerHTML = isLiveStreamActive ? `🟢 Canlı Akış: Açık (12s)` : `🔴 Canlı Akış`;
      btn.title = isLiveStreamActive ? 'Canlı akışı durdurmak için tıklayın' : 'Yeni entry\'leri otomatik akıtmak için tıklayın';
    }

    if (isLiveStreamActive) {
      showToastNotification('🟢 Canlı Akış Başlatıldı (12 saniyede bir kontrol edilir)');
      if (liveStreamInterval) clearInterval(liveStreamInterval);
      liveStreamInterval = setInterval(checkLiveStreamUpdates, 12000);
    } else {
      if (liveStreamInterval) {
        clearInterval(liveStreamInterval);
        liveStreamInterval = null;
      }
      showToastNotification('🔴 Canlı Akış Durduruldu');
    }
  }

  function injectStreamToggleButton() {
    const titleBar = document.querySelector('#topic h1#title');
    if (!titleBar || document.querySelector('.ekstension-stream-btn')) return;

    const container = document.createElement('div');
    container.className = 'ekstension-stream-toggle-container';
    container.innerHTML = `
      <button class="ekstension-stream-btn" type="button" title="Canlı akış modu: Sayfayı yenilemeden yeni entry'leri otomatik akıtır">
        🔴 Canlı Akış
      </button>
    `;

    container.querySelector('.ekstension-stream-btn').addEventListener('click', (e) => {
      e.preventDefault();
      toggleLiveStream();
    });

    titleBar.parentElement.insertBefore(container, titleBar.nextSibling);
  }

  function showToastNotification(msg) {
    if (!toastElement) {
      toastElement = document.createElement('div');
      toastElement.className = 'ekstension-stream-toast';
      document.body.appendChild(toastElement);
    }

    toastElement.textContent = msg;
    toastElement.classList.add('show');

    setTimeout(() => {
      toastElement.classList.remove('show');
    }, 2800);
  }

  function init() {
    if (!document.querySelector('#entry-item-list')) return;

    injectStreamToggleButton();
    setupInfiniteScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
