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

// Content script'i başlat
function initializeContentScript() {
  console.log('Initializing content script for URL:', location.href);
  
  // Önce mevcut icon'u temizle
  const existingIcon = document.querySelector('.eksi-sticky-icon');
  if (existingIcon) {
    existingIcon.remove();
  }

  // Content script yüklendiğinde background'a bildir
  if (document.readyState === 'complete') {
    chrome.runtime.sendMessage({ 
      action: 'contentScriptReady',
      url: location.href  // URL'i de gönder
    });
  } else {
    // Sayfa tam yüklenmemişse bekle
    window.addEventListener('load', () => {
      chrome.runtime.sendMessage({ 
        action: 'contentScriptReady',
        url: location.href
      });
    });
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
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });

  return iconContainer;
}

// Icon'u göster/gizle
function toggleStickyIcon(show) {
  console.log('toggleStickyIcon called with:', show); // Debug için log
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
  console.log('Content script received message:', message); // Debug için log
  if (message.type === 'EKSI_RESULTS_STATUS') {
    toggleStickyIcon(message.hasResults);
  }
}); 