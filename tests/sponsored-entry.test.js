const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Minimal mock DOM for testing content script in Node.js
class MockClassList {
  constructor(initial = []) {
    this.classes = new Set(initial);
  }
  add(...tokens) { tokens.forEach(t => this.classes.add(t)); }
  remove(...tokens) { tokens.forEach(t => this.classes.delete(t)); }
  contains(t) { return this.classes.has(t); }
  toggle(t, force) {
    if (force !== undefined) {
      if (force) { this.classes.add(t); return true; }
      else { this.classes.delete(t); return false; }
    }
    if (this.contains(t)) { this.remove(t); return false; }
    else { this.add(t); return true; }
  }
  toString() { return Array.from(this.classes).join(' '); }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList();
    this.attributes = new Map();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this._listeners = {};
    this.id = '';
  }

  get className() {
    return this.classList.toString();
  }
  set className(val) {
    this.classList = new MockClassList((val || '').split(/\s+/).filter(Boolean));
  }

  get textContent() {
    if (this._textContent !== undefined) return this._textContent;
    return this.children.map(c => c.textContent).join('');
  }
  set textContent(val) {
    this._textContent = val;
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML || '';
  }
  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    if (html.includes('ekstension-toggle-sponsored-entry')) {
      const toggleBtn = new MockElement('button');
      toggleBtn.className = 'ekstension-toggle-sponsored-entry';
      const icon = new MockElement('span');
      icon.className = 'ekst-toggle-icon';
      icon.textContent = '👁️';
      const label = new MockElement('span');
      label.className = 'ekst-toggle-label';
      label.textContent = 'İçeriği Göster';
      toggleBtn.appendChild(icon);
      toggleBtn.appendChild(label);
      this.appendChild(toggleBtn);
    }
  }

  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k) || null; }
  hasAttribute(k) { return this.attributes.has(k); }
  removeAttribute(k) { this.attributes.delete(k); }

  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }
  click() {
    if (this.onclick) this.onclick({ preventDefault() {}, stopPropagation() {} });
    const list = this._listeners['click'] || [];
    for (const fn of list) fn({ preventDefault() {}, stopPropagation() {} });
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
      const selectors = selector.split(',').map(s => s.trim());
      for (const sel of selectors) {
        if (sel.startsWith('#') && el.id === sel.slice(1)) matches = true;
        else if (sel.startsWith('.') && el.classList.contains(sel.slice(1))) matches = true;
        else if (sel.includes('[id*="sponsored"]') && el.id && el.id.includes('sponsored')) matches = true;
        else if (sel === 'footer' && el.tagName === 'FOOTER') matches = true;
        else if (sel === '.content' && el.classList.contains('content')) matches = true;
        else if (sel === '.ekstension-sponsored-blocked-placeholder' && el.classList.contains('ekstension-sponsored-blocked-placeholder')) matches = true;
        else if (sel === '.ekstension-toggle-sponsored-entry' && el.classList.contains('ekstension-toggle-sponsored-entry')) matches = true;
        else if (sel === '.ekst-toggle-label' && el.classList.contains('ekst-toggle-label')) matches = true;
        else if (sel === '.ekst-toggle-icon' && el.classList.contains('ekst-toggle-icon')) matches = true;
      }

      if (matches && el !== this) results.push(el);
      for (const child of el.children) check(child);
    };
    check(this);
    return results;
  }
}

// Load filter.js
const filterCode = fs.readFileSync(path.join(__dirname, '../src/content/filter.js'), 'utf8');

function getFilterScope(mockDoc) {
  const scope = {};
  const dummyWindow = { location: { origin: 'https://eksisozluk.com', protocol: 'https:' }, addEventListener: () => {} };
  const dummyChrome = {
    runtime: { sendMessage: () => {}, onMessage: { addListener: () => {} } },
    storage: { sync: { get: () => {}, set: () => {} }, local: { get: () => {}, set: () => {} }, onChanged: { addListener: () => {} } }
  };

  class MockMutationObserver {
    constructor(cb) { this.cb = cb; }
    observe() {}
    disconnect() {}
  }

  if (!mockDoc.createElement) {
    mockDoc.createElement = (tag) => new MockElement(tag);
  }
  if (!mockDoc.getElementById) {
    mockDoc.getElementById = (id) => mockDoc.querySelector('#' + id);
  }

  const fnWrapper = new Function('scope', 'document', 'window', 'chrome', 'MutationObserver', `
    ${filterCode}
    scope.isSponsoredEntry = typeof isSponsoredEntry !== 'undefined' ? isSponsoredEntry : null;
    scope.applySponsoredEntryCensoring = typeof applySponsoredEntryCensoring !== 'undefined' ? applySponsoredEntryCensoring : null;
    scope.state = typeof state !== 'undefined' ? state : null;
  `);

  fnWrapper(scope, mockDoc, dummyWindow, dummyChrome, MockMutationObserver);
  return scope;
}

test('isSponsoredEntry: detects sponsored span with id corporate-content-sponsored-entry', () => {
  const mockDoc = new MockElement();
  const scope = getFilterScope(mockDoc);

  assert.ok(scope.isSponsoredEntry, 'isSponsoredEntry function should be defined');

  const entry = new MockElement('li');
  entry.setAttribute('data-id', '187159841');
  entry.setAttribute('data-author', 'timurun fillerinin bakicisi');

  const content = new MockElement('div');
  content.className = 'content';
  content.textContent = 'reklam içerikli metin';
  entry.appendChild(content);

  const footer = new MockElement('footer');
  const spanSponsored = new MockElement('span');
  spanSponsored.id = 'corporate-content-sponsored-entry';
  spanSponsored.className = 'sponsored';
  spanSponsored.textContent = 'sponsorlu';
  footer.appendChild(spanSponsored);
  entry.appendChild(footer);

  assert.equal(scope.isSponsoredEntry(entry), true);
});

test('isSponsoredEntry: returns false for regular non-sponsored entry', () => {
  const mockDoc = new MockElement();
  const scope = getFilterScope(mockDoc);

  const entry = new MockElement('li');
  entry.setAttribute('data-id', '123456');
  entry.setAttribute('data-author', 'normal yazar');

  const content = new MockElement('div');
  content.className = 'content';
  content.textContent = 'siradan bir entry';
  entry.appendChild(content);

  const footer = new MockElement('footer');
  entry.appendChild(footer);

  assert.equal(scope.isSponsoredEntry(entry), false);
});

test('applySponsoredEntryCensoring: collapses sponsored entry and creates placeholder', () => {
  const mockDoc = new MockElement();
  const entryList = new MockElement('ul');
  entryList.id = 'entry-item-list';
  mockDoc.appendChild(entryList);

  // Mock document querySelector to find entry-item-list
  mockDoc.querySelector = (sel) => {
    if (sel.includes('#entry-item-list')) return entryList;
    return MockElement.prototype.querySelector.call(mockDoc, sel);
  };
  mockDoc.querySelectorAll = (sel) => {
    if (sel.includes('#entry-item-list > li') || sel.includes('#entry-item-list li')) {
      return entryList.children;
    }
    return MockElement.prototype.querySelectorAll.call(mockDoc, sel);
  };

  const scope = getFilterScope(mockDoc);
  assert.ok(scope.applySponsoredEntryCensoring, 'applySponsoredEntryCensoring function should be defined');

  const entry = new MockElement('li');
  entry.setAttribute('data-id', '187159841');
  entry.setAttribute('data-author', 'timurun fillerinin bakicisi');

  const content = new MockElement('div');
  content.className = 'content';
  content.textContent = 'sponsorlu yazi';
  entry.appendChild(content);

  const footer = new MockElement('footer');
  const span = new MockElement('span');
  span.id = 'corporate-content-sponsored-entry';
  span.className = 'sponsored';
  footer.appendChild(span);
  entry.appendChild(footer);

  entryList.appendChild(entry);

  // Run censoring
  scope.state.censorSponsored = true;
  scope.applySponsoredEntryCensoring();

  // Verify content and footer are hidden
  assert.equal(content.style.display, 'none');
  assert.equal(footer.style.display, 'none');

  // Verify placeholder was inserted
  const placeholder = entry.querySelector('.ekstension-sponsored-blocked-placeholder');
  assert.ok(placeholder, 'Placeholder should be inserted into entry');

  // Verify toggle button click reveals content
  const toggleBtn = placeholder.querySelector('.ekstension-toggle-sponsored-entry');
  assert.ok(toggleBtn, 'Toggle button should exist');
  assert.match(toggleBtn.textContent, /Göster/);
  assert.equal(placeholder.classList.contains('is-collapsed'), true);

  toggleBtn.click();
  assert.equal(content.style.display, '');
  assert.equal(footer.style.display, '');
  assert.match(toggleBtn.textContent, /Gizle/);
  assert.equal(placeholder.classList.contains('is-expanded'), true);

  toggleBtn.click();
  assert.equal(content.style.display, 'none');
  assert.equal(footer.style.display, 'none');
  assert.match(toggleBtn.textContent, /Göster/);
  assert.equal(placeholder.classList.contains('is-collapsed'), true);

  // Verify disabling setting restores entry
  scope.state.censorSponsored = false;
  scope.applySponsoredEntryCensoring();
  assert.equal(content.style.display, '');
  assert.equal(footer.style.display, '');
  assert.equal(entry.querySelector('.ekstension-sponsored-blocked-placeholder'), null);
});

test('applySponsoredEntryCensoring: correctly handles user prompt example (timurun fillerinin bakicisi)', () => {
  const mockDoc = new MockElement();
  const entryList = new MockElement('ul');
  entryList.id = 'entry-item-list';
  mockDoc.appendChild(entryList);

  mockDoc.querySelector = (sel) => {
    if (sel.includes('#entry-item-list')) return entryList;
    return MockElement.prototype.querySelector.call(mockDoc, sel);
  };
  mockDoc.querySelectorAll = (sel) => {
    if (sel.includes('#entry-item-list > li') || sel.includes('#entry-item-list li')) {
      return entryList.children;
    }
    return MockElement.prototype.querySelectorAll.call(mockDoc, sel);
  };

  const scope = getFilterScope(mockDoc);

  // User exact sample structure
  const entry = new MockElement('li');
  entry.id = 'entry-item';
  entry.setAttribute('data-id', '187159841');
  entry.setAttribute('data-author', 'timurun fillerinin bakicisi');
  entry.setAttribute('data-author-id', '3592824');
  entry.setAttribute('data-flags', 'share report vote');

  const content = new MockElement('div');
  content.className = 'content';
  content.textContent = 'olayın videosu elinde olta olan çocuğun...';
  entry.appendChild(content);

  const footer = new MockElement('footer');
  const span = new MockElement('span');
  span.id = 'corporate-content-sponsored-entry';
  span.className = 'sponsored';
  span.textContent = 'sponsorlu';
  footer.appendChild(span);
  entry.appendChild(footer);

  entryList.appendChild(entry);

  assert.equal(scope.isSponsoredEntry(entry), true);

  scope.state.censorSponsored = true;
  scope.applySponsoredEntryCensoring();

  assert.equal(content.style.display, 'none');
  assert.equal(footer.style.display, 'none');

  const placeholder = entry.querySelector('.ekstension-sponsored-blocked-placeholder');
  assert.ok(placeholder, 'Placeholder should be inserted');
});

