import { CACHE_KEYS, STORAGE_KEYS } from '../../utils/constants.js';
import { Storage } from './storage.js';
import { Topics } from './topics.js';
import { Search } from './search.js';
import { footballApi } from '../../utils/footballApi.js';
import { parseDate } from '../../utils/dateUtils.js';
import { parseNumber, formatNumber } from '../../utils/helpers.js';

// Status mesajlarını tanımla
const STATUS_MESSAGES = {
    // Canlı/Devam Eden Maçlar
    'LIVE': 'Canlı',
    '1H': 'İlk Yarı',
    '2H': 'İkinci Yarı',
    'ET': 'Uzatma',
    'P': 'Penaltılar',
    
    // Devre Arası/Mola
    'HT': 'Devre Arası',
    'BT': 'Mola',
    
    // Maç Sonu
    'FT': 'Maç Sonu',
    'AET': 'Uzatmalar Sonrası',
    'PEN': 'Penaltılar Sonrası',
    
    // Başlamadı
    'NS': 'Başlamadı',
    'TBD': 'Tarih Belirlenmedi',
    
    // Ertelendi/İptal
    'PST': 'Ertelendi',
    'CANC': 'İptal Edildi',
    'SUSP': 'Askıya Alındı',
    'INT': 'Ara Verildi',
    'ABD': 'Terk Edildi',
    
    // Hükmen
    'AWD': 'Hükmen',
    'WO': 'Hükmen'
};

export const UI = {
  elements: {
    topicsList: document.getElementById('gundem-list'),
    refreshBtn: document.getElementById('refresh-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsPanel: document.getElementById('settings-panel'),
    filterInput: document.getElementById('filter-input'),
    addFilterBtn: document.getElementById('add-filter-btn'),
    filterTags: document.getElementById('filter-tags'),
    versionText: document.getElementById('version-text'),
    notificationsEnabled: document.getElementById('notifications-enabled'),
    checkInterval: document.getElementById('check-interval')
  },

  showLoading() {
    this.elements.topicsList.innerHTML = `
      <div class="loading">
        <span class="material-icons spinner">refresh</span>
        ${chrome.i18n.getMessage('loading_text')}
      </div>
    `;
  },
  
  showError() {
    this.elements.topicsList.innerHTML = `
      <div class="error">
        <span class="material-icons">error_outline</span>
        ${chrome.i18n.getMessage('error_loading')}
      </div>
    `;
  },

  async renderMatchScore(title) {
    const matchRegex = /(\d{1,2}\s+(?:ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+\d{4})\s+(.+?)\s+(.+?)\s+maçı/i;
    const match = title.match(matchRegex);
    
    if (match) {
        const [_, dateStr, homeTeam, awayTeam] = match;
        const formattedDate = parseDate(dateStr);
        
        try {
            const matches = await footballApi.getMatchesByDate(formattedDate);
            const score = footballApi.findMatchScore(matches, homeTeam, awayTeam);
            
            if (score) {
                // Maç durumuna göre gösterim
                let statusIndicator = '';
                switch(score.status) {
                    // Canlı/Devam Eden Maçlar
                    case 'LIVE':
                    case '1H':
                    case '2H':
                    case 'ET':
                    case 'P':
                        statusIndicator = '<span class="material-icons status-icon live">radio_button_checked</span>';
                        break;

                    // Devre Arası/Mola
                    case 'HT':
                    case 'BT':
                        statusIndicator = '<span class="material-icons status-icon">timer</span>';
                        break;

                    // Maç Sonu
                    case 'FT':
                    case 'AET':
                    case 'PEN':
                        statusIndicator = '<span class="material-icons status-icon">flag</span>';
                        break;

                    // Başlamadı
                    case 'NS':
                    case 'TBD':
                        statusIndicator = '<span class="material-icons status-icon">schedule</span>';
                        break;

                    // Ertelendi/İptal
                    case 'PST':
                    case 'CANC':
                    case 'SUSP':
                    case 'INT':
                    case 'ABD':
                        statusIndicator = '<span class="material-icons status-icon">event_busy</span>';
                        break;

                    // Hükmen
                    case 'AWD':
                    case 'WO':
                        statusIndicator = '<span class="material-icons status-icon">gavel</span>';
                        break;

                    default:
                        statusIndicator = '<span class="material-icons status-icon">sports_soccer</span>';
                }

                const statusMessage = STATUS_MESSAGES[score.status] || 'Bilinmiyor';
                const isLive = ['LIVE', '1H', '2H', 'ET', 'P'].includes(score.status);

                return `
                    <div class="match-score ${isLive ? 'live' : ''}" title="${statusMessage}">
                        ${statusIndicator}
                        ${score.home}-${score.away}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Skor alınamadı:', error);
        }
    }
    return '';
  },

  async createTopicCard(item, favorites, following) {
    const isFavorite = favorites.some(f => f.url === item.url);
    const isFollowing = following.some(f => f.url === item.url);
    
    // Entry count'u parse et ve formatla
    const entryCount = parseNumber(item.entryCount);
    const formattedEntryCount = formatNumber(entryCount);
    
    // Başlık HTML'ini oluştur
    const html = `
        <div class="gundem-item" data-url="${item.url}">
            <div class="topic-content">
                <span class="entry-count">${formattedEntryCount}</span>
                <span class="title">${item.title}</span>
                <span class="score-container"></span>
            </div>
            <button class="more-btn" data-url="${item.url}">
                <span class="material-icons">more_vert</span>
            </button>
            <div class="dropdown-menu">
                <div class="dropdown-item ${isFavorite ? 'active' : ''}" data-action="favorite" data-url="${item.url}" data-title="${item.title}">
                    <span class="material-icons" style="color: ${isFavorite ? 'var(--active-icon)' : 'var(--text)'}">
                        ${isFavorite ? 'star' : 'star_outline'}
                    </span>
                    <span class="dropdown-text">
                        ${isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                    </span>
                </div>
                <div class="dropdown-item ${isFollowing ? 'active' : ''}" data-action="follow" data-url="${item.url}" data-title="${item.title}">
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

    return {
        html,
        afterRender: async (element) => {
            // Skor bilgisini al ve ekle
            const scoreHtml = await this.renderMatchScore(item.title);
            if (scoreHtml && element) {
                const scoreContainer = element.querySelector('.score-container');
                if (scoreContainer) {
                    scoreContainer.innerHTML = scoreHtml;
                }
            }
        }
    };
  },

  async renderTopics(titles, favorites, following) {
    const filteredTitles = titles;
    const cards = await Promise.all(
        filteredTitles.map(item => this.createTopicCard(item, favorites, following))
    );
    
    // Önce HTML'i ekle
    this.elements.topicsList.innerHTML = cards.map(card => card.html).join('');
    
    // Sonra her kart için afterRender fonksiyonunu çalıştır
    const elements = this.elements.topicsList.querySelectorAll('.gundem-item');
    await Promise.all(cards.map((card, index) => card.afterRender(elements[index])));
    
    this.attachTopicListeners();
  },

  async renderLists() {
    const favoritesList = document.getElementById('favorites-list');
    const followingList = document.getElementById('following-list');
    
    const favorites = await Storage.getFavorites();
    const following = await Storage.getFollowing();
    
    favoritesList.innerHTML = favorites.length ? favorites.map(item => `
      <div class="list-item" data-url="${item.url}">
        <span class="title">${item.title}</span>
        <button class="remove-btn" data-url="${item.url}" data-type="favorite">
          <span class="material-icons">delete</span>
        </button>
      </div>
    `).join('') : `<div class="empty-message">${chrome.i18n.getMessage('no_favorites')}</div>`;
    
    followingList.innerHTML = following.length ? following.map(item => `
      <div class="list-item" data-url="${item.url}">
        <span class="title">${item.title}</span>
        <button class="remove-btn" data-url="${item.url}" data-type="following">
          <span class="material-icons">delete</span>
        </button>
      </div>
    `).join('') : `<div class="empty-message">${chrome.i18n.getMessage('no_following')}</div>`;

    this.attachListListeners();
  },

  async initTheme() {
    const savedTheme = await Storage.get(STORAGE_KEYS.THEME) || 'auto';
    document.querySelector(`input[name="theme"][value="${savedTheme}"]`).checked = true;
    
    if (savedTheme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
      document.body.dataset.theme = savedTheme;
    }

    this.attachThemeListeners();
  },

  async renderFilterTags() {
    const filteredWords = await Storage.get(STORAGE_KEYS.FILTERED_WORDS) || [];
    this.elements.filterTags.innerHTML = filteredWords.map(word => `
      <div class="filter-tag">
        ${word}
        <span class="material-icons remove" data-word="${word}">close</span>
      </div>
    `).join('');

    // Silme butonlarına event listener ekle
    document.querySelectorAll('.filter-tag .remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const word = e.target.dataset.word;
        const filteredWords = await Storage.get(STORAGE_KEYS.FILTERED_WORDS) || [];
        const updatedWords = filteredWords.filter(w => w !== word);
        await Storage.set(STORAGE_KEYS.FILTERED_WORDS, updatedWords);
        await this.renderFilterTags();
        await Topics.render(Topics.cachedTopics);
      });
    });
  },

  attachTopicListeners() {
    // Önce tüm event listener'ları temizle
    document.querySelectorAll('.gundem-item').forEach(item => {
      const clone = item.cloneNode(true);
      item.parentNode.replaceChild(clone, item);
    });

    // Yeni event listener'ları ekle
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
          // Önce tüm açık menüleri kapat
          document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            if (menu !== dropdownMenu) {
              menu.classList.remove('show');
            }
          });
          dropdownMenu.classList.toggle('show');
        });
      }
      
      // Dropdown item'lara tıklama
      item.querySelectorAll('.dropdown-item').forEach(dropdownItem => {
        dropdownItem.addEventListener('click', async (e) => {
          e.stopPropagation();
          const action = dropdownItem.dataset.action;
          const url = dropdownItem.dataset.url;
          const title = dropdownItem.dataset.title;
          
          if (action === 'favorite') {
            if (dropdownItem.classList.contains('active')) {
              await Topics.removeFromFavorites(url);
            } else {
              await Topics.addToFavorites({ title, url });
            }
          } else if (action === 'follow') {
            if (dropdownItem.classList.contains('active')) {
              await Topics.removeFromFollowing(url);
            } else {
              await Topics.addToFollowing({ title, url });
            }
          }
          
          dropdownMenu.classList.remove('show');

          // Gündem listesini yeniden render et
          const favorites = await Storage.getFavorites();
          const following = await Storage.getFollowing();
          
          // Arama sonuçlarını yeniden render et
          const results = await Storage.get(STORAGE_KEYS.CURRENT_SEARCH_RESULTS);
          if (results) {
            await Search.displayResults(results);
          }
          
          // Gündem listesini yeniden render et
          if (Topics.cachedTopics) {
            await this.renderTopics(Topics.cachedTopics, favorites, following);
          }
        });
      });
    });

    // Sayfa tıklamalarında açık menüleri kapat
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dropdown-menu') && !e.target.closest('.more-btn')) {
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
          menu.classList.remove('show');
        });
      }
    };

    // Önce eski event listener'ı kaldır
    document.removeEventListener('click', handleClickOutside);
    // Yeni event listener'ı ekle
    document.addEventListener('click', handleClickOutside);
  },

  attachListListeners() {
    document.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-btn')) {
          chrome.tabs.create({ url: item.dataset.url });
        }
      });
    });
    
    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { url, type } = btn.dataset;
        if (type === 'favorite') {
          await Topics.removeFromFavorites(url);
        } else {
          await Topics.removeFromFollowing(url);
        }
        await this.renderLists();
      });
    });
  },

  attachThemeListeners() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
      const currentTheme = await Storage.get(STORAGE_KEYS.THEME) || 'auto';
      if (currentTheme === 'auto') {
        document.body.dataset.theme = e.matches ? 'dark' : 'light';
      }
    });
  },

  localizeHtml() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = chrome.i18n.getMessage(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = chrome.i18n.getMessage(key);
    });
  },

  async initNotificationSettings() {
    // Bildirim ayarlarını yükle
    const notificationsEnabled = await Storage.get(STORAGE_KEYS.NOTIFICATIONS) ?? true;
    const checkInterval = await Storage.get(STORAGE_KEYS.CHECK_INTERVAL) ?? 1;

    // Checkbox'ı ayarla
    this.elements.notificationsEnabled.checked = notificationsEnabled;
    this.elements.checkInterval.value = checkInterval;
    this.elements.checkInterval.disabled = !notificationsEnabled;
  }
}; 