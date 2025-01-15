import { STORAGE_KEYS, MESSAGE_TYPES } from '../utils/constants.js';
import { Storage } from '../actions/js/storage.js';
import { parseEntryCount } from '../utils/helpers.js';
import { Topics } from './topics.js';

export const Notifications = {
  async send(topic, currentEntryCount) {
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
      console.error('Notification error:', error);
    }
  },
  
  async checkFollowedTopics() {
    // Bildirimler kapalıysa kontrol etme
    const notificationsEnabled = await Storage.get(STORAGE_KEYS.NOTIFICATIONS) ?? true;
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
        const response = await fetch('https://eksisozluk.com');
        
        // Response kontrolü
        if (!response.ok) {
          console.error('Fetch failed:', response.status, response.statusText);
          continue;
        }
        
        const html = await response.text();
        const result = await Topics.parse(html, topic.url);
        
        if (!result || !result.entryCount) {
          continue;
        }

        const currentEntryCount = parseEntryCount(result.entryCount);
        
        if (currentEntryCount > topic.lastEntryCount) {
          // Her bildirim arasında 2 saniye bekle
          await new Promise(resolve => setTimeout(resolve, 2000));
          await this.send(topic, currentEntryCount);
        }
      } catch (error) {
        console.error('Topic check error:', error);
      }
    }
  },

  setupAlarms() {
    // Mevcut alarmı temizle
    chrome.alarms.clear('checkTopics');
    
    // Kayıtlı kontrol sıklığını al
    Storage.get(STORAGE_KEYS.CHECK_INTERVAL).then(interval => {
      // Varsayılan değer 5 dakika
      const checkInterval = interval || 5;
      
      // Alarm oluştur
      chrome.alarms.create('checkTopics', {
        periodInMinutes: checkInterval,
        when: Date.now() + 1000  // İlk kontrolü 1 saniye sonra yap
      });
    });

    // Alarm tetiklendiğinde kontrol et
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'checkTopics') {
        this.checkFollowedTopics();
      }
    });
  },

  setupListeners() {
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
  }
}; 