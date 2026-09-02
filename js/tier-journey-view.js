// =====================================================================
// Tier Journey — JEDNA implementace pro hlavní stránku i pro kit stránky
// =====================================================================
// Dřív to bylo dvakrát: script.js (hlavní stránka) a js/tierjourney.js
// (kit stránky). Kopie na kit stránkách zaostala — ukazovala datum jako holé
// číslo (ms timestamp), měla starou geometrii grafu, neuměla kliknout na tečku
// pro detail soubojů, neuměla peak/retire pruh a historii si tahala z XLSX
// i ve chvíli, kdy zbytek webu už četl snapshot.
//
// Stejná chyba se tu jednou stala u karty hráče (player-card.js) — proto to
// tentokrát žije na jednom místě a stránky si jen řeknou, odkud brát data:
//
//   CZSKJourney.configure({ getHistory, getTierEntry, nickOf });
//   window.showTierJourney(nick, kitIcon, tierValue, discordId);
//
// Bez configure() to funguje taky — použije se prázdná historie, takže se graf
// aspoň neshodí.
(function (global) {
    'use strict';

    // Výchozí zdroje: nic. Stránka si je přepíše přes configure().
    var SRC = {
        getHistory:   function () { return []; },
        getTierEntry: function () { return null; },
        nickOf:       function () { return null; }
    };

    function getKitNameFromIcon(icon) {
        const map = {
            'kit_icons/cpvp.png':   'Crystal PvP',
            'kit_icons/axe.png':    'Axe',
            'kit_icons/sword.png':  'Sword',
            'kit_icons/uhc.png':    'UHC',
            'kit_icons/npot.png':   'NPot',
            'kit_icons/pot.png':    'Pot',
            'kit_icons/smp.png':    'SMP',
            'kit_icons/diasmp.png': 'DiaSMP',
            'kit_icons/mace.png':   'Mace',
            'kit_icons/speed.png':      'Speed',
            'kit_icons/OGV.png':        'OGV',
            'kit_icons/cart.png':       'Cart',
            'kit_icons/creeper.png':    'Creeper',
            'kit_icons/diavanilla.png': 'DiaVanilla',
            'kit_icons/trident.png':    'Trident',
            'kit_icons/manhunt.png':    'Manhunt',
            'kit_icons/elytra.png':     'Elytra',
            'kit_icons/bow.png':        'Bow',
            'kit_icons/bed.png':        'Bed',
            'kit_icons/debuff.png':     'Debuff'
        };
        return map[icon] || icon;
    }

    function escapeXml(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // Y index (0 = HT1 best, 9 = LT5 worst) for each tier value
    const TIER_Y_IDX = {
        '60':0,'48':1,'32':2,'24':3,'16':4,'10':5,'5':6,'3':7,'2':8,'1':9,
        '54':0,'43':1,'29':2,'22':3
    };
    const TIER_Y_LABELS = [
        { label:'HT1', val:'60' }, { label:'LT1', val:'48' },
        { label:'HT2', val:'32' }, { label:'LT2', val:'24' },
        { label:'HT3', val:'16' }, { label:'LT3', val:'10' },
        { label:'HT4', val:'5'  }, { label:'LT4', val:'3'  },
        { label:'HT5', val:'2'  }, { label:'LT5', val:'1'  }
    ];

    // Datum k zobrazení — zvládne ms timestamp i starý "D. M. YYYY" řetězec.
    function _journeyDateLabel(h) {
        const ts = h.ts || (typeof h.date === 'number' ? h.date : parseCzechDate(h.date));
        if (ts) return new Date(ts).toLocaleDateString('cs-CZ');
        return typeof h.date === 'string' ? h.date : '';
    }

    // Peak / retire pruh pro JEDEN kit — stejná data jako na kartě hráče,
    // jen zúžená na kit, jehož journey je zrovna otevřená.
    function renderJourneyPeak(container, tierEntry) {
        if (!container) return;
        if (!tierEntry || (!tierEntry.peak && !tierEntry.pending)) {
            container.innerHTML = ''; container.style.display = 'none'; return;
        }
        const parts = [];
        if (tierEntry.peak) {
            parts.push('<span class="peak-locked' + (tierEntry.canRetire ? ' peak-retire-ok' : '') + '">'
                + 'Peak <b>' + _pEsc(tierEntry.peak) + '</b>'
                + (tierEntry.canRetire ? ' \u00B7 retire mo\u017En\u00FD' : '') + '</span>');
        }
        if (tierEntry.pending) {
            const p = tierEntry.pending;
            const pct = Math.max(0, Math.min(100, Math.round((p.days / p.required) * 100)));
            parts.push('<span class="peak-pending"><b>' + _pEsc(p.tier) + '</b> '
                + p.days + '/' + p.required + ' dn\u00ED'
                + (p.left > 0 ? ' \u00B7 zb\u00FDv\u00E1 ' + p.left : ' \u00B7 splněno')
                + (p.maxWins > 0 ? ' \u00B7 v\u00FDhry ' + p.wins + '/' + p.maxWins : '')
                + '</span>'
                + '<span class="peak-bar"><span class="peak-bar-fill" style="width:' + pct + '%"></span></span>');
        }
        container.innerHTML = '<span class="peak-info">' + parts.join('') + '</span>';
        container.style.display = '';
    }

    function renderTierJourneyTimeline(container, history) {
        container.innerHTML = '';

        const SVG_W   = 700;
        const SVG_H   = 340;
        const PL      = 62;   // left pad (Y labels)
        const PR      = 30;   // right pad
        const PT      = 30;   // top pad
        const PB      = 46;   // bottom pad (date labels)
        // Odsazeni bodu od kraje plochy. Bez nej sedel prvni bod primo na ose
        // a prekryval popisek tieru vlevo, posledni utikal ke kraji grafu.
        const INSET   = 18;

        const PLOT_W  = SVG_W - PL - PR;
        const PLOT_H  = SVG_H - PT - PB;
        const TIERS   = 10;
        const SPACING = PLOT_H / (TIERS - 1);

        function yFor(tierValue) {
            const idx = TIER_Y_IDX[String(tierValue)];
            return (idx !== undefined) ? PT + idx * SPACING : PT;
        }
        function xFor(i, total) {
            if (total === 1) return PL + PLOT_W / 2;
            const span = PLOT_W - INSET * 2;
            return PL + INSET + (i / (total - 1)) * span;
        }

        let svg = '';

        // Horizontal grid lines
        TIER_Y_LABELS.forEach((tl, i) => {
            const y = PT + i * SPACING;
            svg += `<line x1="${PL}" y1="${y}" x2="${PL + PLOT_W}" y2="${y}" stroke="rgba(255,255,255,0.055)" stroke-width="1"/>`;
        });

        // Y-axis labels (tier names, coloured)
        TIER_Y_LABELS.forEach((tl, i) => {
            const y   = PT + i * SPACING;
            const inf = tierInfo(tl.val);
            const col = (inf.barvaPozadi === '#23242a') ? inf.barvaTextu : inf.barvaPozadi;
            svg += `<text x="${PL - 8}" y="${y + 4}" text-anchor="end" font-family="Poppins,sans-serif" font-size="11" font-weight="700" fill="${escapeXml(col)}">${tl.label}</text>`;
        });

        // X-axis date labels
        //
        // Vypsat datum ke KAZDEMU bodu nejde - "29. 7. 2024" je siroke pres 55 px
        // a pri deseti a vic testech se popisky slily do necitelne kase. Proto se
        // zobrazi jen tolik, kolik se jich vejde bez prekryvu; prvni a posledni
        // vzdycky (mezi nimi je cely rozsah journey).
        const LABEL_W  = 58;
        const maxLabels = Math.max(2, Math.floor((PLOT_W - INSET * 2) / LABEL_W) + 1);
        const step      = Math.max(1, Math.ceil(history.length / maxLabels));
        history.forEach((h, i) => {
            const isEdge = (i === 0 || i === history.length - 1);
            if (!isEdge && (i % step !== 0)) return;
            // Predposledni popisek by se s poslednim mohl prekryt - radsi ho vynech.
            if (!isEdge && (history.length - 1 - i) < step * 0.6) return;
            const label = _journeyDateLabel(h);
            if (!label) return;
            const x = xFor(i, history.length);
            // Krajni popisky zarovnej dovnitr, at neutecou pres okraj grafu.
            const anchor = i === 0 ? 'start' : (i === history.length - 1 ? 'end' : 'middle');
            const tx = i === 0 ? x - 10 : (i === history.length - 1 ? x + 10 : x);
            svg += `<text x="${tx.toFixed(1)}" y="${SVG_H - 8}" text-anchor="${anchor}" font-family="Poppins,sans-serif" font-size="10" fill="rgba(255,255,255,0.45)">${escapeXml(label)}</text>`;
        });

        // Path connecting points
        if (history.length > 1) {
            let d = '';
            history.forEach((h, i) => {
                const x = xFor(i, history.length);
                const y = yFor(h.resolvedTier);
                d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
            });
            svg += `<path d="${d}" fill="none" stroke="rgba(238,205,20,0.3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
        }

        // Points
        history.forEach((h, i) => {
            const x    = xFor(i, history.length);
            const y    = yFor(h.resolvedTier);
            const inf  = tierInfo(String(h.resolvedTier));
            const orig = getOriginalTierText(String(h.resolvedTier));
            const isR  = orig.startsWith('R');
            const dot  = isR ? inf.barvaTextu : inf.barvaPozadi;
            const isLast = (i === history.length - 1);

            if (isLast) {
                svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="${escapeXml(dot)}" opacity="0.13"/>`;
            }
            // Outer ring + fill
            svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${isR ? '#23242a' : escapeXml(dot)}" stroke="${escapeXml(dot)}" stroke-width="2.5"/>`;
            svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"  fill="${escapeXml(dot)}" opacity="${isLast ? '1' : '0.65'}"/>`;
            // Invisible hit area (larger circle for easy hovering)
            svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="17" fill="transparent" class="journey-hit" data-i="${i}" style="cursor:pointer"/>`;
        });

        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
        svgEl.setAttribute('width',   '100%');
        svgEl.style.maxWidth   = SVG_W + 'px';
        svgEl.style.display    = 'block';
        svgEl.style.margin     = '0 auto';
        svgEl.style.overflow   = 'visible';
        svgEl.innerHTML = svg;
        container.appendChild(svgEl);

        // Tooltip element
        const tip = document.createElement('div');
        tip.className     = 'journey-tooltip';
        tip.style.display = 'none';
        tip.style.position = 'absolute';
        container.style.position = 'relative';
        container.appendChild(tip);

        // Klik na tečku = detail toho konkrétního testu (souboje a skóre)
        svgEl.querySelectorAll('.journey-hit').forEach(circle => {
            circle.addEventListener('click', function (e) {
                e.stopPropagation();
                const i = parseInt(this.getAttribute('data-i'));
                showJourneyTest(history[i]);
            });
        });

        // Hover handlers
        svgEl.querySelectorAll('.journey-hit').forEach(circle => {
            circle.addEventListener('mouseenter', function () {
                const i   = parseInt(this.getAttribute('data-i'));
                const h   = history[i];
                const inf = tierInfo(String(h.resolvedTier));
                const orig = getOriginalTierText(String(h.resolvedTier));
                const isR  = orig.startsWith('R');
                const col  = isR ? inf.barvaTextu : inf.barvaPozadi;
                const isLast = (i === history.length - 1);
                const dateLabel = _journeyDateLabel(h);

                tip.innerHTML =
                    '<div class="journey-tooltip-tier" style="color:' + col + '">' + escapeXml(orig) + '</div>' +
                    // h.date je na snapshotu ms timestamp - bez formatovani
                    // se v bublinE ukazalo hole cislo (1774994400000).
                    (dateLabel ? '<div class="journey-tooltip-date">' + escapeXml(dateLabel) + '</div>' : '') +
                    (h.note ? '<div class="journey-tooltip-note">' + escapeXml(h.note) + '</div>' : '') +
                    (isLast ? '<div class="journey-tooltip-current">Aktuální tier</div>' : '');

                tip.style.display = 'block';

                // Position the tooltip
                const svgRect  = svgEl.getBoundingClientRect();
                const wrapRect = container.getBoundingClientRect();
                const cx = parseFloat(this.getAttribute('cx'));
                const cy = parseFloat(this.getAttribute('cy'));
                const tipX = (svgRect.left - wrapRect.left) + cx * (svgRect.width  / SVG_W);
                const tipY = (svgRect.top  - wrapRect.top)  + cy * (svgRect.height / SVG_H);
                const tipW = tip.offsetWidth;
                const tipH = tip.offsetHeight;
                const GAP  = 18;

                // Prefer above the point, but flip below it when there isn't room
                // (points near the top row — HT1/LT1 — would otherwise push the
                // tooltip up over the tier labels)
                let top = tipY - tipH - GAP;
                if (top < 4) top = tipY + GAP;

                // Keep the tooltip from overflowing the left/right edges of the chart
                let left = tipX - tipW / 2;
                left = Math.max(4, Math.min(left, wrapRect.width - tipW - 4));

                tip.style.left = left + 'px';
                tip.style.top  = top + 'px';
            });
            circle.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        });
    }

    // === Průběh testů pod Tier Journey ================================
    // Bot od teď ukládá ke každému testu i jednotlivé souboje (kdo, jaké skóre) —
    // viz `fights` v tierHistory. Starší záznamy je nemají, u těch se ukáže aspoň
    // seznam soupeřů, a když není ani ten, samotný verdikt.
    const FIGHT_GROUP_LABEL = {
        lt3: 'LT3', ht3: 'HT3', lt2: 'LT2', ht2: 'HT2', lt1: 'LT1', ht1: 'HT1'
    };
    const VERDICT_STYLE = {
        'Získává':  { cls: 'tj-v-up',   icon: '\u25B2' },
        'Zůstává':  { cls: 'tj-v-same', icon: '\u25CF' },
        'Demote':   { cls: 'tj-v-down', icon: '\u25BC' },
        'Retired':  { cls: 'tj-v-ret',  icon: '\u2691' },
        'Unretire': { cls: 'tj-v-same', icon: '\u21BA' }
    };

    function _nickOf(discordId) {
        return SRC.nickOf(discordId);
    }

    // Detail jednoho testu — místo dalšího modalu přepneme obsah toho otevřeného.
    // Vrstvit modaly na sebe je na mobilu nepoužitelné.
    function showJourneyTest(entry) {
        const modal = document.getElementById('tier-journey-modal');
        if (!modal || !entry) return;
        const graph = modal.querySelector('.tier-journey-timeline-wrapper');
        const hint  = modal.querySelector('.tier-journey-hint');
        const peak  = modal.querySelector('#tier-journey-peak');
        const view  = modal.querySelector('#tier-journey-tests');
        const legend = modal.querySelector('.tier-journey-legend');
        if (!view) return;

        [graph, hint, peak, legend].forEach(el => { if (el) el.style.display = 'none'; });

        const vs   = VERDICT_STYLE[entry.note] || { cls: 'tj-v-same', icon: '\u25CF' };
        const when = _journeyDateLabel(entry);
        const tierNow = entry.tier ? getOriginalTierText(resolveTierValue(entry.tier) || '') : '';
        const tierOld = entry.oldTier ? getOriginalTierText(resolveTierValue(entry.oldTier) || '') : '';
        const change = (tierOld && tierOld !== '-' && tierOld !== tierNow)
            ? escapeXml(tierOld) + ' \u2192 <b>' + escapeXml(tierNow) + '</b>'
            : '<b>' + escapeXml(tierNow || entry.tier || '') + '</b>';

        let detail;
        if (Array.isArray(entry.fights) && entry.fights.length) {
            detail = '<div class="tj-fights">' + entry.fights.map(f => {
                const win  = Number(f.s) > Number(f.os);
                // f.on = nick soupeře, když se ho nepodařilo převést na Discord ID
                // (starší zprávy psaly soupeře jen jménem). Radši jméno než "neznámý".
                const nick = _nickOf(f.o) || f.on || null;
                const who  = nick ? escapeXml(nick) : 'neznámý hráč';
                const grp  = FIGHT_GROUP_LABEL[f.g] ? '<span class="tj-fgroup">' + FIGHT_GROUP_LABEL[f.g] + '</span>' : '';
                return '<div class="tj-fight ' + (win ? 'tj-win' : 'tj-loss') + '">' + grp
                     + '<span class="tj-fscore">' + Number(f.s) + '\u2013' + Number(f.os) + '</span>'
                     + '<span class="tj-fopp">' + who + '</span>'
                     + '<span class="tj-fres">' + (win ? 'výhra' : 'prohra') + '</span></div>';
            }).join('') + '</div>';
        } else if (Array.isArray(entry.opponents) && entry.opponents.length) {
            detail = '<div class="tj-fights tj-fights-legacy">Soupeři: '
                   + entry.opponents.map(id => escapeXml(_nickOf(id) || id)).join(', ')
                   + '<div class="tj-legacy-note">U tohoto testu nejsou uložená skóre.</div></div>';
        } else {
            detail = '<div class="tj-fights tj-fights-legacy">Detail soubojů není uložený.'
                   + '<div class="tj-legacy-note">Starší testy skóre neukládaly.</div></div>';
        }

        view.innerHTML =
            '<button class="tj-back" type="button">\u2039 Zpět na graf</button>'
          + '<div class="tj-test tj-open tj-single">'
          +   '<div class="tj-test-head tj-test-head-static">'
          +     '<span class="tj-vbadge ' + vs.cls + '">' + vs.icon + '</span>'
          +     '<span class="tj-verdict">' + escapeXml(entry.note || '') + '</span>'
          +     '<span class="tj-change">' + change + '</span>'
          +     '<span class="tj-date">' + escapeXml(when) + '</span>'
          +   '</div>'
          +   '<div class="tj-test-body">' + detail + '</div>'
          + '</div>';
        view.style.display = '';

        view.querySelector('.tj-back').onclick = () => {
            view.innerHTML = ''; view.style.display = 'none';
            [graph, hint, peak, legend].forEach(el => { if (el) el.style.display = ''; });
        };
    }

    function openJourney(playerNick, kitIcon, currentTierValue, discordId) {
        let raw = SRC.getHistory(discordId, kitIcon) || [];

        // Resolve tier values and filter valid
        let history = raw
            .map(h => ({ ...h, resolvedTier: resolveTierValue(h.tier) }))
            .filter(h => h.resolvedTier !== null);

        // If no history data, fall back to current single-point
        if (history.length === 0) {
            history = [{
                resolvedTier: currentTierValue,
                date: new Date().toLocaleDateString('cs-CZ'),
                note: null,
                kit: getKitNameFromIcon(kitIcon)
            }];
        }

        const journeyModal = document.getElementById('tier-journey-modal');
        if (!journeyModal) return;

        journeyModal.querySelector('.tier-journey-kit-icon').src = kitIcon;
        journeyModal.querySelector('.tier-journey-title').textContent = getKitNameFromIcon(kitIcon) + ' Tier Journey';
        journeyModal.querySelector('.tier-journey-player').textContent = playerNick;

        renderTierJourneyTimeline(
            journeyModal.querySelector('.tier-journey-timeline-wrapper'),
            history
        );

        // Detail testu se ukáže až po kliknutí na tečku — při otevření vždy graf.
        const testsEl = journeyModal.querySelector('#tier-journey-tests');
        if (testsEl) { testsEl.innerHTML = ''; testsEl.style.display = 'none'; }
        ['.tier-journey-timeline-wrapper', '.tier-journey-hint', '.tier-journey-legend']
            .forEach(sel => { const el = journeyModal.querySelector(sel); if (el) el.style.display = ''; });

        // Peak / retire pro tenhle kit — vytáhneme z dat hráče, která už máme.
        const _jp = journeyModal.querySelector('#tier-journey-peak');
        renderJourneyPeak(_jp, SRC.getTierEntry(discordId, kitIcon));

        journeyModal.style.display = 'flex';
    }


    global.CZSKJourney = {
        configure: function (src) {
            if (!src) return;
            if (typeof src.getHistory   === 'function') SRC.getHistory   = src.getHistory;
            if (typeof src.getTierEntry === 'function') SRC.getTierEntry = src.getTierEntry;
            if (typeof src.nickOf       === 'function') SRC.nickOf       = src.nickOf;
        },
        open: openJourney,
        renderTimeline: renderTierJourneyTimeline
    };

    // autocomplete.js i script.js volají tohle jméno.
    global.showTierJourney = openJourney;

    // Zavření modalu (kříž, klik mimo, Esc) — dřív to bylo jen ve script.js,
    // takže na kit stránkách šel modal zavřít hůř.
    global.addEventListener('DOMContentLoaded', function () {
        var jm = document.getElementById('tier-journey-modal');
        if (!jm) return;
        var close = jm.querySelector('.tier-journey-close');
        if (close) close.onclick = function () { jm.style.display = 'none'; };
        jm.onclick = function (e) { if (e.target === jm) jm.style.display = 'none'; };
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && jm.style.display === 'flex') jm.style.display = 'none';
        });
    });
})(window);
