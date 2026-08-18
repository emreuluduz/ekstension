import { Topics, SiteAnalyzer } from './topics.js';
import { MESSAGE_TYPES, STORAGE_KEYS } from '../utils/constants.js';
import { Storage } from '../actions/js/storage.js';
import { debounce } from '../utils/debounce.js';

// Context menu oluştur
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'search-menu-item',
      title: chrome.i18n.getMessage('context_menu_search'),
      contexts: ["selection"],
    });
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

// Sayfa verilerini işle ve Ekşi Sözlük sonuçlarını ara
async function processPageData(tab, currentSite, pageData, updatePopup = true) {
  if (!tab || !tab.id || !pageData) return;

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
      // Content script hazır değilse veya sekme kapandıysa hata vermeden geç
    }

    if (updatePopup) {
      await Storage.set(STORAGE_KEYS.CURRENT_SEARCH_RESULTS, resultsData);
      chrome.runtime.sendMessage({
        type: 'EKSI_RESULTS',
        data: resultsData
      }).catch(() => {});
    }
  } else {
    // Content script'e sonuç olmadığını bildir
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'EKSI_RESULTS_STATUS',
        hasResults: false
      });
    } catch (error) {
      // Content script hazır değilse hata vermeden geç
    }
    
    if (updatePopup) {
      await Storage.remove(STORAGE_KEYS.CURRENT_SEARCH_RESULTS);
    }
  }
}

// Tek bir tabı analiz et
async function analyzeTab(tab, updatePopup = true) {
  if (!tab || !tab.id || !tab.url) return;
  const currentSite = siteAnalyzer.getCurrentSite(tab.url);
  
  if (currentSite) {
    try {
      // YouTube için özel kontrol: Video sayfası değilse analiz yapma
      if (currentSite === 'YOUTUBE' && !tab.url.includes('/watch?v=')) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'EKSI_RESULTS_STATUS',
            hasResults: false
          });
        } catch (error) {}
        return;
      }

      // Content script'ten sayfa verilerini iste
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_DATA' });
        if (response && response.data) {
          await processPageData(tab, response.site || currentSite, response.data, updatePopup);
        }
      } catch (err) {
        // Content script henüz yüklenmemiş olabilir (contentScriptReady eventi tetiklenecektir)
      }
    } catch (error) {
      console.log('Error analyzing tab:', error);
    }
  } else if (updatePopup) {
    await Storage.remove(STORAGE_KEYS.CURRENT_SEARCH_RESULTS);
  }
}

// Tüm açık tabları analiz et ve cachele
async function analyzeAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      const currentSite = siteAnalyzer.getCurrentSite(tab.url);
      if (currentSite) {
        await analyzeTab(tab, false);
      }
    }
  } catch (err) {
    console.error('Error in analyzeAllTabs:', err);
  }
}

// Debounce'lu analiz fonksiyonu
const debouncedAnalyzeTab = debounce(async (tab, updatePopup) => {
  await analyzeTab(tab, updatePopup);
}, 1000);

// Extension yüklendiğinde açık tabları analiz et
chrome.runtime.onInstalled.addListener(async () => {
  await analyzeAllTabs();
});

// Tab güncellendiğinde
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url) {
    debouncedAnalyzeTab(tab, tab.active);
  }
});

// Tab değiştiğinde
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab || !tab.url) return;

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
        }).catch(() => {});
      } else {
        debouncedAnalyzeTab(tab, true);
      }
    } else {
      await Storage.remove(STORAGE_KEYS.CURRENT_SEARCH_RESULTS);
    }
  } catch (err) {
    console.error('Error onActivated:', err);
  }
});

// Tab kapatıldığında
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  await Storage.remove(STORAGE_KEYS.CURRENT_SEARCH_RESULTS);
  siteAnalyzer.cleanCache();
});

// Message listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'contentScriptReady') {
    const tab = sender.tab;
    if (tab && message.url === tab.url) {
      if (message.siteInfo && message.siteInfo.data) {
        processPageData(tab, message.siteInfo.site, message.siteInfo.data, tab.active);
      } else {
        debouncedAnalyzeTab(tab, tab.active);
      }
    }
  }
  
  if (message.action === 'getFilteredWords') {
    Storage.get(STORAGE_KEYS.FILTERED_WORDS).then(words => {
      sendResponse(words || []);
    });
    return true;
  }

  if (message.action === 'getBlockedAuthors') {
    Storage.getBlockedAuthors().then(authors => {
      sendResponse(authors || []);
    });
    return true;
  }

  if (message.action === 'addBlockedAuthor') {
    Storage.addBlockedAuthor(message.author).then(result => {
      sendResponse({ success: result });
    });
    return true;
  }

  if (message.action === 'removeBlockedAuthor') {
    Storage.removeBlockedAuthor(message.author).then(() => {
      sendResponse({ success: true });
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
    try {
      if (chrome.action && chrome.action.openPopup) {
        chrome.action.openPopup().catch(() => {});
      }
    } catch (e) {
      // openPopup may not be supported in all contexts
    }
  }

  if (message.action === 'performSearch') {
    (async () => {
      try {
        const searchText = message.searchText;
        const timestamp = Date.now();
        
        const response = await fetch(
          `https://eksisozluk.com/autocomplete/query?q=${encodeURIComponent(searchText)}&_=${timestamp}`,
          {
            headers: {
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': 'https://eksisozluk.com/'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Search request failed');
        }

        const data = await response.json();
        
        try {
          await chrome.runtime.sendMessage({
            action: 'searchResults',
            results: data
          });
        } catch (err) {
          // Popup kapanmışsa mesaj iletilmez
        }
      } catch (error) {
        console.error('Search error:', error);
        try {
          await chrome.runtime.sendMessage({
            action: 'searchError',
            error: error.message
          });
        } catch (err) {
          // Popup kapanmışsa hata mesajı iletilmez
        }
      }
    })();

    return true;
  }
});
