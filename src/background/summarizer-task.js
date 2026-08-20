import { MESSAGE_TYPES } from '../utils/constants.js';
import { aiService } from '../services/ai/AIService.js';

class SummarizerTaskManager {
  constructor() {
    this.activeTask = null;
  }

  /**
   * Helper delay with jitter
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get slug / unique key from topic URL
   */
  getTopicSlug(url, mode = '') {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.replace(/^\//, '');
      const baseSlug = pathname.split('?')[0] || 'default_topic';
      return mode ? `${baseSlug}_${mode}` : baseSlug;
    } catch (e) {
      const safe = url.replace(/[^a-zA-Z0-9_-]/g, '_');
      return mode ? `${safe}_${mode}` : safe;
    }
  }

  /**
   * Parse HTML string to extract entries and total page count
   */
  parseTopicHtml(html) {
    const entries = [];
    let totalPages = 1;

    try {
      // 1. Extract total page count
      const pageCountMatch = html.match(/data-pagecount=["'](\d+)["']/i) ||
                             html.match(/class=["']pager["'][^>]*data-pagecount=["'](\d+)["']/i) ||
                             html.match(/<a[^>]*class=["']last["'][^>]*>(\d+)<\/a>/i);
      
      if (pageCountMatch && pageCountMatch[1]) {
        totalPages = parseInt(pageCountMatch[1], 10) || 1;
      } else {
        const selectMatch = html.match(/<select[^>]*id=["']select-page["'][^>]*>([\s\S]*?)<\/select>/i);
        if (selectMatch && selectMatch[1]) {
          const optionValues = [...selectMatch[1].matchAll(/<option[^>]*value=["'](\d+)["']/gi)].map(m => parseInt(m[1], 10));
          if (optionValues.length > 0) {
            totalPages = Math.max(...optionValues);
          }
        }
      }

      // 2. Extract entry items (attribute-order independent)
      const listMatch = html.match(/<ul[^>]*id=["']entry-item-list["'][^>]*>([\s\S]*?)<\/ul>/i);
      const searchHtml = listMatch ? listMatch[1] : html;

      const rawItems = searchHtml.split(/<li\b/i).slice(1);
      for (const raw of rawItems) {
        const contentMatch = raw.match(/<div[^>]*class=["']content["'][^>]*>([\s\S]*?)<\/div>/i);
        if (!contentMatch) continue;

        const idMatch = raw.match(/data-id=["'](\d+)["']/i) || raw.match(/id=["']entry-item-(\d+)["']/i);
        const authorMatch = raw.match(/data-author=["']([^"']*)["']/i) || raw.match(/class=["'][^"']*entry-author[^"']*["'][^>]*>([^<]+)<\/a>/i);
        const dateMatch = raw.match(/class=["'][^"']*entry-date[^"']*["'][^>]*>([^<]+)<\/a>/i);
        const favMatch = raw.match(/data-favorite-count=["'](\d+)["']/i);

        entries.push({
          id: idMatch ? idMatch[1] : '',
          author: authorMatch ? authorMatch[1].trim() : '',
          date: dateMatch ? dateMatch[1].trim() : '',
          content: contentMatch[1].trim(),
          favCount: favMatch ? favMatch[1] : '0'
        });
      }
    } catch (e) {
      console.error('[SummarizerTaskManager] Error parsing HTML:', e);
    }

    return { entries, totalPages };
  }

  /**
   * Broadcast progress update to all tabs and storage
   */
  async updateProgress(task, progress, message, stage = 'crawling') {
    task.progress = progress;
    task.statusText = message;
    task.stage = stage;

    // Update storage
    await chrome.storage.local.set({
      active_summary_task: {
        topicUrl: task.topicUrl,
        topicTitle: task.topicTitle,
        topicSlug: task.topicSlug,
        progress: task.progress,
        statusText: task.statusText,
        stage: task.stage,
        status: task.status
      }
    }).catch(() => {});

    // Broadcast message
    chrome.runtime.sendMessage({
      action: MESSAGE_TYPES.SUMMARY_PROGRESS,
      task: {
        topicSlug: task.topicSlug,
        topicTitle: task.topicTitle,
        progress: task.progress,
        statusText: task.statusText,
        stage: task.stage,
        status: task.status
      }
    }).catch(() => {});
  }

  /**
   * Start topic summarization
   */
  /**
   * Start topic summarization
   */
  async startTopicSummary(topicUrl, topicTitle, sourceTabId = null, mode = 'auto', initialEntries = null, initialTotalPages = null) {
    let effectiveMode = mode;
    let queryParams = '';

    try {
      const parsedUrl = new URL(topicUrl);
      const aParam = parsedUrl.searchParams.get('a');
      if (effectiveMode === 'popular' || (effectiveMode === 'auto' && aParam === 'popular')) {
        effectiveMode = 'popular';
        queryParams = 'a=popular';
      } else if (effectiveMode === 'filtered' || (effectiveMode === 'auto' && aParam)) {
        effectiveMode = 'filtered';
        queryParams = `a=${aParam}`;
      } else {
        effectiveMode = 'full';
        queryParams = '';
      }
    } catch (e) {
      effectiveMode = 'full';
    }

    const topicSlug = this.getTopicSlug(topicUrl, effectiveMode);
    const modeLabel = effectiveMode === 'popular' ? 'Gündemdekiler (Bugün)' : 
                      effectiveMode === 'filtered' ? 'Filtrelenmiş Sayfalar' : 'Tüm Başlık';

    // Cancel existing task if running
    if (this.activeTask && this.activeTask.status === 'running') {
      this.activeTask.cancelled = true;
    }

    const task = {
      topicUrl,
      topicTitle: topicTitle || 'Ekşi Sözlük Başlığı',
      topicSlug,
      mode: effectiveMode,
      modeLabel,
      status: 'running',
      stage: 'starting',
      progress: 10,
      statusText: `${modeLabel}: Başlık bilgileri alınıyor...`,
      totalPages: initialTotalPages || 1,
      currentPage: 0,
      totalEntries: initialEntries ? initialEntries.length : 0,
      cancelled: false,
      sourceTabId
    };

    this.activeTask = task;

    try {
      const baseCleanUrl = topicUrl.split('?')[0];
      const getPageUrl = (page) => {
        if (queryParams) {
          return `${baseCleanUrl}?${queryParams}&p=${page}`;
        }
        return `${baseCleanUrl}?p=${page}`;
      };

      let allEntries = [];
      let totalPages = initialTotalPages || 1;

      // Use initial entries if available from current page and in appropriate mode
      if (initialEntries && initialEntries.length > 0) {
        allEntries = [...initialEntries];
        totalPages = initialTotalPages || 1;
        task.totalPages = totalPages;
        console.log(`[SummarizerTask] Using ${allEntries.length} initial entries from DOM (Total pages: ${totalPages})`);
      } else {
        await this.updateProgress(task, 15, `${modeLabel}: 1. Sayfa taranıyor...`, 'crawling');
        try {
          const firstPageResponse = await fetch(getPageUrl(1), {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
          });
          if (firstPageResponse.ok) {
            const firstPageHtml = await firstPageResponse.text();
            const parsedFirstPage = this.parseTopicHtml(firstPageHtml);
            allEntries = [...parsedFirstPage.entries];
            totalPages = parsedFirstPage.totalPages;
            task.totalPages = totalPages;
          }
        } catch (fetchErr) {
          console.warn('[SummarizerTask] Error fetching first page:', fetchErr);
        }
      }

      // 2. Sequential Crawl of remaining pages if any
      if (totalPages > 1) {
        for (let page = 2; page <= totalPages; page++) {
          if (task.cancelled) {
            task.status = 'cancelled';
            await this.updateProgress(task, 0, 'Özetleme iptal edildi.', 'cancelled');
            return;
          }

          const crawlPercent = 15 + Math.round(((page - 1) / totalPages) * 35);
          await this.updateProgress(
            task,
            crawlPercent,
            `${modeLabel}: Sayfa ${page} / ${totalPages} taranıyor (${allEntries.length} entry toplandı)...`,
            'crawling'
          );

          // Jittered delay to be safe and friendly
          await this.sleep(400 + Math.random() * 400);

          try {
            const pageResp = await fetch(getPageUrl(page), {
              headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (pageResp.ok) {
              const pageHtml = await pageResp.text();
              const parsedPage = this.parseTopicHtml(pageHtml);
              allEntries.push(...parsedPage.entries);
            }
          } catch (fetchErr) {
            console.warn(`[SummarizerTask] Error fetching page ${page}:`, fetchErr);
          }
        }
      }

      if (task.cancelled) return;

      task.totalEntries = allEntries.length;
      await this.updateProgress(
        task,
        50,
        `${modeLabel}: Toplam ${allEntries.length} entry toplandı. Gemini Nano ile özetleniyor...`,
        'summarizing'
      );

      // 3. AI Summarization Phase
      const summaryResult = await aiService.summarizeTopic(
        allEntries,
        task.topicTitle,
        (progressInfo) => {
          if (!task.cancelled) {
            this.updateProgress(task, progressInfo.progress, progressInfo.message, progressInfo.stage);
          }
        }
      );

      if (task.cancelled) return;

      task.status = 'completed';
      task.result = summaryResult;

      // Cache result in storage
      const cacheKey = `summary_${task.topicSlug}`;
      const cacheData = {
        topicSlug: task.topicSlug,
        topicTitle: task.topicTitle,
        summary: summaryResult,
        totalEntries: allEntries.length,
        totalPages: task.totalPages,
        timestamp: Date.now()
      };

      await chrome.storage.local.set({
        [cacheKey]: cacheData,
        active_summary_task: {
          ...cacheData,
          status: 'completed',
          progress: 100,
          statusText: 'Özetleme tamamlandı!'
        }
      });

      // Broadcast completion
      chrome.runtime.sendMessage({
        action: MESSAGE_TYPES.SUMMARY_COMPLETED,
        result: cacheData
      }).catch(() => {});

      // Trigger desktop notification
      this.sendDesktopNotification(task);

    } catch (error) {
      console.error('[SummarizerTask] Summary error:', error);
      task.status = 'error';
      task.error = error.message;

      await chrome.storage.local.set({
        active_summary_task: {
          topicSlug: task.topicSlug,
          status: 'error',
          error: error.message,
          progress: 0,
          statusText: `Hata: ${error.message}`
        }
      });

      chrome.runtime.sendMessage({
        action: MESSAGE_TYPES.SUMMARY_ERROR,
        error: error.message,
        topicSlug: task.topicSlug
      }).catch(() => {});
    }
  }

  /**
   * Cancel ongoing summary
   */
  async cancelSummary() {
    if (this.activeTask) {
      this.activeTask.cancelled = true;
      this.activeTask.status = 'cancelled';
      await chrome.storage.local.remove('active_summary_task').catch(() => {});
    }
  }

  /**
   * Send Chrome Desktop Notification
   */
  sendDesktopNotification(task) {
    try {
      if (typeof chrome.notifications?.create === 'function') {
        chrome.notifications.create(`summary_${task.topicSlug}_${Date.now()}`, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon_128.png'),
          title: '✨ Ekşi Sözlük AI Özeti Hazır!',
          message: `"${task.topicTitle}" başlıklı konunun özeti tamamlandı. Görüntülemek için tıklayın.`,
          priority: 2
        });
      }
    } catch (e) {
      console.warn('[SummarizerTask] Failed to send desktop notification:', e);
    }
  }
}

export const summarizerTaskManager = new SummarizerTaskManager();
