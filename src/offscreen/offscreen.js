import { MESSAGE_TYPES } from '../utils/constants.js';
import { parseEntryCount } from '../utils/helpers.js';

// Mesajları dinle
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === MESSAGE_TYPES.FETCH_TOPICS) {
    try {
      const titles = await fetchTopicTitles();
      chrome.runtime.sendMessage({ 
        action: MESSAGE_TYPES.SET_TOPIC_TITLES, 
        titles 
      });
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }
  
  if (message.action === MESSAGE_TYPES.PARSE_HTML) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(message.html, 'text/html');
      
      // URL'den başlık ID'sini al
      const topicId = message.url.split('--')[1];
      
      // Gündem listesinden başlığı bul
      const titleElement = doc.querySelector(`ul.topic-list > li > a[href*="${topicId}"]`);
      
      if (!titleElement) {
        chrome.runtime.sendMessage({
          action: MESSAGE_TYPES.PARSE_HTML_RESULT,
          result: {
            success: false,
            error: 'Topic not found'
          }
        });
        return;
      }
      
      const fullText = titleElement.textContent.trim();
      const match = fullText.match(/(.*?)\s*(\d+)\s*$/);
      
      if (!match) {
        chrome.runtime.sendMessage({
          action: MESSAGE_TYPES.PARSE_HTML_RESULT,
          result: {
            success: false,
            error: 'Entry count not found'
          }
        });
        return;
      }
      
      const title = match[1].trim();
      const entryCount = match[2];
      
      chrome.runtime.sendMessage({
        action: MESSAGE_TYPES.PARSE_HTML_RESULT,
        result: {
          success: true,
          title,
          entryCount,
          url: message.url
        }
      });
    } catch (error) {
      console.error('Parse error:', error);
      chrome.runtime.sendMessage({
        action: MESSAGE_TYPES.PARSE_HTML_RESULT,
        result: {
          success: false,
          error: error.message
        }
      });
    }
  }
});

async function fetchTopicTitles() {
  const response = await fetch('https://eksisozluk.com/basliklar/gundem');
  const html = await response.text();
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const titleElements = doc.querySelectorAll('ul.topic-list.partial > li > a');
  return Array.from(titleElements)
    .filter(a => !a.closest('li[id*="sponsored"]') && !a.closest('li[id*="nativespot"]'))
    .map(a => {
      const fullText = a.textContent;
      const match = fullText.match(/(.*?)\s*(\d+)\s*$/);
      
      return {
        title: match ? match[1].trim() : fullText.trim(),
        entryCount: match ? parseEntryCount(match[2]) : 0,
        url: 'https://eksisozluk.com' + a.getAttribute('href').split('?')[0]
      };
    });
}

async function parseTopicHtml(html, url) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // URL'den başlık ID'sini al
    const topicId = url.split('--')[1];
    
    // Doğru başlığı bul
    const titleLink = doc.querySelector(`ul.topic-list > li > a[href*="${topicId}"]`);
    
    if (!titleLink) {
      return {
        success: false,
        error: 'Topic not found'
      };
    }
    
    const fullText = titleLink.textContent.trim();
    const match = fullText.match(/(.*?)\s*(\d+)\s*$/);
    
    if (!match) {
      return {
        success: false,
        error: 'Entry count not found'
      };
    }
    
    return {
      success: true,
      title: match[1].trim(),
      entryCount: parseEntryCount(match[2]),
      url: url
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
} 