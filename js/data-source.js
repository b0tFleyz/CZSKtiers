// =====================================================================
// Data source — načítá snapshoty vygenerované botem, s fallbackem na XLSX
// =====================================================================
// Bot generuje data/<guild>/overall.json + history.json (viz bot/publish-snapshot.js).
// Hlavní stránka potřebuje JEN overall.json (~74 KB gzip); historie se stahuje
// až když si někdo otevře kartu, graf nebo porovnání.
//
// Když snapshot chybí (bot neběžel, nasazení bez dat), spadne se zpátky na
// původní cestu přes celý XLSX workbook — stránka se tedy nikdy nerozbije.
(function (global) {
  'use strict';

  // =====================================================================
  //  PŘEPÍNAČ ZDROJE DAT  — tohle je jediný řádek, který se mění
  // =====================================================================
  //  false = ber data z XLSX (Google Sheets)   ← teď
  //  true  = ber data ze snapshotu od bota     ← až bude historie kompletní
  //
  //  Proč zatím XLSX: bot má v tierHistory.json historii jen pro ~68 %
  //  hráčů (to, co sám zapsal). List TierHistory v tabulce je bohatší,
  //  protože do něj napadaly i starší výsledky. Než se doplní
  //  (import-sheet-history.js + backfill-fights.js), je XLSX úplnější.
  //
  //  Otestovat druhou cestu bez přepínání souboru:
  //      ?data=snapshot   nebo   ?data=xlsx      v URL
  var DEFAULT_USE_SNAPSHOT = true;

  var USE_SNAPSHOT = (function () {
    try {
      var q = new URLSearchParams(location.search).get('data');
      if (q === 'snapshot') return true;
      if (q === 'xlsx') return false;
    } catch (e) { /* starý prohlížeč */ }
    return DEFAULT_USE_SNAPSHOT;
  })();

  var CACHE = { overall: {}, history: {} };
  var HISTORY_LOADED = {};

  function dataUrl(guild, file) {
    // kits/*.html leží o adresář níž než overall.html
    var prefix = location.pathname.indexOf('/kits/') !== -1 ? '../' : '';
    return prefix + 'data/' + guild + '/' + file;
  }

  // 404 tady NENÍ chyba — na GitHub Pages data od bota prostě nejsou a web
  // korektně spadne na XLSX. Nechceme kvůli tomu červený error v konzoli.
  var _missing = {};
  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (r.status === 404) {
        if (!_missing[url]) {
          _missing[url] = true;
          console.info('[data] ' + url + ' není k dispozici — používám XLSX (pomalejší).');
        }
        var e = new Error('missing'); e.missing = true; throw e;
      }
      if (!r.ok) throw new Error(url + ' -> ' + r.status);
      return r.json();
    });
  }

  // --- overall ---------------------------------------------------------
  function loadOverall(guild) {
    // Vypnuto → tvař se, že snapshot není. Volající (script.js, kit-renderer.js,
    // autocomplete.js) na to už umí zareagovat pádem zpátky na XLSX.
    if (!USE_SNAPSHOT) {
      var e = new Error('snapshot vypnutý'); e.missing = true;
      return Promise.reject(e);
    }
    if (CACHE.overall[guild]) return Promise.resolve(CACHE.overall[guild]);
    return fetchJson(dataUrl(guild, 'overall.json')).then(function (d) {
      CACHE.overall[guild] = d;
      return d;
    });
  }

  // --- history (lazy) --------------------------------------------------
  // Naplní `target` ve tvaru, jaký používá zbytek webu:
  //   target[discordId][kitIcon] = [{ tier, date, note, kit, oldTier, ts, _rowIdx }]
  var _rowIdx = 0;
  function hydrateHistory(guild, target) {
    if (!USE_SNAPSHOT) return Promise.resolve(target);
    if (HISTORY_LOADED[guild]) return Promise.resolve(target);
    return fetchJson(dataUrl(guild, 'history.json')).then(function (d) {
      var iconByKit = kitIconMap(guild);
      var players = d.players || {};
      // Nicky soupeřů, kteří nejsou v overall.json — bez nich by se u soubojů
      // zobrazovalo jen "neznámý hráč".
      // Pozor na `global.` — driv se tu sahalo na holy identifikator
      // discordIdToNick, ktery ale nikdy nebyl globalni (script.js ho ma
      // schovany v DOMContentLoaded). Podminka tim padem nikdy neprosla
      // a nicky soupreu se zahazovaly.
      if (d.nicks) {
        global.discordIdToNick = global.discordIdToNick || {};
        Object.keys(d.nicks).forEach(function (id) {
          if (!global.discordIdToNick[id]) global.discordIdToNick[id] = d.nicks[id];
        });
      }
      Object.keys(players).forEach(function (did) {
        players[did].forEach(function (e) {
          var icon = iconByKit[e.kit];
          if (!icon) return;
          if (!target[did]) target[did] = {};
          if (!target[did][icon]) target[did][icon] = [];
          target[did][icon].push({
            tier: e.tier,
            oldTier: e.old,
            note: e.v,
            kit: e.kit,
            date: e.d,          // ms — parseCzechDate umí i číslo
            ts: e.d,
            fights: e.f || null,      // průběh testu (skóre po soubojích)
            opponents: e.opp || null, // ID soupeřů (i u starších záznamů bez skóre)
            _rowIdx: _rowIdx++
          });
        });
      });
      HISTORY_LOADED[guild] = true;
      return target;
    }).catch(function (err) {
      if (!err.missing) console.warn('[data-source] historie nedostupná pro', guild, err.message);
      return target;
    });
  }

  function kitIconMap(guild) {
    var map = {};
    if (typeof getGuildConf === 'function') {
      var conf = getGuildConf(guild);
      (conf && conf.kits ? conf.kits : []).forEach(function (k) {
        map[k.key] = 'kit_icons/' + k.icon;
      });
    }
    return map;
  }

  // --- převod snapshotu do tvaru, který zbytek script.js očekává -------
  // overallData[i] = { uuid, nick, discordId, score, tiers:[{tier,icon,peakTierText}],
  //                    hallOfFame, tester, allTestedIcons:Set, firstDate }
  function toOverallData(snapshot, guild, otherSnapshot) {
    var iconByKit = kitIconMap(guild);
    var otherIcons = kitIconMap(guild === 'subtiers' ? 'czsktiers' : 'subtiers');
    var kits = snapshot.kits || [];

    return (snapshot.players || []).map(function (p) {
      var tiers = kits.map(function (kitKey) {
        var t = p.tiers[kitKey] || {};
        return {
          // zbytek kódu čte `tier` jako číselnou hodnotu (parseInt)
          tier: (t.pts != null && t.pts !== 0) ? String(t.pts) : (t.pts === 0 ? '0' : undefined),
          icon: iconByKit[kitKey],
          tierCode: t.t || null,
          // peakTierText se nastavuje JEN když peak reálně zvedá skóre —
          // stejná podmínka jako dřív, ale rozhodnutí dělá bot (t.peakBoost)
          peakTierText: t.peakBoost || null,
          peak: t.peak || null,
          canRetire: !!t.canRetire,
          pending: t.pending || null
        };
      });

      var tested = new Set();
      (p.tested || []).forEach(function (k) { if (iconByKit[k]) tested.add(iconByKit[k]); });
      (p.crossTested || []).forEach(function (k) { if (otherIcons[k]) tested.add(otherIcons[k]); });

      return {
        uuid: p.uuid || null,
        nick: p.nick,
        discordId: p.id,
        score: p.score || 0,
        tiers: tiers,
        hallOfFame: !!p.hof,
        tester: !!p.tester,
        allTestedIcons: tested,
        firstDate: p.first || null
      };
    });
  }

  global.CZSKData = {
    usingSnapshot: function () { return USE_SNAPSHOT; },
    loadOverall: loadOverall,
    hydrateHistory: hydrateHistory,
    toOverallData: toOverallData,
    kitIconMap: kitIconMap,
    isHistoryLoaded: function (guild) { return !!HISTORY_LOADED[guild]; }
  };
})(window);
