# Sponsored Entry Censoring Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Ekşi Sözlük'teki sponsorlu entry'leri tespit edip içerik ve footer'ını gizleyen, şık bir placeholder ve "Göster / Gizle" butonu sunan, ayarlar menüsünden açılıp kapatılabilen sponsorlu entry sansürleme özelliğini uygulamak.

**Architecture:** `src/content/filter.js` modülüne `applySponsoredEntryCensoring()` fonksiyonu eklenir. `src/content/content.css` içine placeholder ve buton stilleri (light/dark tema uyumlu) yazılır. `src/actions/index.html` ve `src/actions/js/popup.js` içine `censor_sponsored_entries` ayarı toggle switch ve i18n metinleriyle bağlanır. `node:test` ile DOM simülasyonu ve mantık testleri yazılır.

**Tech Stack:** Vanilla JavaScript (ES6+), Chrome Extension APIs (Storage, Runtime), CSS3, Node.js built-in test runner (`node:test`, `node:assert`).

---

### Task 1: Write Unit & DOM Simulation Tests for Sponsored Entry Censoring

**Files:**
- Create: `tests/sponsored-entry.test.js`

**Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Minimal mock DOM for Node.js test environment
class MockClassList {
  constructor() { this.classes = new Set(); }
  add(c) { this.classes.add(c); }
  remove(c) { this.classes.delete(c); }
  contains(c) { return this.classes.has(c); }
  toggle(c) { if (this.contains(c)) { this.remove(c); return false; } else { this.add(c); return true; } }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList();
    this.attributes = new Map();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.innerHTML = '';
    this.textContent = '';
    this._listeners = {};
  }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k) || null; }
  hasAttribute(k) { return this.attributes.has(k); }
  removeAttribute(k) { this.attributes.delete(k); }
  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }
  dispatchEvent(event) {
    const list = this._listeners[event.type] || [];
    for (const fn of list) fn(event);
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertBefore(newChild, refChild) {
    newChild.parentNode = this;
    const idx = this.children.indexOf(refChild);
    if (idx === -1) {
      this.children.push(newChild);
    } else {
      this.children.splice(idx, 0, newChild);
    }
    return newChild;
  }
  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) this.parentNode.children.splice(idx, 1);
      this.parentNode = null;
    }
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const results = [];
    const check = (el) => {
      let matches = false;
      if (selector === '#corporate-content-sponsored-entry' && el.id === 'corporate-content-sponsored-entry') matches = true;
      else if (selector === '.sponsored' && (el.classList.contains('sponsored') || el.className?.includes('sponsored'))) matches = true;
      else if (selector.includes('sponsored') && (el.id?.includes('sponsored') || el.className?.includes('sponsored'))) matches = true;
      else if (selector === '.content' && el.classList.contains('content')) matches = true;
      else if (selector === 'footer' && el.tagName === 'FOOTER') matches = true;
      else if (selector === '.ekstension-sponsored-blocked-placeholder' && el.classList.contains('ekstension-sponsored-blocked-placeholder')) matches = true;
      else if (selector === '.ekstension-toggle-sponsored-entry' && el.classList.contains('ekstension-toggle-sponsored-entry')) matches = true;

      if (matches && el !== this) results.push(el);
      for (const child of el.children) check(child);
    };
    check(this);
    return results;
  }
}

// Load filter.js functions
const filterCode = fs.readFileSync(path.join(__dirname, '../src/content/filter.js'), 'utf8');
const fnScope = {};
const fnWrapper = new Function('scope', 'document', `
  ${filterCode}
  scope.isSponsoredEntry = typeof isSponsoredEntry !== 'undefined' ? isSponsoredEntry : null;
  scope.applySponsoredEntryCensoring = typeof applySponsoredEntryCensoring !== 'undefined' ? applySponsoredEntryCensoring : null;
  scope.state = typeof state !== 'undefined' ? state : null;
`);

test('isSponsoredEntry: detects sponsored span inside entry', () => {
  const scope = {};
  fnWrapper(scope, new MockElement());
  assert.ok(scope.isSponsoredEntry, 'isSponsoredEntry function should be defined');

  const entry = new MockElement('li');
  const span = new MockElement('span');
  span.id = 'corporate-content-sponsored-entry';
  span.className = 'sponsored';
  entry.appendChild(span);

  assert.equal(scope.isSponsoredEntry(entry), true);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/sponsored-entry.test.js`  
Expected output: FAIL with `AssertionError: isSponsoredEntry function should be defined`

**Step 3: Commit test file**

```bash
git add tests/sponsored-entry.test.js
git commit -m "test: add failing unit tests for sponsored entry censoring"
```

---

### Task 2: Implement Sponsored Entry Censoring in `src/content/filter.js`

**Files:**
- Modify: `src/content/filter.js`

**Step 1: Implement `isSponsoredEntry` and `applySponsoredEntryCensoring`**
1. Add `censorSponsored: true` to `state` in `src/content/filter.js`.
2. Implement `isSponsoredEntry(entry)`:
   - Check `entry.querySelector('#corporate-content-sponsored-entry, .sponsored, span[id*="sponsored"]')`.
   - Also check `data-flags` or footer elements for `sponsored` identifiers.
3. Implement `applySponsoredEntryCensoring()`:
   - If `!state.censorSponsored`, find all `.ekstension-sponsored-blocked-placeholder` elements, remove them, and restore `content.style.display = ''` and `footer.style.display = ''`.
   - For all `#entry-item-list > li` (and standalone `li[data-id]`):
     - If `isSponsoredEntry(entry)`:
       - Check if already blocked by author blocker (`entry.querySelector('.ekstension-author-blocked-placeholder')`); if so, leave it to author blocker.
       - Extract author: `entry.getAttribute('data-author') || entry.querySelector('.entry-author')?.textContent?.trim() || 'sponsorlu'`.
       - Hide `.content` (`content.style.display = 'none'`) and `footer` (`footer.style.display = 'none'`).
       - If placeholder does not exist, create:
         ```html
         <div class="ekstension-sponsored-blocked-placeholder" data-ekstension-processed="true">
           <div class="ekstension-sponsored-info">
             <span class="ekstension-sponsored-icon">📢</span>
             <span>Sponsorlu içerik gizlendi (<strong class="ekstension-author-name">@${author}</strong>)</span>
             <span class="ekstension-sponsored-badge">sponsorlu</span>
           </div>
           <div class="ekstension-placeholder-actions">
             <button class="ekstension-toggle-sponsored-entry" type="button">Göster</button>
           </div>
         </div>
         ```
       - Bind click on `.ekstension-toggle-sponsored-entry`: toggle `content.style.display` and `footer.style.display` between `'none'` and `''`, updating button text between `'Göster'` and `'Gizle'`.
4. Connect into `runAllEnhancements()` and initial storage load `chrome.storage.sync.get('censor_sponsored_entries', ...)` with fallback to `true`.
5. Listen for storage changes: `chrome.storage.onChanged.addListener` for `censor_sponsored_entries`.
6. Export `isSponsoredEntry` and `applySponsoredEntryCensoring` if `typeof module !== 'undefined'`.

**Step 2: Run tests to verify they pass**

Run: `node --test tests/sponsored-entry.test.js`  
Expected output: All tests PASS.

Run: `node --test tests/ai-summary-bkz.test.js`  
Expected output: All 8 existing tests PASS.

**Step 3: Commit**

```bash
git add src/content/filter.js
git commit -m "feat(filter): implement sponsored entry detection and censoring"
```

---

### Task 3: Add CSS Styles in `src/content/content.css`

**Files:**
- Modify: `src/content/content.css`

**Step 1: Write styling matching existing design language**

```css
/* --- Ekşi Sözlük In-Page Tool: Sponsored Entry Censor --- */
.ekstension-sponsored-blocked-placeholder {
  background: rgba(0, 0, 0, 0.03);
  border: 1px dashed #d1d5db;
  border-radius: 4px;
  padding: 8px 12px;
  margin: 6px 0;
  font-size: 12px;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.ekstension-sponsored-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ekstension-sponsored-icon {
  font-size: 13px;
}

.ekstension-sponsored-badge {
  background: #fef3c7;
  color: #92400e;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid #fde68a;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.ekstension-toggle-sponsored-entry {
  background: none;
  border: 1px solid #bbb;
  border-radius: 3px;
  padding: 2px 8px;
  font-size: 11px;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.ekstension-toggle-sponsored-entry:hover {
  background: #e0e0e0;
  color: #111;
}

/* Ekşi Sözlük Dark Mode Compatibility */
body.theme-dark .ekstension-sponsored-blocked-placeholder,
body[data-theme="dark"] .ekstension-sponsored-blocked-placeholder {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.15);
  color: #aaa;
}

body.theme-dark .ekstension-sponsored-badge,
body[data-theme="dark"] .ekstension-sponsored-badge {
  background: rgba(120, 53, 15, 0.4);
  color: #fde68a;
  border-color: rgba(245, 158, 11, 0.3);
}

body.theme-dark .ekstension-toggle-sponsored-entry,
body[data-theme="dark"] .ekstension-toggle-sponsored-entry {
  border-color: #444;
  color: #ccc;
}

body.theme-dark .ekstension-toggle-sponsored-entry:hover,
body[data-theme="dark"] .ekstension-toggle-sponsored-entry:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
```

**Step 2: Verify CSS and commit**

```bash
git add src/content/content.css
git commit -m "style: add light and dark mode styles for sponsored entry placeholder"
```

---

### Task 4: Add Toggle Setting to Popup UI & Localization

**Files:**
- Modify: `_locales/tr/messages.json`
- Modify: `_locales/en/messages.json`
- Modify: `src/actions/index.html`
- Modify: `src/actions/js/popup.js`

**Step 1: Add i18n keys**
- `_locales/tr/messages.json`:
  ```json
  "censor_sponsored_label": {
    "message": "Sponsorlu Entry'leri Sansürle",
    "description": "Label for censoring sponsored entries toggle"
  },
  "censor_sponsored_desc": {
    "message": "Sponsorlu ve reklam içerikli entry'leri gizler ve tıklayınca açılır hale getirir.",
    "description": "Description for censoring sponsored entries toggle"
  }
  ```
- `_locales/en/messages.json`:
  ```json
  "censor_sponsored_label": {
    "message": "Censor Sponsored Entries",
    "description": "Label for censoring sponsored entries toggle"
  },
  "censor_sponsored_desc": {
    "message": "Collapses sponsored and commercial entries with a click-to-expand placeholder.",
    "description": "Description for censoring sponsored entries toggle"
  }
  ```

**Step 2: Add toggle element in `src/actions/index.html`**
Under Settings -> General tab, add:
```html
<div class="settings-group">
    <label class="toggle-setting-label" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
        <span style="display: flex; align-items: center; gap: 6px;">
            <span class="material-icons" style="font-size: 18px; color: #f59e0b;">campaign</span>
            <span data-i18n="censor_sponsored_label">Sponsorlu Entry'leri Sansürle</span>
        </span>
        <input type="checkbox" id="censor-sponsored-toggle" checked style="cursor: pointer;">
    </label>
    <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 24px; line-height: 1.3;" data-i18n="censor_sponsored_desc">
        Sponsorlu ve reklam içerikli entry'leri gizler ve tıklayınca açılır hale getirir.
    </p>
</div>
```

**Step 3: Handle toggle in `src/actions/js/popup.js`**
- In `loadSettings()`: read `censor_sponsored_entries` (default: `true`), set `#censor-sponsored-toggle.checked`.
- Add change listener on `#censor-sponsored-toggle`: save to `chrome.storage.sync` (or `storage.js`).

**Step 4: Commit**

```bash
git add _locales/tr/messages.json _locales/en/messages.json src/actions/index.html src/actions/js/popup.js
git commit -m "feat(settings): add toggle switch and i18n for censoring sponsored entries"
```

---

### Task 5: End-to-End Verification

**Step 1: Run all test suites**
Run: `node --test tests/*.test.js`  
Expected output: All test suites PASS.

**Step 2: Verify user's exact sample entry HTML in tests**
Ensure the exact snippet from user's request (`<span id="corporate-content-sponsored-entry" class="sponsored">sponsorlu</span>` inside entry `li[data-author="timurun fillerinin bakicisi"]`) is tested.

**Step 3: Commit and summarize**
Review git diff and commit any final adjustments.
