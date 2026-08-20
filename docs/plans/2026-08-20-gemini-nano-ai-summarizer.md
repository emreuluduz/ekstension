# Gemini Nano AI Summarizer Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Build a zero-cost, on-device AI summarization engine for Ekşi Sözlük using Chrome's built-in Gemini Nano (Prompt & Summarizer APIs) with extensible cloud API readiness, background crawling across all pages with jittered rate-limiting, and an interactive UI with floating progress and multi-channel notifications.

**Architecture:** A modular AI provider layer (`src/services/ai/`) decoupled from background task management (`summarizer-task.js`) and content scripts (`filter.js`). Background Service Worker orchestrates multi-page crawling, chunked AI map-reduce summarization, persistent state management in `chrome.storage.local`, and notifications (`chrome.notifications` + in-page Toast).

**Tech Stack:** Chrome Extension Manifest V3, Web Built-in AI APIs (`window.ai` / `ai.languageModel` / `ai.summarizer`), Chrome Storage & Notification APIs, Vanilla JavaScript (ES6 Modules), CSS3 animations with theme support.

---

## File Structure

```
manifest.json                                   (Modify: add "notifications" permission)
src/
├── services/
│   └── ai/
│       ├── BaseAIProvider.js                   (Create: abstract base provider)
│       ├── AIService.js                        (Create: AI provider manager & chunker)
│       └── providers/
│           ├── GeminiNanoProvider.js           (Create: Chrome built-in Gemini Nano)
│           └── GeminiAPIProvider.js            (Create: Future Google Gemini API stub)
├── background/
│   ├── background.js                           (Modify: hook summarizer task messages)
│   └── summarizer-task.js                      (Create: background safe crawler & coordinator)
├── content/
│   ├── filter.js                               (Modify: inject summarize buttons, progress & cards)
│   └── content.css                             (Modify: add styles for summary UI components)
```

---

### Task 1: Add Notifications Permission & Update Manifest

**Files:**
- Modify: `manifest.json:7-14`

**Step 1: Edit `manifest.json`**
Add `"notifications"` permission to `permissions` array in `manifest.json`.

**Step 2: Verify manifest syntax**
Run `node -e "JSON.parse(require('fs').readFileSync('manifest.json'))"` to ensure valid JSON.

**Step 3: Commit**
```bash
git add manifest.json
git commit -m "chore: add notifications permission to manifest.json"
```

---

### Task 2: Implement Modular AI Provider Core (`BaseAIProvider`, `GeminiNanoProvider`, `GeminiAPIProvider`, `AIService`)

**Files:**
- Create: `src/services/ai/BaseAIProvider.js`
- Create: `src/services/ai/providers/GeminiNanoProvider.js`
- Create: `src/services/ai/providers/GeminiAPIProvider.js`
- Create: `src/services/ai/AIService.js`

**Step 1: Create `BaseAIProvider.js`**
Define abstract base class with `isAvailable()`, `summarize(text, options)`, and `summarizeStream(text, onChunk)`.

**Step 2: Create `GeminiNanoProvider.js`**
Implement detection via `ai.languageModel.capabilities()` / `ai.summarizer.capabilities()`, session creation with system prompt in Turkish, and map-reduce chunk summarization.

**Step 3: Create `GeminiAPIProvider.js`**
Stub class for future Google AI Studio / Gemini 1.5 Flash API Key integration.

**Step 4: Create `AIService.js`**
Provide unified API to check availability, determine optimal chunk size, perform chunked summarization for multi-entry batches, and summarize single entries (>500 chars).

**Step 5: Commit**
```bash
git add src/services/ai/
git commit -m "feat(ai): create modular AI provider architecture with Gemini Nano implementation"
```

---

### Task 3: Implement Background Crawler & Multi-Page Task Orchestrator

**Files:**
- Create: `src/background/summarizer-task.js`
- Modify: `src/background/background.js`

**Step 1: Create `summarizer-task.js`**
Implement safe sequential multi-page crawler:
- Extracts total page count from pagination elements.
- Fetches all pages sequentially with 400-800ms random jitter delay.
- Cleans HTML, extracts entries (text, author, date, fav count).
- Sends live progress updates via `chrome.runtime.sendMessage` and updates `chrome.storage.local`.
- Invokes `AIService` for chunked map-reduce summarization.
- Caches generated summary in `chrome.storage.local` keyed by topic slug.
- Dispatches desktop notification via `chrome.notifications.create` if tab is not active.

**Step 2: Connect to `background.js`**
Add message listeners for `START_TOPIC_SUMMARY`, `CANCEL_TOPIC_SUMMARY`, and `GET_SUMMARY_STATUS`.

**Step 3: Commit**
```bash
git add src/background/summarizer-task.js src/background/background.js
git commit -m "feat(background): implement safe multi-page crawler and summarizer task coordinator"
```

---

### Task 4: Implement In-Page UI Components & Content Script Integration

**Files:**
- Modify: `src/content/filter.js`
- Modify: `src/content/content.css`

**Step 1: Add UI Components in `filter.js`**
- **Topic Summarize Button:** Injected next to media filter buttons in `#topic h1` / sub-title bar.
- **Summary Card (`ekst-ai-summary-card`):** Collapsible markdown-formatted panel displaying overview, viewpoints, and key quotes with Copy and Refresh actions.
- **Floating Progress Pill (`ekst-floating-pill`):** Fixed bottom-right badge showing live crawl/AI progress with cancel button.
- **Toast Notification (`ekst-toast`):** Animated notification informing that the summary is ready, smoothly scrolling to the summary card upon click.
- **Single Entry Summarize Button:** Injected on entries with $>500$ characters with inline summary drawer.

**Step 2: Add CSS Styles in `content.css`**
Style the summary card, floating pill, spinners, markdown lists, badges, and dark/light mode compatibility.

**Step 3: Commit**
```bash
git add src/content/filter.js src/content/content.css
git commit -m "feat(ui): add summary card, floating progress pill, single-entry summary button, and toast styles"
```

---

### Task 5: Manual Verification & End-to-End Testing

**Verification Steps:**
1. Load unpacked extension in Chrome.
2. Verify Gemini Nano availability checks (`window.ai` / `ai.languageModel`).
3. Navigate to a single-page Ekşi Sözlük topic and test `[ ⚡ Başlığı Özetle (AI) ]`.
4. Navigate to a multi-page topic (e.g. 5+ pages) and test full crawl with floating progress and background tab switching.
5. Verify desktop and in-page toast notifications upon completion.
6. Test single entry summarization on long entries (>500 chars).
7. Verify cache hit when opening previously summarized topics.
8. Commit final version adjustments.
