/**
 * ek$tension - Keyboard Shortcuts & Power Navigator (j/k, s, e, z, ?)
 */

(function () {
  let focusedIndex = -1;
  let modalElement = null;

  // Güvenlik: Kullanıcı yazı yazıyorsa kısayolları engelle
  function isUserTyping() {
    const active = document.activeElement;
    if (!active) return false;
    const tagName = active.tagName.toUpperCase();
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
      return true;
    }
    if (active.isContentEditable) {
      return true;
    }
    return false;
  }

  // Sayfadaki geçerli entry listesini al
  function getEntries() {
    return Array.from(document.querySelectorAll('#entry-item-list > li[data-id]')).filter(el => {
      // Gizlenmiş olanları (örneğin engellenen veya filtrelenen) atla
      return el.offsetParent !== null && !el.classList.contains('ekstension-hide-non-media');
    });
  }

  // Belirli bir index'teki entry'yi odakla ve yumuşak kaydır
  function focusEntry(index) {
    const entries = getEntries();
    if (!entries.length) return;

    if (index < 0) index = 0;
    if (index >= entries.length) index = entries.length - 1;

    // Önceki odağı temizle
    entries.forEach(el => el.classList.remove('ekstension-focused-entry'));

    focusedIndex = index;
    const targetEntry = entries[focusedIndex];
    if (targetEntry) {
      targetEntry.classList.add('ekstension-focused-entry');
      targetEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Cheat Sheet Modalı Oluştur / Göster
  function toggleCheatSheetModal() {
    if (!modalElement) {
      modalElement = document.createElement('div');
      modalElement.className = 'ekstension-modal-overlay';
      modalElement.innerHTML = `
        <div class="ekstension-modal-card">
          <div class="ekstension-modal-header">
            <h3>⌨️ ek$tension Klavye Kısayolları</h3>
            <button class="ekstension-modal-close-btn" title="Kapat">✕</button>
          </div>
          <div class="ekstension-shortcuts-list">
            <div class="ekstension-shortcut-row">
              <span class="ekstension-shortcut-desc">Önceki entry'ye git ve odaklan</span>
              <div class="ekstension-shortcut-keys"><span class="ekstension-kbd">J</span> veya <span class="ekstension-kbd">↑</span></div>
            </div>
            <div class="ekstension-shortcut-row">
              <span class="ekstension-shortcut-desc">Sonraki entry'ye git ve odaklan</span>
              <div class="ekstension-shortcut-keys"><span class="ekstension-kbd">K</span> veya <span class="ekstension-kbd">↓</span></div>
            </div>
            <div class="ekstension-shortcut-row">
              <span class="ekstension-shortcut-desc">Odaklanılan entry'yi Kaydet (Bookmark)</span>
              <div class="ekstension-shortcut-keys"><span class="ekstension-kbd">S</span></div>
            </div>
            <div class="ekstension-shortcut-row">
              <span class="ekstension-shortcut-desc">Entry'yi veya Başlığı Gemini AI ile Özetle</span>
              <div class="ekstension-shortcut-keys"><span class="ekstension-kbd">E</span></div>
            </div>
            <div class="ekstension-shortcut-row">
              <span class="ekstension-shortcut-desc">Zen / Odaklanma Modunu Aç / Kapat</span>
              <div class="ekstension-shortcut-keys"><span class="ekstension-kbd">Z</span></div>
            </div>
            <div class="ekstension-shortcut-row">
              <span class="ekstension-shortcut-desc">Kayıtlı Entry'ler Çekmecesini Aç / Kapat</span>
              <div class="ekstension-shortcut-keys"><span class="ekstension-kbd">B</span></div>
            </div>
            <div class="ekstension-shortcut-row">
              <span class="ekstension-shortcut-desc">Kısayol Yardım Rehberini Göster</span>
              <div class="ekstension-shortcut-keys"><span class="ekstension-kbd">?</span></div>
            </div>
          </div>
        </div>
      `;

      modalElement.querySelector('.ekstension-modal-close-btn').addEventListener('click', () => {
        modalElement.classList.remove('active');
      });

      modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
          modalElement.classList.remove('active');
        }
      });

      document.body.appendChild(modalElement);
    }

    modalElement.classList.toggle('active');
  }

  // Global Keydown Listener
  function handleKeyDown(e) {
    // Input içindeyken veya modifier keys basılıyken (Cmd/Ctrl/Alt) çalışma
    if (isUserTyping() || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    const key = e.key;

    // Modal açıkken ESC kapatır
    if (modalElement && modalElement.classList.contains('active')) {
      if (key === 'Escape') {
        modalElement.classList.remove('active');
        e.preventDefault();
        return;
      }
    }

    switch (key) {
      case 'j':
      case 'J':
      case 'ArrowUp': {
        // J veya Yukarı Ok: Önceki entry'ye git
        const entries = getEntries();
        if (entries.length > 0) {
          focusEntry(focusedIndex - 1);
          e.preventDefault();
        }
        break;
      }

      case 'k':
      case 'K':
      case 'ArrowDown': {
        // K veya Aşağı Ok: Sonraki entry'ye git
        const entries = getEntries();
        if (entries.length > 0) {
          focusEntry(focusedIndex + 1);
          e.preventDefault();
        }
        break;
      }

      case 's':
      case 'S': {
        // Aktif entry'yi kaydet
        const entries = getEntries();
        if (focusedIndex >= 0 && focusedIndex < entries.length) {
          const entry = entries[focusedIndex];
          const bookmarkBtn = entry.querySelector('.ekstension-bookmark-btn');
          if (bookmarkBtn) {
            bookmarkBtn.click();
          }
          e.preventDefault();
        }
        break;
      }

      case 'e':
      case 'E': {
        // Aktif entry'yi veya başlığı Gemini AI ile özetle
        const entries = getEntries();
        if (focusedIndex >= 0 && focusedIndex < entries.length) {
          const entry = entries[focusedIndex];
          if (window.ekstensionSummarizeSingleEntry) {
            window.ekstensionSummarizeSingleEntry(entry);
          } else {
            const aiBtn = entry.querySelector('.ekst-single-summary-btn');
            if (aiBtn) aiBtn.click();
          }
        } else {
          // Odaklı entry yoksa başlık özetini tetikle
          if (window.ekstensionSummarizeTopic) {
            window.ekstensionSummarizeTopic();
          } else {
            const topicAiBtn = document.querySelector('.ekst-ai-summarize-btn');
            if (topicAiBtn) topicAiBtn.click();
          }
        }
        e.preventDefault();
        break;
      }

      case 'z':
      case 'Z': {
        // Zen Modunu Aç / Kapat
        if (window.ekstensionToggleZenMode) {
          window.ekstensionToggleZenMode();
        } else {
          window.dispatchEvent(new CustomEvent('ekstension:toggle-zen'));
        }
        e.preventDefault();
        break;
      }

      case 'b':
      case 'B': {
        // Bookmarks Drawer'ı Aç / Kapat
        if (window.ekstensionToggleBookmarksDrawer) {
          window.ekstensionToggleBookmarksDrawer();
        } else {
          window.dispatchEvent(new CustomEvent('ekstension:toggle-bookmarks-drawer'));
        }
        e.preventDefault();
        break;
      }

      case '?': {
        toggleCheatSheetModal();
        e.preventDefault();
        break;
      }

      case 'Escape': {
        if (window.ekstensionIsZenActive && window.ekstensionIsZenActive()) {
          window.ekstensionToggleZenMode(false);
          e.preventDefault();
        }
        break;
      }
    }
  }

  window.ekstensionToggleCheatSheet = toggleCheatSheetModal;
  window.addEventListener('ekstension:toggle-cheat-sheet', toggleCheatSheetModal);

  function init() {
    window.addEventListener('keydown', handleKeyDown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
