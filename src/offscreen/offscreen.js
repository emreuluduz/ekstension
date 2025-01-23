import { MESSAGE_TYPES } from '../utils/constants.js';
import { parseNumber, formatNumber } from '../utils/helpers.js';

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
      
      // Entry sayısını small etiketinden al
      const entryCountElement = titleElement.querySelector('small');
      const title = titleElement.childNodes[0].textContent.trim();
      
      if (!entryCountElement) {
        chrome.runtime.sendMessage({
          action: MESSAGE_TYPES.PARSE_HTML_RESULT,
          result: {
            success: false,
            error: 'Entry count not found'
          }
        });
        return;
      }
      
      const entryCount = entryCountElement.textContent.trim();
      
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

  if (message.action === MESSAGE_TYPES.PARSE_SEARCH_RESULTS) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(message.html, 'text/html');
      
      // #content-body içeriğini kontrol et
      const contentBody = doc.querySelector('#content-body');
      if (contentBody && contentBody.textContent.includes('başlık yok')) {
        chrome.runtime.sendMessage({
          action: MESSAGE_TYPES.PARSE_SEARCH_RESULTS_RESPONSE,
          result: {
            success: true,
            hasNoResults: true,
            titles: []
          }
        });
        return;
      }
      
      // Başlıkları topla
      const titles = Array.from(doc.querySelectorAll('#content-body h1 a'))
        .map(a => {
          const href = a.getAttribute('href');
          // URL'yi düzelt
          const fullUrl = href.startsWith('/') 
            ? `https://eksisozluk.com${href}`
            : href.startsWith('http') 
              ? href 
              : `https://eksisozluk.com/${href}`;
            
          return {
            Title: a.textContent.trim(),
            Url: fullUrl
          };
        });

      chrome.runtime.sendMessage({
        action: MESSAGE_TYPES.PARSE_SEARCH_RESULTS_RESPONSE,
        result: {
          success: true,
          hasNoResults: false,
          titles
        }
      });
    } catch (error) {
      console.error('Search results parse error:', error);
      chrome.runtime.sendMessage({
        action: MESSAGE_TYPES.PARSE_SEARCH_RESULTS_RESPONSE,
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
      const entryCountElement = a.querySelector('small');
      const title = a.childNodes[0].textContent.trim();
      const entryCount = entryCountElement ? entryCountElement.textContent.trim() : '0';
      
    // Entry count'u parse et ve formatla
    const entryCountParsed = parseNumber(entryCount);
    const formattedEntryCount = formatNumber(entryCountParsed);

      return {
        title,
        entryCount: formattedEntryCount,
        url: 'https://eksisozluk.com' + a.getAttribute('href').split('?')[0]
      };
    });
}