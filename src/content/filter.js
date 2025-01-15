// Her başlığı filtrele
function filterTopics(filteredWords) {
  if (!filteredWords) return;

  // Gündem listesini bul
  const topicList = document.querySelector('ul.topic-list');
  if (!topicList) return;

  // Her başlığı kontrol et
  const topics = topicList.querySelectorAll('li');
  topics.forEach(topic => {
    const titleElement = topic.querySelector('a');
    if (!titleElement) return;

    const title = titleElement.textContent.toLowerCase();
    
    // Filtrelenen kelimelerden biri başlıkta varsa gizle
    for (const word of filteredWords) {
      if (title.includes(word.toLowerCase())) {
        topic.style.display = 'none';
        break;
      }
    }
  });
}

// Yeni eklenen başlıkları filtrele
function filterNewTopic(node, filteredWords) {
  if (!filteredWords) return;

  const titleElement = node.querySelector('a');
  if (!titleElement) return;

  const title = titleElement.textContent.toLowerCase();
  
  for (const word of filteredWords) {
    if (title.includes(word.toLowerCase())) {
      node.style.display = 'none';
      break;
    }
  }
}

// İlk yükleme
chrome.runtime.sendMessage({ action: 'getFilteredWords' }, filterTopics);

// Dinamik yüklenen başlıklar için MutationObserver kullan
const observer = new MutationObserver((mutations) => {
  chrome.runtime.sendMessage({ action: 'getFilteredWords' }, (filteredWords) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.matches('li')) {
          filterNewTopic(node, filteredWords);
        }
      });
    });
  });
});

// Topic listesini gözlemle
const topicList = document.querySelector('ul.topic-list');
if (topicList) {
  observer.observe(topicList, { childList: true, subtree: true });
} 