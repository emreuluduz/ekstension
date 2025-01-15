import { UI } from './ui.js';
import { Topics } from './topics.js';
import { Storage } from './storage.js';
import { STORAGE_KEYS } from '../../utils/constants.js';

document.addEventListener('DOMContentLoaded', async () => {
  // UI ve tema ayarlarını başlat
  await UI.initTheme();
  UI.localizeHtml();
  await UI.renderFilterTags();
  await UI.initNotificationSettings();

  // Version bilgisini göster
  const manifest = chrome.runtime.getManifest();
  UI.elements.versionText.textContent = `v${manifest.version}`;

  // Event listeners
  UI.elements.addFilterBtn.addEventListener('click', async () => {
    const word = UI.elements.filterInput.value.trim().toLowerCase();
    if (word) {
      await Topics.addFilterWord(word);
      UI.elements.filterInput.value = '';
      await UI.renderFilterTags();
    }
  });

  UI.elements.filterInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const word = e.target.value.trim().toLowerCase();
      if (word) {
        await Topics.addFilterWord(word);
        e.target.value = '';
        await UI.renderFilterTags();
      }
    }
  });

  UI.elements.refreshBtn.addEventListener('click', () => {
    Topics.refresh();
  });

  // Ayarlar butonu için event listener
  UI.elements.settingsBtn.addEventListener('click', async () => {
    const isHidden = UI.elements.settingsPanel.classList.contains('hidden');
    UI.elements.settingsPanel.classList.toggle('hidden');
    
    if (!isHidden) {
      // Panel kapanıyor
      await Topics.loadFilterWords();
      await Topics.render(Topics.cachedTopics);
    } else {
      // Panel açılıyor
      await UI.renderLists();
      await Topics.render(Topics.cachedTopics);
    }
  });

  // Tab değiştirme
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.querySelector(`.tab-content[data-tab="${btn.dataset.tab}"]`).classList.add('active');
    });
  });

  // Bildirim ayarlarını kaydet
  UI.elements.notificationsEnabled.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await Storage.set(STORAGE_KEYS.NOTIFICATIONS, enabled);
    UI.elements.checkInterval.disabled = !enabled;
    
    // Bildirimleri kapattıysa alarmı durdur
    if (!enabled) {
      chrome.alarms.clear('checkTopics');
    } else {
      // Bildirimleri açtıysa alarmı başlat
      const interval = parseInt(UI.elements.checkInterval.value);
      // Mevcut alarmı temizle
      await chrome.alarms.clear('checkTopics');
      chrome.alarms.create('checkTopics', {
        periodInMinutes: interval,
        when: Date.now() + 1000  // Hemen başlat
      });
      await Storage.set(STORAGE_KEYS.CHECK_INTERVAL, interval);
      // İlk kontrolü hemen yap
      chrome.runtime.sendMessage({ action: 'checkFollowedTopics' });
    }
  });

  // Kontrol aralığı değiştiğinde kaydet
  UI.elements.checkInterval.addEventListener('change', async (e) => {
    const interval = parseInt(e.target.value);
    await Storage.set(STORAGE_KEYS.CHECK_INTERVAL, interval);
    
    // Bildirimler açıksa alarmı güncelle
    if (UI.elements.notificationsEnabled.checked) {
      chrome.alarms.create('checkTopics', {
        periodInMinutes: interval
      });
    }
  });

  // Tema değişikliği event listener'ı
  document.querySelectorAll('input[name="theme"]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const newTheme = e.target.value;
      await Storage.set(STORAGE_KEYS.THEME, newTheme);
      
      if (newTheme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.dataset.theme = prefersDark ? 'dark' : 'light';
      } else {
        document.body.dataset.theme = newTheme;
      }
    });
  });

  // Başlangıç yüklemesi
  await Topics.load();
}); 