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
  getTopicSlug(url) {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.replace(/^\//, '');
      return pathname.split('?')[0] || 'default_topic';
    } catch (e) {
      return url.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
  }

  /**
   * Parse HTML string to extract entries and total page count
   */
  parseTopicHtml(html) {
    const entries = [];
    let totalPages = 1;

    try {
      // Extract page count from data-pagecount or select options or pager
      const pageCountMatch = html.match(/data-pagecount=["'](\d+)["']/i) ||
                             html.match(/class=["']pager["'][^>]*data-pagecount=["'](\d+)["']/i) ||
                             html.match(/<a[^>]*class=["']last["'][^>]*>(\d+)<\/a>/i);
      
      if (pageCountMatch && pageCountMatch[1]) {
        totalPages = parseInt(pageCountMatch[1], 10) || 1;
      } else {
        // Check select-page options
        const selectMatch = html.match(/<select[^>]*id=["']select-page["'][^>]*>([\s\S]*?)<\/select>/i);
        if (selectMatch && selectMatch[1]) {
          const optionValues = [...selectMatch[1].matchAll(/<option[^>]*value=["'](\d+)["']/gi)].map(m => parseInt(m[1], 10));
          if (optionValues.length > 0) {
            totalPages = Math.max(...optionValues);
          }
        }
      }

      // Extract entries: <li data-id="..." data-author="..." ...> <div class="content">...</div> ... </li>
      // Using regex block extraction for service worker compatibility
      const entryRegex = /<li[^>]*data-id=["'](\d+)["'][^>]*data-author=["']([^"']*)["'][^>]*>([\s\S]*?)<\/li>/gi;
      let match;

      while ((match = entryRegex.exec(html)) !== null) {
        const id = match[1];
        const author = match[2];
        const innerContent = match[3];

        // Content
        const contentMatch = innerContent.match(/<div[^>]*class=["']content["'][^>]*>([\s\S]*?)<\/div>/i);
        const content = contentMatch ? contentMatch[1].trim() : '';

        // Date
        const dateMatch = innerContent.match(/<a[^>]*class=["'][^"']*entry-date[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
        const date = dateMatch ? dateMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        // Favorite count
        const favMatch = innerContent.match(/data-favorite-count=["'](\d+)["']/i);
        const favCount = favMatch ? favMatch[1] : '0';

        if (content) {
          entries.push({
            id,
            author,
            date,
            content,
            favCount
          });
        }
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
  async startTopicSummary(topicUrl, topicTitle, sourceTabId = null) {
    const topicSlug = this.getTopicSlug(topicUrl);

    // Cancel existing task if running
    if (this.activeTask && this.activeTask.status === 'running') {
      this.activeTask.cancelled = true;
    }

    const task = {
      topicUrl,
      topicTitle: topicTitle || 'Ekşi Sözlük Başlığı',
      topicSlug,
      status: 'running',
      stage: 'starting',
      progress: 5,
      statusText: 'Başlık bilgileri alınıyor...',
      totalPages: 1,
      currentPage: 0,
      totalEntries: 0,
      cancelled: false,
      sourceTabId
    };

    this.activeTask = task;

    try {
      await this.updateProgress(task, 10, '1. Sayfa taranıyor...', 'crawling');

      // 1. Fetch First Page
      const baseCleanUrl = topicUrl.split('?')[0];
      const firstPageResponse = await fetch(`${baseCleanUrl}?p=1`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });

      if (!firstPageResponse.ok) {
        throw new Error(`Sayfa yüklenemedi (HTTP ${firstPageResponse.status})`);
      }

      const firstPageHtml = await firstPageResponse.text();
      const parsedFirstPage = this.parseTopicHtml(firstPageHtml);

      let allEntries = [...parsedFirstPage.entries];
      const totalPages = parsedFirstPage.totalPages;
      task.totalPages = totalPages;

      // 2. Sequential Crawl of remaining pages if any
      if (totalPages > 1) {
        for (let page = 2; page <= totalPages; page++) {
          if (task.cancelled) {
            task.status = 'cancelled';
            await this.updateProgress(task, 0, 'Özetleme iptal edildi.', 'cancelled');
            return;
          }

          const crawlPercent = 10 + Math.round(((page - 1) / totalPages) * 40);
          await this.updateProgress(
            task,
            crawlPercent,
            `Sayfa ${page} / ${totalPages} taranıyor (${allEntries.length} entry toplandı)...`,
            'crawling'
          );

          // Jittered delay to be safe and friendly
          await this.sleep(400 + Math.random() * 400);

          try {
            const pageResp = await fetch(`${baseCleanUrl}?p=${page}`, {
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
        `Toplam ${allEntries.length} entry toplandı. Gemini Nano ile özetleniyor...`,
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
