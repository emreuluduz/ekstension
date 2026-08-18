import { Storage } from './storage.js';
import { UI } from './ui.js';
import { escapeHTML } from '../../utils/helpers.js';

export const Search = {
  async displayResults(data) {
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

    // Favori listesini al
    const favorites = await Storage.getFavorites();

    let html = `
      <div class="search-header">
        <h3>İlgili Başlıklar</h3>
      </div>
    `;

    const siteName = escapeHTML((data.site || '').toLowerCase());

    // Her bir selector için sonuçları göster
    for (const [key, results] of Object.entries(data.eksiResults)) {
      if (!results || results.length === 0) continue;

      results.forEach(result => {
        if (!result.results || !result.results[0]) return;
        const targetUrl = encodeURI(result.results[0].Url || '');
        const targetTerm = escapeHTML(result.term || '');
        const isFavorite = favorites.some(f => f.url === result.results[0].Url);

        html += `
          <div class="gundem-item" data-url="${targetUrl}" data-title="${targetTerm}">
            <div class="topic-content">
              <div class="site-icon ${siteName}">
                <img src="/icons/sites/${siteName}.png" alt="${siteName}">
              </div>
              <span class="title">${targetTerm}</span>
            </div>
            <button class="more-btn" aria-label="Seçenekler">
              <span class="material-icons">more_vert</span>
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-item ${isFavorite ? 'active' : ''}" data-action="favorite" data-url="${targetUrl}" data-title="${targetTerm}">
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
      });
    }

    container.innerHTML = html;
    UI.attachTopicListeners();
  }
};