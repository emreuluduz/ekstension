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

// Cloudflare solver tab yönetimi
let activeSolverTabId = null;
let solverTimeoutId = null;

async function startCloudflareSolver() {
  try {
    if (activeSolverTabId) {
      try {
        const existingTab = await chrome.tabs.get(activeSolverTabId);
        if (existingTab) {
          await chrome.tabs.update(activeSolverTabId, { active: true });
          return;
        }
      } catch (e) {
        activeSolverTabId = null;
      }
    }

    const tab = await chrome.tabs.create({
      url: 'https://eksisozluk.com/basliklar/gundem',
      active: true
    });
    activeSolverTabId = tab.id;

    if (solverTimeoutId) clearTimeout(solverTimeoutId);
    solverTimeoutId = setTimeout(() => {
      if (activeSolverTabId) {
        chrome.tabs.remove(activeSolverTabId).catch(() => {});
        activeSolverTabId = null;
        chrome.runtime.sendMessage({
          action: MESSAGE_TYPES.CANCEL_CLOUDFLARE_SOLVER,
          reason: 'timeout'
        }).catch(() => {});
      }
    }, 45000);
  } catch (err) {
    console.error('Error starting Cloudflare solver tab:', err);
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
  if (activeSolverTabId && tabId === activeSolverTabId) {
    activeSolverTabId = null;
    if (solverTimeoutId) {
      clearTimeout(solverTimeoutId);
      solverTimeoutId = null;
    }
    chrome.runtime.sendMessage({
      action: MESSAGE_TYPES.CANCEL_CLOUDFLARE_SOLVER,
      reason: 'closed_by_user'
    }).catch(() => {});
  }

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

  if (message.action === 'EKSI_PAGE_READY') {
    const senderTabId = sender?.tab?.id;
    if (activeSolverTabId && senderTabId === activeSolverTabId) {
      const closingTabId = activeSolverTabId;
      activeSolverTabId = null;
      if (solverTimeoutId) {
        clearTimeout(solverTimeoutId);
        solverTimeoutId = null;
      }

      setTimeout(async () => {
        try {
          await chrome.tabs.remove(closingTabId);
        } catch (e) {}

        chrome.runtime.sendMessage({
          action: MESSAGE_TYPES.CLOUDFLARE_RESOLVED,
          success: true
        }).catch(() => {});
      }, 1000);
      sendResponse({ success: true });
      return true;
    }

    // İframe içinden veya açık başka sekmeden doğrulama tamamlandıysa popup'a bildir
    chrome.runtime.sendMessage({
      action: MESSAGE_TYPES.CLOUDFLARE_RESOLVED,
      success: true
    }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  if (message.action === MESSAGE_TYPES.START_CLOUDFLARE_SOLVER) {
    startCloudflareSolver().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === MESSAGE_TYPES.CANCEL_CLOUDFLARE_SOLVER) {
    if (activeSolverTabId) {
      chrome.tabs.remove(activeSolverTabId).catch(() => {});
      activeSolverTabId = null;
    }
    if (solverTimeoutId) {
      clearTimeout(solverTimeoutId);
      solverTimeoutId = null;
    }
    sendResponse({ success: true });
    return true;
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

  if (message.action === 'resolveImageUrl') {
    (async () => {
      try {
        const fetchUrl = message.url;
        const res = await fetch(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
          },
          redirect: 'follow'
        });
        const html = await res.text();
        const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<img\s+id=["']image["']\s+src=["']([^"']+)["']/i) ||
                      html.match(/<a\s+id=["']image-zoom["']\s+href=["']([^"']+)["']/i);
        if (match && match[1]) {
          sendResponse({ success: true, imageUrl: match[1] });
        } else {
          sendResponse({ success: false });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
