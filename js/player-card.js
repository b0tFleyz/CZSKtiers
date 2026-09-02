// =====================================================================
// Vzhled karty hráče — sdílené mezi hlavní stránkou a kit stránkami
// =====================================================================
// Dřív existovala tahle logika dvakrát: v script.js (hlavní modal) a
// v js/autocomplete.js (modal na kit stránkách). Ta druhá kopie byla
// osekaná, takže karta na kit stránce vypadala jinak — chyběl banner,
// bio, oblíbený kit i dekorace avatara.
//
// Teď je to na jednom místě, takže obě karty vypadají stejně a nemůžou
// se rozejít.
(function (global) {
  'use strict';

  var _cache = {};

  function _db() {
    try { return firebase.firestore(); } catch (e) { return null; }
  }

  /** Nastavení karty z Firestore (veřejné pro kohokoli). */
  function loadCardSettings(nick) {
    if (!nick) return Promise.resolve(null);
    var key = String(nick).toLowerCase();
    if (_cache[key] !== undefined) return Promise.resolve(_cache[key]);
    var db = _db();
    if (!db) return Promise.resolve(null);
    return db.collection('cardSettings').doc(key).get()
      .then(function (doc) {
        var data = doc.exists ? doc.data() : null;
        _cache[key] = data;
        return data;
      })
      .catch(function (e) {
        console.warn('Firestore load failed:', e);
        _cache[key] = null;
        return null;
      });
  }

  var KIT_NAME_TO_ICON = {
    'Crystal': 'cpvp.png', 'Axe': 'axe.png', 'Sword': 'sword.png', 'UHC': 'uhc.png',
    'Npot': 'npot.png', 'Pot': 'pot.png', 'SMP': 'smp.png', 'DiaSMP': 'diasmp.png',
    'Mace': 'mace.png', 'Speed': 'speed.png', 'OGV': 'OGV.png', 'Cart': 'cart.png',
    'Creeper': 'creeper.png', 'DiaVanilla': 'diavanilla.png', 'Trident': 'trident.png',
    'Manhunt': 'manhunt.png', 'Elytra': 'elytra.png', 'Bow': 'bow.png',
    'Bed': 'bed.png', 'Debuff': 'debuff.png'
  };

  // kit stránky leží o adresář níž
  function assetPrefix() {
    return location.pathname.indexOf('/kits/') !== -1 ? '../' : '';
  }

  var ALLOWED_EFFECTS = ['gradient', 'rainbow', 'glitch', 'glow', 'typewriter'];
  var ALLOWED_THEMES  = ['neon', 'dark', 'retro', 'minecraft'];
  var COLOR_RE = /^#[0-9a-f]{3,8}$/i;
  var RGB_RE   = /^rgba?\s*\(/i;
  var isColor  = v => COLOR_RE.test(v) || RGB_RE.test(v);

  /** Vrátí modal do výchozího stavu — bez tohohle by na kartě zůstaly zbytky po předchozím hráči. */
  function resetCard(modal) {
    if (!modal) return;
    var content   = modal.querySelector('.player-modal-content');
    var banner    = modal.querySelector('#player-modal-banner');
    var bioEl     = modal.querySelector('#player-modal-bio');
    var nameEl    = modal.querySelector('.player-modal-name');
    var favkitEl  = modal.querySelector('#player-modal-favkit');
    var decoWrap  = modal.querySelector('#avatar-deco-wrap');
    var decoOver  = modal.querySelector('#avatar-deco-overlay');

    if (decoWrap) decoWrap.removeAttribute('data-deco');
    if (decoOver) { decoOver.style.display = 'none'; decoOver.src = ''; }
    if (nameEl)   { nameEl.className = 'player-modal-name'; nameEl.style.color = ''; }
    if (content)  { content.removeAttribute('data-theme'); content.style.borderColor = ''; }
    if (banner)   { banner.style.display = 'none'; banner.style.background = ''; }
    if (bioEl)    { bioEl.style.display = 'none'; bioEl.textContent = ''; }
    if (favkitEl) { favkitEl.style.display = 'none'; favkitEl.innerHTML = ''; }
  }

  /** Aplikuje nastavení karty na modal. `settings` může být null. */
  function applyCardSettings(modal, settings) {
    if (!modal || !settings) return;
    var content  = modal.querySelector('.player-modal-content');
    var banner   = modal.querySelector('#player-modal-banner');
    var bioEl    = modal.querySelector('#player-modal-bio');
    var nameEl   = modal.querySelector('.player-modal-name');
    var favkitEl = modal.querySelector('#player-modal-favkit');
    var decoWrap = modal.querySelector('#avatar-deco-wrap');
    var decoOver = modal.querySelector('#avatar-deco-overlay');

    // Banner — url() nepouštíme dál, aby si nikdo do karty nenačetl cizí obrázek
    if (banner && settings.banner) {
      var bannerVal = String(settings.banner);
      if (!/url\s*\(/i.test(bannerVal)) {
        banner.style.background = bannerVal;
        banner.style.display = '';
      }
    }

    var accent = String(settings.accent || '').trim();
    if (accent && isColor(accent)) {
      if (nameEl)  nameEl.style.color = accent;
      if (content) content.style.borderColor = accent + '33';
    }

    if (bioEl && settings.bio) {
      bioEl.textContent = settings.bio;   // textContent, ne innerHTML
      bioEl.style.display = '';
    }

    if (favkitEl && settings.favoriteKit) {
      var iconFile = KIT_NAME_TO_ICON[settings.favoriteKit];
      favkitEl.innerHTML = '';
      var lbl = document.createElement('span');
      lbl.className = 'favkit-label';
      lbl.textContent = 'Oblíbený kit:';
      favkitEl.appendChild(lbl);
      favkitEl.appendChild(document.createTextNode(' '));
      if (iconFile) {
        var img = document.createElement('img');
        img.className = 'favkit-icon';
        img.src = assetPrefix() + 'kit_icons/' + iconFile;
        img.alt = '';
        favkitEl.appendChild(img);
      }
      var val = document.createElement('span');
      val.className = 'favkit-value';
      val.textContent = settings.favoriteKit;
      if (accent && isColor(accent)) val.style.color = accent;
      favkitEl.appendChild(val);
      favkitEl.style.display = '';
    }

    // Dekorace avatara — jméno se sanitizuje, ať se z něj nedá poskládat cesta
    if (decoWrap && settings.decoration) {
      var safe = String(settings.decoration).replace(/[^a-zA-Z0-9_-]/g, '');
      if (safe) {
        decoWrap.setAttribute('data-deco', safe);
        if (decoOver) {
          decoOver.src = assetPrefix() + 'decorations/' + safe + '.png';
          decoOver.style.display = '';
          decoOver.onerror = function () { decoOver.style.display = 'none'; };
        }
      }
    }

    if (nameEl && settings.nameEffect && ALLOWED_EFFECTS.indexOf(settings.nameEffect) !== -1) {
      nameEl.classList.add('name-effect-' + settings.nameEffect);
      if (settings.nameEffect === 'gradient' || settings.nameEffect === 'rainbow') {
        nameEl.style.color = '';
      }
    }

    if (content && settings.theme && ALLOWED_THEMES.indexOf(settings.theme) !== -1) {
      content.setAttribute('data-theme', settings.theme);
    }
  }

  /** Načte a rovnou aplikuje — to je to, co volají obě stránky. */
  function decorate(modal, nick, fallbackSettings) {
    resetCard(modal);
    return loadCardSettings(nick).then(function (s) {
      applyCardSettings(modal, s || fallbackSettings || null);
      return s;
    });
  }

  global.CZSKCard = {
    loadCardSettings: loadCardSettings,
    applyCardSettings: applyCardSettings,
    resetCard: resetCard,
    decorate: decorate,
    KIT_NAME_TO_ICON: KIT_NAME_TO_ICON
  };
})(window);
