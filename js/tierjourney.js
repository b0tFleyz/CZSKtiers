/**
 * Tier Journey – sdílený modul pro kitové stránky.
 * Auto-načte TierHistory ze spreadsheetu a poskytuje window.showTierJourney().
 *
 * Závislosti: XLSX.js musí být načteno před tímto skriptem.
 * Použití:    <script src="../js/tierjourney.js"></script>
 *             + mít <div id="tier-journey-modal"> v HTML
 */
(function () {
    const XLSX_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTsYd1Hv8XjsdskgT2O-_Otwe3DKxXTXECPE0s4JcPwPPnLMMpknU_-y8EHNBZTtVEQgzicFKcgluSU/pub?output=xlsx';

    const ICON_MAP = {
        'Crystal': 'kit_icons/cpvp.png',
        'Axe':     'kit_icons/axe.png',
        'Sword':   'kit_icons/sword.png',
        'UHC':     'kit_icons/uhc.png',
        'Npot':    'kit_icons/npot.png',
        'NPot':    'kit_icons/npot.png',
        'Pot':     'kit_icons/pot.png',
        'SMP':     'kit_icons/smp.png',
        'DiaSMP':  'kit_icons/diasmp.png',
        'Mace':    'kit_icons/mace.png'
    };

    // tierHistoryById[discordId][kitIcon] = [ { tier, date, note, kit, oldTier }, ... ]
    window.tierHistoryById = window.tierHistoryById || {};

    // ---- Tier styling helpers (standalone, consistent with tabulky.js) ----
    function _tjTierInfo(val) {
        switch (String(val)) {
            case '60': return { novyText: 'HT1', barvaTextu: '#23242a', barvaPozadi: '#FFCF4A' };
            case '48': return { novyText: 'LT1', barvaTextu: '#23242a', barvaPozadi: '#D5B355' };
            case '32': return { novyText: 'HT2', barvaTextu: '#23242a', barvaPozadi: '#A4B3C7' };
            case '24': return { novyText: 'LT2', barvaTextu: '#23242a', barvaPozadi: '#888D95' };
            case '16': return { novyText: 'HT3', barvaTextu: '#23242a', barvaPozadi: '#8F5931' };
            case '10': return { novyText: 'LT3', barvaTextu: '#23242a', barvaPozadi: '#B56326' };
            case '5':  return { novyText: 'HT4', barvaTextu: '#23242a', barvaPozadi: '#655B79' };
            case '3':  return { novyText: 'LT4', barvaTextu: '#23242a', barvaPozadi: '#655B79' };
            case '2':  return { novyText: 'HT5', barvaTextu: '#23242a', barvaPozadi: '#655B79' };
            case '1':  return { novyText: 'LT5', barvaTextu: '#23242a', barvaPozadi: '#655B79' };
            // Retired variants (same position on graph, different colouring)
            case '54': return { novyText: 'HT1', barvaTextu: '#FFCF4A', barvaPozadi: '#23242a' };
            case '43': return { novyText: 'LT1', barvaTextu: '#D5B355', barvaPozadi: '#23242a' };
            case '29': return { novyText: 'HT2', barvaTextu: '#A4B3C7', barvaPozadi: '#23242a' };
            case '22': return { novyText: 'LT2', barvaTextu: '#888D95', barvaPozadi: '#23242a' };
            default:   return { novyText: String(val), barvaTextu: '#23242a', barvaPozadi: '#EEE0CB' };
        }
    }

    function _tjGetOriginalTierText(val) {
        const m = {
            '60': 'HT1', '48': 'LT1', '32': 'HT2', '24': 'LT2',
            '16': 'HT3', '10': 'LT3', '5':  'HT4', '3':  'LT4',
            '2':  'HT5', '1':  'LT5',
            '54': 'RHT1', '43': 'RLT1', '29': 'RHT2', '22': 'RLT2'
        };
        return m[String(val)] || String(val);
    }

    function _tjResolveTierValue(tier) {
        tier = String(tier).trim();
        const nums = ['1','2','3','5','10','16','24','32','48','60','22','29','43','54'];
        if (nums.includes(tier)) return tier;
        const t = {
            'HT1':'60','LT1':'48','HT2':'32','LT2':'24','HT3':'16',
            'LT3':'10','HT4':'5', 'LT4':'3', 'HT5':'2', 'LT5':'1',
            'RHT1':'54','RLT1':'43','RHT2':'29','RLT2':'22'
        };
        return t[tier.toUpperCase()] || null;
    }

    function _tjEscape(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function _tjGetKitName(icon) {
        const normIcon = icon.replace(/^\.\.\//, '');
        const m = {
            'kit_icons/cpvp.png':   'Crystal PvP',
            'kit_icons/axe.png':    'Axe',
            'kit_icons/sword.png':  'Sword',
            'kit_icons/uhc.png':    'UHC',
            'kit_icons/npot.png':   'NPot',
            'kit_icons/pot.png':    'Pot',
            'kit_icons/smp.png':    'SMP',
            'kit_icons/diasmp.png': 'DiaSMP',
            'kit_icons/mace.png':   'Mace'
        };
        return m[normIcon] || normIcon;
    }

    // Y-axis mapping (retired tiers share position with active counterpart)
    const TJ_Y_IDX = {
        '60':0,'48':1,'32':2,'24':3,'16':4,'10':5,'5':6,'3':7,'2':8,'1':9,
        '54':0,'43':1,'29':2,'22':3
    };
    const TJ_Y_LABELS = [
        { label:'HT1', val:'60' }, { label:'LT1', val:'48' },
        { label:'HT2', val:'32' }, { label:'LT2', val:'24' },
        { label:'HT3', val:'16' }, { label:'LT3', val:'10' },
        { label:'HT4', val:'5'  }, { label:'LT4', val:'3'  },
        { label:'HT5', val:'2'  }, { label:'LT5', val:'1'  }
    ];

    function _tjRenderTimeline(container, history) {
        container.innerHTML = '';
        const SVG_W = 700, SVG_H = 340, PL = 56, PR = 24, PT = 28, PB = 44;
        const PLOT_W = SVG_W - PL - PR;
        const PLOT_H = SVG_H - PT - PB;
        const SPACING = PLOT_H / 9;

        function yFor(v) {
            const idx = TJ_Y_IDX[String(v)];
            return (idx !== undefined) ? PT + idx * SPACING : PT;
        }
        function xFor(i, n) {
            return n === 1 ? PL + PLOT_W / 2 : PL + (i / (n - 1)) * PLOT_W;
        }

        let svg = '';

        // Grid lines + Y labels
        TJ_Y_LABELS.forEach((tl, i) => {
            const y = PT + i * SPACING;
            svg += `<line x1="${PL}" y1="${y}" x2="${PL + PLOT_W}" y2="${y}" stroke="rgba(255,255,255,0.055)" stroke-width="1"/>`;
            const inf = _tjTierInfo(tl.val);
            const col = inf.barvaPozadi === '#23242a' ? inf.barvaTextu : inf.barvaPozadi;
            svg += `<text x="${PL - 8}" y="${y + 4}" text-anchor="end" font-family="Poppins,sans-serif" font-size="11" font-weight="700" fill="${_tjEscape(col)}">${tl.label}</text>`;
        });

        // X-axis date labels
        history.forEach((h, i) => {
            const x = xFor(i, history.length);
            if (h.date) {
                svg += `<text x="${x}" y="${SVG_H - 6}" text-anchor="middle" font-family="Poppins,sans-serif" font-size="9.5" fill="rgba(255,255,255,0.38)">${_tjEscape(h.date)}</text>`;
            }
        });

        // Connecting path
        if (history.length > 1) {
            let d = '';
            history.forEach((h, i) => {
                const x = xFor(i, history.length), y = yFor(h.resolvedTier);
                d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
            });
            svg += `<path d="${d}" fill="none" stroke="rgba(238,205,20,0.3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
        }

        // Data points
        history.forEach((h, i) => {
            const x = xFor(i, history.length), y = yFor(h.resolvedTier);
            const inf  = _tjTierInfo(String(h.resolvedTier));
            const orig = _tjGetOriginalTierText(String(h.resolvedTier));
            const isR  = orig.startsWith('R');
            const dot  = isR ? inf.barvaTextu : inf.barvaPozadi;
            const isLast = (i === history.length - 1);
            if (isLast) {
                svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="${_tjEscape(dot)}" opacity="0.13"/>`;
            }
            svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${isR ? '#23242a' : _tjEscape(dot)}" stroke="${_tjEscape(dot)}" stroke-width="2.5"/>`;
            svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${_tjEscape(dot)}" opacity="${isLast ? '1' : '0.65'}"/>`;
            svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="17" fill="transparent" class="tj-hit" data-i="${i}" style="cursor:pointer"/>`;
        });

        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
        svgEl.setAttribute('width', '100%');
        svgEl.style.maxWidth = SVG_W + 'px';
        svgEl.style.display  = 'block';
        svgEl.style.margin   = '0 auto';
        svgEl.style.overflow = 'visible';
        svgEl.innerHTML = svg;
        container.appendChild(svgEl);

        // Tooltip
        const tip = document.createElement('div');
        tip.className = 'journey-tooltip';
        tip.style.cssText = 'display:none;position:absolute;';
        container.style.position = 'relative';
        container.appendChild(tip);

        svgEl.querySelectorAll('.tj-hit').forEach(circle => {
            circle.addEventListener('mouseenter', function () {
                const i    = parseInt(this.getAttribute('data-i'));
                const h    = history[i];
                const inf  = _tjTierInfo(String(h.resolvedTier));
                const orig = _tjGetOriginalTierText(String(h.resolvedTier));
                const isR  = orig.startsWith('R');
                const col  = isR ? inf.barvaTextu : inf.barvaPozadi;
                const isLast = (i === history.length - 1);
                tip.innerHTML =
                    `<div class="journey-tooltip-tier" style="color:${col}">${_tjEscape(orig)}</div>` +
                    (h.date ? `<div class="journey-tooltip-date">${_tjEscape(h.date)}</div>` : '') +
                    (h.note ? `<div class="journey-tooltip-note">${_tjEscape(h.note)}</div>` : '') +
                    (isLast ? '<div class="journey-tooltip-current">Aktuální tier</div>' : '');
                tip.style.display = 'block';
                const svgRect  = svgEl.getBoundingClientRect();
                const wrapRect = container.getBoundingClientRect();
                const cx = parseFloat(this.getAttribute('cx'));
                const cy = parseFloat(this.getAttribute('cy'));
                const tipX = (svgRect.left - wrapRect.left) + cx * (svgRect.width  / SVG_W);
                const tipY = (svgRect.top  - wrapRect.top)  + cy * (svgRect.height / SVG_H);
                tip.style.left = (tipX - tip.offsetWidth / 2) + 'px';
                tip.style.top  = (tipY - tip.offsetHeight - 18) + 'px';
            });
            circle.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        });
    }

    // ---- Public API ----

    /**
     * Otevře Tier Journey modal pro daného hráče.
     * @param {string} playerNick      - zobrazovaný nick
     * @param {string} kitIcon         - cesta k ikoně kitu (kit_icons/... nebo ../kit_icons/...)
     * @param {string} currentTierValue - aktuální tier (číslo nebo zkratka, fallback pokud není history)
     * @param {string} discordId       - Discord ID hráče (primární klíč do tierHistoryById)
     */
    window.showTierJourney = function (playerNick, kitIcon, currentTierValue, discordId) {
        // Normalize icon path – kit pages prefix icons with ../
        const normIcon = kitIcon.replace(/^\.\.\//, '');
        const entries = (discordId && window.tierHistoryById[discordId] && window.tierHistoryById[discordId][normIcon]) || [];

        let history = entries
            .map(h => ({ ...h, resolvedTier: _tjResolveTierValue(h.tier) }))
            .filter(h => h.resolvedTier !== null);

        if (history.length === 0) {
            const fallback = _tjResolveTierValue(currentTierValue);
            history = [{ resolvedTier: fallback || currentTierValue, date: new Date().toLocaleDateString('cs-CZ'), note: null }];
        }

        const modal = document.getElementById('tier-journey-modal');
        if (!modal) return;

        const imgSrc = window.location.pathname.includes('/kits/') ? '../' + normIcon : normIcon;
        modal.querySelector('.tier-journey-kit-icon').src = imgSrc;
        modal.querySelector('.tier-journey-title').textContent = _tjGetKitName(normIcon) + ' Tier Journey';
        modal.querySelector('.tier-journey-player').textContent = playerNick;
        _tjRenderTimeline(modal.querySelector('.tier-journey-timeline-wrapper'), history);
        modal.style.display = 'flex';
    };

    // Wire up modal close buttons when DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        const jm = document.getElementById('tier-journey-modal');
        if (!jm) return;
        const closeBtn = jm.querySelector('.tier-journey-close');
        if (closeBtn) closeBtn.onclick = () => { jm.style.display = 'none'; };
        jm.onclick = (e) => { if (e.target === jm) jm.style.display = 'none'; };
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && jm.style.display === 'flex') jm.style.display = 'none';
        });
    });

    // ---- Data loading ----
    function _loadHistory() {
        fetch(XLSX_URL)
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
            .then(data => {
                const wb = XLSX.read(data, { type: 'array' });
                const wsName = wb.SheetNames.find(n => n === 'TierHistory');
                if (!wsName) return;
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wsName]);
                rows.forEach(row => {
                    const discordId = row['Discord ID'] ? String(row['Discord ID']).trim() : null;
                    if (!discordId || !row.Kit || !row.Tier) return;
                    const kit  = String(row.Kit).trim();
                    const icon = ICON_MAP[kit] || null;
                    if (!icon) return;
                    const tier    = String(row.Tier).trim();
                    const date    = row.Date    ? String(row.Date).trim()    : null;
                    const note    = row.Verdict ? String(row.Verdict).trim() : null;
                    const oldTier = row.OldTier ? String(row.OldTier).trim() : null;
                    if (!window.tierHistoryById[discordId]) window.tierHistoryById[discordId] = {};
                    if (!window.tierHistoryById[discordId][icon]) window.tierHistoryById[discordId][icon] = [];
                    window.tierHistoryById[discordId][icon].push({ tier, date, note, kit, oldTier });
                });
            })
            .catch(() => { /* silently ignore – history is best-effort */ });
    }

    // XLSX is synchronously loaded before this script – start loading immediately
    if (typeof XLSX !== 'undefined') {
        _loadHistory();
    } else {
        // Fallback: wait for load event (should not normally happen)
        window.addEventListener('load', function () {
            if (typeof XLSX !== 'undefined') _loadHistory();
        });
    }
})();
