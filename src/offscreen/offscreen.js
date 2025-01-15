// Mesajları dinle
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'fetchTopics') {
    try {
      await fetchTopicTitles();
      
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }
  
  if (message.action === 'parseHtml') {
    parseHtml(message).then(result => sendResponse(result));
    return true;
  }
});

async function fetchTopicTitles() {
  const response = await fetch('https://eksisozluk.com/basliklar/gundem');
  const html = await response.text();
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const titleElements = doc.querySelectorAll('ul.topic-list.partial > li > a');
  const titles = Array.from(titleElements)
    .filter(a => !a.closest('li[id*="sponsored"]') && !a.closest('li[id*="nativespot"]'))
    .map(a => {
      const fullText = a.textContent;
      const match = fullText.match(/(.*?)\s*(\d+)\s*$/);
      
      return {
        title: match ? match[1].trim() : fullText.trim(),
        entryCount: match ? parseInt(match[2]) : 0,
        url: 'https://eksisozluk.com' + a.getAttribute('href').split('?')[0]
      };
    });

  // Başlıkları background script'e gönder
  chrome.runtime.sendMessage({
    action: 'setTopicTitles',
    titles: titles
  });
}

// HTML'i parse et
async function parseHtml(message) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.html, 'text/html');
    
    // URL'den başlık ID'sini al
    const topicId = message.url.split('--')[1];
    
    // Doğru başlığı bul
    const titleLink = doc.querySelector(`ul.topic-list > li > a[href*="${topicId}"]`);
    
    if (!titleLink) {
      return {
        success: false,
        error: 'Başlık bulunamadı'
      };
    }
    
    const fullText = titleLink.textContent.trim();
    const match = fullText.match(/(.*?)\s*(\d+)\s*$/);
    
    if (!match) {
      return {
        success: false,
        error: 'Entry sayısı bulunamadı'
      };
    }
    
    return {
      success: true,
      title: match[1].trim(),
      entryCount: match[2],
      url: message.url
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
} 