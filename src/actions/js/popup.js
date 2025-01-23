import { UI } from './ui.js';
import { Topics } from './topics.js';
import { Storage } from './storage.js';
import { Search } from './search.js';
import { STORAGE_KEYS } from '../../utils/constants.js';

export async function displayEksiResults(data) {
  // Önce eski container'ı kaldır
  let container = document.getElementById('eksi-results');
  if (container) {
    container.remove();
  }

  // Sonuç yoksa hiçbir şey yapma
  if (!data || !data.pageData || !data.eksiResults || Object.keys(data.eksiResults).length === 0) {
    return;
  }

  // Yeni container oluştur
  container = document.createElement('div');
  container.id = 'eksi-results';
  container.className = 'results-container';

  // Gündem listesinden önce yerleştir
  const gundemList = document.getElementById('gundem-list');
  if (gundemList) {
    gundemList.parentNode.insertBefore(container, gundemList);
  }

  // Favori ve takip listelerini al
  const favorites = await Storage.getFavorites();
  const following = await Storage.getFollowing();

  let html = `
    <div class="search-header">
      <h3>İlgili Başlıklar</h3>
    </div>
  `;

  // Her bir selector için sonuçları göster
  for (const [key, results] of Object.entries(data.eksiResults)) {
    if (!results || results.length === 0) continue;

    results.forEach(result => {
      const isFavorite = favorites.some(f => f.url === result.Url);
      const isFollowing = following.some(f => f.url === result.Url);

      html += `
        <div class="gundem-item" data-url="${result.Url}" data-title="${result.Title}">
          <div class="topic-content">
            <div class="site-icon ${data.site.toLowerCase()}">
              <img src="/icons/sites/${data.site.toLowerCase()}.png" alt="${data.site}">
            </div>
            <span class="title">${result.Title}</span>
          </div>
          <button class="more-btn">
            <span class="material-icons">more_vert</span>
          </button>
          <div class="dropdown-menu">
            <div class="dropdown-item ${isFavorite ? 'active' : ''}" data-action="favorite" data-url="${result.Url}" data-title="${result.Title}">
              <span class="material-icons" style="color: ${isFavorite ? 'var(--active-icon)' : 'var(--text)'}">
                ${isFavorite ? 'star' : 'star_outline'}
              </span>
              <span class="dropdown-text">
                ${isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
              </span>
            </div>
            <div class="dropdown-item ${isFollowing ? 'active' : ''}" data-action="follow" data-url="${result.Url}" data-title="${result.Title}">
              <span class="material-icons" style="color: ${isFollowing ? 'var(--active-icon)' : 'var(--text)'}">
                ${isFollowing ? 'notifications' : 'notifications_none'}
              </span>
              <span class="dropdown-text">
                ${isFollowing ? 'Takibi Bırak' : 'Başlığı Takip Et'}
              </span>
            </div>
          </div>
        </div>
      `;
    });
  }

  container.innerHTML = html;
  UI.attachTopicListeners();
}

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

  // Varsa mevcut arama sonuçlarını yükle
  const results = await Storage.get(STORAGE_KEYS.CURRENT_SEARCH_RESULTS);
  if (results) {
    Search.displayResults(results);
  }

  const searchBtn = document.getElementById('search-btn');
  const searchPanel = document.getElementById('search-panel');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.querySelector('.search-clear');
  let searchTimeout = null;

  // Clear button functionality
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    // Trigger input event to update UI
    searchInput.dispatchEvent(new Event('input'));
  });

  searchBtn.addEventListener('click', () => {
    const settingsPanel = document.getElementById('settings-panel');
    settingsPanel.classList.add('hidden'); // Ayarlar panelini kapat
    searchPanel.classList.toggle('hidden');
    if (!searchPanel.classList.contains('hidden')) {
        searchInput.focus();
    } else {
        // Arama paneli kapanınca sonuçları temizle ve gündem listesini göster
        const searchResultsContainer = document.getElementById('search-results-container');
        if (searchResultsContainer) {
            searchResultsContainer.innerHTML = '';
        }
        document.getElementById('gundem-list').style.display = 'block';
    }
  });

  // Settings butonu için de arama panelini kapatma ekleyelim
  document.getElementById('settings-btn').addEventListener('click', () => {
    searchPanel.classList.add('hidden');
    // ... existing settings button code ...
  });

  searchInput.addEventListener('input', (e) => {
    const searchText = e.target.value.trim();
    const gundemList = document.getElementById('gundem-list');
    const searchResultsContainer = document.getElementById('search-results-container');
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // If search text is empty, show gundem list and remove search results
    if (searchText.length === 0) {
      if (searchResultsContainer) {
        searchResultsContainer.remove();
      }
      gundemList.style.display = 'block';
      return;
    }

    // Add debounce to prevent too many requests
    searchTimeout = setTimeout(() => {
      performSearch(searchText);
    }, 300);
  });

  // Close search when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchPanel.contains(e.target) && !searchBtn.contains(e.target)) {
      searchPanel.classList.add('hidden');
      // Arama paneli kapanınca sonuçları temizle ve gündem listesini göster
      const searchResultsContainer = document.getElementById('search-results-container');
      if (searchResultsContainer) {
        searchResultsContainer.innerHTML = '';
      }
      document.getElementById('gundem-list').style.display = 'block';
    }
  });

  // Show loading state during search
  async function performSearch(searchText) {
    try {
      searchPanel.classList.add('searching');
      
      // Önceki arama sonuçlarını temizle
      const searchResultsContainer = document.getElementById('search-results-container');
      if (searchResultsContainer) {
        searchResultsContainer.innerHTML = `
          <div class="search-loading-text">
            Aranıyor...
          </div>
        `;
      }

      // İsteği gönder ve cevabı bekle
      chrome.runtime.sendMessage({
        action: 'performSearch',
        searchText: searchText
      });

    } catch (error) {
      console.error('Search error:', error);
      const searchResultsContainer = document.getElementById('search-results-container');
      if (searchResultsContainer) {
        searchResultsContainer.innerHTML = `
          <div class="search-error">
            Arama yapılırken bir hata oluştu
          </div>
        `;
      }
    } finally {
      // Loading state'i kaldır
      setTimeout(() => {
        if (document.body.contains(searchPanel)) { // Panel hala DOM'da mı kontrol et
          searchPanel.classList.remove('searching');
        }
      }, 300);
    }
  }

  // Yeni bir fonksiyon olarak tanımla
  function handleSearchResults(message) {
    if (message.action === 'searchResults') {
      displaySearchResults(message.results);
    } else if (message.action === 'searchError') {
      console.error('Search error:', message.error);
      const searchResultsContainer = document.getElementById('search-results-container');
      if (searchResultsContainer) {
        searchResultsContainer.innerHTML = `
          <div class="search-error">
            Arama yapılırken bir hata oluştu
          </div>
        `;
      }
    }
  }

  // Global message listener'a ekle
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'searchResults' || message.action === 'searchError') {
      handleSearchResults(message);
    }
  });

  function displaySearchResults(results) {
    const gundemList = document.getElementById('gundem-list');
    const content = document.querySelector('.content');
    
    // Önce eski arama sonuçlarını temizle
    let searchResultsContainer = document.getElementById('search-results-container');
    if (searchResultsContainer) {
      searchResultsContainer.remove();
    }

    // Yeni sonuçlar container'ı oluştur
    searchResultsContainer = document.createElement('div');
    searchResultsContainer.id = 'search-results-container';
    searchResultsContainer.className = 'results-container';
    
    if (results && (results.Titles?.length > 0 || results.Nicks?.length > 0)) {
      // Başlıkları göster
      if (results.Titles?.length > 0) {
        const titlesSection = document.createElement('div');
        titlesSection.className = 'search-section';
        titlesSection.innerHTML = '<div class="search-section-header">Başlıklar</div>';
        
        results.Titles.forEach(title => {
          const resultItem = document.createElement('div');
          resultItem.className = 'gundem-item';
          resultItem.innerHTML = `
            <div class="topic-content">
              <span class="title">${title}</span>
            </div>
          `;
          resultItem.addEventListener('click', () => {
            const query = title.toLowerCase();
            window.open(`https://eksisozluk.com/?q=${encodeURIComponent(query)}`, '_blank');
          });
          titlesSection.appendChild(resultItem);
        });
        searchResultsContainer.appendChild(titlesSection);
      }

      // Yazarları göster
      if (results.Nicks?.length > 0) {
        const nicksSection = document.createElement('div');
        nicksSection.className = 'search-section';
        nicksSection.innerHTML = '<div class="search-section-header">Yazarlar</div>';
        
        results.Nicks.forEach(nick => {
          const resultItem = document.createElement('div');
          resultItem.className = 'gundem-item';
          resultItem.innerHTML = `
            <div class="topic-content">
              <span class="title">${nick}</span>
            </div>
          `;
          resultItem.addEventListener('click', () => {
            window.open(`https://eksisozluk.com/biri/${nick}`, '_blank');
          });
          nicksSection.appendChild(resultItem);
        });
        searchResultsContainer.appendChild(nicksSection);
      }

      // Gündem listesini gizle ve arama sonuçlarını göster
      gundemList.style.display = 'none';
      content.insertBefore(searchResultsContainer, gundemList);
    } else {
      // Sonuç yoksa "sonuç bulunamadı" mesajı göster
      searchResultsContainer.innerHTML = `
        <div class="search-error">
          Sonuç bulunamadı
        </div>
      `;
      gundemList.style.display = 'none';
      content.insertBefore(searchResultsContainer, gundemList);
    }
  }
});

// Listen for Ekşi results
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EKSI_RESULTS') {
    Search.displayResults(message.data);
  }
}); 