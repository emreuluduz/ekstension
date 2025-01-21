import { Topics, SiteAnalyzer } from './topics.js';
import { Notifications } from './notifications.js';
import { MESSAGE_TYPES, STORAGE_KEYS, SUPPORTED_SITES } from '../utils/constants.js';
import { Storage } from '../actions/js/storage.js';
import { debounce, throttle } from '../utils/debounce.js';

// Context menu oluştur
chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: 'search-menu-item',
    title: chrome.i18n.getMessage('context_menu_search'),
    contexts: ["selection"],
  });
});

// Context menu tıklama
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'search-menu-item') {
    const query = info.selectionText;
    chrome.tabs.create({ 
      url: "https://eksisozluk.com/?q=" + encodeURIComponent(query) 
    });
  }
});

const siteAnalyzer = new SiteAnalyzer();

// Tüm açık tabları analiz et ve cachele
async function analyzeAllTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const currentSite = siteAnalyzer.getCurrentSite(tab.url);
    if (currentSite) {
      await analyzeTab(tab, false); // false = popup'ı güncelleme
    }
  }
}

// Tek bir tabı analiz et
async function analyzeTab(tab, updatePopup = true) {
  const currentSite = siteAnalyzer.getCurrentSite(tab.url);
  
  if (currentSite) {
    try {
      // YouTube için özel kontrol
      if (currentSite === 'YOUTUBE' && !tab.url.includes('/watch?v=')) {
        // Video sayfası değilse analiz yapma
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'EKSI_RESULTS_STATUS',
            hasResults: false
          });
        } catch (error) {
          console.log('Content script not ready yet');
        }
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (site, selectors) => {
          const data = {};
          for (const [key, selector] of Object.entries(selectors)) {
            if (Array.isArray(selector)) {
              const elements = document.querySelectorAll(selector[0]);
              const uniqueValues = [...new Set(
                Array.from(elements).map(el => el.textContent.trim())
              )];
              data[key] = uniqueValues;
            } else {
              const element = document.querySelector(selector);
              data[key] = element ? element.textContent.trim() : null;
            }
          }
          return data;
        },
        args: [currentSite, SUPPORTED_SITES[currentSite].selectors]
      }, async (results) => {
        if (results && results[0] && results[0].result) {
          const pageData = results[0].result;
          const searchResults = await siteAnalyzer.searchAllSelectors(pageData, tab.url);
          
          if (searchResults && searchResults.size > 0) {
            const searchResultsObj = Object.fromEntries(searchResults);
            const resultsData = {
              site: currentSite,
              pageData,
              eksiResults: searchResultsObj
            };

            // Content script'e sonuç durumunu bildir
            try {
              await chrome.tabs.sendMessage(tab.id, {
                type: 'EKSI_RESULTS_STATUS',
                hasResults: true
              });
            } catch (error) {
              console.log('Content script not ready yet');
            }

            if (updatePopup) {
              await Storage.set(STORAGE_KEYS.CURRENT_SEARCH_RESULTS, resultsData);
              chrome.runtime.sendMessage({
                type: 'EKSI_RESULTS',
                data: resultsData
              });
            }
          } else {
            // Content script'e sonuç olmadığını bildir
            try {
              await chrome.tabs.sendMessage(tab.id, {
                type: 'EKSI_RESULTS_STATUS',
                hasResults: false
              });
            } catch (error) {
              console.log('Content script not ready yet');
            }
            
            if (updatePopup) {
              await Storage.remove(STORAGE_KEYS.CURRENT_SEARCH_RESULTS);
            }
          }
        }
      });
    } catch (error) {
      console.log('Error executing script:', error);
    }
  } else if (updatePopup) {
    await Storage.remove(STORAGE_KEYS.CURRENT_SEARCH_RESULTS);
  }
}

// Debounce'lu analiz fonksiyonu
const debouncedAnalyzeTab = debounce(async (tab, updatePopup) => {
  await analyzeTab(tab, updatePopup);
}, 1000); // 1 saniye bekle

// Throttle'lı cache temizleme
const throttledCleanCache = throttle(() => {
  siteAnalyzer.cleanCache();
}, 60000); // En az 1 dakika ara ile çalış

// Extension yüklendiğinde tüm tabları analiz et
chrome.runtime.onInstalled.addListener(async () => {
  await analyzeAllTabs();
});

// Tab güncellendiğinde
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    debouncedAnalyzeTab(tab, tab.active);
  }
});

// Tab değiştiğinde
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  const currentSite = siteAnalyzer.getCurrentSite(tab.url);
  if (currentSite) {
    const cachedResults = siteAnalyzer.cache.get(tab.url);
    if (cachedResults) {
      const resultsData = {
        site: currentSite,
        pageData: tab.title,
        eksiResults: Object.fromEntries(cachedResults.data)
      };
      await Storage.set(STORAGE_KEYS.CURRENT_SEARCH_RESULTS, resultsData);
      chrome.runtime.sendMessage({
        type: 'EKSI_RESULTS',
        data: resultsData
      });
    } else {
      debouncedAnalyzeTab(tab, true);
    }
  } else {
    await Storage.remove(STORAGE_KEYS.CURRENT_SEARCH_RESULTS);
  }
});

// Tab kapatıldığında
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  await Storage.remove(STORAGE_KEYS.CURRENT_SEARCH_RESULTS);
  siteAnalyzer.cleanCache(); // Cache temizliğini kontrol et
});

// Cache temizliği için throttle kullan
setInterval(throttledCleanCache, 5 * 60 * 1000);

// Message listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'contentScriptReady') {
    const tab = sender.tab;
    if (tab && message.url === tab.url) {
      debouncedAnalyzeTab(tab, tab.active);
    }
  }
  
  if (message.action === 'checkFollowedTopics') {
    Notifications.checkFollowedTopics();
  }
  
  if (message.action === 'getFilteredWords') {
    Storage.get(STORAGE_KEYS.FILTERED_WORDS).then(words => {
      sendResponse(words || []);
    });
    return true;
  }
  
  if (message.action === MESSAGE_TYPES.FETCH_TOPICS) {
    Topics.fetch().then(titles => {
      sendResponse({ titles });
    });
    return true;
  }
  
  if (message.action === MESSAGE_TYPES.SET_TOPIC_TITLES) {
    Topics.cachedTitles = message.titles;
  }
  
  if (message.action === MESSAGE_TYPES.PARSE_HTML) {
    Topics.parse(message.html, message.url).then(result => {
      sendResponse(result);
    });
    return true;
  }

  if (message.action === 'openPopup') {
    chrome.action.openPopup();
  }
});

// Bildirimleri başlat
chrome.runtime.onInstalled.addListener(() => {
  // Bildirim izinlerini kontrol et ve iste
  chrome.notifications.getPermissionLevel((permission) => {
    if (permission !== 'granted') {
      chrome.permissions.request({
        permissions: ['notifications']
      });
    }
  });
});

Notifications.setupAlarms();
Notifications.setupListeners();
