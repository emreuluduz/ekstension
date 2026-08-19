import { UI } from './ui.js';
import { Topics } from './topics.js';
import { Storage } from './storage.js';
import { Search } from './search.js';
import { STORAGE_KEYS } from '../../utils/constants.js';
import { turkishToLower } from '../../utils/helpers.js';

document.addEventListener('DOMContentLoaded', async () => {
  // UI ve tema ayarlarını başlat
  await UI.initTheme();
  UI.localizeHtml();
  await UI.renderFilterTags();
  await UI.renderAuthorTags();

  // Version bilgisini göster
  const manifest = chrome.runtime.getManifest();
  if (UI.elements.versionText) {
    UI.elements.versionText.textContent = `v${manifest.version}`;
  }

  // Kelime Filtreleme Event Listeners
  if (UI.elements.addFilterBtn && UI.elements.filterInput) {
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
  }

  // Yazar Engelleme Event Listeners
  if (UI.elements.addAuthorFilterBtn && UI.elements.authorFilterInput) {
    UI.elements.addAuthorFilterBtn.addEventListener('click', async () => {
      const author = UI.elements.authorFilterInput.value.trim().toLowerCase();
      if (author) {
        await Storage.addBlockedAuthor(author);
        UI.elements.authorFilterInput.value = '';
        await UI.renderAuthorTags();
      }
    });

    UI.elements.authorFilterInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const author = e.target.value.trim().toLowerCase();
        if (author) {
          await Storage.addBlockedAuthor(author);
          e.target.value = '';
          await UI.renderAuthorTags();
        }
      }
    });
  }

  // Yedekleme ve Geri Yükleme Listeners
  if (UI.elements.exportBackupBtn) {
    UI.elements.exportBackupBtn.addEventListener('click', () => {
      UI.exportBackup();
    });
  }

  if (UI.elements.importBackupBtn && UI.elements.importFileInput) {
    UI.elements.importBackupBtn.addEventListener('click', () => {
      UI.elements.importFileInput.click();
    });

    UI.elements.importFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result;
        if (typeof content === 'string') {
          await UI.importBackup(content);
        }
        UI.elements.importFileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  if (UI.elements.refreshBtn) {
    UI.elements.refreshBtn.addEventListener('click', () => {
      Topics.refresh();
    });
  }

  // Buy Me a Coffee Event Listeners
  const openBuyMeACoffee = (e) => {
    if (e) e.preventDefault();
    chrome.tabs.create({ url: 'https://buymeacoffee.com/emreuluduz' });
  };

  if (UI.elements.coffeeBtn) {
    UI.elements.coffeeBtn.addEventListener('click', openBuyMeACoffee);
  }

  if (UI.elements.bmcLinkBtn) {
    UI.elements.bmcLinkBtn.addEventListener('click', openBuyMeACoffee);
  }

  if (UI.elements.bmcQrBox) {
    UI.elements.bmcQrBox.addEventListener('click', openBuyMeACoffee);
  }

  // Ayarlar butonu için event listener
  if (UI.elements.settingsBtn && UI.elements.settingsPanel) {
    UI.elements.settingsBtn.addEventListener('click', async () => {
      const searchPanel = document.getElementById('search-panel');
      const gundemList = document.getElementById('gundem-list');
      const eksiResults = document.getElementById('eksi-results');

      if (searchPanel) {
        searchPanel.classList.add('hidden');
      }

      const isOpening = UI.elements.settingsPanel.classList.contains('hidden');
      UI.elements.settingsPanel.classList.toggle('hidden');
      
      const content = document.querySelector('.content');
      if (isOpening) {
        // Panel açılıyor -> Gündem ve arama sonuçlarını gizle
        if (gundemList) gundemList.style.display = 'none';
        if (eksiResults) eksiResults.style.display = 'none';
        if (content) content.scrollTop = 0;
        await UI.renderLists();
        await UI.renderAuthorTags();
        await UI.renderFilterTags();
      } else {
        // Panel kapanıyor -> Gündem listesini geri göster
        if (gundemList) gundemList.style.display = 'block';
        if (eksiResults) eksiResults.style.display = 'block';
        if (content) content.scrollTop = 0;
        await Topics.loadFilterWords();
        await Topics.render(Topics.cachedTopics);
      }
    });
  }

  // Ana Sekme Değiştirme (Gündem / DEBE)
  document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('active')) return;

      document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.dataset.tab;
      const settingsPanel = document.getElementById('settings-panel');
      const searchPanel = document.getElementById('search-panel');
      const gundemList = document.getElementById('gundem-list');
      const content = document.querySelector('.content');

      if (settingsPanel) settingsPanel.classList.add('hidden');
      if (searchPanel) searchPanel.classList.add('hidden');
      if (gundemList) gundemList.style.display = 'block';
      if (content) content.scrollTop = 0;

      await Topics.load(tab);
    });
  });

  // Ayarlar Tab değiştirme (Genel / Favoriler)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const targetContent = document.querySelector(`.tab-content[data-tab="${btn.dataset.tab}"]`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
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

  if (searchClear && searchInput) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.focus();
      searchInput.dispatchEvent(new Event('input'));
    });
  }

  if (searchBtn && searchPanel && searchInput) {
    searchBtn.addEventListener('click', () => {
      const settingsPanel = document.getElementById('settings-panel');
      const gundemList = document.getElementById('gundem-list');
      const eksiResults = document.getElementById('eksi-results');

      if (settingsPanel) {
        settingsPanel.classList.add('hidden');
      }

      const isOpening = searchPanel.classList.contains('hidden');
      searchPanel.classList.toggle('hidden');

      if (isOpening) {
        if (gundemList) gundemList.style.display = 'none';
        if (eksiResults) eksiResults.style.display = 'none';
        searchInput.focus();
      } else {
        const searchResultsContainer = document.getElementById('search-results-container');
        if (searchResultsContainer) {
          searchResultsContainer.innerHTML = '';
        }
        if (gundemList) gundemList.style.display = 'block';
        if (eksiResults) eksiResults.style.display = 'block';
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchText = e.target.value.trim();
      const gundemList = document.getElementById('gundem-list');
      const searchResultsContainer = document.getElementById('search-results-container');
      
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      if (searchText.length === 0) {
        if (searchResultsContainer) {
          searchResultsContainer.remove();
        }
        if (gundemList) {
          gundemList.style.display = 'block';
        }
        return;
      }

      searchTimeout = setTimeout(() => {
        performSearch(searchText);
      }, 300);
    });
  }

  document.addEventListener('click', (e) => {
    if (searchPanel && searchBtn && !searchPanel.contains(e.target) && !searchBtn.contains(e.target)) {
      searchPanel.classList.add('hidden');
      const searchResultsContainer = document.getElementById('search-results-container');
      if (searchResultsContainer) {
        searchResultsContainer.innerHTML = '';
      }
      const gundemList = document.getElementById('gundem-list');
      if (gundemList) {
        gundemList.style.display = 'block';
      }
    }
  });

  async function performSearch(searchText) {
    if (!searchPanel) return;
    try {
      searchPanel.classList.add('searching');
      
      let searchResultsContainer = document.getElementById('search-results-container');
      if (searchResultsContainer) {
        searchResultsContainer.textContent = '';
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'search-loading-text';
        loadingDiv.textContent = 'Aranıyor...';
        searchResultsContainer.appendChild(loadingDiv);
      }

      chrome.runtime.sendMessage({
        action: 'performSearch',
        searchText: searchText
      });
    } catch (error) {
      console.error('Search error:', error);
      const searchResultsContainer = document.getElementById('search-results-container');
      if (searchResultsContainer) {
        searchResultsContainer.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'search-error';
        errorDiv.textContent = 'Arama yapılırken bir hata oluştu';
        searchResultsContainer.appendChild(errorDiv);
      }
    } finally {
      setTimeout(() => {
        if (document.body.contains(searchPanel)) {
          searchPanel.classList.remove('searching');
        }
      }, 300);
    }
  }

  function handleSearchResults(message) {
    if (message.action === 'searchResults') {
      displaySearchResults(message.results);
    } else if (message.action === 'searchError') {
      console.error('Search error:', message.error);
      const searchResultsContainer = document.getElementById('search-results-container');
      if (searchResultsContainer) {
        searchResultsContainer.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'search-error';
        errorDiv.textContent = 'Arama yapılırken bir hata oluştu';
        searchResultsContainer.appendChild(errorDiv);
      }
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'searchResults' || message.action === 'searchError') {
      handleSearchResults(message);
    }
  });

  function displaySearchResults(results) {
    const searchResultsContainer = document.getElementById('search-results-container');
    if (!searchResultsContainer) return;
    
    searchResultsContainer.innerHTML = '';
    
    if (results && (results.Titles?.length > 0 || results.Nicks?.length > 0)) {
      if (results.Titles?.length > 0) {
        const titlesSection = document.createElement('div');
        titlesSection.className = 'search-section';
        
        const header = document.createElement('div');
        header.className = 'search-section-header';
        header.textContent = 'Başlıklar';
        titlesSection.appendChild(header);
        
        results.Titles.forEach(title => {
          const resultItem = document.createElement('div');
          resultItem.className = 'gundem-item';
          
          const topicContent = document.createElement('div');
          topicContent.className = 'topic-content';
          
          const titleSpan = document.createElement('span');
          titleSpan.className = 'title';
          titleSpan.textContent = title;
          
          topicContent.appendChild(titleSpan);
          resultItem.appendChild(topicContent);
          
          resultItem.addEventListener('click', () => {
            const query = turkishToLower(title);
            chrome.tabs.create({ url: `https://eksisozluk.com/?q=${encodeURIComponent(query)}` });
          });
          titlesSection.appendChild(resultItem);
        });
        searchResultsContainer.appendChild(titlesSection);
      }

      if (results.Nicks?.length > 0) {
        const nicksSection = document.createElement('div');
        nicksSection.className = 'search-section';
        
        const header = document.createElement('div');
        header.className = 'search-section-header';
        header.textContent = 'Yazarlar';
        nicksSection.appendChild(header);
        
        results.Nicks.forEach(nick => {
          const resultItem = document.createElement('div');
          resultItem.className = 'gundem-item';
          
          const topicContent = document.createElement('div');
          topicContent.className = 'topic-content';
          
          const titleSpan = document.createElement('span');
          titleSpan.className = 'title';
          titleSpan.textContent = nick;
          
          topicContent.appendChild(titleSpan);
          resultItem.appendChild(topicContent);
          
          resultItem.addEventListener('click', () => {
            chrome.tabs.create({ url: `https://eksisozluk.com/biri/${encodeURIComponent(nick)}` });
          });
          nicksSection.appendChild(resultItem);
        });
        searchResultsContainer.appendChild(nicksSection);
      }
    } else {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-message';
      emptyDiv.innerHTML = `
        <span class="material-icons" style="font-size: 28px; display: block; margin-bottom: 6px; opacity: 0.4;">search_off</span>
        <span>Sonuç bulunamadı</span>
      `;
      searchResultsContainer.appendChild(emptyDiv);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EKSI_RESULTS') {
    Search.displayResults(message.data);
  }
});