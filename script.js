document.addEventListener('DOMContentLoaded', async function () {

    // Autocomplete proměnné - definovány na začátku
    let allPlayers = [];
    let currentSuggestionIndex = -1;
    let autocompleteInitialized = false;

    const TIER_ORDER = [
        "60", "48", "32", "24", "16", "10", "5", "3", "2", "1",
        "54", "43", "29", "22"
    ];

    // Points awarded for peak tier (for players not yet retired)
    // HT3 peak = 14, LT2+ uses same bonus as the retire score
    const PEAK_TIER_SCORE = {
        'HT3': 14, 'LT2': 22, 'HT2': 29, 'LT1': 43, 'HT1': 54
    };

    function getTierOrder(tier) {
        const idx = TIER_ORDER.indexOf(String(tier));
        return idx === -1 ? 999 : idx;
    }

    // Returns the highest regular (non-retire) tier text from history for a player/kit
    function getPeakTierTextFromHistory(discordId, kitIcon) {
        const history = (tierHistory[discordId] || {})[kitIcon] || [];
        let bestOrder = 999;
        let bestTierText = null;
        for (const entry of history) {
            for (const tierText of [entry.tier, entry.oldTier]) {
                if (!tierText) continue;
                const t = String(tierText).trim();
                if (!t || t.startsWith('R')) continue;
                const tierVal = resolveTierValue(t);
                if (!tierVal) continue;
                const order = getTierOrder(tierVal);
                if (order < bestOrder) {
                    bestOrder = order;
                    bestTierText = t;
                }
            }
        }
        return bestTierText; // e.g. 'HT2', 'LT1', or null
    }

    // Extracts peak tier info from TierHistory worksheet (already in-memory)
    function processTierHistoryFromSheet(worksheet) {
        const iconMap = {
            'Crystal': 'kit_icons/cpvp.png',
            'Axe': 'kit_icons/axe.png',
            'Sword': 'kit_icons/sword.png',
            'UHC': 'kit_icons/uhc.png',
            'Npot': 'kit_icons/npot.png', 'NPot': 'kit_icons/npot.png',
            'Pot': 'kit_icons/pot.png',
            'SMP': 'kit_icons/smp.png',
            'DiaSMP': 'kit_icons/diasmp.png',
            'Mace': 'kit_icons/mace.png'
        };
        const rows = XLSX.utils.sheet_to_json(worksheet);
        rows.forEach(row => {
            if (!row.Kit || !row.Tier) return;
            const discordId = row['Discord ID'] ? String(row['Discord ID']).trim() : null;
            if (!discordId) return;
            const kit     = String(row.Kit).trim();
            const tier    = String(row.Tier).trim();
            const date    = row.Date    ? String(row.Date).trim()    : null;
            const note    = row.Verdict ? String(row.Verdict).trim() : null;
            const oldTier = row.OldTier ? String(row.OldTier).trim() : null;
            const icon    = iconMap[kit] || null;
            if (!icon) return;
            if (!tierHistory[discordId]) tierHistory[discordId] = {};
            if (!tierHistory[discordId][icon]) tierHistory[discordId][icon] = [];
            tierHistory[discordId][icon].push({ tier, date, note, kit, oldTier });
        });
    }

    const kits = [
        { key: "Crystal", icon: "kit_icons/cpvp.png" },
        { key: "Axe", icon: "kit_icons/axe.png" },
        { key: "Sword", icon: "kit_icons/sword.png" },
        { key: "UHC", icon: "kit_icons/uhc.png" },
        { key: "NPot", icon: "kit_icons/npot.png" },
        { key: "Pot", icon: "kit_icons/pot.png" },
        { key: "SMP", icon: "kit_icons/smp.png" },
        { key: "DiaSMP", icon: "kit_icons/diasmp.png" },
        { key: "Mace", icon: "kit_icons/mace.png" }
    ];

    // Funkce pro badge: zobrazí všechny badge, s tierem seřazené, neotestované na konci
    function renderSortedBadges(player) {
        // Pro každý kit vždy vygeneruj badge (i když není v player.tiers)
        const badgeList = kits.map(kit => {
            // Najdi nejlepší tier pro tento kit
            const kitTiers = (player.tiers || []).filter(t => t.icon === kit.icon && t.tier && t.tier !== "-");
            if (kitTiers.length === 0) {
                // Hráč nemá žádný záznam pro tento kit → neotestovaný
                return {
                    html: `
<span class="kit-badge kit-badge-missing">
    <span class="kit-icon-circle kit-icon-missing">
        <svg width="22" height="22">
            <circle cx="11" cy="11" r="9" fill="#23242a" stroke="#444" stroke-width="1"/>
        </svg>
    </span>
    <span class="kit-tier-text kit-tier-missing">?</span>
</span>
                    `,
                    order: 999
                };
            }
            // Najdi nejlepší tier podle pořadí
            kitTiers.sort((a, b) => getTierOrder(a.tier) - getTierOrder(b.tier));
            const t = kitTiers[0];
            const info = tierInfo(String(t.tier));
            const origText = getOriginalTierText(String(t.tier));
            let style = "";
            let circleColor = "";
            if (origText.startsWith("R")) {
                style = `background:#23242a;color:${info.barvaTextu};`;
                circleColor = "#23242a";
            } else {
                style = `background:${info.barvaPozadi};color:#23242a;`;
                circleColor = info.barvaPozadi;
            }
            return {
                html: `
<span class="kit-badge tooltip">
    <span class="kit-icon-circle" style="border-color:` + circleColor + `;">
        <img src="` + kit.icon + `" alt="" class="kit-icon" loading="lazy">
    </span>
    <span class="kit-tier-text" style="` + style + `">
        ` + info.novyText + `
    </span>
    <span class="tooltiptext">
        <strong>` + origText + `</strong><br>
        ` + (t.peakTierText ? PEAK_TIER_SCORE[t.peakTierText] : t.tier) + ` pts` + (t.peakTierText ? `<br><span style="font-size:0.85em;opacity:0.7;">Peak: ` + t.peakTierText + `</span>` : '') + `
    </span>
</span>
            `,
                order: getTierOrder(t.tier)
            };
        });

    // Zobraz pouze badge s tierem (order < 999), seřazené podle tieru
    const tested = badgeList.filter(b => b.order < 999).sort((a, b) => a.order - b.order);
    return tested.map(b => b.html).join('');
    }

    // Vrací pole tierů hráče ve správném pořadí
    function sortPlayerTiers(tiers) {
        return [...tiers].sort((a, b) => getTierOrder(a.tier) - getTierOrder(b.tier));
    }

    // Vrací HT1, LT2 atd. pro badge, ale tooltip ukazuje původní text (např. RHT1)
    function tierInfo(hodnota) {
        let novyText = hodnota;
        let barvaTextu = "#23242a";
        let barvaPozadi = "#EEE0CB";
        switch (hodnota) {
            case "32": novyText = "HT2"; barvaPozadi = "#A4B3C7"; break;
            case "16": novyText = "HT3"; barvaPozadi = "#8F5931"; break;
            case "10": novyText = "LT3"; barvaPozadi = "#B56326"; break;
            case "5": novyText = "HT4"; barvaPozadi = "#655B79"; break;
            case "3": novyText = "LT4"; barvaPozadi = "#655B79"; break;
            case "2": novyText = "HT5"; barvaPozadi = "#655B79"; break;
            case "1": novyText = "LT5"; barvaPozadi = "#655B79"; break;
            case "24": novyText = "LT2"; barvaPozadi = "#888D95"; break;
            case "48": novyText = "LT1"; barvaPozadi = "#D5B355"; break;
            case "60": novyText = "HT1"; barvaPozadi = "#FFCF4A"; break;
            // Přemapování RHT/RTL na normální HT/LT
            case "22": novyText = "LT2"; barvaTextu = "#888D95"; barvaPozadi = "#23242a"; break; // RTL2 → LT2
            case "29": novyText = "HT2"; barvaTextu = "#A4B3C7"; barvaPozadi = "#23242a"; break; // RHT2 → HT2
            case "43": novyText = "LT1"; barvaTextu = "#D5B355"; barvaPozadi = "#23242a"; break; // RTL1 → LT1
            case "54": novyText = "HT1"; barvaTextu = "#FFCF4A"; barvaPozadi = "#23242a"; break; // RHT1 → HT1
            default: barvaPozadi = "#EEE0CB"; break;
        }
        return { novyText, barvaTextu, barvaPozadi };
    }

    // Vrací původní text tieru pro tooltip
    function getOriginalTierText(hodnota) {
        switch (hodnota) {
            case "22": return "RLT2";
            case "29": return "RHT2";
            case "43": return "RLT1";
            case "54": return "RHT1";
            case "32": return "HT2";
            case "16": return "HT3";
            case "10": return "LT3";
            case "5": return "HT4";
            case "3": return "LT4";
            case "2": return "HT5";
            case "1": return "LT5";
            case "24": return "LT2";
            case "48": return "LT1";
            case "60": return "HT1";
            default: return "-";
        }
    }

    let overallData = [];
    let discordIdToNick = {}; // Discord ID → Nick, built from spreadsheet data
    let tierHistory = {}; // keyed by discordId → kitIcon → [{tier, date, note, kit, oldTier}]
    // Načti overall jako pole objektů a vygeneruj karty
    async function nactiOverallExcel(url) {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });

        // Process TierHistory from the same workbook so peak tiers are available immediately
        const histSheetName = workbook.SheetNames.find(n => n === 'TierHistory');
        if (histSheetName) {
            processTierHistoryFromSheet(workbook.Sheets[histSheetName]);
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        // Build Discord ID → Nick map for tier history bridging
        rows.forEach(row => {
            const discordId = row['Discord ID'] ? String(row['Discord ID']).trim() : null;
            const nick = row.Nick ? String(row.Nick).trim() : null;
            if (discordId && nick) discordIdToNick[discordId] = nick;
        });

        overallData = rows.map(row => {
            const discordId = row['Discord ID'] ? String(row['Discord ID']).trim() : '';
            const tiers = [
                { tier: row.Crystal, icon: "kit_icons/cpvp.png" },
                { tier: row.Axe, icon: "kit_icons/axe.png" },
                { tier: row.Sword, icon: "kit_icons/sword.png" },
                { tier: row.UHC, icon: "kit_icons/uhc.png" },
                { tier: row.Npot, icon: "kit_icons/npot.png" },
                { tier: row.Pot, icon: "kit_icons/pot.png" },
                { tier: row.SMP, icon: "kit_icons/smp.png" },
                { tier: row.DiaSMP, icon: "kit_icons/diasmp.png" },
                { tier: row.Mace, icon: "kit_icons/mace.png" }
            ];
            // Score = max(current tier, peak tier bonus) per kit
            let overallScore = 0;
            tiers.forEach(t => {
                const val = parseInt(t.tier);
                if (!isNaN(val)) {
                    const peakText = discordId ? getPeakTierTextFromHistory(discordId, t.icon) : null;
                    const peakScore = peakText ? (PEAK_TIER_SCORE[peakText] || 0) : 0;
                    const effectiveScore = Math.max(val, peakScore);
                    overallScore += effectiveScore;
                    // Only store peakTierText if it actually boosts the score
                    t.peakTierText = (peakScore > val) ? peakText : null;
                }
            });
            return {
                uuid: row.UUID,
                nick: row.Nick,
                discordId,
                score: overallScore,
                tiers: tiers
            };
        });

        renderOverall(overallData);
    }

    // Ostatní tabulky nech původní
    async function nactiExcel(nazevSouboru, idTabulky) {
        try {
            const response = await fetch(nazevSouboru);
            const data = await response.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const html = XLSX.utils.sheet_to_html(worksheet);
            const tabulka = document.getElementById(idTabulky);
            if (!tabulka) {
                console.warn('Element s id "' + idTabulky + '" nebyl na stránce nalezen, přeskočeno.');
                return;
            }
            tabulka.innerHTML = html;
            const firstTr = tabulka.querySelector('tr:first-child');
            if (firstTr) firstTr.remove();
        } catch (error) {
            console.error("Chyba při načítání Excelu:", error);
        }
    }

    // Přepínání kategorií
    function zobrazTabulku(idTabulky) {
        const vsechnyTabulky = document.querySelectorAll('.tabulka');
        vsechnyTabulky.forEach(tabulka => tabulka.classList.remove('active'));

        const vybranaTabulka = document.getElementById(idTabulky);
        if (vybranaTabulka) {
            vybranaTabulka.classList.add('active');
        }
    }

    // Navigace: správné přesměrování na overall.html nebo tabulky.html#kit-table
    const odkazy = document.querySelectorAll('nav a');
    odkazy.forEach(odkaz => {
        odkaz.addEventListener('click', function (event) {
            const href = odkaz.getAttribute('href');
            if (href.includes('overall.html')) {
                // Přímé přesměrování na overall.html bez hash
                window.location.href = 'overall.html';
                event.preventDefault();
            } else if (href.includes('tabulky.html')) {
                // Přímé přesměrování na tabulky.html#kit-table
                window.location.href = href;
                event.preventDefault();
            }
        });
    });

    // Načti overall jako karty s error handlingem
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');
    
    try {
        await nactiOverallExcel('https://docs.google.com/spreadsheets/d/e/2PACX-1vTsYd1Hv8XjsdskgT2O-_Otwe3DKxXTXECPE0s4JcPwPPnLMMpknU_-y8EHNBZTtVEQgzicFKcgluSU/pub?output=xlsx');
        // Skryj loading indicator po úspěšném načtení
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        // TierHistory is already processed inside nactiOverallExcel from the same workbook
    } catch (error) {
        console.error('Error loading data:', error);
        // Zobraz error message
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (errorMessage) errorMessage.style.display = 'block';
    }

    zobrazTabulku('overall-tabulka');

    function renderOverall(overallData) {
        const container = document.getElementById('overall-tabulka');
        if (!container) return;
        container.innerHTML = '';
        
        // Seřaď všechny hráče
        const allSortedPlayers = [...overallData].sort((a, b) => b.score - a.score);
        
        // Inicializuj autocomplete se VŠEMI hráči
        if (allPlayers.length === 0) {
            allPlayers = allSortedPlayers.map(p => ({
                nick: p.nick,
                score: p.score,
                uuid: p.uuid,
                tiers: p.tiers,
                discordId: p.discordId || ''
            }));
            initAutocomplete(allPlayers);
        }
        
        // Pro zobrazení použij jen top 99
        const sortedPlayers = allSortedPlayers.slice(0, 99);
        
        // Virtuální scrolling - načti jen prvních 20 karet
        const INITIAL_LOAD = 20;
        const LOAD_MORE = 15;
        let currentlyLoaded = 0;
        
        const playerCards = [];
        let lastScore = null;
        let lastRank = 0;
        
        // Připrav všechny kartičky ale nevkládej je do DOMu
        sortedPlayers.forEach((player, idx) => {
            if (player.score === lastScore) {
                var rank = lastRank;
            } else {
                var rank = idx + 1;
                lastScore = player.score;
                lastRank = rank;
            }

            let rankColor;
            if (rank === 1) rankColor = '#eecd14';
            else if (rank === 2) rankColor = '#c0c0c0';
            else if (rank === 3) rankColor = '#cd7f32';
            else rankColor = '#555555ff';

            const sortedTiers = player.tiers
                .filter(t => t.tier && t.tier !== "-")
                .sort((a, b) => getTierOrder(a.tier) - getTierOrder(b.tier));

            const kitsHtml = sortedTiers.map(t => {
                const info = tierInfo(String(t.tier));
                const origText = getOriginalTierText(String(t.tier));
                let style = "";
                let circleColor = "";
                if (origText.startsWith("R")) {
                    style = `background:#23242a;color:${info.barvaTextu};`;
                    circleColor = "#23242a";
                } else {
                    style = `background:${info.barvaPozadi};color:#23242a;`;
                    circleColor = info.barvaPozadi;
                }
                return `
                    <span class="kit-badge tooltip" data-kit-icon="${t.icon}" style="--tier-color:${origText.startsWith('R') ? info.barvaTextu : info.barvaPozadi};">
                        <span class="kit-icon-circle" style="border-color:${circleColor};">
                            <img src="${t.icon}" alt="" class="kit-icon" loading="lazy">
                        </span>
                        <span class="kit-tier-text" style="${style}">
                            ${info.novyText}
                        </span>
                        <span class="tooltiptext">
                            <strong>${origText}</strong><br>
                            ${t.peakTierText ? PEAK_TIER_SCORE[t.peakTierText] : t.tier} pts${t.peakTierText ? `<br><span style="font-size:0.85em;opacity:0.7;">Peak: ${t.peakTierText}</span>` : ''}
                        </span>
                    </span>
                `;
            }).join('');

            playerCards.push({
                rank,
                rankColor,
                player,
                kitsHtml
            });
        });
        
        // Funkce pro vytvoření DOM elementu karty
        function createCard(cardData) {
            const { rank, rankColor, player, kitsHtml } = cardData;
            const card = document.createElement('div');
            card.className = 'player-card';
            card.innerHTML = `
                <div class="card-header compact-row">
                    <div class="rank-badge" style="background:${rankColor}; color:#23242a;">${rank}</div>
                    <div class="skin-bg rank-${rank}">
                        <img class="skin" src="https://mc-heads.net/avatar/${player.uuid}/64" alt="${player.nick}" loading="lazy" decoding="async" fetchpriority="${rank <= 3 ? 'high' : 'low'}">
                    </div>
                    <div class="player-info">
                        <div class="player-name">${player.nick}</div>
                        <div class="score">${player.score}</div>
                    </div>
                    <div class="kits-row">${kitsHtml}</div>
                </div>
            `;
            card.addEventListener('click', () => {
                showPlayerModal({
                    name: player.nick,
                    position: rank,
                    score: player.score,
                    skin: `https://mc-heads.net/avatar/${player.uuid}/64`,
                    kitsHtml: kitsHtml,
                    tiers: player.tiers,
                    nick: player.nick,
                    discordId: player.discordId || ''
                });
            });
            return card;
        }
        
        // Načti prvních INITIAL_LOAD karet
        function loadMoreCards() {
            const fragment = document.createDocumentFragment();
            const end = Math.min(currentlyLoaded + (currentlyLoaded === 0 ? INITIAL_LOAD : LOAD_MORE), playerCards.length);
            
            for (let i = currentlyLoaded; i < end; i++) {
                fragment.appendChild(createCard(playerCards[i]));
            }
            
            container.appendChild(fragment);
            currentlyLoaded = end;
            
            return currentlyLoaded < playerCards.length;
        }
        
        // Načti první dávku
        loadMoreCards();
        
        // Intersection Observer pro automatické načítání při scrollování
        const sentinel = document.createElement('div');
        sentinel.className = 'scroll-sentinel';
        sentinel.style.height = '1px';
        container.appendChild(sentinel);
        
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const hasMore = loadMoreCards();
                if (!hasMore) {
                    observer.disconnect();
                    sentinel.remove();
                }
            }
        }, {
            rootMargin: '200px'
        });
        
        observer.observe(sentinel);
    }

    // ========== TIER JOURNEY ==========

    async function nactiTierHistory(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) return;
            const data = await response.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            // Hledá list pojmenovaný 'TierHistory' (vytváří bot)
            const sheetName = workbook.SheetNames.find(n => n === 'TierHistory');
            if (!sheetName) return;
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) return;
            const rows = XLSX.utils.sheet_to_json(worksheet);

            const iconMap = {
                'Crystal': 'kit_icons/cpvp.png',
                'Axe': 'kit_icons/axe.png',
                'Sword': 'kit_icons/sword.png',
                'UHC': 'kit_icons/uhc.png',
                'Npot': 'kit_icons/npot.png', 'NPot': 'kit_icons/npot.png',
                'Pot': 'kit_icons/pot.png',
                'SMP': 'kit_icons/smp.png',
                'DiaSMP': 'kit_icons/diasmp.png',
                'Mace': 'kit_icons/mace.png'
            };

            rows.forEach(row => {
                if (!row.Kit || !row.Tier) return;
                // Primární klíč: Discord ID (stabilní i při změně nicku)
                const discordId = row['Discord ID'] ? String(row['Discord ID']).trim() : null;
                if (!discordId) return;
                const kit     = String(row.Kit).trim();
                const tier    = String(row.Tier).trim();
                const date    = row.Date    ? String(row.Date).trim()    : null;
                const note    = row.Verdict ? String(row.Verdict).trim() : null;
                const oldTier = row.OldTier ? String(row.OldTier).trim() : null;
                const icon    = iconMap[kit] || null;
                if (!icon) return;
                if (!tierHistory[discordId]) tierHistory[discordId] = {};
                if (!tierHistory[discordId][icon]) tierHistory[discordId][icon] = [];
                tierHistory[discordId][icon].push({ tier, date, note, kit, oldTier });
            });
        } catch (e) {
            // History not available – silently skip
        }
    }

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
            'kit_icons/mace.png':   'Mace'
        };
        return map[icon] || icon;
    }

    function resolveTierValue(tier) {
        tier = String(tier).trim();
        const validNums = ['1','2','3','5','10','16','24','32','48','60','22','29','43','54'];
        if (validNums.includes(tier)) return tier;
        const textMap = {
            'HT1':'60','LT1':'48','HT2':'32','LT2':'24','HT3':'16',
            'LT3':'10','HT4':'5','LT4':'3','HT5':'2','LT5':'1',
            'RHT1':'54','RLT1':'43','RHT2':'29','RLT2':'22'
        };
        return textMap[tier.toUpperCase()] || null;
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

    function renderTierJourneyTimeline(container, history) {
        container.innerHTML = '';

        const SVG_W   = 700;
        const SVG_H   = 340;
        const PL      = 56;   // left pad (Y labels)
        const PR      = 24;   // right pad
        const PT      = 28;   // top pad
        const PB      = 44;   // bottom pad (date labels)

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
            return PL + (i / (total - 1)) * PLOT_W;
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
        history.forEach((h, i) => {
            const x = xFor(i, history.length);
            if (h.date) {
                svg += `<text x="${x}" y="${SVG_H - 6}" text-anchor="middle" font-family="Poppins,sans-serif" font-size="9.5" fill="rgba(255,255,255,0.38)">${escapeXml(h.date)}</text>`;
            }
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

                tip.innerHTML =
                    '<div class="journey-tooltip-tier" style="color:' + col + '">' + escapeXml(orig) + '</div>' +
                    (h.date ? '<div class="journey-tooltip-date">' + escapeXml(h.date) + '</div>' : '') +
                    (h.note ? '<div class="journey-tooltip-note">' + escapeXml(h.note) + '</div>' : '') +
                    (isLast ? '<div class="journey-tooltip-current">Aktuální tier</div>' : '');

                tip.style.display = 'block';

                // Position the tooltip
                const svgRect  = svgEl.getBoundingClientRect();
                const wrapRect = container.getBoundingClientRect();
                const total    = history.length;
                const ptIndex  = parseFloat(this.getAttribute('cx')) === 0 ? 0 : i;
                const cx       = parseFloat(this.getAttribute('cx'));
                const cy       = parseFloat(this.getAttribute('cy'));
                const scaleX   = svgRect.width  / SVG_W;
                const scaleY   = svgRect.height / SVG_H;
                const tipX     = (svgRect.left - wrapRect.left) + cx * scaleX;
                const tipY     = (svgRect.top  - wrapRect.top)  + cy * scaleY;

                tip.style.left = (tipX - tip.offsetWidth / 2) + 'px';
                tip.style.top  = (tipY - tip.offsetHeight - 18) + 'px';
            });
            circle.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        });
    }

    function showTierJourney(playerNick, kitIcon, currentTierValue, discordId) {
        let raw = (discordId && tierHistory[discordId] && tierHistory[discordId][kitIcon]) || [];

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

        journeyModal.style.display = 'flex';
    }

    // Close journey modal
    (() => {
        const jm = document.getElementById('tier-journey-modal');
        if (!jm) return;
        jm.querySelector('.tier-journey-close').onclick = () => { jm.style.display = 'none'; };
        jm.onclick = (e) => { if (e.target === jm) jm.style.display = 'none'; };
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && jm.style.display === 'flex') jm.style.display = 'none';
        });
    })();

    // MODAL funkce
    function showPlayerModal({ name, position, score, skin, kitsHtml, tiers, nick, discordId }) {
        const modal = document.getElementById('player-modal');
        modal.querySelector('.player-modal-name').textContent = name;

        // Nastav barvu podle pořadí
        let rankClass = "rank-other";
        if (position === 1) rankClass = "rank-1";
        else if (position === 2) rankClass = "rank-2";
        else if (position === 3) rankClass = "rank-3";

        const rankElem = modal.querySelector('.player-modal-rank');
        rankElem.className = "player-modal-rank " + rankClass;
        rankElem.textContent = position + ".";

        modal.querySelector('.player-modal-score').textContent = `${score} points`;
        const modalSkinImg = modal.querySelector('.player-modal-skin');
        modalSkinImg.src = skin;
        modalSkinImg.loading = 'lazy';
        modalSkinImg.decoding = 'async';
        modal.querySelector('.player-modal-tiers').innerHTML = kitsHtml;

        // Wire Tier Journey click on each badge
        if (tiers && nick) {
            const sortedTiers = (tiers || [])
                .filter(t => t.tier && t.tier !== "-")
                .sort((a, b) => getTierOrder(a.tier) - getTierOrder(b.tier));

            modal.querySelectorAll('.player-modal-tiers .kit-badge').forEach((badge) => {
                const kitIcon = badge.dataset.kitIcon;
                if (!kitIcon) return;
                // Find matching tier by icon
                const match = sortedTiers.find(t => t.icon === kitIcon);
                if (!match) return;
                badge.classList.add('badge-journey-clickable');
                // Clone to remove old listeners
                const fresh = badge.cloneNode(true);
                badge.parentNode.replaceChild(fresh, badge);
                fresh.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showTierJourney(nick, kitIcon, String(match.tier), discordId);
                });
            });
        }

        modal.style.display = 'flex';
    }

    // Zavření modalu
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.querySelector('.player-modal-close').onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }

    // Klávesová zkratka "/" pro focus - bude přidána v initAutocomplete

    function getBestTierForKit(player, kitIcon) {
        // Najdi všechny tiery hráče pro daný kit
        const kitTiers = player.tiers.filter(t => t.icon === kitIcon && t.tier && t.tier !== "-");
        if (kitTiers.length === 0) return null;
        // Vyber nejlepší podle pořadí
        kitTiers.sort((a, b) => getTierOrder(a.tier) - getTierOrder(b.tier));
        return kitTiers[0];
    }

    function renderKitTable(players, kitKey, columnsClass) {
        // Nejprve vyčisti všechny sloupce
        document.querySelectorAll(`.${columnsClass} .kit-tier-list`).forEach(el => el.innerHTML = '');
        // Pro každý tier 1-5
        const tiers = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];
        tiers.forEach(tier => {
            const col = document.querySelector(`.${columnsClass} .kit-tier-col[data-tier="${tier}"] .kit-tier-list`);
            if (!col) return;
            // Filtrovat hráče, kteří mají tento tier v daném kitu
            players.forEach(player => {
                if (player.kits[kitKey] === tier) {
                    const div = document.createElement('div');
                    div.className = 'kit-player';
                    div.innerHTML = `
                  <img src='https://render.crafty.gg/3d/bust/${player.nick}' alt='skin' style='width:32px;height:32px;border-radius:8px;margin-right:8px;vertical-align:middle;'>
                  <span>${player.nick}</span>
                `;
                    div.style.cursor = "pointer";
                    div.onclick = () => showPlayerModal(player);
                    col.appendChild(div);
                }
            });
        });
    }

    function renderAllKits(players) {
        const kitMap = {
            cpvp: 'cpvp-columns',
            axe: 'axe-columns',
            sword: 'sword-columns',
            uhc: 'uhc-columns',
            npot: 'npot-columns',
            pot: 'pot-columns',
            smp: 'smp-columns',
            diasmp: 'diasmp-columns',
            mace: 'mace-columns'
        };
        const tierNames = {
            'HT1': 'Tier 1', 'LT1': 'Tier 1',
            'HT2': 'Tier 2', 'LT2': 'Tier 2',
            'HT3': 'Tier 3', 'LT3': 'Tier 3',
            'HT4': 'Tier 4', 'LT4': 'Tier 4',
            'HT5': 'Tier 5', 'LT5': 'Tier 5'
        };
        Object.entries(kitMap).forEach(([kit, columnsClass]) => {
            document.querySelectorAll(`.${columnsClass} .kit-tier-list`).forEach(el => el.innerHTML = '');
            players.forEach(player => {
                const tierLabel = player.kits[kit];
                if (!tierLabel) return;
                const tier = tierNames[tierLabel] || tierLabel;
                const col = document.querySelector(`.${columnsClass} .kit-tier-col[data-tier="${tier}"] .kit-tier-list`);
                if (col) {
                    const div = document.createElement('div');
                    div.className = 'kit-player';
                    div.innerHTML = `
                  <img src='https://render.crafty.gg/3d/bust/${player.nick}' alt='skin' style='width:32px;height:32px;border-radius:8px;margin-right:8px;vertical-align:middle;'>
                  <span>${player.nick}</span>
                `;
                    div.style.cursor = "pointer";
                    div.onclick = () => showPlayerModal(player);
                    col.appendChild(div);
                }
            });
        });
    }

    // Autocomplete funkcionalita pro vyhledávání
    function initAutocomplete(players) {
        allPlayers = players;
        const searchInput = document.getElementById('search-input');
        const searchForm = document.getElementById('search-form');
        
        if (!searchInput || !searchForm) return;
        if (autocompleteInitialized) return; // Už je inicializovaný
        autocompleteInitialized = true;

        // Zabráň defaultnímu submit chování
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
        });

        // Vytvoř dropdown container
        let suggestionsDiv = document.querySelector('.search-suggestions');
        if (!suggestionsDiv) {
            suggestionsDiv = document.createElement('div');
            suggestionsDiv.className = 'search-suggestions';
            searchForm.appendChild(suggestionsDiv);
        }

        // Input handler
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim().toLowerCase();
            currentSuggestionIndex = -1;

            if (query.length === 0) {
                suggestionsDiv.classList.remove('active');
                return;
            }

            // Filtruj hráče
            const matches = allPlayers.filter(player => 
                player.nick && player.nick.toLowerCase().includes(query)
            ).slice(0, 8); // Max 8 návrhů

            if (matches.length === 0) {
                suggestionsDiv.innerHTML = '<div class="search-suggestions-empty">Žádní hráči nenalezeni</div>';
                suggestionsDiv.classList.add('active');
                return;
            }

            // Vygeneruj návrhy
            suggestionsDiv.innerHTML = matches.map((player, index) => `
                <div class="search-suggestion-item" data-index="${index}" data-nick="${player.nick}">
                    <img src="https://mc-heads.net/avatar/${player.nick}/32" alt="${player.nick}" class="player-avatar" loading="lazy">
                    <div class="player-details">
                        <div class="name">${player.nick}</div>
                    </div>
                </div>
            `).join('');
            suggestionsDiv.classList.add('active');

            // Přidej click handlery
            suggestionsDiv.querySelectorAll('.search-suggestion-item').forEach(item => {
                    item.addEventListener('click', function() {
                    const nick = this.dataset.nick;
                    const player = allPlayers.find(p => p.nick === nick);
                    if (player) {
                        // Najdi pozici hráče v seřazeném seznamu
                        const sortedPlayers = [...allPlayers].sort((a, b) => b.score - a.score);
                        let lastScore = null;
                        let lastRank = 0;
                        let position = 1;
                        
                        for (let i = 0; i < sortedPlayers.length; i++) {
                            const p = sortedPlayers[i];
                            const currentRank = (p.score === lastScore) ? lastRank : (i + 1);
                            const isMatch = (player.discordId && p.discordId === player.discordId) || p.nick === player.nick;
                            if (isMatch) {
                                position = currentRank;
                                break;
                            }
                            lastScore = p.score;
                            lastRank = currentRank;
                        }
                        
                        // Vygeneruj kits HTML pro modal
                        const sortedTiers = (player.tiers || [])
                            .filter(t => t.tier && t.tier !== "-")
                            .sort((a, b) => getTierOrder(a.tier) - getTierOrder(b.tier));
                        
                        const kitsHtml = sortedTiers.map(t => {
                            const info = tierInfo(String(t.tier));
                            const origText = getOriginalTierText(String(t.tier));
                            let style = "";
                            let circleColor = "";
                            if (origText.startsWith("R")) {
                                style = "background:#23242a;color:" + info.barvaTextu + ";";
                                circleColor = "#23242a";
                            } else {
                                style = "background:" + info.barvaPozadi + ";color:#23242a;";
                                circleColor = info.barvaPozadi;
                            }
                            const ptsDisplay = t.peakTierText ? PEAK_TIER_SCORE[t.peakTierText] : t.tier;
                            const peakExtra = t.peakTierText ? '<br><span style="font-size:0.85em;opacity:0.7;">Peak: ' + t.peakTierText + '</span>' : '';
                            return '<span class="kit-badge tooltip" data-kit-icon="' + t.icon + '" style="--tier-color:' + (origText.startsWith('R') ? info.barvaTextu : info.barvaPozadi) + ';">' +
                                '<span class="kit-icon-circle" style="border-color:' + circleColor + ';">' +
                                '<img src="' + t.icon + '" alt="" class="kit-icon" loading="lazy">' +
                                '</span>' +
                                '<span class="kit-tier-text" style="' + style + '">' +
                                info.novyText +
                                '</span>' +
                                '<span class="tooltiptext">' +
                                '<strong>' + origText + '</strong><br>' +
                                ptsDisplay + ' pts' + peakExtra +
                                '</span>' +
                                '</span>';
                        }).join('');
                        
                        showPlayerModal({
                            name: player.nick,
                            position: position,
                            score: player.score,
                            skin: 'https://mc-heads.net/avatar/' + (player.uuid || player.nick) + '/64',
                            kitsHtml: kitsHtml,
                            tiers: player.tiers,
                            nick: player.nick,
                            discordId: player.discordId || ''
                        });
                        searchInput.value = '';
                        suggestionsDiv.classList.remove('active');
                    }
                });
            });

            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentSuggestionIndex = Math.min(currentSuggestionIndex + 1, suggestions.length - 1);
                updateSuggestionSelection(suggestions);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentSuggestionIndex = Math.max(currentSuggestionIndex - 1, -1);
                updateSuggestionSelection(suggestions);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (currentSuggestionIndex >= 0 && suggestions[currentSuggestionIndex]) {
                    suggestions[currentSuggestionIndex].click();
                } else if (suggestions.length > 0) {
                    suggestions[0].click();
                }
            } else if (e.key === 'Escape') {
                suggestionsDiv.classList.remove('active');
                searchInput.blur();
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchForm.contains(e.target)) {
                suggestionsDiv.classList.remove('active');
            }
        });

        // "/" shortcut
        document.addEventListener('keydown', function(e) {
            if (e.key === '/' && document.activeElement !== searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
        });
    }

    function updateSuggestionSelection(suggestions) {
        suggestions.forEach((item, index) => {
            if (index === currentSuggestionIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

});
