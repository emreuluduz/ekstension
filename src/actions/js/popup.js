document.addEventListener('DOMContentLoaded', async () => {
  // DOM elementleri
  const topicsList = document.getElementById('gundem-list');
  const refreshBtn = document.getElementById('refresh-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const filterInput = document.getElementById('filter-input');
  const addFilterBtn = document.getElementById('add-filter-btn');
  const filterTags = document.getElementById('filter-tags');
  const saveSettingsBtn = document.getElementById('save-settings');
  const closeSettingsBtn = document.getElementById('close-settings');
  const versionText = document.getElementById('version-text');

  let filteredWords = [];
  let favorites = [];
  let following = [];

  function showLoading() {
    topicsList.innerHTML = `
      <div class="loading">
        <span class="material-icons spinner">refresh</span>
        ${chrome.i18n.getMessage('loading_text')}
      </div>
    `;
  }

  function showError() {
    topicsList.innerHTML = `
      <div class="error">
        <span class="material-icons">error_outline</span>
        ${chrome.i18n.getMessage('error_loading')}
      </div>
    `;
  }

  function addFilterWord(word) {
    word = word.trim().toLowerCase();
    if (word && !filteredWords.includes(word)) {
      filteredWords.push(word);
      renderFilterTags();
      filterInput.value = '';
    }
  }

  function filterTitles(titles) {
    return titles.filter(item => {
      const titleLower = item.title.toLowerCase();
      return !filteredWords.some(word => titleLower.includes(word.toLowerCase()));
    });
  }

  function localizeHtml() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = chrome.i18n.getMessage(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = chrome.i18n.getMessage(key);
    });
  }

  // Tema kontrolü
  async function initTheme() {
    const savedTheme = await Storage.get('theme') || 'auto';
    document.querySelector(`input[name="theme"][value="${savedTheme}"]`).checked = true;
    
    if (savedTheme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
      document.body.dataset.theme = savedTheme;
    }

    // Sistem teması değişikliğini dinle
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
      const currentTheme = await Storage.get('theme') || 'auto';
      if (currentTheme === 'auto') {
        document.body.dataset.theme = e.matches ? 'dark' : 'light';
      }
    });
  }

  // Ayarları yükle
  async function loadSettings() {
    filteredWords = await Storage.get('filteredWords') || [];
    favorites = await Storage.getFavorites();
    following = await Storage.getFollowing();
    
    // Bildirim ayarlarını yükle
    const notificationsEnabled = await Storage.get('notificationsEnabled') ?? true;
    const checkInterval = await Storage.get('checkInterval') ?? 1;
    
    document.getElementById('notifications-enabled').checked = notificationsEnabled;
    document.getElementById('check-interval').value = checkInterval;
    document.getElementById('check-interval').disabled = !notificationsEnabled;
    
    renderFilterTags();
  }

  // Filtre tag'lerini render et
  function renderFilterTags() {
    filterTags.innerHTML = filteredWords.map(word => `
      <div class="filter-tag">
        ${word}
        <span class="material-icons remove" data-word="${word}">close</span>
      </div>
    `).join('');

    document.querySelectorAll('.filter-tag .remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const word = e.target.dataset.word;
        filteredWords = filteredWords.filter(w => w !== word);
        await Storage.set('filteredWords', filteredWords);
        renderFilterTags();
        loadTopics();
      });
    });
  }

  // Başlık kartını oluştur
  function createTopicCard(item) {
    const isFavorite = favorites.some(f => f.url === item.url);
    const isFollowing = following.some(f => f.url === item.url);

    return `
      <div class="gundem-item" data-url="${item.url}">
        <div class="topic-content">
          <span class="entry-count">${item.entryCount}</span>
          <span class="title">${item.title}</span>
        </div>
        <button class="more-btn" data-url="${item.url}">
          <span class="material-icons">more_vert</span>
        </button>
        <div class="dropdown-menu">
          <div class="dropdown-item ${isFavorite ? 'active' : ''}" data-action="favorite">
            <span class="material-icons">${isFavorite ? 'star' : 'star_outline'}</span>
            <span class="dropdown-text">
              ${isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
            </span>
          </div>
          <div class="dropdown-item ${isFollowing ? 'active' : ''}" data-action="follow">
            <span class="material-icons">${isFollowing ? 'notifications' : 'notifications_none'}</span>
            <span class="dropdown-text">
              ${isFollowing ? 'Takibi Bırak' : 'Başlığı Takip Et'}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  // Gündem listesini yükle
  async function loadTopics() {
    showLoading();
    
    try {
      // Önce cache'e bak
      const cachedData = await Cache.get('topics');
      if (cachedData) {
        renderTopics(cachedData);
        return;
      }

      // Cache'de yoksa API'den al
      const response = await chrome.runtime.sendMessage({ action: 'getTopics' });
      if (response?.titles?.length > 0) {
        await Cache.set('topics', response.titles);
        renderTopics(response.titles);
      } else {
        showError();
      }
    } catch (error) {
      showError();
    }
  }

  // Gündem listesini render et
  function renderTopics(titles) {
    const filteredTitles = filterTitles(titles);
    topicsList.innerHTML = filteredTitles.map(createTopicCard).join('');

    // Event listener'ları ekle
    document.querySelectorAll('.gundem-item').forEach(item => {
      // Başlığa tıklama
      item.addEventListener('click', (e) => {
        const moreBtn = e.target.closest('.more-btn');
        const dropdownItem = e.target.closest('.dropdown-item');
        if (!moreBtn && !dropdownItem) {
          chrome.tabs.create({ url: item.dataset.url });
        }
      });

      // Dropdown menüyü aç/kapa
      const moreBtn = item.querySelector('.more-btn');
      const dropdownMenu = item.querySelector('.dropdown-menu');
      
      if (moreBtn && dropdownMenu) {
        moreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdownMenu.classList.toggle('show');
        });
      }
      
      // Dropdown item'lara tıklama
      item.querySelectorAll('.dropdown-item').forEach(dropdownItem => {
        dropdownItem.addEventListener('click', async (e) => {
          e.stopPropagation();
          const action = dropdownItem.dataset.action;
          const url = item.dataset.url;
          const title = titles.find(t => t.url === url);
          const iconElement = dropdownItem.querySelector('.material-icons');
          const textElement = dropdownItem.querySelector('.dropdown-text');
          
          if (action === 'favorite') {
            if (dropdownItem.classList.contains('active')) {
              await Storage.removeFavorite(url);
              dropdownItem.classList.remove('active');
              iconElement.textContent = 'star_outline';
              textElement.textContent = 'Favorilere Ekle';
            } else {
              await Storage.addFavorite(title);
              dropdownItem.classList.add('active');
              iconElement.textContent = 'star';
              textElement.textContent = 'Favorilerden Çıkar';
            }
          } else if (action === 'follow') {
            // Önce bildirim iznini kontrol et ve iste
            const permission = await chrome.notifications.getPermissionLevel();
            if (permission !== 'granted') {
              // Kullanıcıya bildirim izni için açıklama göster
              if (confirm('Başlık takibi için bildirim iznine ihtiyaç var. İzin vermek ister misiniz?')) {
                try {
                  // Chrome'un bildirim izni isteği
                  const result = await Notification.requestPermission();
                  if (result !== 'granted') {
                    alert('Bildirimler için izin verilmedi. Takip özelliği çalışmayacak.');
                    return;
                  }
                } catch (error) {
                  alert('Bildirim izni alınamadı. Takip özelliği çalışmayacak.');
                  return;
                }
              } else {
                return;
              }
            }
            
            if (dropdownItem.classList.contains('active')) {
              await Storage.removeFollowing(title.url);
              dropdownItem.classList.remove('active');
              iconElement.textContent = 'notifications_none';
              textElement.textContent = 'Başlığı Takip Et';
            } else {
              const newTopic = {
                ...title,
                lastChecked: Date.now(),
                lastEntryCount: parseInt(title.entryCount)
              };
              await Storage.addFollowing(newTopic);
              dropdownItem.classList.add('active');
              iconElement.textContent = 'notifications';
              textElement.textContent = 'Takibi Bırak';
              
              // Test bildirimi gönder
              chrome.notifications.create({
                type: 'basic',
                iconUrl: '/icons/icon_48.png',
                title: chrome.i18n.getMessage('notification_success'),
                message: chrome.i18n.getMessage('notification_success_message').replace('%1', title.title),
                priority: 2,
                requireInteraction: false
              });
            }
          }
          
          dropdownMenu.classList.remove('show');
        });
      });
    });

    // Sayfa tıklamalarında açık menüleri kapat
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown-menu') && !e.target.closest('.more-btn')) {
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
          menu.classList.remove('show');
        });
      }
    });
  }

  // Event Listeners
  addFilterBtn.addEventListener('click', async () => {
    const word = filterInput.value.trim().toLowerCase();
    if (word && !filteredWords.includes(word)) {
      filteredWords.push(word);
      await Storage.set('filteredWords', filteredWords);
      renderFilterTags();
      filterInput.value = '';
      loadTopics();
    }
  });

  filterInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const word = filterInput.value.trim().toLowerCase();
      if (word && !filteredWords.includes(word)) {
        filteredWords.push(word);
        await Storage.set('filteredWords', filteredWords);
        renderFilterTags();
        filterInput.value = '';
        loadTopics();
      }
    }
  });

  refreshBtn.addEventListener('click', () => {
    Cache.clear(); // Cache'i temizle
    loadTopics();
    const refreshIcon = refreshBtn.querySelector('.material-icons');
    refreshIcon.classList.add('rotating');
    setTimeout(() => {
      refreshIcon.classList.remove('rotating');
    }, 1000);
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

  // Favori ve takip listelerini render et
  async function renderLists() {
    const favoritesList = document.getElementById('favorites-list');
    const followingList = document.getElementById('following-list');
    
    // Favorileri render et
    const favorites = await Storage.getFavorites();
    favoritesList.innerHTML = favorites.length ? favorites.map(item => `
      <div class="list-item" data-url="${item.url}">
        <span class="title">${item.title}</span>
        <button class="remove-btn" data-url="${item.url}" data-type="favorite">
          <span class="material-icons">delete</span>
        </button>
      </div>
    `).join('') : `<div class="empty-message">${chrome.i18n.getMessage('no_favorites')}</div>`;
    
    // Takip edilenleri render et
    const following = await Storage.getFollowing();
    followingList.innerHTML = following.length ? following.map(item => `
      <div class="list-item" data-url="${item.url}">
        <span class="title">${item.title}</span>
        <button class="remove-btn" data-url="${item.url}" data-type="following">
          <span class="material-icons">delete</span>
        </button>
      </div>
    `).join('') : `<div class="empty-message">${chrome.i18n.getMessage('no_following')}</div>`;
    
    // Liste öğelerine tıklama olayı ekle
    document.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Silme butonuna tıklanmadıysa başlığa git
        if (!e.target.closest('.remove-btn')) {
          chrome.tabs.create({ url: item.dataset.url });
        }
      });
    });
    
    // Silme butonlarına event listener ekle
    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { url, type } = btn.dataset;
        if (type === 'favorite') {
          await Storage.removeFavorite(url);
        } else {
          await Storage.removeFollowing(url);
        }
        renderLists();
      });
    });
  }

  // Ayarlar butonu için tek bir event listener
  settingsBtn.addEventListener('click', async () => {
    const isHidden = settingsPanel.classList.contains('hidden');
    settingsPanel.classList.toggle('hidden');
    
    if (!isHidden) {
      // Panel kapanıyor
      filteredWords = await Storage.get('filteredWords') || [];
      renderFilterTags();
    } else {
      // Panel açılıyor
      renderLists();
    }
  });

  // Başlangıç
  await Promise.all([
    initTheme(),
    loadSettings()
  ]);
  
  // Version bilgisini göster
  const manifest = chrome.runtime.getManifest();
  versionText.textContent = `v${manifest.version}`;

  // Localization
  localizeHtml();

  // Gündem listesini yükle
  loadTopics();

  // Tema değişikliği event listener'ı
  document.querySelectorAll('input[name="theme"]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const newTheme = e.target.value;
      await Storage.set('theme', newTheme);
      
      if (newTheme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.dataset.theme = prefersDark ? 'dark' : 'light';
      } else {
        document.body.dataset.theme = newTheme;
      }
    });
  });

  // Bildirim ayarlarını kaydet
  document.getElementById('notifications-enabled').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await Storage.set('notificationsEnabled', enabled);
    document.getElementById('check-interval').disabled = !enabled;
    
    // Bildirimleri kapattıysa alarmı durdur
    if (!enabled) {
      chrome.alarms.clear('checkTopics');
    } else {
      // Bildirimleri açtıysa alarmı başlat
      const interval = parseInt(document.getElementById('check-interval').value);
      chrome.alarms.create('checkTopics', {
        periodInMinutes: interval
      });
    }
  });
}); 