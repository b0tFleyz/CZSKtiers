// Guild configuration — drives navigation, data loading, and theming
const GUILD_CONFIG = {
  czsktiers: {
    name: 'CZSKTiers',
    shortName: 'CZSK',
    accent: '#eecd14',
    accentRGB: '238, 205, 20',
    sheetTab: null, // first sheet
    tierHistoryTab: 'TierHistory',
    discord: 'https://discord.gg/rAnR4hfKzw',
    kits: [
      { key: 'Crystal', slug: 'cpvp',   icon: 'cpvp.png',   label: 'Cpvp' },
      { key: 'Axe',     slug: 'axe',    icon: 'axe.png',    label: 'Axe' },
      { key: 'Sword',   slug: 'sword',  icon: 'sword.png',  label: 'Sword' },
      { key: 'UHC',     slug: 'uhc',    icon: 'uhc.png',    label: 'UHC' },
      { key: 'Npot',    slug: 'npot',   icon: 'npot.png',   label: 'Npot' },
      { key: 'Pot',     slug: 'pot',    icon: 'pot.png',    label: 'Pot' },
      { key: 'SMP',     slug: 'smp',    icon: 'smp.png',    label: 'SMP' },
      { key: 'DiaSMP',  slug: 'diasmp', icon: 'diasmp.png', label: 'DiaSMP' },
      { key: 'Mace',    slug: 'mace',   icon: 'mace.png',   label: 'Mace' }
    ]
  },
  subtiers: {
    name: 'CZSKSubtiers',
    shortName: 'Sub',
    accent: '#6366f1',
    accentRGB: '99, 102, 241',
    sheetTab: 'SubTiers',
    tierHistoryTab: 'SubTiersTierHistory',
    discord: 'https://discord.gg/B2nuJsFcqK',
    kits: [
      { key: 'Speed',      slug: 'speed',      icon: 'speed.png',      label: 'Speed' },
      { key: 'OGV',        slug: 'ogv',        icon: 'OGV.png',        label: 'OGV' },
      { key: 'Cart',       slug: 'cart',       icon: 'cart.png',       label: 'Cart' },
      { key: 'Creeper',    slug: 'creeper',    icon: 'creeper.png',    label: 'Creeper' },
      { key: 'DiaVanilla', slug: 'diavanilla', icon: 'diavanilla.png', label: 'DiaVanilla' }
    ]
  }
};

const XLSX_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTsYd1Hv8XjsdskgT2O-_Otwe3DKxXTXECPE0s4JcPwPPnLMMpknU_-y8EHNBZTtVEQgzicFKcgluSU/pub?output=xlsx';

function getActiveGuild() {
  return localStorage.getItem('activeGuild') || 'czsktiers';
}

function setActiveGuild(guildKey) {
  localStorage.setItem('activeGuild', guildKey);
}

function getGuildConf(guildKey) {
  return GUILD_CONFIG[guildKey || getActiveGuild()] || GUILD_CONFIG.czsktiers;
}

let _xlsxCache = null;
let _xlsxFetchPromise = null;
const _XLSX_CACHE_KEY = 'czsk_xlsx_v1';
const _XLSX_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function _bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function _base64ToBuf(b64) {
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}

let _workbookCache = null;

function getWorkbook() {
  if (_workbookCache) return Promise.resolve(_workbookCache);
  return fetchXLSX().then(buf => {
    if (_workbookCache) return _workbookCache;
    _workbookCache = XLSX.read(buf, { type: 'array' });
    return _workbookCache;
  });
}

function fetchXLSX() {
  if (_xlsxCache) return Promise.resolve(_xlsxCache);
  if (_xlsxFetchPromise) return _xlsxFetchPromise;

  // Check sessionStorage for a valid cached copy
  try {
    const raw = sessionStorage.getItem(_XLSX_CACHE_KEY);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < _XLSX_CACHE_TTL) {
        const buf = _base64ToBuf(data);
        _xlsxCache = buf;
        return Promise.resolve(buf);
      }
    }
  } catch (e) { /* sessionStorage unavailable or corrupt */ }

  _xlsxFetchPromise = fetch(XLSX_URL)
    .then(r => r.arrayBuffer())
    .then(buf => {
      _xlsxCache = buf;
      _xlsxFetchPromise = null;
      try {
        sessionStorage.setItem(_XLSX_CACHE_KEY, JSON.stringify({ data: _bufToBase64(buf), ts: Date.now() }));
      } catch (e) { /* storage quota exceeded, skip caching */ }
      return buf;
    });
  return _xlsxFetchPromise;
}
