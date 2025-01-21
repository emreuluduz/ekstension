import { Storage } from './storage.js';
import { UI } from './ui.js';

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
        const isFavorite = favorites.some(f => f.url === result.results[0].Url);
        const isFollowing = following.some(f => f.url === result.results[0].Url);

        html += `
          <div class="gundem-item" data-url="${result.results[0].Url}" data-title="${result.term}">
            <div class="topic-content">
              <div class="site-icon ${data.site.toLowerCase()}">
                <img src="/icons/sites/${data.site.toLowerCase()}.png" alt="${data.site}">
              </div>
              <span class="title">${result.term}</span>
            </div>
            <button class="more-btn">
              <span class="material-icons">more_vert</span>
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-item ${isFavorite ? 'active' : ''}" data-action="favorite" data-url="${result.results[0].Url}" data-title="${result.term}">
                <span class="material-icons" style="color: ${isFavorite ? 'var(--active-icon)' : 'var(--text)'}">
                  ${isFavorite ? 'star' : 'star_outline'}
                </span>
                <span class="dropdown-text">
                  ${isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                </span>
              </div>
              <div class="dropdown-item ${isFollowing ? 'active' : ''}" data-action="follow" data-url="${result.results[0].Url}" data-title="${result.term}">
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
}; 