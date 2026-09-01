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

  var CACHE = { overall: {}, history: {} };
  var HISTORY_LOADED = {};

  function dataUrl(guild, file) {
    // kits/*.html leží o adresář níž než overall.html
    var prefix = location.pathname.indexOf('/kits/') !== -1 ? '../' : '';
    return prefix + 'data/' + guild + '/' + file;
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' -> ' + r.status);
      return r.json();
    });
  }

  // --- overall ---------------------------------------------------------
  function loadOverall(guild) {
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
    if (HISTORY_LOADED[guild]) return Promise.resolve(target);
    return fetchJson(dataUrl(guild, 'history.json')).then(function (d) {
      var iconByKit = kitIconMap(guild);
      var players = d.players || {};
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
      console.warn('[data-source] historie nedostupná pro', guild, err.message);
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
    loadOverall: loadOverall,
    hydrateHistory: hydrateHistory,
    toOverallData: toOverallData,
    kitIconMap: kitIconMap,
    isHistoryLoaded: function (guild) { return !!HISTORY_LOADED[guild]; }
  };
})(window);
