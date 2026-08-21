/**
 * ek$tension - Zen / Odaklanma Modu (Reader Mode)
 */

(function () {
  let isZenActive = false;
  let toolbarElement = null;
  let shortcutsHintElement = null;

  const fontSizes = [15, 17, 19, 21, 24];
  let currentFontSizeIndex = 1; // default: 17px

  const widths = ['860px', '1120px', '1400px', '94%'];
  const widthLabels = ['Standart (860px)', 'Geniş (1120px)', 'Ultra Geniş (1400px)', 'Tam Ekran (%94)'];
  let currentWidthIndex = 1; // default: 1120px (Geniş & Ferah)

  const fontFamilies = [
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'Georgia, Cambria, "Times New Roman", Times, serif',
    '"Courier New", Courier, monospace'
  ];
  const fontLabels = ['Sans', 'Serif', 'Mono'];
  let currentFontFamilyIndex = 0;

  // Ayarları yükle
  function loadSettings() {
    try {
      chrome.storage.local.get('ekstension_zen_settings', (res) => {
        if (res?.ekstension_zen_settings) {
          const s = res.ekstension_zen_settings;
          if (typeof s.fontSizeIndex === 'number' && s.fontSizeIndex < fontSizes.length) currentFontSizeIndex = s.fontSizeIndex;
          if (typeof s.widthIndex === 'number' && s.widthIndex < widths.length) currentWidthIndex = s.widthIndex;
          if (typeof s.fontFamilyIndex === 'number' && s.fontFamilyIndex < fontFamilies.length) currentFontFamilyIndex = s.fontFamilyIndex;
          applyZenStyles();
        }
      });
    } catch (e) { }
  }

  // Ayarları kaydet
  function saveSettings() {
    try {
      chrome.storage.local.set({
        ekstension_zen_settings: {
          fontSizeIndex: currentFontSizeIndex,
          widthIndex: currentWidthIndex,
          fontFamilyIndex: currentFontFamilyIndex
        }
      });
    } catch (e) { }
  }

  // CSS değişkenlerini güncelle
  function applyZenStyles() {
    document.documentElement.style.setProperty('--ekstension-zen-font-size', `${fontSizes[currentFontSizeIndex]}px`);
    document.documentElement.style.setProperty('--ekstension-zen-width', widths[currentWidthIndex]);
    document.documentElement.style.setProperty('--ekstension-zen-font-family', fontFamilies[currentFontFamilyIndex]);

    if (toolbarElement) {
      const widthBtn = toolbarElement.querySelector('#zen-width-btn');
      if (widthBtn) widthBtn.textContent = `📐 ${widthLabels[currentWidthIndex]}`;

      const fontBtn = toolbarElement.querySelector('#zen-font-btn');
      if (fontBtn) fontBtn.textContent = `🔤 ${fontLabels[currentFontFamilyIndex]}`;
    }
  }

  // Sol Alttaki Zen Kısayol İpuçları Çubuğunu Oluştur
  function createZenShortcutsHint() {
    if (shortcutsHintElement) return shortcutsHintElement;

    shortcutsHintElement = document.createElement('div');
    shortcutsHintElement.className = 'ekstension-zen-shortcuts-hint';
    shortcutsHintElement.innerHTML = `
      <span style="cursor: pointer;" id="zen-hint-jk" title="[J] Önceki • [K] Sonraki"><kbd class="ekstension-kbd">J</kbd> Önceki <kbd class="ekstension-kbd">K</kbd> Sonraki</span>
      <span style="cursor: pointer;" id="zen-hint-s" title="Entry Kaydet"><kbd class="ekstension-kbd">S</kbd> Kaydet</span>
      <span style="cursor: pointer;" id="zen-hint-e" title="Gemini AI ile Özetle"><kbd class="ekstension-kbd">E</kbd> Özetle</span>
      <span style="cursor: pointer;" id="zen-hint-z" title="Zen Modundan Çık"><kbd class="ekstension-kbd">Z</kbd> Çıkış</span>
      <span style="cursor: pointer; color: #10b981; font-weight: 700;" id="zen-hint-help" title="Tüm Kısayolları Göster"><kbd class="ekstension-kbd">?</kbd> Yardım</span>
    `;

    shortcutsHintElement.querySelector('#zen-hint-help').addEventListener('click', () => {
      if (window.ekstensionToggleCheatSheet) window.ekstensionToggleCheatSheet();
    });

    shortcutsHintElement.querySelector('#zen-hint-z').addEventListener('click', () => {
      toggleZenMode(false);
    });

    document.body.appendChild(shortcutsHintElement);
    return shortcutsHintElement;
  }

  // Zen Toolbar Oluştur
  function createZenToolbar() {
    if (toolbarElement) return toolbarElement;

    toolbarElement = document.createElement('div');
    toolbarElement.className = 'ekstension-zen-toolbar';
    toolbarElement.innerHTML = `
      <button class="ekstension-zen-btn" id="zen-font-minus" title="Yazıyı Küçült">A-</button>
      <button class="ekstension-zen-btn" id="zen-font-plus" title="Yazıyı Büyüt">A+</button>
      <button class="ekstension-zen-btn" id="zen-width-btn" title="Genişlik Değiştir">📐 ${widthLabels[currentWidthIndex]}</button>
      <button class="ekstension-zen-btn" id="zen-font-btn" title="Yazı Tipi Değiştir">🔤 ${fontLabels[currentFontFamilyIndex]}</button>
      <button class="ekstension-zen-btn" id="zen-shortcuts-btn" title="Klavye Kısayolları (?)">⌨️ Kısayollar</button>
      <button class="ekstension-zen-btn exit-btn" id="zen-exit-btn" title="Zen Modundan Çık (ESC / Z)">✕ Çıkış</button>
    `;

    toolbarElement.querySelector('#zen-font-minus').addEventListener('click', () => {
      if (currentFontSizeIndex > 0) {
        currentFontSizeIndex--;
        applyZenStyles();
        saveSettings();
      }
    });

    toolbarElement.querySelector('#zen-font-plus').addEventListener('click', () => {
      if (currentFontSizeIndex < fontSizes.length - 1) {
        currentFontSizeIndex++;
        applyZenStyles();
        saveSettings();
      }
    });

    toolbarElement.querySelector('#zen-width-btn').addEventListener('click', () => {
      currentWidthIndex = (currentWidthIndex + 1) % widths.length;
      applyZenStyles();
      saveSettings();
    });

    toolbarElement.querySelector('#zen-font-btn').addEventListener('click', () => {
      currentFontFamilyIndex = (currentFontFamilyIndex + 1) % fontFamilies.length;
      applyZenStyles();
      saveSettings();
    });

    toolbarElement.querySelector('#zen-shortcuts-btn').addEventListener('click', () => {
      if (window.ekstensionToggleCheatSheet) {
        window.ekstensionToggleCheatSheet();
      } else {
        window.dispatchEvent(new CustomEvent('ekstension:toggle-cheat-sheet'));
      }
    });

    toolbarElement.querySelector('#zen-exit-btn').addEventListener('click', () => {
      toggleZenMode(false);
    });

    document.body.appendChild(toolbarElement);
    return toolbarElement;
  }

  // Zen Modunu Aç / Kapat
  function toggleZenMode(forceState) {
    if (typeof forceState === 'boolean') {
      isZenActive = forceState;
    } else {
      isZenActive = !isZenActive;
    }

    if (isZenActive) {
      document.body.classList.add('ekstension-zen-active');
      createZenToolbar();
      createZenShortcutsHint();
      applyZenStyles();

      if (toolbarElement) toolbarElement.style.display = 'flex';
      if (shortcutsHintElement) shortcutsHintElement.style.display = 'flex';
    } else {
      document.body.classList.remove('ekstension-zen-active');

      if (toolbarElement) toolbarElement.style.display = 'none';
      if (shortcutsHintElement) shortcutsHintElement.style.display = 'none';
    }

    // Başlık butonunun durumunu güncelle
    const headerZenBtn = document.querySelector('.ekstension-zen-header-btn');
    if (headerZenBtn) {
      headerZenBtn.classList.toggle('active', isZenActive);
    }
  }

  // Başlık barına Zen Mod Butonu Enjekte Et
  function injectZenHeaderButton() {
    const titleBar = document.querySelector('#topic h1#title');
    if (!titleBar || document.querySelector('.ekstension-zen-header-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'ekstension-zen-header-btn ekstension-media-filter-btn';
    btn.style.marginLeft = '8px';
    btn.style.verticalAlign = 'middle';
    btn.title = 'Zen / Odaklanma Modu (Kısayol: Z)';
    btn.innerHTML = `🧘 Zen Modu`;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleZenMode();
    });

    titleBar.parentElement.insertBefore(btn, titleBar.nextSibling);
  }

  // Global erişim için window'a ekle
  window.ekstensionToggleZenMode = toggleZenMode;
  window.ekstensionIsZenActive = () => isZenActive;

  window.addEventListener('ekstension:toggle-zen', () => {
    toggleZenMode();
  });

  function init() {
    loadSettings();
    injectZenHeaderButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Sayfa güncellemelerinde butonu kontrol et
  window.addEventListener('ekstension:entries-added', () => {
    injectZenHeaderButton();
  });
})();
