import { Topics } from './topics.js';
import { Notifications } from './notifications.js';
import { MESSAGE_TYPES, STORAGE_KEYS } from '../utils/constants.js';
import { Storage } from '../actions/js/storage.js';

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

// Content script injection
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url?.includes("eksisozluk.com") && changeInfo.status === 'complete') {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["src/actions/js/eksi.js"]
    }).catch(() => {});
  }
});

// Message listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkFollowedTopics') {
    Notifications.checkFollowedTopics();
  }
  
  if (request.action === 'getFilteredWords') {
    Storage.get(STORAGE_KEYS.FILTERED_WORDS).then(words => {
      sendResponse(words || []);
    });
    return true;
  }
  
  if (request.action === MESSAGE_TYPES.FETCH_TOPICS) {
    Topics.fetch().then(titles => {
      sendResponse({ titles });
    });
    return true;
  }
  
  if (request.action === MESSAGE_TYPES.SET_TOPIC_TITLES) {
    Topics.cachedTitles = request.titles;
  }
  
  if (request.action === MESSAGE_TYPES.PARSE_HTML) {
    Topics.parse(request.html, request.url).then(result => {
      sendResponse(result);
    });
    return true;
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
