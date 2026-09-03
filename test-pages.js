#!/usr/bin/env node
/**
 * Nacte skripty obou stranek ve stejnem poradi jako prohlizec a overi,
 * ze sdilene moduly opravdu existuji.
 *
 * PROC: soubory na sebe zavisi pres globaly a uz dvakrat se stalo, ze po
 * rozdeleni kodu neco chybelo a stranka se rozbila az u uzivatele:
 *   - _pEsc zustalo schovane ve script.js (uvnitr DOMContentLoaded), takze
 *     Tier Journey padala hned, jak mel hrac peak
 *   - discordIdToNick nebylo globalni, takze se nicky soupreu z history.json
 *     tise zahazovaly a u souboju svitilo "neznamy hrac"
 *
 * Kdyz pridas sdileny modul nebo presunes funkci mezi soubory, PUST TOHLE.
 *
 *   node test-pages.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = __dirname;

let pass = 0, fail = 0;
const ok = (l, c, d) => c ? (pass++, console.log('  OK   ' + l))
                          : (fail++, console.log('  FAIL ' + l + (d ? '\n         ' + d : '')));

function el(tag) {
  const e = {
    tagName: tag, children: [],
    style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    className: '', _html: '', _text: '', _q: {},
    setAttribute(k, v) { e[k] = v; }, getAttribute(k) { return e[k] || null; },
    appendChild(c) { e.children.push(c); return c; }, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, contains: () => false, focus() {}, blur() {},
    querySelector(s) { return e._q[s] || (e._q[s] = el('div')); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 700, height: 340 }; },
    insertAdjacentHTML() {}, scrollIntoView() {}, insertBefore(n){e.children.push(n);return n;},
    replaceChild(){}, cloneNode(){return el(tag);}, closest(){return null;}, matches(){return false;},
    setAttributeNS(){}, hasAttribute(){return false;}, removeAttribute(){}, click(){}, submit(){},
    firstChild:null, lastChild:null, parentNode:null, nextSibling:null, offsetWidth:100, offsetHeight:40,
    get innerHTML() { return e._html; }, set innerHTML(v) { e._html = String(v); },
    get textContent() { return e._text; }, set textContent(v) { e._text = String(v); }
  };
  return e;
}

function makeCtx(pathname) {
  const ready = [];
  const doc = {
    readyState: 'loading',
    getElementById: () => el('div'),
    querySelector: () => el('div'),
    querySelectorAll: () => [],
    createElement: el, createElementNS: (n, t) => el(t),
    addEventListener(ev, fn) { if (ev === 'DOMContentLoaded') ready.push(fn); },
    body: el('body'), head: el('head'), documentElement: el('html'),
    cookie: ''
  };
  const ctx = vm.createContext({});
  ctx.window = ctx; ctx.global = ctx; ctx.self = ctx;
  ctx.document = doc; ctx.console = { log() {}, warn() {}, error() {}, info() {} };
  ctx.location = { search: '', pathname, href: 'https://x' + pathname, hash: '' };
  ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  ctx.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  ctx.navigator = { userAgent: 'node' };
  ctx.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  ctx.setTimeout = setTimeout; ctx.clearTimeout = clearTimeout;
  ctx.setInterval = () => 0; ctx.clearInterval = () => {};
  ctx.requestAnimationFrame = fn => setTimeout(fn, 0);
  ctx.XLSX = { read: () => ({ SheetNames: [], Sheets: {} }), utils: { sheet_to_json: () => [] } };
  ctx.firebase = { initializeApp() {}, auth: () => ({ onAuthStateChanged() {}, currentUser: null }),
                   firestore: () => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false }) }) }) }) };
  ctx.IntersectionObserver = class { observe() {} disconnect() {} };
  ctx.performance = { now: () => 0 };
  ctx.URLSearchParams = URLSearchParams;
  ctx._ready = ready;
  return ctx;
}

const PAGES = {
  'hlavni stranka (overall.html)': ['js/guild-config.js','js/tier-utils.js','js/data-source.js',
      'js/player-count.js','js/firebase-config.js','js/auth.js','js/player-card.js',
      'js/tier-journey-view.js','script.js'],
  'kit stranka (kits/sword.html)': ['js/guild-config.js','js/tier-utils.js','js/data-source.js',
      'js/player-count.js','js/firebase-config.js','js/auth.js','js/player-card.js',
      'js/tier-journey-view.js','js/autocomplete.js','js/kit-renderer.js']
};

for (const [name, files] of Object.entries(PAGES)) {
  console.log('\n=== ' + name + ' ===');
  const ctx = makeCtx(name.includes('kit') ? '/kits/sword.html' : '/overall.html');
  let boom = null;
  for (const f of files) {
    const p = path.join(WEB, f);
    if (!fs.existsSync(p)) continue;
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
    catch (e) { if (!boom) boom = f + ': ' + e.message; }   // pokracuj, at vidim i dalsi soubory
  }
  ok('vsechny skripty se nactou', !boom, boom);

  // spust DOMContentLoaded (script.js ma v nem cely obsah)
  let readyErr = null;
  for (const fn of ctx._ready) { try { fn(); } catch (e) { readyErr = e.message; } }
  ok('DOMContentLoaded projde', !readyErr, readyErr);

  ok('CZSKCard.renderTierBadges k dispozici',
     ctx.CZSKCard && typeof ctx.CZSKCard.renderTierBadges === 'function');
  ok('CZSKJourney k dispozici', ctx.CZSKJourney && typeof ctx.CZSKJourney.open === 'function');
  ok('showTierJourney k dispozici', typeof ctx.showTierJourney === 'function');
  ok('discordIdToNick je globalni mapa', ctx.discordIdToNick && typeof ctx.discordIdToNick === 'object');
  ok('PEAK_TIER_SCORE k dispozici',
     vm.runInContext('typeof PEAK_TIER_SCORE', ctx) === 'object');

  // Kazdy peak tier musi jit prevest na nazev pres resolveTierValue() ->
  // tierInfo(). Odznak v porovnani hracu tuhle cestu pouziva; kdyz se do
  // PEAK_TIER_SCORE dostane klic, ktery resolveTierValue nezna, ukaze se
  // v modalu holé cislo misto tieru (presne to delalo HT3 s body 14).
  var peaks = vm.runInContext('PEAK_TIER_SCORE', ctx);
  Object.keys(peaks).forEach(function (name) {
    var val = ctx.resolveTierValue(name);
    var shown = val ? ctx.tierInfo(String(val)).novyText : null;
    ok('peak ' + name + ' (' + peaks[name] + ' bodu) se zobrazi jako "' + name + '"',
       shown === name);
  });

  // odznaky se opravdu vykresli
  let html = '';
  try {
    html = ctx.CZSKCard.renderTierBadges(
      [{ tier: '32', icon: 'kit_icons/sword.png', peakTierText: 'HT2' }],
      { prefix: name.includes('kit') ? '../' : '' });
  } catch (e) { html = 'CHYBA: ' + e.message; }
  ok('odznak kitu se vykresli', html.indexOf('kit-badge') !== -1, html.slice(0, 120));
}

console.log('\n' + (fail ? 'FAIL' : 'OK') + ': ' + pass + ' proslo, ' + fail + ' selhalo');
process.exit(fail ? 1 : 0);
