const search = function (word) {
  var query = word.selectionText;
  chrome.tabs.create({ url: "https://eksisozluk.com/?q=" + encodeURIComponent(query) });
};

// Önce mevcut menu item'ı temizle
chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: 'search-menu-item',
    title: chrome.i18n.getMessage('context_menu_search'),
    contexts: ["selection"],
  });
});

function contextClick(info, tab) {
  const { menuItemId } = info
  if (menuItemId === 'search-menu-item') {
    search(info);
  }
}

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (tab.url && tab.url.includes("eksisozluk.com")) {
    if (changeInfo.status === 'complete') {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["src/actions/js/eksi.js"]
      }).catch(() => {});
    }
  }
});

chrome.contextMenus.onClicked.addListener(contextClick);

let cachedTitles = [];

async function createOffscreenDocument() {
  try {
    if (await chrome.offscreen.hasDocument()) {
      return true;
    }
    
    await chrome.offscreen.createDocument({
      url: 'src/offscreen/offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse Ekşi Sözlük gündem sayfası'
    });
    
    // Document'ın yüklenmesi için biraz bekle
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  } catch (error) {
    console.error('Offscreen document oluşturma hatası:', error);
    return false;
  }
}

// HTML parse etmek için Promise wrapper
async function parseHtmlInOffscreen(html, url) {
  // Önce offscreen document'ın hazır olduğundan emin ol
  const isReady = await createOffscreenDocument();
  if (!isReady) {
    throw new Error('Offscreen document oluşturulamadı');
  }
  
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'parseHtml',
        html: html,
        url: url
      }, resolve);
    });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    return response;
  } catch (error) {
    console.error('Parse error:', error);
    throw error;
  }
}

async function fetchTopics() {
  try {
    await createOffscreenDocument();
    chrome.runtime.sendMessage({ action: 'fetchTopics' });
    
    const titles = await new Promise((resolve) => {
      setTimeout(() => resolve(cachedTitles), 1000);
    });
    
    return titles;
    
  } catch (error) {
    return [];
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTopics') {
    fetchTopics().then(titles => {
      sendResponse({ titles });
    });
    return true;
  }
  
  if (request.action === 'setTopicTitles') {
    cachedTitles = request.titles;
  }
});

// Storage sınıfını tanımla
class Storage {
  static async get(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }

  static async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, resolve);
    });
  }

  static async getFollowing() {
    return await this.get('following') || [];
  }

  static async addFollowing(topic) {
    const following = await this.getFollowing();
    const exists = following.some(f => f.url === topic.url);
    if (!exists) {
      following.push(topic);
      await this.set('following', following);
    }
  }

  static async removeFollowing(url) {
    const following = await this.getFollowing();
    const filtered = following.filter(f => f.url !== url);
    await this.set('following', filtered);
  }

  static async updateFollowing(topic) {
    const following = await this.getFollowing();
    const index = following.findIndex(f => f.url === topic.url);
    if (index !== -1) {
      following[index] = topic;
      await this.set('following', following);
    }
  }
}

// Bildirim gönderme fonksiyonu
async function sendNotification(topic, currentEntryCount) {
  const newEntryCount = currentEntryCount - topic.lastEntryCount;

  try {
    await chrome.notifications.create(
      `topic-${topic.url}`,
      {
        type: 'basic',
        iconUrl: '/icons/icon_48.png',
        title: topic.title,
        message: chrome.i18n.getMessage('new_entries_message').replace('%1', newEntryCount),
        priority: 2,
        requireInteraction: false,
        buttons: [{ title: chrome.i18n.getMessage('go_to_topic') }]
      }
    );

    // Son kontrol bilgilerini güncelle
    topic.lastChecked = Date.now();
    topic.lastEntryCount = currentEntryCount;
    await Storage.updateFollowing(topic);
  } catch (error) {
    console.error('Bildirim gönderme hatası:', error);
  }
}

// Takip edilen başlıkları kontrol et
async function checkFollowedTopics() {
  // Bildirimler kapalıysa kontrol etme
  const notificationsEnabled = await Storage.get('notificationsEnabled') ?? true;
  if (!notificationsEnabled) {
    return;
  }

  // Bildirim izinlerini kontrol et
  const permission = await chrome.notifications.getPermissionLevel();
  if (permission !== 'granted') {
    return;
  }

  const following = await Storage.getFollowing();
  
  // Her başlık için bildirim gönderme işlemini sıraya koyalım
  for (const topic of following) {
    try {
      const response = await fetch(topic.url);
      const html = await response.text();
      
      // Offscreen document kullan
      await createOffscreenDocument();
      
      // HTML'i parse et
      const result = await parseHtmlInOffscreen(html, topic.url);
      
      if (!result || !result.entryCount) {
        continue;
      }

      const currentEntryCount = parseInt(result.entryCount);
      
      if (currentEntryCount > topic.lastEntryCount) {
        // Her bildirim arasında 2 saniye bekle
        await new Promise(resolve => setTimeout(resolve, 2000));
        await sendNotification(topic, currentEntryCount);
      }
    } catch (error) {
      console.error('Başlık kontrolü hatası:', error);
    }
  }
}

// Alarm oluştur
chrome.alarms.create('checkTopics', {
  periodInMinutes: 1
});

// Alarm tetiklendiğinde kontrol et
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkTopics') {
    checkFollowedTopics();
  }
});

// İlk kontrolü hemen yap
checkFollowedTopics();

// Bildirim tıklama olayını dinle
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('topic-')) {
    const url = notificationId.replace('topic-', '');
    chrome.tabs.create({ url });
  }
});

// Bildirim butonuna tıklama olayını dinle
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId.startsWith('topic-')) {
    const url = notificationId.replace('topic-', '');
    chrome.tabs.create({ url });
  }
});
