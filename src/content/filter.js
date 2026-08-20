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

// Doğrudan Görsel URL'sini Çıkarıcı / Düzenleyici
function getDirectImageUrl(url) {
  if (!url) return null;
  try {
    const cleanUrl = url.toLowerCase().split('?')[0];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif'];
    if (imageExtensions.some(ext => cleanUrl.endsWith(ext))) {
      return url;
    }

    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // 1. Ekşi Sözlük resmi görsel kısaltması: soz.lk/i/..., soz.lk/...
    if (host === 'soz.lk' || host.endsWith('.soz.lk')) {
      return url;
    }

    // 2. Ekşi Sözlük dahili görsel yolları: eksisozluk.com/img/..., /gorsel/...
    if ((host.includes('eksisozluk') || host.includes('eksisozluk1923') || host.includes('eksisozluk2023') || host.includes('eksisozluk111')) &&
        (pathname.startsWith('/img/') || pathname.startsWith('/gorsel/'))) {
      return url;
    }

    // 3. Hızlıresim: i.hizliresim.com veya hizliresim.com/ID
    if (host.includes('hizliresim.com')) {
      if (host.startsWith('i.')) return url;
      const id = pathname.replace(/^\//, '').split('/')[0];
      if (id && id.length >= 3 && !pathname.includes('.')) {
        return `https://i.hizliresim.com/${id}.jpg`;
      }
      return url;
    }

    // 4. Imgur: i.imgur.com veya imgur.com/ID
    if (host.includes('imgur.com')) {
      if (host.startsWith('i.')) return url;
      const parts = pathname.replace(/^\//, '').split('/');
      if (parts.length === 1 && parts[0] && !parts[0].includes('.') && parts[0] !== 'a' && parts[0] !== 'gallery') {
        return `https://i.imgur.com/${parts[0]}.jpg`;
      }
      return url;
    }

    // 5. Resmim.net
    if (host.includes('resmim.net')) {
      return url;
    }

    // 6. Ibb.co / ImgBB
    if (host.includes('ibb.co') || host.includes('imgbb.com')) {
      return url;
    }

    // 7. ResimYükle & Benzeri görsel servisleri
    if (host.includes('resimyukle.org') || host.includes('resimyukle.com') || host.includes('hizliresimyukle.com') || host.includes('prnt.sc')) {
      return url;
    }
  } catch (e) {
    return null;
  }
  return null;
}

// Resim Linki Kontrolü
function isImageUrl(url) {
  return getDirectImageUrl(url) !== null;
}

// Görsel URL Çözücü Cache
const imageResolvedCache = new Map();

// Ekşi Sözlük / soz.lk görsel ID ayıklayıcı
function extractEksiImageId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    if (host === 'soz.lk' || host.endsWith('.soz.lk')) {
      const parts = pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || null;
    }

    if (host.includes('eksisozluk') && (pathname.startsWith('/img/') || pathname.startsWith('/gorsel/'))) {
      const parts = pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || null;
    }
  } catch (e) {}
  return null;
}

// Görseli gizli Same-Origin iframe yardımıyla DOM'dan çözme (Cloudflare bypass & 100% güvenilirlik)
function resolveEksiImageViaIframe(id) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.src = `${window.location.origin}/img/${id}`;
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:10px;height:10px;opacity:0;pointer-events:none;z-index:-1;';

    let isResolved = false;

    const cleanup = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(null);
      }
    }, 6000);

    iframe.onload = () => {
      if (isResolved) return;
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          const img = doc.querySelector('#image') || doc.querySelector('a#image-zoom');
          const imgSrc = img?.getAttribute('src') || img?.getAttribute('href') || doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
          if (imgSrc) {
            isResolved = true;
            clearTimeout(timer);
            cleanup();
            resolve(imgSrc);
            return;
          }
        }
      } catch (e) {}
    };

    (document.body || document.documentElement).appendChild(iframe);
  });
}

// HTML tabanlı görsel sayfalarından doğrudan görsel CDN URL'sini çöz
async function resolveMediaUrl(url) {
  if (!url) return null;
  if (imageResolvedCache.has(url)) {
    return imageResolvedCache.get(url);
  }

  const cleanUrl = url.toLowerCase().split('?')[0];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif'];
  if (imageExtensions.some(ext => cleanUrl.endsWith(ext))) {
    imageResolvedCache.set(url, url);
    return url;
  }

  // 1. Ekşi Sözlük / soz.lk görselleri
  const eksiId = extractEksiImageId(url);
  if (eksiId) {
    const sameOriginImgUrl = `${window.location.origin}/img/${eksiId}`;

    // 1a. Doğrudan Same-Origin Fetch (Kullanıcının aktif session & cookies'iyle)
    try {
      const res = await fetch(sameOriginImgUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<img\s+id=["']image["']\s+src=["']([^"']+)["']/i) ||
                      html.match(/<a\s+id=["']image-zoom["']\s+href=["']([^"']+)["']/i);
        if (match && match[1]) {
          imageResolvedCache.set(url, match[1]);
          return match[1];
        }
      }
    } catch (e) {}

    // 1b. Same-Origin Iframe fallback (Cloudflare Challenge/Bot Koruması durumunda)
    try {
      const iframeSrc = await resolveEksiImageViaIframe(eksiId);
      if (iframeSrc) {
        imageResolvedCache.set(url, iframeSrc);
        return iframeSrc;
      }
    } catch (e) {}
  }

  // 2. Harici HTML tabanlı görsel siteleri için Background Worker Fetch
  try {
    const bgRes = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'resolveImageUrl', url }, resolve);
    });
    if (bgRes && bgRes.success && bgRes.imageUrl) {
      imageResolvedCache.set(url, bgRes.imageUrl);
      return bgRes.imageUrl;
    }
  } catch (err) {}

  // 3. Fallback regex dönüşümü (Hizliresim, Imgur vs.)
  const direct = getDirectImageUrl(url);
  if (direct && direct !== url) {
    imageResolvedCache.set(url, direct);
    return direct;
  }

  imageResolvedCache.set(url, url);
  return url;
}

// Harici link kontrolü (Entry içindeki dış bağlantılar, (bkz:) ve dahili görseller hariç)
function isExternalUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('eksisozluk') || host === 'soz.lk' || host.endsWith('.soz.lk')) {
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
      const href = link.href || link.getAttribute('href') || '';
      
      const isImg = isImageUrl(href);
      const ytId = extractYouTubeId(href);

      if (!isImg && !ytId) return;

      const previewBtn = document.createElement('button');
      previewBtn.className = 'ekstension-preview-btn';
      previewBtn.textContent = isImg ? '🖼️ Önizle' : '▶️ Oynat';
      previewBtn.title = isImg ? 'Görseli doğrudan aç' : 'Videoyu oynat';

      let container = null;

      previewBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (container) {
          container.style.display = container.style.display === 'none' ? 'block' : 'none';
          return;
        }

        container = document.createElement('div');
        container.className = 'ekstension-media-container';
        link.parentNode.insertBefore(container, link.nextSibling);

        if (isImg) {
          container.innerHTML = '<div class="ekstension-media-loading">⏳ Görsel yükleniyor...</div>';

          try {
            const directSrc = await resolveMediaUrl(href);
            if (!directSrc) {
              showImageError(container, href);
              return;
            }

            container.innerHTML = '';
            const img = document.createElement('img');
            img.className = 'ekstension-image-preview';
            img.src = directSrc;
            img.alt = 'Görsel Önizleme';
            img.loading = 'lazy';
            img.referrerPolicy = 'no-referrer';

            img.onerror = () => {
              // Eğer dönüştürülmüş link başarısız olduysa ve orijinal href farklıysa orijinali dene
              if (img.src !== href && directSrc !== href) {
                img.onerror = () => showImageError(container, href);
                img.src = href;
              } else {
                showImageError(container, href);
              }
            };

            container.appendChild(img);
          } catch (err) {
            showImageError(container, href);
          }
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
      });

      link.parentNode.insertBefore(previewBtn, link.nextSibling);
    });
  });
}

function showImageError(container, originalUrl) {
  if (!container) return;
  container.innerHTML = `
    <div class="ekstension-media-error">
      <span>⚠️ Görsel doğrudan yüklenemedi (silinmiş veya harici korumalı olabilir).</span>
      <a href="${originalUrl}" target="_blank" rel="noopener noreferrer">Yeni sekmede aç ↗</a>
    </div>
  `;
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
    const href = link.href || link.getAttribute('href') || '';
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

// 5. Entry Bkz Hover Önizleme (Entry Popover)
const entryPreviewCache = new Map();
let popoverElement = null;
let hoverTimer = null;
let hideTimer = null;
let currentTargetLink = null;
let currentEntryId = null;
let isEntryHoverInitialized = false;

// Link veya elemandan Entry ID'sini çıkar (#173073218, /entry/173073218 veya eksisozluk.com/entry/173073218)
function extractEntryIdFromElement(el) {
  if (!el) return null;
  const link = el.closest('a');
  if (!link) return null;

  // Popover'ın kendi içindeki linkleri yoksay
  if (link.closest('#ekstension-entry-popover')) return null;

  const href = link.getAttribute('href') || link.href || '';
  const text = (link.textContent || '').trim();

  // 1. href içinde /entry/12345 var mı?
  const hrefMatch = href.match(/\/entry\/(\d+)/i);
  if (hrefMatch && hrefMatch[1]) {
    return hrefMatch[1];
  }

  // 2. href query içinde q=%2312345 veya q=#12345 var mı?
  const qMatch = href.match(/[?&]q=(?:%23|#)(\d+)/i);
  if (qMatch && qMatch[1]) {
    return qMatch[1];
  }

  // 3. Link metni #12345 formatında mı?
  if (text.startsWith('#')) {
    const textMatch = text.match(/^#(\d+)$/);
    if (textMatch && textMatch[1]) {
      return textMatch[1];
    }
  }

  return null;
}

// Mevcut sayfadaki DOM'dan Entry Bilgilerini Oku (0ms gecikme)
function getEntryDataFromLocalDOM(entryId) {
  const entryLi = document.querySelector(`#entry-item-list > li[data-id="${entryId}"]`) ||
                  document.querySelector(`li[data-id="${entryId}"]`) ||
                  document.querySelector(`#entry-item-${entryId}`);
  if (!entryLi) return null;

  const contentEl = entryLi.querySelector('.content');
  if (!contentEl) return null;

  const authorEl = entryLi.querySelector('.entry-author, .avatar-and-author .entry-author');
  const author = authorEl ? (authorEl.textContent || '').trim() : (entryLi.getAttribute('data-author') || '').trim();

  const dateEl = entryLi.querySelector('.entry-date') || entryLi.querySelector('footer .entry-date');
  const date = dateEl ? (dateEl.textContent || '').trim() : '';

  // İçeriği klonla ve eklentinin eklediği butonları temizle
  const clone = contentEl.cloneNode(true);
  clone.querySelectorAll('.ekstension-preview-btn, .ekstension-media-container, .ekstension-block-author-btn').forEach(el => el.remove());
  clone.querySelectorAll('a').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  const blockedSet = new Set((state.blockedAuthors || []).map(a => a.toLowerCase().trim()));
  const isBlocked = author ? blockedSet.has(author.toLowerCase()) : false;

  return {
    id: entryId,
    contentHtml: clone.innerHTML,
    author: author,
    date: date,
    isBlocked: isBlocked,
    source: 'local'
  };
}

// Uzak Entry'yi Çek ve DOMParser ile Güvenle Ayrıştır
async function fetchRemoteEntryData(entryId) {
  const url = `${window.location.origin}/entry/${entryId}`;
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { isError: true, errorMessage: 'Entry bulunamadı veya silinmiş.' };
      }
      return { isError: true, errorMessage: `Entry yüklenemedi (HTTP ${res.status}).` };
    }

    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const entryLi = doc.querySelector(`#entry-item-list > li[data-id="${entryId}"]`) ||
                    doc.querySelector('#entry-item-list > li') ||
                    doc.querySelector(`li[data-id="${entryId}"]`) ||
                    doc.querySelector('li[data-id]');

    const contentEl = entryLi ? entryLi.querySelector('.content') : doc.querySelector('.content');
    if (!contentEl) {
      return { isError: true, errorMessage: 'Entry içeriği bulunamadı veya silinmiş.' };
    }

    const authorEl = entryLi ? entryLi.querySelector('.entry-author, .avatar-and-author .entry-author') : doc.querySelector('.entry-author');
    const author = authorEl ? (authorEl.textContent || '').trim() : (entryLi?.getAttribute('data-author') || '').trim();

    const dateEl = entryLi ? (entryLi.querySelector('.entry-date') || entryLi.querySelector('footer .entry-date')) : doc.querySelector('.entry-date');
    const date = dateEl ? (dateEl.textContent || '').trim() : '';

    const clone = contentEl.cloneNode(true);
    clone.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
    clone.querySelectorAll('a').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });

    const blockedSet = new Set((state.blockedAuthors || []).map(a => a.toLowerCase().trim()));
    const isBlocked = author ? blockedSet.has(author.toLowerCase()) : false;

    return {
      id: entryId,
      contentHtml: clone.innerHTML,
      author: author,
      date: date,
      isBlocked: isBlocked,
      source: 'remote'
    };
  } catch (err) {
    return { isError: true, errorMessage: 'Bağlantı hatası oluştu.' };
  }
}

// Popover DOM Yönetimi
function getOrCreateEntryPopover() {
  if (popoverElement && document.body.contains(popoverElement)) {
    return popoverElement;
  }

  popoverElement = document.createElement('div');
  popoverElement.id = 'ekstension-entry-popover';

  // Fare popover üzerine gelirse kapanmayı iptal et
  popoverElement.addEventListener('mouseenter', () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });

  // Fare popover'dan ayrılırsa kapatma zamanlayıcısını başlat
  popoverElement.addEventListener('mouseleave', () => {
    scheduleHidePopover();
  });

  document.body.appendChild(popoverElement);
  return popoverElement;
}

// Popover'ı Linkin Konumuna Göre Akıllıca Yerleştir
function positionPopover(targetRect, popover) {
  const popoverWidth = Math.min(440, window.innerWidth - 32);
  const padding = 12;

  // X ekseni hizalama
  let left = targetRect.left + window.scrollX;
  if (targetRect.left + popoverWidth > window.innerWidth - padding) {
    left = window.innerWidth - popoverWidth - padding + window.scrollX;
  }
  if (left < padding + window.scrollX) {
    left = padding + window.scrollX;
  }

  // Y ekseni hizalama
  const spaceBelow = window.innerHeight - targetRect.bottom;
  const spaceAbove = targetRect.top;
  const popoverHeight = popover.offsetHeight || 220;

  let top = targetRect.bottom + window.scrollY + 8;
  if (spaceBelow < 220 && spaceAbove > spaceBelow) {
    top = Math.max(window.scrollY + padding, targetRect.top + window.scrollY - popoverHeight - 8);
  }

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
  popover.style.width = `${Math.round(popoverWidth)}px`;
}

// Popover İçeriğini Doldur
function renderPopoverContent(data, entryId) {
  const popover = getOrCreateEntryPopover();
  popover.innerHTML = '';

  // 1. Header
  const header = document.createElement('div');
  header.className = 'ekstension-popover-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'ekstension-popover-title-wrap';

  const badge = document.createElement('span');
  badge.className = 'ekstension-popover-id-badge';
  badge.textContent = `#${entryId}`;
  titleWrap.appendChild(badge);

  if (data && data.isBlocked) {
    const blockedTag = document.createElement('span');
    blockedTag.className = 'ekstension-popover-blocked-tag';
    blockedTag.textContent = '🚫 Engelli Yazar';
    titleWrap.appendChild(blockedTag);
  }

  header.appendChild(titleWrap);

  const directLink = document.createElement('a');
  directLink.className = 'ekstension-popover-link';
  directLink.href = `/entry/${entryId}`;
  directLink.target = '_blank';
  directLink.rel = 'noopener noreferrer';
  directLink.textContent = 'Doğrudan Aç ↗';
  header.appendChild(directLink);

  popover.appendChild(header);

  // 2. Body
  const body = document.createElement('div');
  body.className = 'ekstension-popover-body';

  if (data.isError) {
    const errDiv = document.createElement('div');
    errDiv.className = 'ekstension-popover-error';
    const errSpan = document.createElement('span');
    errSpan.textContent = `⚠️ ${data.errorMessage || 'Entry yüklenemedi.'}`;
    errDiv.appendChild(errSpan);
    body.appendChild(errDiv);
  } else {
    body.innerHTML = data.contentHtml || '';
  }
  popover.appendChild(body);

  // 3. Footer
  if (!data.isError) {
    const footer = document.createElement('div');
    footer.className = 'ekstension-popover-footer';

    const authorLink = document.createElement('a');
    authorLink.className = 'ekstension-popover-author';
    authorLink.href = `/biri/${encodeURIComponent(data.author || '')}`;
    authorLink.target = '_blank';
    authorLink.rel = 'noopener noreferrer';
    authorLink.textContent = data.author ? `@${data.author}` : '';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'ekstension-popover-date';
    dateSpan.textContent = data.date || '';

    footer.appendChild(authorLink);
    footer.appendChild(dateSpan);
    popover.appendChild(footer);
  }
}

// Popover Yükleniyor Durumu
function renderPopoverLoading(entryId) {
  const popover = getOrCreateEntryPopover();
  popover.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'ekstension-popover-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'ekstension-popover-title-wrap';

  const badge = document.createElement('span');
  badge.className = 'ekstension-popover-id-badge';
  badge.textContent = `#${entryId}`;
  titleWrap.appendChild(badge);
  header.appendChild(titleWrap);

  popover.appendChild(header);

  const body = document.createElement('div');
  body.className = 'ekstension-popover-body';
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'ekstension-popover-loading';
  const loadingSpan = document.createElement('span');
  loadingSpan.textContent = '⏳ Entry yükleniyor...';
  loadingDiv.appendChild(loadingSpan);
  body.appendChild(loadingDiv);
  popover.appendChild(body);
}

function scheduleHidePopover() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (popoverElement) {
      popoverElement.classList.remove('visible');
    }
    currentTargetLink = null;
    currentEntryId = null;
  }, 200);
}

async function showEntryPopover(targetLink, entryId) {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  currentTargetLink = targetLink;
  currentEntryId = entryId;

  const popover = getOrCreateEntryPopover();

  // 1. Önce Local DOM (Mevcut Sayfa)
  const localData = getEntryDataFromLocalDOM(entryId);
  if (localData) {
    entryPreviewCache.set(entryId, localData);
    renderPopoverContent(localData, entryId);
    positionPopover(targetLink.getBoundingClientRect(), popover);
    popover.classList.add('visible');
    return;
  }

  // 2. Önceki Hafıza Önbelleği (Cache)
  if (entryPreviewCache.has(entryId)) {
    const cachedData = entryPreviewCache.get(entryId);
    renderPopoverContent(cachedData, entryId);
    positionPopover(targetLink.getBoundingClientRect(), popover);
    popover.classList.add('visible');
    return;
  }

  // 3. Yükleniyor durumunu göster
  renderPopoverLoading(entryId);
  positionPopover(targetLink.getBoundingClientRect(), popover);
  popover.classList.add('visible');

  // 4. Uzaktan Fetch ile Çek
  const remoteData = await fetchRemoteEntryData(entryId);
  if (currentEntryId === entryId) {
    if (!remoteData.isError) {
      entryPreviewCache.set(entryId, remoteData);
    }
    renderPopoverContent(remoteData, entryId);
    positionPopover(targetLink.getBoundingClientRect(), popover);
  }
}

// Entry Hover Dinleyicilerini Başlat (Event Delegation)
function initEntryHoverPreview() {
  if (isEntryHoverInitialized) return;
  isEntryHoverInitialized = true;

  document.body.addEventListener('mouseover', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    if (link.closest('#ekstension-entry-popover')) return;

    const entryId = extractEntryIdFromElement(link);
    if (!entryId) return;

    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    if (currentEntryId === entryId && popoverElement && popoverElement.classList.contains('visible')) {
      return;
    }

    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      showEntryPopover(link, entryId);
    }, 250);
  });

  document.body.addEventListener('mouseout', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    if (link.closest('#ekstension-entry-popover')) return;

    const entryId = extractEntryIdFromElement(link);
    if (!entryId) return;

    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }

    scheduleHidePopover();
  });
}

// ==========================================================================
// 6. AI Başlık & Entry Özetleyici (Gemini Nano & Cloud Ready)
// ==========================================================================

function getCurrentTopicSlug(mode = '') {
  try {
    const pathname = window.location.pathname.replace(/^\//, '');
    const baseSlug = pathname.split('?')[0] || 'default_topic';
    return mode ? `${baseSlug}_${mode}` : baseSlug;
  } catch (e) {
    return mode ? `default_topic_${mode}` : 'default_topic';
  }
}

function isTopicFilteredView() {
  const search = window.location.search || '';
  return search.includes('a=popular') || search.includes('a=dailynice') || search.includes('a=nice');
}

function getCurrentTopicTitle() {
  const h1 = document.querySelector('#topic h1');
  if (!h1) return document.title || 'Ekşi Sözlük Başlığı';
  const clone = h1.cloneNode(true);
  const small = clone.querySelector('small');
  if (small) small.remove();
  return clone.textContent.trim();
}

function formatSummaryMarkdown(mdText) {
  if (!mdText) return '';
  let html = mdText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Headers: ### or ## or emoji headers
  html = html.replace(/^###\s+(.*$)/gim, '<div class="ekst-summary-section-title">$1</div>');
  html = html.replace(/^##\s+(.*$)/gim, '<div class="ekst-summary-section-title">$1</div>');
  html = html.replace(/^(📌|⚖️|💡)\s*(.*$)/gim, '<div class="ekst-summary-section-title">$1 $2</div>');

  // Bullets
  const lines = html.split('\n');
  let inList = false;
  const processedLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      if (!inList) {
        processedLines.push('<ul>');
        inList = true;
      }
      processedLines.push(`<li>${trimmed.replace(/^[-*•]\s+/, '')}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      if (trimmed.length > 0) {
        processedLines.push(`<p>${trimmed}</p>`);
      }
    }
  }
  if (inList) {
    processedLines.push('</ul>');
  }

  return processedLines.join('');
}

function injectAISummarizeButton() {
  const entryList = document.querySelector('#entry-item-list');
  if (!entryList) return;

  const topicTitle = document.querySelector('#topic h1');
  if (!topicTitle) return;

  let container = document.querySelector('.ekstension-media-filter-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'ekstension-media-filter-container';
    topicTitle.parentNode.insertBefore(container, topicTitle.nextSibling);
  }

  let wrapper = document.getElementById('ekstension-ai-dropdown-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = 'ekstension-ai-dropdown-wrapper';
    wrapper.className = 'ekst-ai-dropdown-wrapper';

    const aiBtn = document.createElement('button');
    aiBtn.id = 'ekstension-ai-summary-btn';
    aiBtn.className = 'ekstension-ai-summary-btn';
    
    const isFiltered = isTopicFilteredView();
    aiBtn.innerHTML = isFiltered ? `⚡ Başlığı Özetle (AI) <span style="font-size:10px;margin-left:2px;">▾</span>` : `⚡ Başlığı Özetle (AI)`;
    aiBtn.title = isFiltered ? 'Özetleme kapsamı seç (Gündemdekiler veya Tüm Başlık)' : 'Tüm sayfaları tarayarak Gemini Nano ile başlığı özetle';

    aiBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (isTopicFilteredView()) {
        toggleAIDropdownMenu(wrapper);
      } else {
        handleAISummarizeClick('full');
      }
    });

    wrapper.appendChild(aiBtn);
    container.appendChild(wrapper);

    // Click outside listener for dropdown
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        const menu = wrapper.querySelector('.ekst-ai-dropdown-menu');
        if (menu) menu.remove();
      }
    });
  }
}

function toggleAIDropdownMenu(wrapper) {
  let menu = wrapper.querySelector('.ekst-ai-dropdown-menu');
  if (menu) {
    menu.remove();
    return;
  }

  menu = document.createElement('div');
  menu.className = 'ekst-ai-dropdown-menu';
  menu.innerHTML = `
    <button class="ekst-ai-dropdown-item" id="ekst-opt-popular">
      <div class="ekst-ai-dropdown-item-title">🔥 Gündemdekiler (Bugün)</div>
      <div class="ekst-ai-dropdown-item-desc">Sadece bugünün popüler sayfalarını özetle (Hızlı)</div>
    </button>
    <button class="ekst-ai-dropdown-item" id="ekst-opt-full" style="border-top:1px solid rgba(0,0,0,0.06);margin-top:4px;padding-top:8px;">
      <div class="ekst-ai-dropdown-item-title">📚 Tüm Başlık (Tüm Zamanlar)</div>
      <div class="ekst-ai-dropdown-item-desc">1. sayfadan itibaren tüm sayfaları tara</div>
    </button>
  `;

  menu.querySelector('#ekst-opt-popular').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.remove();
    handleAISummarizeClick('popular');
  });

  menu.querySelector('#ekst-opt-full').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.remove();
    handleAISummarizeClick('full');
  });

  wrapper.appendChild(menu);
}

async function handleAISummarizeClick(mode = 'auto', forceRefresh = false) {
  let effectiveMode = mode;
  if (effectiveMode === 'auto') {
    effectiveMode = isTopicFilteredView() ? 'popular' : 'full';
  }

  const slug = getCurrentTopicSlug(effectiveMode);
  const title = getCurrentTopicTitle();
  const cacheKey = `summary_${slug}`;
  const modeLabel = effectiveMode === 'popular' ? 'Gündemdekiler (Bugün)' : 'Tüm Başlık';

  // Check cache first if not forced refresh
  if (!forceRefresh) {
    try {
      const stored = await chrome.storage.local.get(cacheKey);
      if (stored && stored[cacheKey]) {
        renderSummaryCard(stored[cacheKey]);
        return;
      }
    } catch (e) {}
  }

  // Show starting progress
  showFloatingProgressPill({
    topicSlug: slug,
    topicTitle: title,
    mode: effectiveMode,
    modeLabel,
    progress: 10,
    statusText: `${modeLabel}: 1. Sayfa taranıyor...`
  });

  // Start background task
  chrome.runtime.sendMessage({
    action: 'startTopicSummary',
    topicUrl: window.location.href,
    topicTitle: title,
    mode: effectiveMode
  }, (response) => {
    if (chrome.runtime.lastError || !response?.success) {
      console.warn('Could not start summary task:', chrome.runtime.lastError || response?.error);
    }
  });
}

function renderSummaryCard(data) {
  if (!data || !data.summary) return;

  let card = document.getElementById('ekst-ai-summary-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'ekst-ai-summary-card';
    card.className = 'ekst-ai-summary-card';

    const container = document.querySelector('.ekstension-media-filter-container');
    if (container) {
      container.parentNode.insertBefore(card, container.nextSibling);
    } else {
      const topicTitle = document.querySelector('#topic h1');
      if (topicTitle) {
        topicTitle.parentNode.insertBefore(card, topicTitle.nextSibling);
      }
    }
  }

  const metaText = data.totalEntries ? `${data.totalEntries} entry (${data.totalPages || 1} sayfa)` : '';
  const modeBadge = data.mode === 'popular' 
    ? `<span class="ekst-summary-badge" style="background:#ea580c">Gündem (Bugün)</span>` 
    : `<span class="ekst-summary-badge">Gemini Nano</span>`;

  card.innerHTML = `
    <div class="ekst-summary-header">
      <div class="ekst-summary-header-left">
        <span class="ekst-summary-title">⚡ AI Başlık Özeti</span>
        ${modeBadge}
        ${metaText ? `<span class="ekst-summary-meta">• ${metaText}</span>` : ''}
      </div>
      <div class="ekst-summary-header-right">
        <button class="ekst-summary-action-btn" id="ekst-copy-summary-btn" title="Metni Kopyala">
          📋 Kopyala
        </button>
        <button class="ekst-summary-action-btn" id="ekst-refresh-summary-btn" title="Yeniden Özetle">
          🔄 Yenile
        </button>
        <button class="ekst-summary-close-btn" id="ekst-close-summary-btn" title="Kapat">✕</button>
      </div>
    </div>
    <div class="ekst-summary-body">
      ${formatSummaryMarkdown(data.summary)}
    </div>
  `;

  // Event handlers
  const copyBtn = card.querySelector('#ekst-copy-summary-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(data.summary).then(() => {
        copyBtn.textContent = '✓ Kopyalandı!';
        setTimeout(() => {
          copyBtn.innerHTML = '📋 Kopyala';
        }, 2000);
      });
    });
  }

  const refreshBtn = card.querySelector('#ekst-refresh-summary-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      handleAISummarizeClick(data.mode || 'auto', true);
    });
  }

  const closeBtn = card.querySelector('#ekst-close-summary-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      card.remove();
    });
  }

  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showFloatingProgressPill(task) {
  let pill = document.getElementById('ekst-floating-pill');
  if (!pill) {
    pill = document.createElement('div');
    pill.id = 'ekst-floating-pill';
    pill.className = 'ekst-floating-pill';
    document.body.appendChild(pill);
  }

  const percent = task.progress || 10;
  const statusText = task.statusText || 'Özetleniyor...';

  pill.innerHTML = `
    <div class="ekst-pill-spinner"></div>
    <div class="ekst-pill-text">${statusText}</div>
    <span class="ekst-pill-percent">%${percent}</span>
    <button class="ekst-pill-cancel" id="ekst-pill-cancel-btn" title="İptal Et">✕</button>
  `;

  const cancelBtn = pill.querySelector('#ekst-pill-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'cancelTopicSummary' });
      removeFloatingProgressPill();
    });
  }

  pill.onclick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
}

function removeFloatingProgressPill() {
  const pill = document.getElementById('ekst-floating-pill');
  if (pill) {
    pill.remove();
  }
}

function showToastNotification(title, message, onClick) {
  let container = document.querySelector('.ekst-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'ekst-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'ekst-toast';
  toast.innerHTML = `
    <div class="ekst-toast-icon">✨</div>
    <div class="ekst-toast-content">
      <div class="ekst-toast-title">${title}</div>
      <div class="ekst-toast-desc">${message}</div>
    </div>
  `;

  toast.addEventListener('click', () => {
    if (typeof onClick === 'function') onClick();
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 200);
  });

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 200);
    }
  }, 6000);
}

function injectSingleEntrySummarizeButtons() {
  const entries = document.querySelectorAll('#entry-item-list > li');
  if (!entries || entries.length === 0) return;

  entries.forEach(entry => {
    if (entry.querySelector('.ekst-single-summary-btn')) return;

    const content = entry.querySelector('.content');
    if (!content) return;

    const textLength = content.textContent.trim().length;
    if (textLength < 500) return; // Only entries >500 chars

    const footer = entry.querySelector('.info, .feedback, footer') || content;
    const author = entry.getAttribute('data-author') || '';

    const btn = document.createElement('button');
    btn.className = 'ekst-single-summary-btn';
    btn.innerHTML = '⚡ Özetle';
    btn.title = 'Bu uzun entry\'yi Gemini Nano ile kısaca özetle';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      let box = entry.querySelector('.ekst-single-summary-box');
      if (box) {
        box.remove();
        btn.innerHTML = '⚡ Özetle';
        return;
      }

      btn.innerHTML = '⏳ Özetleniyor...';
      btn.disabled = true;

      try {
        let summaryText = '';
        const localLm = (typeof LanguageModel !== 'undefined') ? LanguageModel : (window.LanguageModel || window.ai?.languageModel);
        
        if (localLm) {
          try {
            console.log('[ek$tension] Summarizing single entry locally with window.LanguageModel...');
            let session = null;
            try {
              session = await localLm.create({
                systemPrompt: 'Sen Ekşi Sözlük entrylerini tarafsız ve özlü biçimde özetleyen bir asistansın.'
              });
            } catch (e) {
              session = await localLm.create();
            }
            const prompt = `Aşağıdaki Ekşi Sözlük entry'sini analiz et ve 2-3 maddelik kısa, tarafsız ve net bir özet çıkar.\n\nYazar: @${author}\nEntry Metni:\n"${content.textContent.trim()}"\n\nLütfen doğrudan özet maddelerini ver:`;
            summaryText = await session.prompt(prompt);
            if (session?.destroy) session.destroy();
          } catch (localErr) {
            console.warn('[ek$tension] Local LanguageModel call notice, falling back to background:', localErr);
          }
        }

        if (!summaryText) {
          summaryText = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              action: 'summarizeSingleEntry',
              entryText: content.textContent.trim(),
              author
            }, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else if (response && response.success && response.summary) {
                resolve(response.summary);
              } else {
                reject(new Error(response?.error || 'Özetlenemedi'));
              }
            });
          });
        }

        btn.disabled = false;
        if (summaryText) {
          btn.innerHTML = '⚡ Özeti Gizle';
          box = document.createElement('div');
          box.className = 'ekst-single-summary-box';
          box.innerHTML = `
            <div class="ekst-single-summary-box-header">
              <span>⚡ AI Entry Özeti (@${author})</span>
            </div>
            <div class="ekst-single-summary-box-body">
              ${formatSummaryMarkdown(summaryText)}
            </div>
          `;
          content.parentNode.insertBefore(box, content.nextSibling);
        } else {
          btn.innerHTML = '⚠️ Özetlenemedi';
          setTimeout(() => { btn.innerHTML = '⚡ Özetle'; }, 3000);
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '⚠️ Hata';
        console.error('[ek$tension] Single entry summary error:', err);
        setTimeout(() => { btn.innerHTML = '⚡ Özetle'; }, 3000);
      }
    });

    footer.appendChild(btn);
  });
}

function renderAIHelpCard(errorMessage) {
  let card = document.getElementById('ekst-ai-summary-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'ekst-ai-summary-card';
    card.className = 'ekst-ai-summary-card';

    const container = document.querySelector('.ekstension-media-filter-container');
    if (container) {
      container.parentNode.insertBefore(card, container.nextSibling);
    } else {
      const topicTitle = document.querySelector('#topic h1');
      if (topicTitle) {
        topicTitle.parentNode.insertBefore(card, topicTitle.nextSibling);
      }
    }
  }

  card.innerHTML = `
    <div class="ekst-summary-header" style="background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); border-bottom-color: #fecdd3;">
      <div class="ekst-summary-header-left">
        <span class="ekst-summary-title" style="color: #be123c;">⚠️ Gemini Nano (LanguageModel) Kurulumu Gerekli</span>
      </div>
      <div class="ekst-summary-header-right">
        <button class="ekst-summary-close-btn" id="ekst-close-summary-btn" title="Kapat">✕</button>
      </div>
    </div>
    <div class="ekst-summary-body" style="font-size: 13px;">
      <p><strong>Yerel yapay zeka modeli (Gemini Nano) tarayıcınızda henüz aktif değil veya indirilmedi.</strong></p>
      <div style="background: rgba(0,0,0,0.03); padding: 12px; border-radius: 8px; margin: 10px 0;">
        <strong>1 Dakikada Nasıl Aktif Edilir?</strong>
        <ul style="margin: 8px 0 0 16px; padding: 0;">
          <li><code>chrome://flags/#prompt-api-for-gemini-nano</code> adresini açıp <strong>Enabled</strong> yapın.</li>
          <li><code>chrome://flags/#optimization-guide-on-device-model</code> adresini açıp <strong>Enabled BypassPerfRequirement</strong> yapın.</li>
          <li>Chrome'u yeniden başlatın (Relaunch).</li>
          <li><code>chrome://components</code> sayfasından <strong>Optimization Guide On Device Model</strong> satırını güncelleyin.</li>
        </ul>
      </div>
      <p style="color: #64748b; font-size: 11px; margin-top: 8px;">Detaylı rehber eklenti dizinindeki <code>docs/GEMINI_NANO_SETUP.md</code> dosyasında mevcuttur.</p>
    </div>
  `;

  const closeBtn = card.querySelector('#ekst-close-summary-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => card.remove());
  }

  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// AI Summarizer Mesajlarını Dinle
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'summaryProgress' && message.task) {
    const currentSlug = getCurrentTopicSlug();
    if (message.task.topicSlug && message.task.topicSlug.startsWith(currentSlug)) {
      showFloatingProgressPill(message.task);
    }
  }

  if (message.action === 'summaryCompleted' && message.result) {
    removeFloatingProgressPill();
    const currentSlug = getCurrentTopicSlug();
    if (message.result.topicSlug && message.result.topicSlug.startsWith(currentSlug)) {
      renderSummaryCard(message.result);
      showToastNotification(
        '✨ Başlık Özeti Hazır!',
        `"${message.result.topicTitle}" başlığı başarıyla özetlendi.`,
        () => {
          renderSummaryCard(message.result);
        }
      );
    }
  }

  if (message.action === 'summaryError') {
    removeFloatingProgressPill();
    const currentSlug = getCurrentTopicSlug();
    if (message.topicSlug && message.topicSlug.startsWith(currentSlug)) {
      showToastNotification('⚠️ Özetleme Hatası', message.error || 'Özetleme tamamlanamadı.');
      if (message.error?.includes('Gemini Nano') || message.error?.includes('LanguageModel') || message.error?.includes('Prompt API')) {
        renderAIHelpCard(message.error);
      }
    }
  }
});

// Tüm Sayfa İçi Araçları Çalıştır
function runAllEnhancements() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    filterTopics();
    applyAuthorBlocking();
    applyMediaPreviews();
    injectMediaFilterButton();
    injectAISummarizeButton();
    injectSingleEntrySummarizeButtons();
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
  if (window !== window.top && !document.querySelector('#entry-item-list, ul.topic-list')) {
    return;
  }

  notifyPageReady();

  chrome.runtime.sendMessage({ action: 'getFilteredWords' }, (words) => {
    state.filteredWords = words || [];
    filterTopics();
  });

  chrome.runtime.sendMessage({ action: 'getBlockedAuthors' }, (authors) => {
    state.blockedAuthors = authors || [];
    applyAuthorBlocking();
  });

  // Restore active summary task if ongoing
  chrome.storage.local.get('active_summary_task', (stored) => {
    const task = stored?.active_summary_task;
    if (task && task.status === 'running') {
      const currentSlug = getCurrentTopicSlug();
      if (task.topicSlug === currentSlug) {
        showFloatingProgressPill(task);
      }
    }
  });

  initEntryHoverPreview();
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
    if (target && (
      target.id === 'ekstension-entry-popover' ||
      target.closest?.('#ekstension-entry-popover') ||
      (target.classList && (
        target.classList.contains('ekstension-media-container') ||
        target.classList.contains('ekstension-preview-btn') ||
        target.classList.contains('ekstension-block-author-btn') ||
        target.classList.contains('ekstension-author-blocked-placeholder')
      ))
    )) {
      continue;
    }

    if (mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1 && 
            !node.classList?.contains('ekstension-preview-btn') && 
            !node.classList?.contains('ekstension-media-container') &&
            node.id !== 'ekstension-entry-popover') {
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