export const CACHE_KEYS = {
  TOPICS: 'topics'
};

export const STORAGE_KEYS = {
  FAVORITES: 'favorites',
  FOLLOWING: 'following',
  NOTIFICATIONS: 'notificationsEnabled',
  FILTERED_WORDS: 'filteredWords',
  CHECK_INTERVAL: 'checkInterval',
  THEME: 'theme',
  CURRENT_SEARCH_RESULTS: 'currentSearchResults'
};

export const MESSAGE_TYPES = {
  FETCH_TOPICS: 'fetchTopics',
  PARSE_HTML: 'parseHtml',
  SET_TOPIC_TITLES: 'setTopicTitles',
  PARSE_HTML_RESULT: 'parseHtmlResult',
  PARSE_SEARCH_RESULTS: 'parseSearchResults',
  PARSE_SEARCH_RESULTS_RESPONSE: 'parseSearchResultsResponse'
}; 

export const SUPPORTED_SITES = {
  YOUTUBE: {
    hostname: 'www.youtube.com',
    selectors: {
      mainTitle: '#title.ytd-rich-metadata-renderer',
      attrTitle: '.yt-video-attribute-view-model__title',
      attrSubtitle: '.yt-video-attribute-view-model__subtitle',
      attrString: '.yt-video-attribute-view-model__secondary-subtitle > .yt-core-attributed-string.yt-core-attributed-string--white-space-pre-wrap'
    }
  },
  WIKIPEDIA: {
    hostname: 'wikipedia.org',
    selectors: {
      title: 'h1.firstHeading',
      summary: 'div.mw-parser-output > p:not([class])',
    }
  },
  IMDB: {
    hostname: 'www.imdb.com',
    selectors: {
      cast: ['ul.ipc-metadata-list.ipc-metadata-list--dividers-all.title-pc-list.ipc-metadata-list--baseAlt li ul.ipc-inline-list a'],
      title: 'h1[data-testid="hero__pageTitle"]'
    }
  },
  STEAM: {
    hostname: 'store.steampowered.com',
    selectors: {
      title: 'div.apphub_AppName',
      description: 'div.game_description_snippet',
    }
  },
  EPIC: {
    hostname: 'store.epicgames.com',
    selectors: {
      title: 'h1[data-testid="game-title"]',
      description: 'div[data-testid="game-description"]',
    }
  }
}; 