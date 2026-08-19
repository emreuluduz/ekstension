import { STORAGE_KEYS } from '../../utils/constants.js';
import { Storage } from './storage.js';
import { Topics } from './topics.js';
import { Search } from './search.js';
import { parseNumber, formatNumber, escapeHTML } from '../../utils/helpers.js';

export const UI = {
  elements: {
    get topicsList() { return document.getElementById('gundem-list'); },
    get refreshBtn() { return document.getElementById('refresh-btn'); },
    get settingsBtn() { return document.getElementById('settings-btn'); },
    get settingsPanel() { return document.getElementById('settings-panel'); },
    get filterInput() { return document.getElementById('filter-input'); },
    get addFilterBtn() { return document.getElementById('add-filter-btn'); },
    get filterTags() { return document.getElementById('filter-tags'); },
    get authorFilterInput() { return document.getElementById('author-filter-input'); },
    get addAuthorFilterBtn() { return document.getElementById('add-author-filter-btn'); },
    get authorFilterTags() { return document.getElementById('author-filter-tags'); },
    get exportBackupBtn() { return document.getElementById('export-backup-btn'); },
    get importBackupBtn() { return document.getElementById('import-backup-btn'); },
    get importFileInput() { return document.getElementById('import-file-input'); },
    get coffeeBtn() { return document.getElementById('coffee-btn'); },
    get bmcLinkBtn() { return document.getElementById('bmc-link-btn'); },
    get bmcQrBox() { return document.getElementById('bmc-qr-box'); },
    get versionText() { return document.getElementById('version-text'); }
  },

  showLoading() {
    this.elements.topicsList.innerHTML = `
      <div class="loading">
        <span class="material-icons spinner">refresh</span>
        ${escapeHTML(chrome.i18n.getMessage('loading_text'))}
      </div>
    `;
  },
  
  showError() {
    this.elements.topicsList.innerHTML = `
      <div class="error">
        <span class="material-icons">error_outline</span>
        ${escapeHTML(chrome.i18n.getMessage('error_loading'))}
      </div>
    `;
  },

  createTopicCard(item, favorites) {
    const isFavorite = favorites.some(f => f.url === item.url);
    
    // Entry count'u parse et ve formatla
    const entryCount = parseNumber(item.entryCount);
    const formattedEntryCount = formatNumber(entryCount);
    const safeTitle = escapeHTML(item.title);
    const safeUrl = encodeURI(item.url);
    
    // Başlık HTML'ini oluştur
    return `
        <div class="gundem-item" data-url="${safeUrl}">
            <div class="topic-content">
                <span class="entry-count">${escapeHTML(formattedEntryCount)}</span>
                <span class="title">${safeTitle}</span>
            </div>
            <button class="more-btn" data-url="${safeUrl}" aria-label="Seçenekler">
                <span class="material-icons">more_vert</span>
            </button>
            <div class="dropdown-menu">
                <div class="dropdown-item ${isFavorite ? 'active' : ''}" data-action="favorite" data-url="${safeUrl}" data-title="${safeTitle}">
                    <span class="material-icons" style="color: ${isFavorite ? 'var(--active-icon)' : 'var(--text)'}">
                        ${isFavorite ? 'star' : 'star_outline'}
                    </span>
                    <span class="dropdown-text">
                        ${isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                    </span>
                </div>
            </div>
        </div>
    `;
  },

  async renderTopics(titles, favorites) {
    if (!titles || titles.length === 0) {
      this.elements.topicsList.innerHTML = `
        <div class="empty-message">
          <span class="material-icons" style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.4;">filter_list_off</span>
          <span>Görüntülenecek başlık bulunamadı</span>
        </div>
      `;
      return;
    }
    const cardsHtml = titles.map(item => this.createTopicCard(item, favorites)).join('');
    this.elements.topicsList.innerHTML = cardsHtml;
    this.attachTopicListeners();
  },

  async renderLists() {
    const favoritesList = document.getElementById('favorites-list');
    if (!favoritesList) return;
    
    const favorites = await Storage.getFavorites();
    
    favoritesList.innerHTML = favorites.length ? favorites.map(item => `
      <div class="list-item" data-url="${encodeURI(item.url)}">
        <span class="title">${escapeHTML(item.title)}</span>
        <button class="remove-btn" data-url="${encodeURI(item.url)}" data-type="favorite" aria-label="Sil">
          <span class="material-icons">delete</span>
        </button>
      </div>
    `).join('') : `<div class="empty-message">${escapeHTML(chrome.i18n.getMessage('no_favorites'))}</div>`;

    this.attachListListeners();
  },

  async initTheme() {
    const savedTheme = await Storage.get(STORAGE_KEYS.THEME) || 'auto';
    const radioBtn = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
    if (radioBtn) {
      radioBtn.checked = true;
    }
    
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
        <span>${escapeHTML(word)}</span>
        <span class="material-icons remove" data-word="${escapeHTML(word)}">close</span>
      </div>
    `).join('');

    // Silme butonlarına event listener ekle
    this.elements.filterTags.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const word = e.target.dataset.word;
        const currentFilteredWords = await Storage.get(STORAGE_KEYS.FILTERED_WORDS) || [];
        const updatedWords = currentFilteredWords.filter(w => w !== word);
        await Storage.set(STORAGE_KEYS.FILTERED_WORDS, updatedWords);
        await this.renderFilterTags();
        await Topics.render(Topics.cachedTopics);
      });
    });
  },

  async renderAuthorTags() {
    if (!this.elements.authorFilterTags) return;
    const blockedAuthors = await Storage.getBlockedAuthors();
    this.elements.authorFilterTags.innerHTML = blockedAuthors.map(author => `
      <div class="filter-tag">
        <span>@${escapeHTML(author)}</span>
        <span class="material-icons remove" data-author="${escapeHTML(author)}">close</span>
      </div>
    `).join('');

    // Silme butonlarına event listener ekle
    this.elements.authorFilterTags.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const author = e.target.dataset.author;
        await Storage.removeBlockedAuthor(author);
        await this.renderAuthorTags();
      });
    });
  },

  async exportBackup() {
    const favorites = await Storage.getFavorites();
    const filteredWords = await Storage.get(STORAGE_KEYS.FILTERED_WORDS) || [];
    const blockedAuthors = await Storage.getBlockedAuthors();
    const theme = await Storage.get(STORAGE_KEYS.THEME) || 'auto';

    const backupData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: {
        favorites,
        filteredWords,
        blockedAuthors,
        theme
      }
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ekstension_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async importBackup(jsonString) {
    try {
      const backup = JSON.parse(jsonString);
      if (!backup || !backup.data) {
        throw new Error('Geçersiz yedek dosyası formatı');
      }

      const { favorites, filteredWords, blockedAuthors, theme } = backup.data;

      if (Array.isArray(favorites)) {
        await Storage.set(STORAGE_KEYS.FAVORITES, favorites);
      }
      if (Array.isArray(filteredWords)) {
        await Storage.set(STORAGE_KEYS.FILTERED_WORDS, filteredWords);
      }
      if (Array.isArray(blockedAuthors)) {
        await Storage.set(STORAGE_KEYS.BLOCKED_AUTHORS, blockedAuthors);
      }
      if (typeof theme === 'string') {
        await Storage.set(STORAGE_KEYS.THEME, theme);
      }

      // Arayüzü yenile
      await this.initTheme();
      await this.renderFilterTags();
      await this.renderAuthorTags();
      await this.renderLists();
      await Topics.render(Topics.cachedTopics);

      alert(chrome.i18n.getMessage('import_success') || 'Yedek başarıyla geri yüklendi!');
    } catch (err) {
      console.error('Import error:', err);
      alert(chrome.i18n.getMessage('import_error') || 'Yedek yüklenirken bir hata oluştu!');
    }
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
        if (!moreBtn && !dropdownItem && item.dataset.url) {
          chrome.tabs.create({ url: item.dataset.url });
        }
      });

      // Dropdown menüyü aç/kapa
      const moreBtn = item.querySelector('.more-btn');
      const dropdownMenu = item.querySelector('.dropdown-menu');
      
      if (moreBtn && dropdownMenu) {
        moreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isCurrentlyOpen = dropdownMenu.classList.contains('show');

          // Önce tüm açık menüleri ve aktif item'ları kapat
          document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
          });
          document.querySelectorAll('.gundem-item.dropdown-active').forEach(el => {
            el.classList.remove('dropdown-active');
          });

          if (!isCurrentlyOpen) {
            // Akıllı konumlandırma: Altta yer kalmadıysa yukarı aç
            const content = document.querySelector('.content');
            if (content) {
              const itemRect = item.getBoundingClientRect();
              const contentRect = content.getBoundingClientRect();
              if (itemRect.bottom + 50 > contentRect.bottom) {
                dropdownMenu.classList.add('open-up');
              } else {
                dropdownMenu.classList.remove('open-up');
              }
            }

            dropdownMenu.classList.add('show');
            item.classList.add('dropdown-active');
          }
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
          }
          
          dropdownMenu.classList.remove('show');
          item.classList.remove('dropdown-active');

          // Gündem ve arama sonuçlarını yeniden render et
          const favorites = await Storage.getFavorites();
          
          const results = await Storage.get(STORAGE_KEYS.CURRENT_SEARCH_RESULTS);
          if (results) {
            await Search.displayResults(results);
          }
          
          const currentList = Topics.getCurrentList ? Topics.getCurrentList() : Topics.cachedTopics;
          if (currentList && currentList.length > 0) {
            const filtered = await Topics.filter(currentList);
            await this.renderTopics(filtered, favorites);
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
        document.querySelectorAll('.gundem-item.dropdown-active').forEach(el => {
          el.classList.remove('dropdown-active');
        });
      }
    };

    document.removeEventListener('click', handleClickOutside);
    document.addEventListener('click', handleClickOutside);
  },

  attachListListeners() {
    document.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-btn') && item.dataset.url) {
          chrome.tabs.create({ url: item.dataset.url });
        }
      });
    });
    
    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { url } = btn.dataset;
        await Topics.removeFromFavorites(url);
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
      const msg = chrome.i18n.getMessage(key);
      if (msg) element.textContent = msg;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      const msg = chrome.i18n.getMessage(key);
      if (msg) element.placeholder = msg;
    });

    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      const msg = chrome.i18n.getMessage(key);
      if (msg) element.title = msg;
    });
  }
};