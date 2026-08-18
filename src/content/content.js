// DOM yüklendiğinde başla
document.addEventListener('DOMContentLoaded', () => {
  initializeContentScript();
});

// URL değişikliklerini izle
let lastUrl = location.href;
let urlCheckInterval;

// URL kontrolü için debounce fonksiyonu
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Debounce'lu initialize
const debouncedInitialize = debounce(() => {
  console.log('Initializing content script for URL:', location.href);
  initializeContentScript();
}, 500);

// URL kontrolü için interval başlat
function startUrlCheck() {
  if (urlCheckInterval) {
    clearInterval(urlCheckInterval);
  }
  
  urlCheckInterval = setInterval(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      console.log('URL changed from:', lastUrl, 'to:', currentUrl);
      lastUrl = currentUrl;
      debouncedInitialize();
    }
  }, 500);
}

startUrlCheck();

// Sayfadan başlık ve veri çıkarma fonksiyonu
function extractPageData() {
  const hostname = window.location.hostname;
  let currentSite = null;
  let selectors = null;

  if (hostname.includes('youtube.com')) {
    if (!window.location.href.includes('/watch?v=')) return null;
    currentSite = 'YOUTUBE';
    selectors = {
      mainTitle: '#title.ytd-rich-metadata-renderer',
      attrTitle: '.yt-video-attribute-view-model__title',
      attrSubtitle: '.yt-video-attribute-view-model__subtitle',
      attrString: '.yt-video-attribute-view-model__secondary-subtitle > .yt-core-attributed-string.yt-core-attributed-string--white-space-pre-wrap'
    };
  } else if (hostname.includes('wikipedia.org')) {
    currentSite = 'WIKIPEDIA';
    selectors = {
      title: 'h1.firstHeading',
      summary: 'div.mw-parser-output > p:not([class])'
    };
  } else if (hostname.includes('imdb.com')) {
    currentSite = 'IMDB';
    selectors = {
      cast: ['ul.ipc-metadata-list.ipc-metadata-list--dividers-all.title-pc-list.ipc-metadata-list--baseAlt li ul.ipc-inline-list a'],
      title: 'h1[data-testid="hero__pageTitle"]'
    };
  } else if (hostname.includes('steampowered.com')) {
    currentSite = 'STEAM';
    selectors = {
      title: 'div.apphub_AppName',
      description: 'div.game_description_snippet'
    };
  } else if (hostname.includes('epicgames.com')) {
    currentSite = 'EPIC';
    selectors = {
      title: 'h1'
    };
  }

  if (!currentSite || !selectors) return null;

  const data = {};
  for (const [key, selector] of Object.entries(selectors)) {
    if (Array.isArray(selector)) {
      const elements = document.querySelectorAll(selector[0]);
      const uniqueValues = [...new Set(
        Array.from(elements).map(el => el.textContent.trim()).filter(Boolean)
      )];
      data[key] = uniqueValues;
    } else {
      const element = document.querySelector(selector);
      data[key] = element ? element.textContent.trim() : null;
    }
  }
  return { site: currentSite, data };
}

// Content script'i başlat
function initializeContentScript() {
  // Önce mevcut icon'u temizle
  const existingIcon = document.querySelector('.eksi-sticky-icon');
  if (existingIcon) {
    existingIcon.remove();
  }

  const notifyReady = () => {
    const siteInfo = extractPageData();
    chrome.runtime.sendMessage({ 
      action: 'contentScriptReady',
      url: location.href,
      siteInfo
    }).catch(() => {});
  };

  // Content script yüklendiğinde background'a bildir
  if (document.readyState === 'complete') {
    notifyReady();
  } else {
    window.addEventListener('load', notifyReady, { once: true });
  }
}

// Sticky icon oluştur
function createStickyIcon() {
  const iconContainer = document.createElement('div');
  iconContainer.className = 'eksi-sticky-icon';
  iconContainer.innerHTML = `
    <img src="${chrome.runtime.getURL('icons/icon_48.png')}" alt="Ekşi Companion">
    <div class="eksi-notification-dot"></div>
  `;
  document.body.appendChild(iconContainer);

  // Icon'a tıklama olayı
  iconContainer.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openPopup' }).catch(() => {});
  });

  return iconContainer;
}

// Icon'u göster/gizle
function toggleStickyIcon(show) {
  let iconContainer = document.querySelector('.eksi-sticky-icon');
  
  if (show) {
    if (!iconContainer) {
      iconContainer = createStickyIcon();
    }
    iconContainer.classList.add('show');
  } else if (iconContainer) {
    iconContainer.classList.remove('show');
  }
}

// Background'dan mesajları dinle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EKSI_RESULTS_STATUS') {
    toggleStickyIcon(message.hasResults);
  } else if (message.type === 'EXTRACT_PAGE_DATA') {
    sendResponse(extractPageData());
  }
}); 