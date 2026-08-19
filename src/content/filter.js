/**
 * ek$tension - Ekşi Sözlük In-Page Enhancements
 * - Topic keyword filtering
 * - Author / Troll blocking with 1-click block button & toggle placeholder
 * - Inline image & YouTube previews
 * - "Sadece Medyalı / Linkli Entry'ler" filter button
 */

let state = {
  filteredWords: [],
  blockedAuthors: [],
  mediaOnlyActive: false
};

let isProcessing = false;
let observerTimeout = null;

// YouTube Video ID Çıkarıcı
function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1]?.split('?')[0];
      }
      return parsed.searchParams.get('v');
    } else if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1).split('?')[0];
    }
  } catch (e) {
    return null;
  }
  return null;
}

// Resim Linki Kontrolü
function isImageUrl(url) {
  if (!url) return false;
  try {
    const cleanUrl = url.toLowerCase().split('?')[0];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    if (imageExtensions.some(ext => cleanUrl.endsWith(ext))) {
      return true;
    }
    if (url.includes('i.hizliresim.com') || url.includes('i.imgur.com') || url.includes('resmim.net') || url.includes('eksisozluk.com/img/')) {
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

// Harici link kontrolü (Entry içindeki dış bağlantılar, (bkz:) hariç)
function isExternalUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('eksisozluk.com') || host.includes('eksisozluk2023.com') || host.includes('eksisozluk1923.com')) {
      return false;
    }
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// 1. Sol Paneldeki Başlıkları Filtrele
function filterTopics() {
  if (!state.filteredWords || state.filteredWords.length === 0) return;

  const topicList = document.querySelector('ul.topic-list');
  if (!topicList) return;

  const topics = topicList.querySelectorAll('li');
  topics.forEach(topic => {
    const titleElement = topic.querySelector('a');
    if (!titleElement) return;

    const title = titleElement.textContent.toLowerCase();
    for (const word of state.filteredWords) {
      if (title.includes(word.toLowerCase())) {
        topic.style.display = 'none';
        break;
      }
    }
  });
}

// Yazar Engelleme / Engeli Kaldırma İşlemleri
function blockAuthor(author) {
  const authorLower = author.toLowerCase().trim();
  if (confirm(`"${author}" adlı yazarın entry'lerini gizlemek istediğinize emin misiniz?`)) {
    chrome.runtime.sendMessage({ action: 'addBlockedAuthor', author: authorLower }, () => {
      if (!state.blockedAuthors.includes(authorLower)) {
        state.blockedAuthors.push(authorLower);
      }
      applyAuthorBlocking();
    });
  }
}

function unblockAuthor(author) {
  const authorLower = author.toLowerCase().trim();
  if (confirm(`"${author}" adlı yazarın engelini kaldırmak istediğinize emin misiniz?`)) {
    chrome.runtime.sendMessage({ action: 'removeBlockedAuthor', author: authorLower }, () => {
      state.blockedAuthors = state.blockedAuthors.filter(a => a.toLowerCase().trim() !== authorLower);
      applyAuthorBlocking();
    });
  }
}

// 2. Yazar / Troll Engelleme
function applyAuthorBlocking() {
  const entries = document.querySelectorAll('#entry-item-list > li[data-author]');
  if (!entries || entries.length === 0) return;

  const blockedSet = new Set((state.blockedAuthors || []).map(a => a.toLowerCase().trim()));

  entries.forEach(entry => {
    const author = (entry.getAttribute('data-author') || '').trim();
    const authorLower = author.toLowerCase();
    const isBlocked = blockedSet.has(authorLower);

    // 1-Click Engelleme / Engeli Kaldırma İkonu
    const authorLink = entry.querySelector('.entry-author, .avatar-and-author .entry-author');
    if (authorLink) {
      let blockBtn = authorLink.parentNode.querySelector('.ekstension-block-author-btn');
      if (!blockBtn) {
        blockBtn = document.createElement('span');
        blockBtn.className = 'ekstension-block-author-btn';
        authorLink.parentNode.insertBefore(blockBtn, authorLink.nextSibling);
      }

      if (isBlocked) {
        blockBtn.className = 'ekstension-block-author-btn blocked';
        blockBtn.title = `"${author}" yazarının engelini kaldır`;
        blockBtn.textContent = '🟢';
        blockBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          unblockAuthor(author);
        };
      } else {
        blockBtn.className = 'ekstension-block-author-btn';
        blockBtn.title = `"${author}" adlı yazarı engelle`;
        blockBtn.textContent = '🚫';
        blockBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          blockAuthor(author);
        };
      }
    }

    // Engellenen Yazarı Gizle / Göster
    let placeholder = entry.querySelector('.ekstension-author-blocked-placeholder');
    const content = entry.querySelector('.content');
    const footer = entry.querySelector('footer');

    if (isBlocked) {
      if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'ekstension-author-blocked-placeholder';
        placeholder.innerHTML = `
          <span>🚫 Engellenen yazar (<strong>@${author}</strong>) gizlendi</span>
          <div class="ekstension-placeholder-actions">
            <button class="ekstension-toggle-blocked-entry">Göster</button>
            <button class="ekstension-unblock-btn" title="Yazarın engelini kaldır">Engeli Kaldır</button>
          </div>
        `;

        const toggleBtn = placeholder.querySelector('.ekstension-toggle-blocked-entry');
        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const isHidden = content && content.style.display === 'none';
          if (content) content.style.display = isHidden ? '' : 'none';
          if (footer) footer.style.display = isHidden ? '' : 'none';
          toggleBtn.textContent = isHidden ? 'Gizle' : 'Göster';
        });

        const unblockBtn = placeholder.querySelector('.ekstension-unblock-btn');
        unblockBtn.addEventListener('click', (e) => {
          e.preventDefault();
          unblockAuthor(author);
        });

        entry.insertBefore(placeholder, entry.firstChild);
      }

      const toggleBtn = placeholder.querySelector('.ekstension-toggle-blocked-entry');
      if (toggleBtn && toggleBtn.textContent === 'Göster') {
        if (content) content.style.display = 'none';
        if (footer) footer.style.display = 'none';
      }
    } else if (placeholder) {
      placeholder.remove();
      if (content) content.style.display = '';
      if (footer) footer.style.display = '';
    }
  });
}

// 3. Medya ve YouTube Önizlemeleri
function applyMediaPreviews() {
  const entries = document.querySelectorAll('#entry-item-list > li');
  if (!entries || entries.length === 0) return;

  entries.forEach(entry => {
    const content = entry.querySelector('.content');
    if (!content) return;

    const links = content.querySelectorAll('a[href]:not([data-ekstension-processed])');

    links.forEach(link => {
      link.setAttribute('data-ekstension-processed', 'true');
      const href = link.getAttribute('href') || '';
      
      const isImg = isImageUrl(href);
      const ytId = extractYouTubeId(href);

      if (!isImg && !ytId) return;

      const previewBtn = document.createElement('button');
      previewBtn.className = 'ekstension-preview-btn';
      previewBtn.textContent = isImg ? '🖼️ Önizle' : '▶️ Oynat';
      previewBtn.title = isImg ? 'Görseli doğrudan aç' : 'Videoyu oynat';

      let container = null;

      previewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (container) {
          container.style.display = container.style.display === 'none' ? 'block' : 'none';
          return;
        }

        container = document.createElement('div');
        container.className = 'ekstension-media-container';

        if (isImg) {
          const img = document.createElement('img');
          img.className = 'ekstension-image-preview';
          img.src = href;
          img.alt = 'Görsel Önizleme';
          img.loading = 'lazy';
          container.appendChild(img);
        } else if (ytId) {
          const wrapper = document.createElement('div');
          wrapper.className = 'ekstension-video-wrapper';
          const iframe = document.createElement('iframe');
          iframe.src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`;
          iframe.allowFullscreen = true;
          iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
          wrapper.appendChild(iframe);
          container.appendChild(wrapper);
        }

        link.parentNode.insertBefore(container, link.nextSibling);
      });

      link.parentNode.insertBefore(previewBtn, link.nextSibling);
    });
  });
}

// 4. "Sadece Medya / Linkli Entry'ler" Filtre Butonu
function injectMediaFilterButton() {
  const entryList = document.querySelector('#entry-item-list');
  if (!entryList) return;

  const topicTitle = document.querySelector('#topic h1');
  if (!topicTitle) return;

  let filterBtn = document.getElementById('ekstension-media-filter-btn');

  if (!filterBtn) {
    const container = document.createElement('div');
    container.className = 'ekstension-media-filter-container';

    filterBtn = document.createElement('button');
    filterBtn.id = 'ekstension-media-filter-btn';
    filterBtn.className = 'ekstension-media-filter-btn';
    filterBtn.innerHTML = `🎬 Sadece Medya & Linkler <span class="badge-count">0/0</span>`;

    filterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      state.mediaOnlyActive = !state.mediaOnlyActive;
      filterBtn.classList.toggle('active', state.mediaOnlyActive);
      applyMediaOnlyFilter();
    });

    container.appendChild(filterBtn);
    topicTitle.parentNode.insertBefore(container, topicTitle.nextSibling);
  }

  updateMediaFilterCounts();
}

function hasMediaOrLinks(entry) {
  const content = entry.querySelector('.content');
  if (!content) return false;

  const links = content.querySelectorAll('a[href]');
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (isImageUrl(href) || extractYouTubeId(href) || isExternalUrl(href)) {
      return true;
    }
  }
  return false;
}

function updateMediaFilterCounts() {
  const entries = document.querySelectorAll('#entry-item-list > li');
  if (!entries || entries.length === 0) return;

  let mediaCount = 0;
  entries.forEach(entry => {
    if (hasMediaOrLinks(entry)) {
      mediaCount++;
    }
  });

  const countBadge = document.querySelector('#ekstension-media-filter-btn .badge-count');
  if (countBadge) {
    countBadge.textContent = `${mediaCount}/${entries.length}`;
  }
}

function applyMediaOnlyFilter() {
  const entries = document.querySelectorAll('#entry-item-list > li');
  if (!entries || entries.length === 0) return;

  entries.forEach(entry => {
    if (!state.mediaOnlyActive) {
      entry.classList.remove('ekstension-hide-non-media');
      return;
    }

    if (hasMediaOrLinks(entry)) {
      entry.classList.remove('ekstension-hide-non-media');
    } else {
      entry.classList.add('ekstension-hide-non-media');
    }
  });
}

// Tüm Sayfa İçi Araçları Çalıştır
function runAllEnhancements() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    filterTopics();
    applyAuthorBlocking();
    applyMediaPreviews();
    injectMediaFilterButton();
    if (state.mediaOnlyActive) {
      applyMediaOnlyFilter();
    }
  } catch (err) {
    console.error('ek$tension enhancement error:', err);
  } finally {
    // DOM mutasyonları bittikten kısa bir süre sonra kilidi aç
    setTimeout(() => {
      isProcessing = false;
    }, 150);
  }
}

// Gerçek Ekşi Sözlük sayfası yüklendiğinde background'a bildir
function notifyPageReady() {
  const isRealEksi = !!document.querySelector('#container, #top-navigation, ul.topic-list, #content-body, #logo, header, #topic');
  if (isRealEksi) {
    try {
      chrome.runtime.sendMessage({ action: 'EKSI_PAGE_READY' }).catch(() => {});
    } catch (e) {}
  }
}

// Başlangıç Yüklemesi
function initialize() {
  notifyPageReady();

  chrome.runtime.sendMessage({ action: 'getFilteredWords' }, (words) => {
    state.filteredWords = words || [];
    filterTopics();
  });

  chrome.runtime.sendMessage({ action: 'getBlockedAuthors' }, (authors) => {
    state.blockedAuthors = authors || [];
    applyAuthorBlocking();
  });

  runAllEnhancements();
}

// Sayfa yüklendiğinde başlat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Observer - Debounced ve Korumalı
const observer = new MutationObserver((mutations) => {
  if (isProcessing) return;

  let relevantMutation = false;
  for (const mutation of mutations) {
    // Kendi eklediğimiz ekstension elemanlarının mutasyonlarını yok say
    const target = mutation.target;
    if (target && target.classList && (
      target.classList.contains('ekstension-media-container') ||
      target.classList.contains('ekstension-preview-btn') ||
      target.classList.contains('ekstension-block-author-btn') ||
      target.classList.contains('ekstension-author-blocked-placeholder')
    )) {
      continue;
    }

    if (mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1 && !node.classList?.contains('ekstension-preview-btn') && !node.classList?.contains('ekstension-media-container')) {
          relevantMutation = true;
          break;
        }
      }
    }
    if (relevantMutation) break;
  }

  if (relevantMutation) {
    notifyPageReady();
    if (observerTimeout) clearTimeout(observerTimeout);
    observerTimeout = setTimeout(() => {
      runAllEnhancements();
    }, 300);
  }
});

// Sayfayı gözlemle (Ana içerik alanı hazır olduğunda)
const targetNode = document.getElementById('content-body') || document.body;
observer.observe(targetNode, { childList: true, subtree: true });