search = function(word){
    var query = word.selectionText;
    chrome.tabs.create({url: "https://eksisozluk.com/?q=" + encodeURIComponent(query)});
 };

chrome.contextMenus.create({
    id:'search-menu-item',
    title: chrome.i18n.getMessage('context_menu_search'),
    contexts: ["selection"],  // ContextType
});

function contextClick(info, tab) {
    const { menuItemId } = info
  
    if (menuItemId === 'search-menu-item') {
      search(info);
    }
  }

chrome.contextMenus.onClicked.addListener(contextClick);