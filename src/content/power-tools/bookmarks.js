/**
 * ek$tension - Single Entry Bookmarks & Read Later (Markdown / JSON Export & Drawer UI)
 */

(function () {
  let savedEntries = [];
  let drawerElement = null;
  let toggleBtnElement = null;
  let searchQuery = '';

  // Yerel hafızadan kayıtlı entry'leri yükle
  function loadSavedEntries(callback) {
    try {
      chrome.storage.local.get('ekstension_saved_entries', (res) => {
        savedEntries = res?.ekstension_saved_entries || [];
        updateAllBookmarkButtons();
        updateDrawerBadge();
        if (drawerElement && drawerElement.classList.contains('open')) {
          renderDrawerList();
        }
        if (callback) callback(savedEntries);
      });
    } catch (e) {
      if (callback) callback([]);
    }
  }

  // Hafızaya kaydet
  function saveToStorage() {
    try {
      chrome.storage.local.set({ ekstension_saved_entries: savedEntries }, () => {
        updateAllBookmarkButtons();
        updateDrawerBadge();
        if (drawerElement && drawerElement.classList.contains('open')) {
          renderDrawerList();
        }
      });
    } catch (e) { }
  }

  // Entry verisini DOM'dan çıkar
  function extractEntryData(entryLi) {
    const entryId = entryLi.getAttribute('data-id') || entryLi.id?.replace('entry-', '');
    if (!entryId) return null;

    const contentEl = entryLi.querySelector('.content');
    const authorEl = entryLi.querySelector('.entry-author') || entryLi.querySelector('a[href^="/biri/"]');
    const dateEl = entryLi.querySelector('.entry-date');
    const titleEl = document.querySelector('#topic h1#title a') || document.querySelector('#topic h1#title');

    const title = titleEl ? titleEl.textContent.trim() : document.title.replace(' - ekşi sözlük', '').trim();
    const titleUrl = titleEl?.getAttribute('href') || window.location.pathname;
    const author = entryLi.getAttribute('data-author') || authorEl?.textContent.trim() || 'anonim';
    const authorUrl = authorEl?.getAttribute('href') || `/biri/${encodeURIComponent(author)}`;
    const date = dateEl ? dateEl.textContent.trim() : '';
    const contentHtml = contentEl ? contentEl.innerHTML : '';
    const contentText = contentEl ? contentEl.textContent.trim() : '';
    const url = `https://eksisozluk.com/entry/${entryId}`;

    return {
      id: entryId,
      title,
      titleUrl,
      author,
      authorUrl,
      date,
      contentHtml,
      contentText,
      url,
      savedAt: Date.now()
    };
  }

  // Entry'yi kaydet / kaldır
  function toggleBookmark(entryId, entryLi) {
    const existingIndex = savedEntries.findIndex(item => item.id === entryId);

    if (existingIndex !== -1) {
      // Listeden çıkar
      savedEntries.splice(existingIndex, 1);
      saveToStorage();
    } else {
      // Listeye ekle
      let data = null;
      if (entryLi) {
        data = extractEntryData(entryLi);
      }
      if (!data) {
        const foundLi = document.querySelector(`#entry-item-list > li[data-id="${entryId}"]`);
        if (foundLi) data = extractEntryData(foundLi);
      }

      if (data) {
        savedEntries.unshift(data);
        saveToStorage();
      }
    }
  }

  // Sayfadaki tüm bookmark butonlarının durumunu senkronize et
  function updateAllBookmarkButtons() {
    const buttons = document.querySelectorAll('.ekstension-bookmark-btn');
    buttons.forEach(btn => {
      const entryId = btn.getAttribute('data-entry-id');
      const isSaved = savedEntries.some(item => item.id === entryId);
      btn.classList.toggle('saved', isSaved);
      btn.innerHTML = isSaved ? `🔖 Kaydedildi` : `🔖 Kaydet`;
      btn.title = isSaved ? 'Okuma listesinden kaldır' : 'Daha sonra okumak için kaydet';
    });
  }

  // Sayfadaki entry'lere Kaydet Butonu Enjekte Et
  function injectBookmarkButtons() {
    const entries = document.querySelectorAll('#entry-item-list > li[data-id]');
    entries.forEach(entry => {
      const entryId = entry.getAttribute('data-id');
      if (!entryId) return;

      // Zaten eklendiyse atla
      if (entry.querySelector('.ekstension-bookmark-btn')) return;

      const footer = entry.querySelector('footer') || entry.querySelector('.info') || entry.querySelector('.feedback');
      if (!footer) return;

      const btn = document.createElement('button');
      btn.className = 'ekstension-bookmark-btn';
      btn.setAttribute('data-entry-id', entryId);
      btn.type = 'button';

      const isSaved = savedEntries.some(item => item.id === entryId);
      if (isSaved) {
        btn.classList.add('saved');
        btn.innerHTML = `🔖 Kaydedildi`;
      } else {
        btn.innerHTML = `🔖 Kaydet`;
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmark(entryId, entry);
      });

      // Butonu footer içine yerleştir
      const otherActions = footer.querySelector('.other') || footer.querySelector('.rate-options') || footer;
      otherActions.appendChild(btn);
    });
  }

  // Sağ alttaki yüzen çekmece açma butonunu oluştur
  function createFloatingToggleButton() {
    if (toggleBtnElement) return toggleBtnElement;

    toggleBtnElement = document.createElement('button');
    toggleBtnElement.className = 'ekstension-drawer-toggle-btn';
    toggleBtnElement.title = 'Okuma Listesi / Kaydedilen Entry\'ler (Kısayol: B)';
    toggleBtnElement.innerHTML = `
      <span style="font-size: 20px;">🔖</span>
      <span class="ekstension-drawer-badge" id="ekstension-drawer-badge" style="display: none;">0</span>
    `;

    toggleBtnElement.addEventListener('click', () => {
      toggleDrawer();
    });

    document.body.appendChild(toggleBtnElement);
    return toggleBtnElement;
  }

  function updateDrawerBadge() {
    const badge = document.getElementById('ekstension-drawer-badge');
    if (!badge) return;

    const count = savedEntries.length;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  // Slide-over Drawer UI Oluştur
  function createDrawer() {
    if (drawerElement) return drawerElement;

    drawerElement = document.createElement('div');
    drawerElement.className = 'ekstension-drawer';
    drawerElement.id = 'ekstension-bookmarks-drawer';
    drawerElement.innerHTML = `
      <div class="ekstension-drawer-header">
        <h3 class="ekstension-drawer-title">
          <span>🔖 Okuma Listesi</span>
          <span class="badge" id="drawer-count-badge" style="font-size: 12px; background: rgba(16,185,129,0.15); color: #10b981; padding: 2px 8px; border-radius: 12px;">0</span>
        </h3>
        <div class="ekstension-drawer-actions">
          <button class="ekstension-icon-btn" id="export-md-btn" title="Markdown Olarak İndir">📥 .md</button>
          <button class="ekstension-icon-btn" id="export-json-btn" title="JSON Olarak İndir">📥 .json</button>
          <button class="ekstension-icon-btn" id="copy-md-btn" title="Markdown Panoya Kopyala">📋 Kopyala</button>
          <button class="ekstension-icon-btn" id="close-drawer-btn" style="font-size: 15px; font-weight: bold;" title="Kapat">✕</button>
        </div>
      </div>
      <div class="ekstension-drawer-search">
        <input type="text" id="drawer-search-input" placeholder="Başlık, yazar veya metin ara..." />
      </div>
      <div class="ekstension-drawer-body" id="drawer-entry-list">
        <!-- Entry kartları buraya gelecek -->
      </div>
    `;

    // Event Dinleyicileri
    drawerElement.querySelector('#close-drawer-btn').addEventListener('click', () => toggleDrawer(false));

    drawerElement.querySelector('#drawer-search-input').addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderDrawerList();
    });

    drawerElement.querySelector('#export-md-btn').addEventListener('click', () => {
      downloadFile(generateMarkdownContent(getFilteredEntries()), `ekstension-okuma-listesi-${getFormattedDate()}.md`, 'text/markdown');
    });

    drawerElement.querySelector('#export-json-btn').addEventListener('click', () => {
      downloadFile(JSON.stringify(getFilteredEntries(), null, 2), `ekstension-okuma-listesi-${getFormattedDate()}.json`, 'application/json');
    });

    drawerElement.querySelector('#copy-md-btn').addEventListener('click', (e) => {
      const md = generateMarkdownContent(getFilteredEntries());
      navigator.clipboard.writeText(md).then(() => {
        const btn = e.currentTarget;
        const originalText = btn.textContent;
        btn.textContent = '✓ Kopyalandı!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
      });
    });

    document.body.appendChild(drawerElement);
    return drawerElement;
  }

  function getFilteredEntries() {
    if (!searchQuery) return savedEntries;
    return savedEntries.filter(item => {
      return (
        item.title?.toLowerCase().includes(searchQuery) ||
        item.author?.toLowerCase().includes(searchQuery) ||
        item.contentText?.toLowerCase().includes(searchQuery)
      );
    });
  }

  // Drawer Listesini Çiz
  function renderDrawerList() {
    const listContainer = document.getElementById('drawer-entry-list');
    const countBadge = document.getElementById('drawer-count-badge');
    if (!listContainer) return;

    const filtered = getFilteredEntries();
    if (countBadge) countBadge.textContent = savedEntries.length;

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="ekstension-drawer-empty">
          <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
          <div>${searchQuery ? 'Aramanıza uygun kayıt bulunamadı.' : 'Henüz kaydedilmiş bir entry bulunmuyor.'}</div>
          <div style="font-size: 11px; margin-top: 6px; color: #94a3b8;">Entry'lerin altındaki 🔖 butonuna tıklayarak veya <kbd>S</kbd> tuşuyla kaydedebilirsiniz.</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(item => `
      <div class="ekstension-bookmark-card" data-id="${item.id}">
        <a href="${item.url}" target="_blank" class="ekstension-bookmark-card-title">${escapeHtml(item.title)}</a>
        <div class="ekstension-bookmark-card-content">${escapeHtml(item.contentText.slice(0, 200))}${item.contentText.length > 200 ? '...' : ''}</div>
        <div class="ekstension-bookmark-card-meta">
          <span><strong>@${escapeHtml(item.author)}</strong> • ${escapeHtml(item.date || '')}</span>
          <div style="display: flex; gap: 4px;">
            <button class="ekstension-icon-btn jump-btn" data-id="${item.id}" title="Bu sayfada bul / Git">👁️ Göster</button>
            <button class="ekstension-icon-btn remove-btn" data-id="${item.id}" style="color: #ef4444;" title="Sil">🗑️</button>
          </div>
        </div>
      </div>
    `).join('');

    // Kart butonlarına event bağla
    listContainer.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        toggleBookmark(id, null);
      });
    });

    listContainer.querySelectorAll('.jump-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const localLi = document.querySelector(`#entry-item-list > li[data-id="${id}"]`);
        if (localLi) {
          toggleDrawer(false);
          localLi.scrollIntoView({ behavior: 'smooth', block: 'center' });
          localLi.classList.add('ekstension-focused-entry');
        } else {
          window.open(`https://eksisozluk.com/entry/${id}`, '_blank');
        }
      });
    });
  }

  // Markdown Çıktısı Üret
  function generateMarkdownContent(entries) {
    if (!entries || !entries.length) return '# ek$tension Okuma Listesi\n\nKayıtlı entry bulunmamaktadır.\n';

    let md = `# ek$tension Okuma Listesi\n\n*Dışa aktarılma tarihi: ${new Date().toLocaleString('tr-TR')}*\n*Toplam entry:* ${entries.length}\n\n---\n\n`;

    entries.forEach((item, index) => {
      md += `### ${index + 1}. [${item.title}](${item.url})\n`;
      md += `> **Yazar:** [@${item.author}](https://eksisozluk.com${item.authorUrl}) | **Tarih:** ${item.date || '-'}\n\n`;
      md += `${item.contentText}\n\n---\n\n`;
    });

    return md;
  }

  // Dosya İndir
  function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getFormattedDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Drawer Aç / Kapat
  function toggleDrawer(forceState) {
    createDrawer();
    const isOpen = typeof forceState === 'boolean' ? forceState : !drawerElement.classList.contains('open');

    if (isOpen) {
      drawerElement.classList.add('open');
      renderDrawerList();
      setTimeout(() => {
        const input = document.getElementById('drawer-search-input');
        if (input) input.focus();
      }, 100);
    } else {
      drawerElement.classList.remove('open');
    }
  }

  window.ekstensionToggleBookmarksDrawer = toggleDrawer;

  window.addEventListener('ekstension:toggle-bookmarks-drawer', () => {
    toggleDrawer();
  });

  function init() {
    createFloatingToggleButton();
    loadSavedEntries();
    injectBookmarkButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('ekstension:entries-added', () => {
    injectBookmarkButtons();
  });
})();
