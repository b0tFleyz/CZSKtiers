document.addEventListener('DOMContentLoaded', async function () {

    // Autocomplete proměnné - definovány na začátku
    let allPlayers = [];
    let currentSuggestionIndex = -1;
    let autocompleteInitialized = false;

    // Nastavení a vzhled karty hráče žijí v js/player-card.js (CZSKCard) —
    // dřív tu byla kopie, kvůli které vypadala karta na kit stránkách jinak.

    // currentTier je potřeba, aby se nedalo "potvrdit" držení tieru, který
    // hráč dávno nemá a jen k němu chybí záznam o demotu.
    function getPeakTierTextFromHistory(discordId, kitIcon, currentTier) {
        return computePeakTierText((tierHistory[discordId] || {})[kitIcon] || [], currentTier);
    }

    // Extracts peak tier info from TierHistory worksheet (already in-memory)
    let _tierHistoryRowIdx = 0; // global row counter for ordering
    function processTierHistoryFromSheet(worksheet, nickToDiscordId) {
        const iconMap = {
            'Crystal': 'kit_icons/cpvp.png',
            'Axe': 'kit_icons/axe.png',
            'Sword': 'kit_icons/sword.png',
            'UHC': 'kit_icons/uhc.png',
            'Npot': 'kit_icons/npot.png', 'NPot': 'kit_icons/npot.png',
            'Pot': 'kit_icons/pot.png',
            'SMP': 'kit_icons/smp.png',
            'DiaSMP': 'kit_icons/diasmp.png',
            'Mace': 'kit_icons/mace.png',
            'Speed': 'kit_icons/speed.png',
            'OGV': 'kit_icons/OGV.png',
            'Cart': 'kit_icons/cart.png',
            'Creeper': 'kit_icons/creeper.png',
            'DiaVanilla': 'kit_icons/diavanilla.png',
            'Trident': 'kit_icons/trident.png',
            'Manhunt': 'kit_icons/manhunt.png',
            'Elytra': 'kit_icons/elytra.png',
            'Bow': 'kit_icons/bow.png',
            'Bed': 'kit_icons/bed.png',
            'Debuff': 'kit_icons/debuff.png'
        };
        const lookup = nickToDiscordId || {};
        const rows = XLSX.utils.sheet_to_json(worksheet);
        rows.forEach(row => {
            if (!row.Kit || !row.Tier) return;
            let discordId = row['Discord ID'] ? String(row['Discord ID']).trim() : null;
            // Fallback: if Discord ID is missing, try to find it by Nick
            if (!discordId && row.Nick) {
                const nick = String(row.Nick).trim().toLowerCase();
                discordId = lookup[nick] || null;
            }
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
            tierHistory[discordId][icon].push({ tier, date, note, kit, oldTier, _rowIdx: _tierHistoryRowIdx++ });
        });
    }

    // Guild-aware kit configuration
    const _guild = (typeof getActiveGuild === 'function') ? getActiveGuild() : 'czsktiers';
    const _conf = (typeof getGuildConf === 'function') ? getGuildConf(_guild) : null;

    const CZSK_KITS = [
        { key: "Crystal", icon: "kit_icons/cpvp.png" },
        { key: "Axe", icon: "kit_icons/axe.png" },
        { key: "Sword", icon: "kit_icons/sword.png" },
        { key: "UHC", icon: "kit_icons/uhc.png" },
        { key: "Npot", icon: "kit_icons/npot.png" },
        { key: "Pot", icon: "kit_icons/pot.png" },
        { key: "SMP", icon: "kit_icons/smp.png" },
        { key: "DiaSMP", icon: "kit_icons/diasmp.png" },
        { key: "Mace", icon: "kit_icons/mace.png" }
    ];
    const SUB_KITS = [
        { key: "Speed", icon: "kit_icons/speed.png" },
        { key: "OGV", icon: "kit_icons/OGV.png" },
        { key: "Cart", icon: "kit_icons/cart.png" },
        { key: "Creeper", icon: "kit_icons/creeper.png" },
        { key: "DiaVanilla", icon: "kit_icons/diavanilla.png" },
        { key: "Trident", icon: "kit_icons/trident.png" },
        { key: "Manhunt", icon: "kit_icons/manhunt.png" },
        { key: "Elytra", icon: "kit_icons/elytra.png" },
        { key: "Bow", icon: "kit_icons/bow.png" },
        { key: "Bed", icon: "kit_icons/bed.png" },
        { key: "Debuff", icon: "kit_icons/debuff.png" }
    ];
    const kits = (_guild === 'subtiers') ? SUB_KITS : CZSK_KITS;

    let overallData = [];
    let discordIdToNick = {}; // Discord ID → Nick, built from spreadsheet data
    let tierHistory = {}; // keyed by discordId → kitIcon → [{tier, date, note, kit, oldTier}]

    // Drzime referenci, at se pri kazdem prekresleni (filtr) nehromadi observery.
    let _overallObserver = null;

    // Time Machine state
    let _tmActive = false;
    let _tmBlacklistedIds = new Set();
    let _originalOverallData = null;

    // Load card settings from localStorage for the logged-in user
    function getMyCardSettings() {
        try {
            const auth = window.CZSKAuth && CZSKAuth.getCurrentUser();
            if (!auth || !auth.nick) return null;
            const raw = localStorage.getItem('czsktiers_card_' + auth.nick.toLowerCase());
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }
    // Načti overall jako pole objektů a vygeneruj karty
    async function nactiOverallExcel() {
        const workbook = await getWorkbook();

        // Pick correct sheet tab for active guild
        const _sheetTab = _conf ? _conf.sheetTab : null;
        const _histTab = _conf ? _conf.tierHistoryTab : 'TierHistory';

        // Pre-build Nick ↔ Discord ID mappings from Overall + TierHistory
        // so we can fill in missing Discord IDs/Nicks in TierHistory rows
        const nickToDiscordId = {};
        // 1) From Overall sheet
        const _preSheet = _sheetTab ? workbook.Sheets[_sheetTab] : workbook.Sheets[workbook.SheetNames[0]];
        if (_preSheet) {
            XLSX.utils.sheet_to_json(_preSheet).forEach(r => {
                const did = r['Discord ID'] ? String(r['Discord ID']).trim() : null;
                const nick = r.Nick ? String(r.Nick).trim() : null;
                if (did && nick) {
                    nickToDiscordId[nick.toLowerCase()] = did;
                    if (!discordIdToNick[did]) discordIdToNick[did] = nick;
                }
            });
        }
        // 2) From TierHistory rows that DO have both Nick and Discord ID (covers old nicks)
        const histSheetName = workbook.SheetNames.find(n => n === _histTab) || workbook.SheetNames.find(n => n === 'TierHistory');
        if (histSheetName) {
            XLSX.utils.sheet_to_json(workbook.Sheets[histSheetName]).forEach(r => {
                const did = r['Discord ID'] ? String(r['Discord ID']).trim() : null;
                const nick = r.Nick ? String(r.Nick).trim() : null;
                if (did && nick) {
                    const key = nick.toLowerCase();
                    if (!nickToDiscordId[key]) nickToDiscordId[key] = did;
                    if (!discordIdToNick[did]) discordIdToNick[did] = nick;
                }
            });
        }

        // Process TierHistory from the same workbook so peak tiers are available immediately
        if (histSheetName) {
            processTierHistoryFromSheet(workbook.Sheets[histSheetName], nickToDiscordId);
        }

        // Also load the OTHER guild's tier history for cross-guild achievements (Tierlist GOD)
        const _otherGuild = _guild === 'subtiers' ? 'czsktiers' : 'subtiers';
        const _otherConf = (typeof getGuildConf === 'function') ? getGuildConf(_otherGuild) : null;
        if (_otherConf) {
            const otherHistTab = _otherConf.tierHistoryTab;
            const otherHistSheet = workbook.SheetNames.find(n => n === otherHistTab);
            if (otherHistSheet) {
                processTierHistoryFromSheet(workbook.Sheets[otherHistSheet], nickToDiscordId);
            }
        }

        // Load the other guild's data sheet to check current tiers across both guilds
        const _otherKits = _otherGuild === 'subtiers' ? SUB_KITS : CZSK_KITS;
        const _otherSheetTab = _otherConf ? _otherConf.sheetTab : null;
        let otherWorksheet = _otherSheetTab ? workbook.Sheets[_otherSheetTab] : null;
        if (!otherWorksheet && _otherGuild === 'czsktiers') otherWorksheet = workbook.Sheets[workbook.SheetNames[0]];
        const otherGuildCurrentTiers = {}; // discordId → Set<kitIcon>
        if (otherWorksheet) {
            const otherRows = XLSX.utils.sheet_to_json(otherWorksheet);
            otherRows.forEach(row => {
                const did = row['Discord ID'] ? String(row['Discord ID']).trim() : null;
                if (!did) return;
                if (!otherGuildCurrentTiers[did]) otherGuildCurrentTiers[did] = new Set();
                _otherKits.forEach(kit => {
                    const val = parseInt(row[kit.key]);
                    if (!isNaN(val) && val > 0) otherGuildCurrentTiers[did].add(kit.icon);
                });
            });
        }

        // Select data sheet based on guild
        let worksheet;
        if (_sheetTab) {
            worksheet = workbook.Sheets[_sheetTab];
        }
        if (!worksheet) {
            worksheet = workbook.Sheets[workbook.SheetNames[0]];
        }
        const rows = XLSX.utils.sheet_to_json(worksheet);

        // Ensure discordIdToNick is fully populated (in case pre-build used different sheet ref)
        rows.forEach(row => {
            const discordId = row['Discord ID'] ? String(row['Discord ID']).trim() : null;
            const nick = row.Nick ? String(row.Nick).trim() : null;
            if (discordId && nick) discordIdToNick[discordId] = nick;
        });

        overallData = rows.map(row => {
            const discordId = row['Discord ID'] ? String(row['Discord ID']).trim() : '';
            // Build tiers dynamically from active guild's kit list
            const tiers = kits.map(kit => ({
                tier: row[kit.key],
                icon: kit.icon
            }));
            // Score = max(current tier, peak tier bonus) per kit
            let overallScore = 0;
            tiers.forEach(t => {
                const val = parseInt(t.tier);
                if (!isNaN(val)) {
                    // Bez USE_DERIVED_PEAK se skóre bere výhradně z tabulky —
                    // odvozený peak z neúplné historie jinak hráče neprávem
                    // vystřelí v žebříčku nahoru (viz komentář v tier-utils.js).
                    const peakText = (USE_DERIVED_PEAK && discordId)
                        ? getPeakTierTextFromHistory(discordId, t.icon, getOriginalTierText(String(t.tier)))
                        : null;
                    const peakScore = peakText ? (PEAK_TIER_SCORE[peakText] || 0) : 0;
                    overallScore += Math.max(val, peakScore);
                    t.peakTierText = (peakScore > val) ? peakText : null;
                    t.peak = peakText || null;
                    t.canRetire = !!peakText && ['LT2', 'HT2', 'LT1', 'HT1'].indexOf(peakText) !== -1;
                }
            });
            // Count current-guild tested kits
            const testedCurrentKits = new Set();
            tiers.forEach(t => {
                const val = parseInt(t.tier);
                if (!isNaN(val) && val > 0) testedCurrentKits.add(t.icon);
            });
            // Cross-guild tested kit icons
            const otherKitSet = (discordId && otherGuildCurrentTiers[discordId]) ? otherGuildCurrentTiers[discordId] : new Set();
            // Merge with tier history entries for comprehensive coverage
            const allTestedIcons = new Set([...testedCurrentKits, ...otherKitSet]);
            if (discordId && tierHistory[discordId]) {
                for (const icon of Object.keys(tierHistory[discordId])) {
                    if (tierHistory[discordId][icon].length > 0) allTestedIcons.add(icon);
                }
            }

            return {
                uuid: row.UUID,
                nick: row.Nick,
                discordId,
                score: overallScore,
                tiers: tiers,
                hallOfFame: row['HallOfFame'] ? true : false,
                tester: row['Tester'] ? true : false,
                allTestedIcons: allTestedIcons
            };
        });

        renderOverall(overallData);
    }

    // === Rychlá cesta: snapshot vygenerovaný botem ======================
    // Hlavní stránka díky tomu nestahuje celý XLSX workbook (oba servery +
    // obě TierHistory záložky) ani SheetJS — jen ~74 KB JSON. Historie se
    // dotahuje až na vyžádání (viz ensureHistoryLoaded).
    // Umí tahle verze data-source.js všechno, co po ní chceme?
    // Web a data-source.js se nasazují zvlášť, takže se verze můžou rozejít —
    // a jeden chybějící pomocník nesmí znamenat rozbitou stránku.
    function snapshotApiReady() {
        return typeof CZSKData !== 'undefined'
            && typeof CZSKData.loadOverall === 'function'
            && typeof CZSKData.toOverallData === 'function';
    }

    async function nactiOverallSnapshot() {
        if (!snapshotApiReady()) {
            const e = new Error('data-source.js je starší verze nebo chybí');
            e.missing = true;
            throw e;
        }
        const snap = await CZSKData.loadOverall(_guild);
        overallData = CZSKData.toOverallData(snap, _guild);
        overallData.forEach(p => {
            if (p.discordId && p.nick) discordIdToNick[p.discordId] = p.nick;
        });
        renderOverall(overallData);
    }

    // Historii potřebují jen detailní pohledy (karta hráče, grafy, porovnání).
    // Zavolej a počkej, než sáhneš na `tierHistory`.
    let _historyPromise = null;
    async function ensureHistoryLoaded() {
        if (_usingSnapshot === false) return;              // XLSX cesta ji má už v paměti
        if (typeof CZSKData === 'undefined'
            || typeof CZSKData.hydrateHistory !== 'function'
            || typeof CZSKData.isHistoryLoaded !== 'function') return;
        if (CZSKData.isHistoryLoaded(_guild)) return;
        if (!_historyPromise) {
            const other = _guild === 'subtiers' ? 'czsktiers' : 'subtiers';
            _historyPromise = Promise.all([
                CZSKData.hydrateHistory(_guild, tierHistory),
                CZSKData.hydrateHistory(other, tierHistory).catch(() => {})
            ]);
        }
        await _historyPromise;
    }
    window.ensureHistoryLoaded = ensureHistoryLoaded;

    // Načti overall jako karty s error handlingem
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');

    let _usingSnapshot = null;
    try {
        try {
            await nactiOverallSnapshot();
            _usingSnapshot = true;
        } catch (snapErr) {
            // Snapshot ještě neexistuje (bot neběžel) — spadni na starou cestu,
            // ať se stránka nikdy nerozbije kvůli chybějícím datům.
            const _snapOn = (typeof CZSKData !== 'undefined'
                && typeof CZSKData.usingSnapshot === 'function')
                ? CZSKData.usingSnapshot() : null;
            console.info(_snapOn === false
                ? '[data] zdroj: XLSX (snapshot vypnutý v js/data-source.js)'
                : '[data] snapshot nedostupný, načítám XLSX: ' + snapErr.message);
            _usingSnapshot = false;
            await nactiOverallExcel();
        }
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        const tabulka = document.getElementById('overall-tabulka');
        if (tabulka) tabulka.classList.remove('tabulka-loading');
    } catch (error) {
        console.error('Error loading data:', error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (errorMessage) errorMessage.style.display = 'block';
    }

    // Get earliest tier history date for a player (how long on tierlist)
    function getPlayerFirstDate(discordId) {
        // Snapshot posila prvni datum rovnou, takze hlavni stranka kvuli nemu
        // nemusi stahovat celou historii.
        if (!discordId) return null;
        if (!tierHistory[discordId]) {
            const p = overallData.find(x => x.discordId === discordId);
            return (p && p.firstDate) || null;
        }
        let earliest = Infinity;
        for (const entries of Object.values(tierHistory[discordId])) {
            for (const e of entries) {
                const ts = parseCzechDate(e.date);
                if (ts && ts < earliest) earliest = ts;
            }
        }
        return earliest === Infinity ? null : earliest;
    }

    // Single source of truth for the kit-badge markup shown on cards and in the
    // player modal. Expects tier objects already filtered + sorted by the caller.
    function _pEsc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function buildKitBadgesHtml(sortedTiers) {
        return sortedTiers.map(t => {
            const info = tierInfo(String(t.tier));
            const origText = getOriginalTierText(String(t.tier));
            let style, circleColor;
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
                            ${(t.peakTierText && PEAK_TIER_SCORE[t.peakTierText]) || t.tier} pts${t.peakTierText ? `<br><span style="font-size:0.85em;opacity:0.7;">Peak: ${t.peakTierText}</span>` : ''}
                        </span>
                    </span>
                `;
        }).join('');
    }

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

            let rankColor, rankColorRGB;
            if (rank === 1) { rankColor = '#eecd14'; rankColorRGB = '238,205,20'; }
            else if (rank === 2) { rankColor = '#c0c0c0'; rankColorRGB = '192,192,192'; }
            else if (rank === 3) { rankColor = '#cd7f32'; rankColorRGB = '205,127,50'; }
            else { rankColor = '#555555'; rankColorRGB = '85,85,85'; }

            const sortedTiers = player.tiers
                .filter(t => t.tier && t.tier !== "-")
                .sort((a, b) => {
                    // Sort by effective tier (peak > current) for priority
                    const aVal = a.peakTierText ? resolveTierValue(a.peakTierText) : String(a.tier);
                    const bVal = b.peakTierText ? resolveTierValue(b.peakTierText) : String(b.tier);
                    return getTierOrder(aVal) - getTierOrder(bVal);
                });

            const kitsHtml = buildKitBadgesHtml(sortedTiers);

            playerCards.push({
                rank,
                rankColor,
                rankColorRGB,
                player,
                kitsHtml
            });
        });
        
        // Funkce pro vytvoření DOM elementu karty
        function createCard(cardData, index) {
            const { rank, rankColor, rankColorRGB, player, kitsHtml } = cardData;
            const card = document.createElement('div');
            card.className = 'player-card card-enter';
            card.style.setProperty('--rank-color', rankColor);
            card.style.setProperty('--rank-color-rgb', rankColorRGB);
            card.style.setProperty('--card-i', String(index));

            // Score title
            const st = getScoreTitle(player.score);

            card.innerHTML = `
                <div class="card-header compact-row">
                    <div class="rank-badge" style="background:${rankColor}; color:#23242a;">${rank}</div>
                    <div class="skin-bg rank-${rank}">
                        <img class="skin" src="https://mc-heads.net/avatar/${player.uuid}/64" alt="${escapeXml(player.nick)}" loading="lazy" decoding="async" fetchpriority="${rank <= 3 ? 'high' : 'low'}">
                    </div>
                    <div class="player-info">
                        <div class="player-name">${escapeXml(player.nick)}</div>
                        <div class="score-row">
                            <span class="score score-clickable" title="Zobrazit graf bodů">${player.score}</span>
                            <span class="score-title" style="--st-color:${st.color};">${st.title}</span>
                        </div>
                    </div>
                    <div class="kits-row">${kitsHtml}</div>
                </div>
            `;

            // Time Machine: blacklisted player styling
            if (_tmActive && _tmBlacklistedIds.has(player.discordId)) {
                card.classList.add('tm-blacklisted');
                const nameEl = card.querySelector('.player-name');
                if (nameEl) {
                    nameEl.textContent = '???';
                    nameEl.insertAdjacentHTML('afterend', '<span class="tm-blacklisted-tag">blacklistnutý</span>');
                }
                // Replace skin with placeholder
                const skinImg = card.querySelector('.skin');
                if (skinImg) {
                    skinImg.src = 'https://mc-heads.net/avatar/MHF_Question/64';
                    skinImg.alt = '???';
                }
                // Blacklisted players are not clickable
                card.style.pointerEvents = 'none';
                card.style.cursor = 'default';
                return card;
            }

            // Score click — show score history graph
            const scoreEl = card.querySelector('.score-clickable');
            if (scoreEl) {
                scoreEl.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await ensureHistoryLoaded();
                    showScoreGraph(player.nick, player.discordId || '', player.score);
                });
            }

            card.addEventListener('click', () => {
                showPlayerModal({
                    name: player.nick,
                    position: rank,
                    score: player.score,
                    skin: `https://mc-heads.net/avatar/${player.uuid}/64`,
                    kitsHtml: kitsHtml,
                    tiers: player.tiers,
                    nick: player.nick,
                    discordId: player.discordId || '',
                    hallOfFame: player.hallOfFame,
                    tester: player.tester,
                    allTestedIcons: player.allTestedIcons
                });
            });
            return card;
        }
        
        // Načti prvních INITIAL_LOAD karet
        function loadMoreCards() {
            const fragment = document.createDocumentFragment();
            const end = Math.min(currentlyLoaded + (currentlyLoaded === 0 ? INITIAL_LOAD : LOAD_MORE), playerCards.length);
            const batchStart = currentlyLoaded;
            
            for (let i = currentlyLoaded; i < end; i++) {
                fragment.appendChild(createCard(playerCards[i], i - batchStart));
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
        
        if (_overallObserver) { try { _overallObserver.disconnect(); } catch (e) {} }
        const observer = _overallObserver = new IntersectionObserver((entries) => {
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
        
        // ========== STATS BADGE (before recently tested so it's always first) ==========
        renderStatsDashboard(overallData);
        // ========== RECENTLY TESTED ==========
        try { renderRecentlyTested(); } catch(e) { console.warn('renderRecentlyTested error:', e); }
    }

    // ========== STATS: COUNT-UP PLAYER COUNTER ==========
    function renderStatsDashboard(data) {
        if (typeof updatePlayerCount === 'function') {
            updatePlayerCount(data.length);
        }
    }

    function renderRecentlyTested() {
        const recentEl = document.getElementById('recently-tested');
        if (!recentEl) return;
        
        // Collect all tier history entries with dates
        const allEntries = [];
        for (const [discordId, kitsObj] of Object.entries(tierHistory)) {
            for (const [icon, entries] of Object.entries(kitsObj)) {
                for (const entry of entries) {
                    if (!entry.date) continue;
                    // Skip retires (tier starts with R or oldTier exists and tier is retired variant)
                    const tierStr = String(entry.tier || '').trim();
                    if (tierStr.startsWith('R')) continue;
                    // Also detect retires stored as numeric values (e.g. 22 = RLT2)
                    const resolvedCheck = resolveTierValue(tierStr);
                    if (resolvedCheck) {
                        const origCheck = getOriginalTierText(resolvedCheck);
                        if (origCheck.startsWith('R')) continue;
                    }
                    // Skip if this is just a "hold" or no actual tier change
                    if (entry.oldTier && String(entry.oldTier).trim() === tierStr) continue;
                    // Only show TopResult-level tiers (HT3+), skip LT5-LT3
                    const numVal = resolvedCheck ? parseInt(resolvedCheck, 10) : NaN;
                    if (!numVal || numVal <= 10) continue;
                    const ts = parseCzechDate(entry.date);
                    if (!ts) continue;
                    // Find player nick from discordIdToNick map
                    const nick = discordIdToNick[discordId] || null;
                    if (!nick) continue;
                    // Find UUID from overallData
                    const playerData = overallData.find(p => p.nick === nick || p.discordId === discordId);
                    // Skip if player's current tier for this kit is a retire tier
                    if (playerData) {
                        const curTierObj = playerData.tiers.find(t => t.icon === icon);
                        if (curTierObj) {
                            const curVal = String(curTierObj.tier || '').trim();
                            const curResolved = resolveTierValue(curVal);
                            if (curResolved) {
                                const curOrig = getOriginalTierText(curResolved);
                                if (curOrig.startsWith('R')) continue;
                            }
                        }
                    }
                    allEntries.push({
                        nick,
                        uuid: playerData ? playerData.uuid : null,
                        kit: entry.kit,
                        icon,
                        tier: entry.tier,
                        oldTier: entry.oldTier || null,
                        date: entry.date,
                        ts,
                        _rowIdx: entry._rowIdx ?? 0
                    });
                }
            }
        }
        
        if (allEntries.length === 0) { recentEl.style.display = 'none'; return; }
        
        // Sort by sheet row descending (last added = newest), fallback to date
        allEntries.sort((a, b) => b._rowIdx - a._rowIdx);

        // Split entries by guild
        const czskIcons = new Set(CZSK_KITS.map(k => k.icon));
        const subIcons = new Set(SUB_KITS.map(k => k.icon));
        const czskEntries = allEntries.filter(e => czskIcons.has(e.icon));
        const subEntries = allEntries.filter(e => subIcons.has(e.icon));

        function buildCards(entries, limit) {
            const latest = entries.slice(0, limit);
            let html = '';
            for (const e of latest) {
                const resolved = resolveTierValue(e.tier);
                const info = resolved ? tierInfo(resolved) : { novyText: e.tier, barvaPozadi: '#655B79', barvaTextu: '#23242a' };
                const origText = resolved ? getOriginalTierText(resolved) : e.tier;
                const isR = origText.startsWith('R');
                const badgeStyle = isR
                    ? `background:#23242a;color:${info.barvaTextu};border:1px solid ${info.barvaTextu};`
                    : `background:${info.barvaPozadi};color:#23242a;`;
                let dirHtml = '';
                if (e.oldTier) {
                    const oldVal = resolveTierValue(e.oldTier);
                    const newVal = resolveTierValue(e.tier);
                    if (oldVal && newVal) {
                        const oldIdx = getTierOrder(oldVal);
                        const newIdx = getTierOrder(newVal);
                        if (newIdx < oldIdx) dirHtml = '<span class="recent-dir recent-up">&#9650;</span>';
                        else if (newIdx > oldIdx) dirHtml = '<span class="recent-dir recent-dn">&#9660;</span>';
                    }
                }
                const avatarSrc = e.uuid ? `https://mc-heads.net/avatar/${e.uuid}/32` : '';
                const kitIconSrc = e.icon || '';
                html += `
                    <div class="recent-card">
                        ${avatarSrc ? `<img class="recent-avatar" src="${avatarSrc}" alt="" loading="lazy">` : ''}
                        <div class="recent-info">
                            <span class="recent-nick">${escapeXml(e.nick)}</span>
                            <span class="recent-date">${escapeXml(e.date)}</span>
                        </div>
                        ${kitIconSrc ? `<img class="recent-kit-icon" src="${kitIconSrc}" alt="${escapeXml(e.kit || '')}" title="${escapeXml(e.kit || '')}">` : ''}
                        <span class="recent-badge" style="${badgeStyle}">${info.novyText}</span>
                        ${dirHtml}
                    </div>`;
            }
            return html;
        }

        let html = '';
        if (_guild === 'czsktiers' && czskEntries.length > 0) {
            html += '<div class="recent-header">Nedávno testováno — CZSKTiers</div><div class="recent-cards">';
            html += buildCards(czskEntries, 8);
            html += '</div>';
        }
        if (_guild === 'subtiers' && subEntries.length > 0) {
            html += '<div class="recent-header">Nedávno testováno — SubTiers</div><div class="recent-cards">';
            html += buildCards(subEntries, 8);
            html += '</div>';
        }

        recentEl.innerHTML = html;
        recentEl.style.display = '';
    }

    // ========== TIER JOURNEY ==========

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

    // Tier Journey bydlí v js/tier-journey-view.js (sdílené s kit stránkami).
    // Tady se mu jen řekne, odkud brát data téhle stránky.
    if (typeof CZSKJourney !== 'undefined') {
        CZSKJourney.configure({
            getHistory: function (discordId, kitIcon) {
                return (discordId && tierHistory[discordId] && tierHistory[discordId][kitIcon]) || [];
            },
            getTierEntry: function (discordId, kitIcon) {
                var p = overallData.find(function (x) { return x.discordId === discordId; })
                     || allPlayers.find(function (x) { return x.discordId === discordId; });
                return p && p.tiers ? p.tiers.find(function (t) { return t.icon === kitIcon; }) : null;
            },
            nickOf: function (discordId) { return discordIdToNick[discordId] || null; }
        });
    }

    // MODAL funkce
    async function showPlayerModal({ name, position, score, skin, kitsHtml, tiers, nick, discordId, hallOfFame, tester, allTestedIcons }) {
        // Karta hráče potřebuje tier historii (achievementy, tier journey).
        // Na hlavní stránce se nestahuje — dotáhne se až tady, při prvním otevření.
        await ensureHistoryLoaded();
        const modal = document.getElementById('player-modal');
        const content = modal.querySelector('.player-modal-content');
        const banner = modal.querySelector('#player-modal-banner');
        const bioEl = modal.querySelector('#player-modal-bio');
        const nameEl = modal.querySelector('.player-modal-name');
        const favkitEl = modal.querySelector('#player-modal-favkit');
        const decoWrap = modal.querySelector('#avatar-deco-wrap');

        // Show modal immediately with loading state
        content.classList.add('modal-loading');
        modal.style.display = 'flex';

        // Vzhled karty řeší sdílený modul js/player-card.js — dřív tu byla
        // vlastní kopie a karta na kit stránkách proto vypadala jinak.
        let cardSettings = null;
        const playerNick = nick || name || '';
        try {
          cardSettings = await CZSKCard.loadCardSettings(playerNick);
        } catch (e) { /* Firestore nedostupné */ }
        if (!cardSettings) {
          const auth = window.CZSKAuth && CZSKAuth.getCurrentUser();
          const isMyCard = auth && auth.nick && auth.nick.toLowerCase() === playerNick.toLowerCase();
          if (isMyCard) cardSettings = getMyCardSettings();
        }
        CZSKCard.resetCard(modal);
        content.className = 'player-modal-content modal-loading';
        CZSKCard.applyCardSettings(modal, cardSettings);

        // Set player name
        nameEl.textContent = name;

        // Nastav barvu podle pořadí
        let rankClass = "rank-other";
        if (position === 1) rankClass = "rank-1";
        else if (position === 2) rankClass = "rank-2";
        else if (position === 3) rankClass = "rank-3";

        const rankElem = modal.querySelector('.player-modal-rank');
        rankElem.className = "player-modal-rank " + rankClass;
        rankElem.textContent = position + ".";

        modal.querySelector('.player-modal-score').textContent = `${score} points`;
        const stModal = getScoreTitle(score);
        const scoreTitleEl = modal.querySelector('.player-modal-score-title');
        if (scoreTitleEl) {
            scoreTitleEl.textContent = stModal.title;
            scoreTitleEl.style.color = stModal.color;
        }
        const daysEl = modal.querySelector('.player-modal-days');
        if (daysEl) {
            const firstDate = getPlayerFirstDate(discordId);
            if (firstDate) {
                const days = Math.floor((Date.now() - firstDate) / (24 * 60 * 60 * 1000));
                daysEl.textContent = `${days} dni na tierlistu`;
                daysEl.style.display = '';
            } else {
                daysEl.style.display = 'none';
            }
        }
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
                const match = sortedTiers.find(t => t.icon === kitIcon);
                if (!match) return;
                badge.classList.add('badge-journey-clickable');
                const fresh = badge.cloneNode(true);
                badge.parentNode.replaceChild(fresh, badge);
                fresh.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await ensureHistoryLoaded();
                    showTierJourney(nick, kitIcon, String(match.tier), discordId);
                });
            });
        }

        // Compute achievements
        const achEl = modal.querySelector('.player-modal-achievements');
        if (achEl) {
            const achList = computeAchievements({ name, position, score, tiers, discordId, hallOfFame, tester, allTestedIcons });
            if (achList.length > 0) {
                achEl.innerHTML = achList.map(a =>
                    `<span class="achievement-badge" style="--ach-color:${a.color};">${a.label}<span class="ach-tip">${a.desc}</span></span>`
                ).join('');
                achEl.style.display = '';
            } else {
                achEl.innerHTML = '';
                achEl.style.display = 'none';
            }
        }

        // Remove loading state — reveal content
        content.classList.remove('modal-loading');

        // Show/hide Rank History button
        const rhBtn = document.getElementById('rank-history-btn');
        if (rhBtn) {
            rhBtn.style.display = discordId ? '' : 'none';
        }
    }

    function computeAchievements({ name, position, score, tiers, discordId, hallOfFame, tester, allTestedIcons }) {
        const achievements = [];
        const validTiers = (tiers || []).filter(t => t.tier && t.tier !== '-');
        const testedKits = validTiers.length;
        const nick = name || '';

        // --- Special personal achievements ---
        if (nick === 'ownedbyshifty') {
            achievements.push({ label: 'Exekutor', desc: 'První tester', color: '#5adc26' });
        }
        if (nick === 'EBAN92') {
            achievements.push({ label: 'EBAN', desc: 'Stvořitel tierlistu', color: '#ff0000' });
        }
        if (nick === 'Fleyz') {
            achievements.push({ label: 'Fleyz', desc: 'Spolumajitel, vytvořil bota a stránky', color: '#eb9525' });
        }

        // --- Position achievements ---

        // Top 3
        if (position === 1) achievements.push({ label: '#1', desc: '1. místo v celkovém leaderboardu', color: '#eecd14' });
        else if (position === 2) achievements.push({ label: '#2', desc: '2. místo v celkovém leaderboardu', color: '#c0c0c0' });
        else if (position === 3) achievements.push({ label: '#3', desc: '3. místo v celkovém leaderboardu', color: '#cd7f32' });

        // Top 10
        if (position >= 4 && position <= 10) {
            achievements.push({ label: 'Top 10', desc: 'Umístění v top 10 celkového leaderboardu', color: '#6366f1' });
        }

        // --- Kit mastery achievements ---

        // Kit Master — has any HT1 tier (value 60)
        if (validTiers.some(t => String(t.tier) === '60')) {
            achievements.push({ label: 'Kit Master', desc: 'Dosáhl HT1 v některém kitu', color: '#FFCF4A' });
        }

        // Elite — has 3+ kits at HT2 or higher (values 32, 48, 60)
        const eliteTiers = validTiers.filter(t => ['32','48','60'].includes(String(t.tier)));
        if (eliteTiers.length >= 3) {
            achievements.push({ label: 'Elite', desc: '3 nebo více kitů na HT2 nebo výše', color: '#f97316' });
        }

        // All-kits — every kit in current guild has a tier
        if (testedKits >= kits.length && kits.length > 0) {
            achievements.push({ label: 'All-kits', desc: 'Testován ve všech kitech', color: '#34d399' });
        }

        // Tierlist GOD — tested on ALL kits across BOTH guilds (14 total)
        const ALL_KIT_ICONS = [...CZSK_KITS, ...SUB_KITS].map(k => k.icon);
        if (allTestedIcons && ALL_KIT_ICONS.every(icon => allTestedIcons.has(icon))) {
            achievements.push({ label: 'Tierlist GOD', desc: 'Testován ve všech kitech na Tiers i Subtiers', color: '#ef4444' });
        }

        // --- Milestone achievements ---

        // První kroky — has exactly 1 point
        if (score === 1) {
            achievements.push({ label: 'První kroky', desc: 'Získal první bod na tierlistu', color: '#94a3b8' });
        }

        // --- Time-based achievements ---

        let earliestDate = Infinity;
        let totalTestCount = 0;
        if (discordId && tierHistory[discordId]) {
            for (const entries of Object.values(tierHistory[discordId])) {
                totalTestCount += entries.length;
                for (const e of entries) {
                    const ts = parseCzechDate(e.date);
                    if (ts && ts < earliestDate) earliestDate = ts;
                }
            }
            const daysSinceFirst = (Date.now() - earliestDate) / (24 * 60 * 60 * 1000);
            const years = daysSinceFirst / 365.25;

            if (years >= 2) {
                achievements.push({ label: '2+ roky', desc: 'Na tierlistu více než 2 roky', color: '#f59e0b' });
            }
            // Unc — 1000+ days on tierlist
            if (daysSinceFirst >= 1000) {
                achievements.push({ label: 'Unc', desc: '1000+ dní na tierlistu', color: '#7c3aed' });
            }
        }

        // --- Test count milestones ---
        if (totalTestCount >= 50) {
            achievements.push({ label: '50+ testů', desc: 'Absolvoval 50 nebo více testů', color: '#14b8a6' });
        }
        if (totalTestCount >= 100) {
            achievements.push({ label: '100+ testů', desc: 'Absolvoval 100 nebo více testů', color: '#0ea5e9' });
        }
        if (totalTestCount >= 200) {
            achievements.push({ label: '200+ testů', desc: 'Absolvoval 200 nebo více testů', color: '#8b5cf6' });
        }

        return achievements;
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

            // Filtruj hráče (skip blacklisted during time travel)
            const matches = allPlayers.filter(player => 
                player.nick && player.nick.toLowerCase().includes(query) &&
                !(_tmActive && _tmBlacklistedIds.has(player.discordId))
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
                        const position = getPositionMap().get(player.nick) || 1;

                        // Vygeneruj kits HTML pro modal
                        const sortedTiers = (player.tiers || [])
                            .filter(t => t.tier && t.tier !== "-")
                            .sort((a, b) => getTierOrder(a.tier) - getTierOrder(b.tier));
                        
                        const kitsHtml = buildKitBadgesHtml(sortedTiers);
                        
                        showPlayerModal({
                            name: player.nick,
                            position: position,
                            score: player.score,
                            skin: 'https://mc-heads.net/avatar/' + (player.uuid || player.nick) + '/64',
                            kitsHtml: kitsHtml,
                            tiers: player.tiers,
                            nick: player.nick,
                            discordId: player.discordId || '',
                            hallOfFame: player.hallOfFame,
                            tester: player.tester,
                            allTestedIcons: player.allTestedIcons
                        });
                        searchInput.value = '';
                        suggestionsDiv.classList.remove('active');
                    }
                });
            });
        });

        // Keyboard navigation (arrow keys / Enter / Escape).
        // NOTE: this must be a separate `keydown` listener — it previously lived
        // inside the `input` handler above, where `e.key` is always undefined,
        // so keyboard navigation silently did nothing.
        searchInput.addEventListener('keydown', function(e) {
            const suggestions = suggestionsDiv.querySelectorAll('.search-suggestion-item');
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

    // ========== PLAYER COMPARISON ==========
    let comparePlayerA = null; // stored from player modal

    // Dense-rank lookup (nick -> rank, ties share a rank), cached by the identity of
    // allPlayers so repeated clicks (autocomplete select, compare, etc.) don't each
    // re-sort the full player list. allPlayers is only ever reassigned (not mutated
    // in place, e.g. on Time Machine toggle), so a reference check is enough to
    // detect staleness.
    let _positionMapCache = { forArray: null, map: null };
    function getPositionMap() {
        if (_positionMapCache.forArray === allPlayers) return _positionMapCache.map;
        const sorted = [...allPlayers].sort((a, b) => b.score - a.score);
        const map = new Map();
        let lastScore = null, lastRank = 0;
        for (let i = 0; i < sorted.length; i++) {
            const rank = (sorted[i].score === lastScore) ? lastRank : (i + 1);
            map.set(sorted[i].nick, rank);
            lastScore = sorted[i].score;
            lastRank = rank;
        }
        _positionMapCache = { forArray: allPlayers, map };
        return map;
    }

    function getPlayerPosition(nick) {
        return getPositionMap().get(nick) || null;
    }

    // ========== SCORE GRAPH ==========
    function showScoreGraph(playerNick, discordId, currentScore) {
        const modal = document.getElementById('score-graph-modal');
        if (!modal) return;

        const player = allPlayers.find(p => p.nick === playerNick);
        const uuid = player ? player.uuid : playerNick;

        modal.querySelector('.score-graph-skin').src = `https://mc-heads.net/avatar/${uuid}/48`;
        modal.querySelector('.score-graph-title').textContent = playerNick;
        modal.querySelector('.score-graph-subtitle').textContent = `${currentScore} bodů · ${getScoreTitle(currentScore).title}`;

        // Build score timeline from tier history
        // Each tier history entry has: kit, tier, date, oldTier
        // We reconstruct cumulative score at each date
        // Filter to only active guild's kits
        const _activeKitIcons = new Set(kits.map(k => k.icon));
        const fullHistory = (discordId && tierHistory[discordId]) || {};
        const history = {};
        for (const [kitIcon, entries] of Object.entries(fullHistory)) {
            if (_activeKitIcons.has(kitIcon)) history[kitIcon] = entries;
        }
        const events = []; // { ts, date, kitIcon, oldVal, newVal }

        for (const [kitIcon, entries] of Object.entries(history)) {
            for (const e of entries) {
                const ts = parseCzechDate(e.date);
                const newVal = parseInt(resolveTierValue(e.tier)) || 0;
                const oldVal = e.oldTier ? (parseInt(resolveTierValue(e.oldTier)) || 0) : 0;
                if (ts) events.push({ ts, date: e.date, kitIcon, oldVal, newVal });
            }
        }

        if (events.length === 0) {
            modal.querySelector('.score-graph-chart').innerHTML = '<div class="score-graph-empty">Žádná historie</div>';
            modal.style.display = 'flex';
            return;
        }

        events.sort((a, b) => a.ts - b.ts);

        // Pre-compute peak tier bonuses per kit (same logic as overall score)
        const kitPeakScores = {};
        for (const kitIcon of Object.keys(history)) {
            const peakTier = getPeakTierTextFromHistory(discordId, kitIcon);
            kitPeakScores[kitIcon] = peakTier ? (PEAK_TIER_SCORE[peakTier] || 0) : 0;
        }

        // Compute cumulative score at each event using peak-aware scoring
        const kitScores = {}; // kitIcon => current raw value
        const points = []; // { ts, date, score }

        for (const ev of events) {
            kitScores[ev.kitIcon] = ev.newVal;
            let total = 0;
            for (const [kit, rawVal] of Object.entries(kitScores)) {
                total += Math.max(rawVal, kitPeakScores[kit] || 0);
            }
            points.push({ ts: ev.ts, date: ev.date, score: total });
        }

        // Deduplicate same-date entries (keep last one for each date)
        const byDate = new Map();
        for (const p of points) byDate.set(p.date, p);
        const timeline = [...byDate.values()];

        // Ensure final point matches currentScore (handles kits without history)
        if (timeline.length > 0 && timeline[timeline.length - 1].score !== currentScore) {
            const today = new Date();
            const todayStr = `${today.getDate()}. ${today.getMonth() + 1}. ${today.getFullYear()}`;
            timeline.push({ ts: Date.now(), date: todayStr, score: currentScore });
        }

        renderScoreChart(modal.querySelector('.score-graph-chart'), timeline, currentScore);
        modal.style.display = 'flex';
    }

    function renderScoreChart(container, timeline, currentScore) {
        container.innerHTML = '';
        const W = 700, H = 300;
        const PL = 50, PR = 20, PT = 20, PB = 40;
        const plotW = W - PL - PR;
        const plotH = H - PT - PB;

        const scores = timeline.map(t => t.score);
        const maxScore = Math.max(...scores, currentScore);
        const minScore = Math.min(...scores, 0);
        const range = maxScore - minScore || 1;

        function xFor(i) { return PL + (timeline.length === 1 ? plotW / 2 : (i / (timeline.length - 1)) * plotW); }
        function yFor(score) { return PT + plotH - ((score - minScore) / range) * plotH; }

        let svg = '';

        // Grid lines (4 horizontal)
        for (let i = 0; i <= 4; i++) {
            const val = Math.round(minScore + (range * i / 4));
            const y = yFor(val);
            svg += `<line x1="${PL}" y1="${y}" x2="${PL + plotW}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
            svg += `<text x="${PL - 8}" y="${y + 4}" text-anchor="end" font-family="Poppins,sans-serif" font-size="10" fill="rgba(255,255,255,0.35)">${val}</text>`;
        }

        // Area fill
        if (timeline.length > 1) {
            let areaD = `M${xFor(0)},${yFor(timeline[0].score)}`;
            for (let i = 1; i < timeline.length; i++) areaD += ` L${xFor(i)},${yFor(timeline[i].score)}`;
            areaD += ` L${xFor(timeline.length - 1)},${PT + plotH} L${xFor(0)},${PT + plotH} Z`;
            svg += `<path d="${areaD}" fill="url(#scoreGrad)" opacity="0.3"/>`;
        }

        // Line path
        if (timeline.length > 1) {
            let d = `M${xFor(0)},${yFor(timeline[0].score)}`;
            for (let i = 1; i < timeline.length; i++) d += ` L${xFor(i)},${yFor(timeline[i].score)}`;
            svg += `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
        }

        // Points + invisible hit areas
        timeline.forEach((t, i) => {
            const x = xFor(i);
            const y = yFor(t.score);
            const isLast = i === timeline.length - 1;
            if (isLast) svg += `<circle cx="${x}" cy="${y}" r="12" fill="var(--accent)" opacity="0.15"/>`;
            svg += `<circle cx="${x}" cy="${y}" r="${isLast ? 5 : 4}" fill="var(--accent)" opacity="${isLast ? '1' : '0.7'}"/>`;
            svg += `<circle cx="${x}" cy="${y}" r="14" fill="transparent" class="score-hit" data-i="${i}" style="cursor:pointer"/>`;
        });

        // Date labels (max 6)
        const step = Math.max(1, Math.floor(timeline.length / 5));
        for (let i = 0; i < timeline.length; i += step) {
            svg += `<text x="${xFor(i)}" y="${H - 6}" text-anchor="middle" font-family="Poppins,sans-serif" font-size="9" fill="rgba(255,255,255,0.35)">${escapeXml(timeline[i].date)}</text>`;
        }
        if (timeline.length > 1) {
            const last = timeline.length - 1;
            svg += `<text x="${xFor(last)}" y="${H - 6}" text-anchor="middle" font-family="Poppins,sans-serif" font-size="9" fill="rgba(255,255,255,0.35)">${escapeXml(timeline[last].date)}</text>`;
        }

        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svgEl.setAttribute('width', '100%');
        svgEl.style.maxWidth = W + 'px';
        svgEl.innerHTML = `<defs><linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.4"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>` + svg;
        container.appendChild(svgEl);

        // Tooltip
        const tip = document.createElement('div');
        tip.className = 'score-graph-tooltip';
        container.appendChild(tip);

        svgEl.querySelectorAll('.score-hit').forEach(circle => {
            circle.addEventListener('mouseenter', (ev) => {
                const i = parseInt(circle.dataset.i);
                const t = timeline[i];
                const st = getScoreTitle(t.score);
                tip.innerHTML = `<strong>${t.score} bodů</strong><br><span style="color:${st.color}">${st.title}</span><br><span style="opacity:0.6">${t.date}</span>`;
                tip.style.opacity = '1';
                const rect = svgEl.getBoundingClientRect();
                const cx = parseFloat(circle.getAttribute('cx'));
                const cy = parseFloat(circle.getAttribute('cy'));
                const scaleX = rect.width / W;
                const scaleY = rect.height / H;
                tip.style.left = (cx * scaleX) + 'px';
                tip.style.top = (cy * scaleY) + 'px';
            });
            circle.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
        });
    }

    // Close score graph modal
    (() => {
        const sgm = document.getElementById('score-graph-modal');
        if (!sgm) return;
        sgm.querySelector('.score-graph-close').onclick = () => { sgm.style.display = 'none'; };
        sgm.onclick = (e) => { if (e.target === sgm) sgm.style.display = 'none'; };
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sgm.style.display === 'flex') sgm.style.display = 'none';
        });
    })();

    // ---- Rank History ----
    function _rhEscape(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function _rhRankColor(rank) {
        if (rank === 1) return '#FFCF4A';
        if (rank <= 3) return '#D5B355';
        if (rank <= 10) return '#A4B3C7';
        if (rank <= 20) return '#8F5931';
        return '#655B79';
    }

    function computeRankHistory(targetDiscordId) {
        if (!targetDiscordId) return [];

        // Guild-aware: only consider kits from the active guild
        const validIcons = new Set(kits.map(k => k.icon));

        // Gather ALL discordIds (from overallData + tierHistory)
        const sourceData = _originalOverallData || overallData;
        const currentDiscordIds = new Set(sourceData.map(p => p.discordId).filter(Boolean));
        const allDiscordIds = new Set();
        for (const [did, kitsObj] of Object.entries(tierHistory)) {
            for (const icon of Object.keys(kitsObj)) {
                if (validIcons.has(icon)) { allDiscordIds.add(did); break; }
            }
        }
        currentDiscordIds.forEach(id => allDiscordIds.add(id));

        // Every player should only appear as a competitor in OTHER players' rank
        // history starting from the date of their own first recorded test (they
        // weren't on the tierlist before that, so they shouldn't count against
        // anyone's rank before it), and - if they've since been removed/blacklisted -
        // only up until the date of their last recorded test.
        const firstTestTs = {};         // discordId -> ts of their first event (any kit)
        const blacklistedLastTestTs = {}; // discordId -> ts of their last event (any kit), blacklisted only
        for (const did of allDiscordIds) {
            let minTs = null;
            let maxTs = null;
            const ph = tierHistory[did] || {};
            for (const kitIcon of Object.keys(ph)) {
                if (!validIcons.has(kitIcon)) continue;
                ph[kitIcon].forEach(e => {
                    const ts = parseCzechDate(e.date);
                    if (!ts) return;
                    if (minTs === null || ts < minTs) minTs = ts;
                    if (maxTs === null || ts > maxTs) maxTs = ts;
                });
            }
            if (minTs !== null) firstTestTs[did] = minTs;
            // Only cap the upper end for players who are no longer on the current tierlist
            if (!currentDiscordIds.has(did) && maxTs !== null) blacklistedLastTestTs[did] = maxTs;
        }

        // Pre-sort events per player/kit for forward reconstruction
        const sortedEvents = {}; // discordId -> kitIcon -> sorted events array
        for (const did of allDiscordIds) {
            sortedEvents[did] = {};
            const ph = tierHistory[did] || {};
            for (const kitIcon of Object.keys(ph)) {
                if (!validIcons.has(kitIcon)) continue;
                sortedEvents[did][kitIcon] = ph[kitIcon]
                    .map(e => ({ ...e, _ts: parseCzechDate(e.date) }))
                    .filter(e => e._ts)
                    .sort((a, b) => a._ts - b._ts);
            }
        }

        // Compute kit introduction dates from tier history (earliest event per kit)
        const kitIntroDate = {};
        for (const did in tierHistory) {
            for (const kitIcon in tierHistory[did]) {
                if (!validIcons.has(kitIcon)) continue;
                tierHistory[did][kitIcon].forEach(entry => {
                    const ts = parseCzechDate(entry.date);
                    if (ts && (!kitIntroDate[kitIcon] || ts < kitIntroDate[kitIcon])) {
                        kitIntroDate[kitIcon] = ts;
                    }
                });
            }
        }

        // Peak tier system was introduced on 5.3.2026
        const PEAK_SYSTEM_TS = new Date(2026, 2, 5).getTime();

        // Build current kit vals from spreadsheet (ground truth for "now")
        const currentKitVals = {}; // discordId -> { kitIcon -> tierValue }
        sourceData.forEach(p => {
            if (!p.discordId) return;
            currentKitVals[p.discordId] = {};
            (p.tiers || []).forEach(t => {
                if (!validIcons.has(t.icon)) return;
                currentKitVals[p.discordId][t.icon] = parseInt(t.tier) || 0;
            });
        });
        // For players only in tierHistory (removed/blacklisted), reconstruct from latest events
        for (const did of allDiscordIds) {
            if (!currentKitVals[did]) {
                currentKitVals[did] = {};
                for (const kitIcon in (sortedEvents[did] || {})) {
                    const evts = sortedEvents[did][kitIcon];
                    if (evts.length) {
                        currentKitVals[did][kitIcon] = parseInt(resolveTierValue(evts[evts.length - 1].tier)) || 0;
                    }
                }
            }
        }

        const NOW = Date.now();

        // Pre-build current scores from spreadsheet (ground truth for "now")
        const currentScores = {};
        sourceData.forEach(p => { if (p.discordId) currentScores[p.discordId] = p.score; });

        // Forward reconstruction: get a player's tier value for a kit at a given timestamp
        function getTierAtTime(discordId, kitIcon, atTs) {
            // For current time, use spreadsheet data (ground truth)
            if (atTs >= NOW && currentKitVals[discordId] && currentKitVals[discordId][kitIcon] !== undefined) {
                return currentKitVals[discordId][kitIcon];
            }
            const events = sortedEvents[discordId]?.[kitIcon] || [];
            let tierVal = 0;
            for (let i = events.length - 1; i >= 0; i--) {
                if (events[i]._ts <= atTs) {
                    tierVal = parseInt(resolveTierValue(events[i].tier)) || 0;
                    break;
                }
            }
            return tierVal;
        }

        // Forward reconstruction: get the peak tier SCORE a player had reached in a kit
        // as of a given timestamp (i.e. their "peak so far"), not their all-time peak.
        // Reuses the same computePeakTierText + PEAK_TIER_SCORE pipeline used everywhere
        // else in the app (getPeakTierTextFromHistory), just fed a time-filtered slice of
        // the kit's RAW history (same order as stored) so the result reflects what the
        // peak actually was AT that point in time, not the current all-time peak.
        function getPeakScoreAtTime(discordId, kitIcon, atTs) {
            const rawEvents = (tierHistory[discordId] || {})[kitIcon] || [];
            if (!rawEvents.length) return 0;
            const eventsUpToTs = rawEvents.filter(e => {
                const ts = parseCzechDate(e.date);
                return ts !== null && ts !== undefined && ts <= atTs;
            });
            if (!eventsUpToTs.length) return 0;
            // třetí parametr = počítej peak k tomuto datu, ne k dnešku
            const peakText = computePeakTierText(eventsUpToTs, null, atTs);
            return (peakText && PEAK_TIER_SCORE[peakText]) ? PEAK_TIER_SCORE[peakText] : 0;
        }

        // Compute a player's score at a given timestamp using forward reconstruction
        function getPlayerScoreAtTime(discordId, atTs) {
            // For current time, use actual score from the overall spreadsheet (ground truth)
            if (atTs >= NOW && currentScores[discordId] !== undefined) {
                return currentScores[discordId];
            }
            let s = 0;
            for (const kit of kits) {
                if (!validIcons.has(kit.icon)) continue;
                if (kitIntroDate[kit.icon] && atTs < kitIntroDate[kit.icon]) continue;
                const tierVal = getTierAtTime(discordId, kit.icon, atTs);
                // Peak bonuses apply from PEAK_SYSTEM_TS onward (when peak system was introduced),
                // using the peak actually reached BY this timestamp (not the current all-time peak).
                let peakScore = 0;
                if (atTs >= PEAK_SYSTEM_TS) {
                    peakScore = getPeakScoreAtTime(discordId, kit.icon, atTs);
                }
                s += Math.max(tierVal, peakScore);
            }
            return s;
        }

        // Get the target player's rank at a given timestamp
        function getRankAtTime(atTs) {
            const targetScore = getPlayerScoreAtTime(targetDiscordId, atTs);
            if (targetScore <= 0) return null;
            let rank = 1;
            // For current time, rank only against spreadsheet players (matching overall page)
            if (atTs >= NOW) {
                for (let i = 0; i < sourceData.length; i++) {
                    const p = sourceData[i];
                    if (p.discordId === targetDiscordId) continue;
                    if ((p.score || 0) > targetScore) rank++;
                }
                return rank;
            }
            for (const did of allDiscordIds) {
                if (did === targetDiscordId) continue;
                // A player only counts as a competitor from their own first test date onward
                if (firstTestTs[did] !== undefined && atTs < firstTestTs[did]) continue;
                // Blacklisted players only count as competitors up to their last test date
                if (blacklistedLastTestTs[did] !== undefined && atTs > blacklistedLastTestTs[did]) continue;
                if (getPlayerScoreAtTime(did, atTs) > targetScore) rank++;
            }
            return rank;
        }

        // Collect ALL unique event timestamps
        const allTimestamps = new Set();
        for (const dId in tierHistory) {
            for (const kitIcon in tierHistory[dId]) {
                if (!validIcons.has(kitIcon)) continue;
                tierHistory[dId][kitIcon].forEach(entry => {
                    const ts = parseCzechDate(entry.date);
                    if (ts) allTimestamps.add(ts);
                });
            }
        }
        allTimestamps.add(Date.now()); // current
        allTimestamps.add(PEAK_SYSTEM_TS); // peak tier system introduction

        // Sort timestamps chronologically
        const sortedTimestamps = [...allTimestamps].sort((a, b) => a - b);

        // Build rank history at each event timestamp
        const rawHistory = [];
        for (const ts of sortedTimestamps) {
            const rank = getRankAtTime(ts);
            if (rank !== null) {
                const d = new Date(ts);
                rawHistory.push({ ts, date: d.toLocaleDateString('cs-CZ'), rank });
            }
        }

        // Consolidate by date
        const byDate = {};
        const dateOrder = [];
        rawHistory.forEach(h => {
            if (!byDate[h.date]) dateOrder.push(h.date);
            byDate[h.date] = h;
        });
        let history = dateOrder.map(d => byDate[d]);

        // Remove consecutive duplicates
        if (history.length > 2) {
            const filtered = [history[0]];
            for (let j = 1; j < history.length - 1; j++) {
                if (history[j].rank !== history[j-1].rank || history[j].rank !== history[j+1].rank) {
                    filtered.push(history[j]);
                }
            }
            filtered.push(history[history.length - 1]);
            history = filtered;
        }

        return { history, kitIntroDate, peakSystemTs: PEAK_SYSTEM_TS };
    }

    function renderRankHistoryChart(container, history, kitIntroDate, peakSystemTs) {
        container.innerHTML = '';

        const PL = 56, PR = 24, PT = 50, PB = 44;
        const SVG_H = 360;
        const PLOT_H = SVG_H - PT - PB;

        const ranks = history.map(h => h.rank);
        const dataMinRank = Math.min(...ranks);
        const dataMaxRank = Math.max(...ranks);
        const yMin = Math.max(1, dataMinRank - 1);
        const yMax = dataMaxRank + 1;

        // Zoom state — controls horizontal spacing (px per data point)
        let pxPerPoint = 80;
        const ZOOM_MIN_PX = 30;
        const ZOOM_MAX_PX = 250;

        // Kit intro annotation lines — only kits from the active guild
        const KIT_ICON_NAMES = {};
        kits.forEach(k => { KIT_ICON_NAMES[k.icon] = k.key; });

        const firstTs = history[0].ts;
        const lastTs = history[history.length - 1].ts;

        function buildSvg() {
            const SVG_W = Math.max(700, history.length * pxPerPoint) + PL + PR;
            const PLOT_W = SVG_W - PL - PR;

            function yFor(rank) {
                if (yMin === yMax) return PT + PLOT_H / 2;
                return PT + ((rank - yMin) / (yMax - yMin)) * PLOT_H;
            }
            function xFor(i) {
                return history.length === 1 ? PL + PLOT_W / 2 : PL + (i / (history.length - 1)) * PLOT_W;
            }
            function xForTs(ts) {
                if (history.length <= 1) return xFor(0);
                if (ts <= history[0].ts) return xFor(0);
                if (ts >= history[history.length - 1].ts) return xFor(history.length - 1);
                // Interpolate between the two surrounding data points
                for (let k = 0; k < history.length - 1; k++) {
                    if (ts >= history[k].ts && ts <= history[k + 1].ts) {
                        const frac = (ts - history[k].ts) / (history[k + 1].ts - history[k].ts);
                        return xFor(k) + frac * (xFor(k + 1) - xFor(k));
                    }
                }
                return xFor(history.length - 1);
            }

            let svg = '';

            // Kit intro annotation lines
            if (kitIntroDate) {
                const dateGroups = {};
                for (const icon in kitIntroDate) {
                    if (!KIT_ICON_NAMES[icon]) continue;
                    const ts = kitIntroDate[icon];
                    if (ts >= firstTs && ts <= lastTs) {
                        const key = ts.toString();
                        if (!dateGroups[key]) dateGroups[key] = { ts, names: [] };
                        dateGroups[key].names.push(KIT_ICON_NAMES[icon]);
                    }
                }
                Object.values(dateGroups).forEach(g => {
                    const x = xForTs(g.ts);
                    svg += `<line x1="${x.toFixed(1)}" y1="${PT}" x2="${x.toFixed(1)}" y2="${PT + PLOT_H}" stroke="rgba(238,205,20,0.18)" stroke-width="1" stroke-dasharray="5,4"/>`;
                    const label = '+' + g.names.join(', ');
                    const dateStr = new Date(g.ts).toLocaleDateString('cs-CZ');
                    svg += `<text x="${x.toFixed(1)}" y="${PT - 16}" text-anchor="middle" font-family="Poppins,sans-serif" font-size="9" font-weight="600" fill="rgba(238,205,20,0.55)">${_rhEscape(label)}</text>`;
                    svg += `<text x="${x.toFixed(1)}" y="${PT - 5}" text-anchor="middle" font-family="Poppins,sans-serif" font-size="7.5" fill="rgba(238,205,20,0.35)">${_rhEscape(dateStr)}</text>`;
                });
            }

            // Peak system annotation line
            if (peakSystemTs && peakSystemTs >= firstTs && peakSystemTs <= lastTs) {
                const px = xForTs(peakSystemTs);
                svg += `<line x1="${px.toFixed(1)}" y1="${PT}" x2="${px.toFixed(1)}" y2="${PT + PLOT_H}" stroke="rgba(238,205,20,0.18)" stroke-width="1" stroke-dasharray="5,4"/>`;
                const peakDateStr = new Date(peakSystemTs).toLocaleDateString('cs-CZ');
                svg += `<text x="${px.toFixed(1)}" y="${PT - 16}" text-anchor="middle" font-family="Poppins,sans-serif" font-size="9" font-weight="600" fill="rgba(238,205,20,0.55)">+Peak Tiers</text>`;
                svg += `<text x="${px.toFixed(1)}" y="${PT - 5}" text-anchor="middle" font-family="Poppins,sans-serif" font-size="7.5" fill="rgba(238,205,20,0.35)">${_rhEscape(peakDateStr)}</text>`;
            }

            // Y-axis labels
            const range = yMax - yMin;
            let step = 1;
            if (range > 40) step = 10;
            else if (range > 20) step = 5;
            else if (range > 10) step = 2;

            for (let r = yMin; r <= yMax; r += step) {
                const yy = yFor(r);
                svg += `<line x1="${PL}" y1="${yy}" x2="${PL + PLOT_W}" y2="${yy}" stroke="rgba(255,255,255,0.055)" stroke-width="1"/>`;
                svg += `<text x="${PL - 8}" y="${yy + 4}" text-anchor="end" font-family="Poppins,sans-serif" font-size="11" font-weight="700" fill="${_rhRankColor(r)}">#${r}</text>`;
            }

            // X-axis date labels
            const maxLabels = Math.max(12, Math.floor(PLOT_W / 70));
            const labelStep = Math.max(1, Math.ceil(history.length / maxLabels));
            history.forEach((h, i) => {
                if (i % labelStep === 0 || i === history.length - 1) {
                    const x = xFor(i);
                    svg += `<text x="${x}" y="${SVG_H - 6}" text-anchor="middle" font-family="Poppins,sans-serif" font-size="9.5" fill="rgba(255,255,255,0.38)">${_rhEscape(h.date)}</text>`;
                }
            });

            // Connecting path
            if (history.length > 1) {
                let d = '';
                history.forEach((h, i) => {
                    const x = xFor(i), y = yFor(h.rank);
                    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
                });
                svg += `<path d="${d}" fill="none" stroke="rgba(238,205,20,0.3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
            }

            // Data points
            history.forEach((h, i) => {
                const x = xFor(i), y = yFor(h.rank);
                const col = _rhRankColor(h.rank);
                const isLast = (i === history.length - 1);
                if (isLast) {
                    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="${col}" opacity="0.13"/>`;
                }
                svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${col}" stroke="${col}" stroke-width="2.5"/>`;
                svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${col}" opacity="${isLast ? '1' : '0.65'}"/>`;
                svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="17" fill="transparent" class="rh-hit" data-i="${i}" style="cursor:pointer"/>`;
            });

            return { svg, SVG_W };
        }

        const { svg: initSvg, SVG_W: initW } = buildSvg();

        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('viewBox', `0 0 ${initW} ${SVG_H}`);
        svgEl.setAttribute('width', initW + 'px');
        svgEl.style.display = 'block';
        svgEl.style.overflow = 'visible';
        svgEl.style.minWidth = initW + 'px';
        svgEl.innerHTML = initSvg;
        container.appendChild(svgEl);

        // Scroll to rightmost (current) position
        requestAnimationFrame(() => { container.scrollLeft = container.scrollWidth; });

        // Mouse wheel → horizontal scroll
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            container.scrollLeft += e.deltaY * 2;
        }, { passive: false });

        // Zoom controls (horizontal width) — always recreate to bind fresh closures
        const contentEl = container.closest('.rank-history-content');
        if (contentEl) {
            const oldZoom = contentEl.querySelector('.rh-zoom-controls');
            if (oldZoom) oldZoom.remove();
        }
        let zoomWrap = null;
        if (contentEl) {
            zoomWrap = document.createElement('div');
            zoomWrap.className = 'rh-zoom-controls';
            zoomWrap.innerHTML =
                '<button class="rh-zoom-btn rh-zoom-out" title="Oddálit (menší rozestupy)">−</button>' +
                '<span class="rh-zoom-label">Zoom</span>' +
                '<button class="rh-zoom-btn rh-zoom-in" title="Přiblížit (větší rozestupy)">+</button>';
            contentEl.querySelector('.rank-history-header').after(zoomWrap);
        }

        function redraw() {
            const scrollRatio = container.scrollWidth > 0 ? container.scrollLeft / container.scrollWidth : 1;
            const { svg, SVG_W } = buildSvg();
            svgEl.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
            svgEl.setAttribute('width', SVG_W + 'px');
            svgEl.style.minWidth = SVG_W + 'px';
            svgEl.innerHTML = svg;
            bindTooltip();
            // Preserve scroll position proportionally
            requestAnimationFrame(() => { container.scrollLeft = scrollRatio * container.scrollWidth; });
        }

        if (zoomWrap) {
            zoomWrap.querySelector('.rh-zoom-in').onclick = () => {
                if (pxPerPoint < ZOOM_MAX_PX) { pxPerPoint = Math.min(ZOOM_MAX_PX, pxPerPoint + 20); redraw(); }
            };
            zoomWrap.querySelector('.rh-zoom-out').onclick = () => {
                if (pxPerPoint > ZOOM_MIN_PX) { pxPerPoint = Math.max(ZOOM_MIN_PX, pxPerPoint - 20); redraw(); }
            };
        }

        // Tooltip — placed on body with position:fixed to avoid overflow clipping
        const tip = document.createElement('div');
        tip.className = 'rank-history-tooltip';
        tip.style.cssText = 'display:none;position:fixed;';
        document.body.appendChild(tip);

        const removeTip = () => { if (tip.parentNode) tip.parentNode.removeChild(tip); };
        const modal = document.getElementById('rank-history-modal');
        if (modal) {
            const obs = new MutationObserver(() => {
                if (modal.style.display === 'none') { removeTip(); obs.disconnect(); }
            });
            obs.observe(modal, { attributes: true, attributeFilter: ['style'] });
        }

        function bindTooltip() {
            svgEl.querySelectorAll('.rh-hit').forEach(circle => {
                circle.addEventListener('mouseenter', function() {
                    const idx = parseInt(this.getAttribute('data-i'));
                    const h = history[idx];
                    const col = _rhRankColor(h.rank);
                    const isLast = (idx === history.length - 1);
                    tip.innerHTML =
                        `<div class="rank-history-tooltip-rank" style="color:${col}">#${h.rank}</div>` +
                        `<div class="rank-history-tooltip-date">${_rhEscape(h.date)}</div>` +
                        (isLast ? '<div class="rank-history-tooltip-current">Aktuální pozice</div>' : '');
                    tip.style.display = 'block';
                    const circleRect = this.getBoundingClientRect();
                    tip.style.left = (circleRect.left + circleRect.width / 2 - tip.offsetWidth / 2) + 'px';
                    tip.style.top = (circleRect.top - tip.offsetHeight - 10) + 'px';
                });
                circle.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
            });
        }
        bindTooltip();
    }

    function showRankHistory(playerNick, discordId) {
        const modal = document.getElementById('rank-history-modal');
        if (!modal) return;

        modal.querySelector('.rank-history-title').textContent = 'Rank History';
        modal.querySelector('.rank-history-player').textContent = playerNick;
        const wrapper = modal.querySelector('.rank-history-timeline-wrapper');

        // Show loading state
        wrapper.innerHTML = '<div class="rank-history-loading"><div class="rh-spinner"></div><div class="rh-loading-text">Počítám historii...</div></div>';
        modal.style.display = 'flex';

        // Defer computation so the loading UI renders first
        requestAnimationFrame(() => {
            setTimeout(() => {
                const result = computeRankHistory(discordId);
                const history = result.history;
                const kitIntroDate = result.kitIntroDate;
                const peakSystemTs = result.peakSystemTs;

                if (history.length < 2) {
                    wrapper.innerHTML = '<div class="rank-history-no-data">Nedostatek dat pro zobrazení historie umístění.</div>';
                } else {
                    renderRankHistoryChart(wrapper, history, kitIntroDate, peakSystemTs);
                }
            }, 20);
        });

        const closeBtn = modal.querySelector('.rank-history-close');
        if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }

    // Close rank history on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const rm = document.getElementById('rank-history-modal');
            if (rm && rm.style.display === 'flex') rm.style.display = 'none';
        }
    });

    // Rank History button in player modal — use event delegation
    document.addEventListener('click', async (e) => {
        if (!e.target.closest('#rank-history-btn')) return;
        const modal = document.getElementById('player-modal');
        const nick = modal.querySelector('.player-modal-name').textContent;
        const player = allPlayers.find(p => p.nick === nick);
        if (!player || !player.discordId) return;
        await ensureHistoryLoaded();   // rank history potrebuje historii VSECH hracu
        showRankHistory(nick, player.discordId);
    });

    // Compare button in player modal — use event delegation so it works after data loads
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#compare-btn')) return;
        const modal = document.getElementById('player-modal');
        const nick = modal.querySelector('.player-modal-name').textContent;
        const player = allPlayers.find(p => p.nick === nick);
        if (!player) return;
        comparePlayerA = player;
        modal.style.display = 'none';
        showComparePicker();
    });

    function showComparePicker() {
        // Remove old picker if exists
        let picker = document.getElementById('compare-picker');
        if (picker) picker.remove();

        // Positions come from the shared cache (avoids yet another full sort here)
        const positionMap = getPositionMap();

        // POZOR: getMatches() níž pracovalo s `sorted`, které se ale deklaruje jako
        // lokální const uvnitř getPositionMap() — tady tedy nikdy nebylo v scope.
        // Každé vyhledávání shodilo ReferenceError a seznam zůstal prázdný, takže
        // porovnání nešlo dokončit vůbec. Vlastní seřazená kopie to řeší.
        const sorted = [...allPlayers].sort((a, b) => b.score - a.score);

        picker = document.createElement('div');
        picker.id = 'compare-picker';
        picker.className = 'compare-picker';
        picker.innerHTML = `
            <div class="compare-picker-content">
                <span class="compare-picker-close">&times;</span>
                <h3>Vyber hráče pro porovnání</h3>
                <p class="compare-picker-info">Porovnání s <strong>${comparePlayerA.nick}</strong></p>
                <div class="compare-picker-search">
                    <input type="text" class="compare-picker-input" placeholder="Jméno hráče..." autocomplete="off" spellcheck="false">
                </div>
                <div class="compare-picker-suggestions"></div>
            </div>
        `;
        document.body.appendChild(picker);

        const closeBtn = picker.querySelector('.compare-picker-close');
        closeBtn.addEventListener('click', () => picker.remove());
        picker.addEventListener('mousedown', (e) => { if (e.target === picker) picker.remove(); });

        picker.style.display = 'flex';
        const input = picker.querySelector('.compare-picker-input');
        const sugDiv = picker.querySelector('.compare-picker-suggestions');

        let selectedIdx = -1;

        function buildSuggestionHTML(matches) {
            return matches.map((p, idx) => {
                const pos = positionMap.get(p.nick) || '?';
                const st = getScoreTitle(p.score);
                return `<div class="compare-picker-item" data-idx="${idx}">
                    <img src="https://mc-heads.net/avatar/${p.uuid || p.nick}/32" alt="" loading="lazy">
                    <div class="compare-picker-player-info">
                        <span class="compare-picker-nick">${p.nick}</span>
                        <span class="compare-picker-meta">#${pos} · ${p.score} pts · <span style="color:${st.color}">${st.title}</span></span>
                    </div>
                </div>`;
            }).join('');
        }

        function getMatches(q) {
            if (!q) {
                return sorted
                    .filter(p => p.nick !== comparePlayerA.nick)
                    .slice(0, 10);
            }
            const starts = [];
            const includes = [];
            for (const p of sorted) {
                if (p.nick === comparePlayerA.nick) continue;
                const lower = p.nick.toLowerCase();
                if (lower.startsWith(q)) starts.push(p);
                else if (lower.includes(q)) includes.push(p);
                if (starts.length + includes.length >= 10) break;
            }
            return [...starts, ...includes].slice(0, 10);
        }

        function render(query) {
            selectedIdx = -1;
            const q = (query || '').trim().toLowerCase();
            const matches = getMatches(q);
            if (matches.length === 0) {
                sugDiv.innerHTML = '<div class="compare-picker-empty">Žádní hráči nenalezeni</div>';
                return;
            }
            sugDiv.innerHTML = buildSuggestionHTML(matches);

            // Click handlers using event delegation
            sugDiv.onclick = function(e) {
                const item = e.target.closest('.compare-picker-item');
                if (!item) return;
                const idx = parseInt(item.dataset.idx);
                const playerB = matches[idx];
                if (playerB) {
                    picker.remove();
                    ensureHistoryLoaded().then(() => showCompareModal(comparePlayerA, playerB));
                }
            };
        }

        // Initial render
        render('');

        // Search input — use both input and keyup for maximum compatibility
        input.addEventListener('input', () => render(input.value));

        input.addEventListener('keydown', (e) => {
            const items = sugDiv.querySelectorAll('.compare-picker-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
                items.forEach((it, i) => it.classList.toggle('selected', i === selectedIdx));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIdx = Math.max(selectedIdx - 1, 0);
                items.forEach((it, i) => it.classList.toggle('selected', i === selectedIdx));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIdx >= 0 && items[selectedIdx]) items[selectedIdx].click();
                else if (items.length > 0) items[0].click();
            } else if (e.key === 'Escape') {
                picker.remove();
            }
        });

        requestAnimationFrame(() => input.focus());
    }

    // Efektivní tier pro porovnání = lepší z (aktuální tier, peak tier).
    // Skóre na kartě se počítá stejně (peak boost), takže když by se tady
    // porovnával jen aktuální tier, hráč s vyšším skóre mohl "prohrát" kit,
    // ve kterém má lepší peak — což vypadalo jako chyba.
    function getEffectiveTierForKit(player, kitIcon) {
        const t = getBestTierForKit(player, kitIcon);
        const peakText = t && t.peakTierText ? t.peakTierText : null;
        const curVal = t ? parseInt(t.tier) : 0;
        const peakVal = peakText ? parseInt(PEAK_TIER_SCORE[peakText] || 0) : 0;
        if (!t && !peakVal) return null;
        const useValue = Math.max(isNaN(curVal) ? 0 : curVal, peakVal);
        return {
            value: useValue,
            display: String(useValue),
            fromPeak: peakVal > (isNaN(curVal) ? 0 : curVal),
            peakText: peakText,
            canRetire: !!(t && t.canRetire),
            pending: t ? t.pending : null
        };
    }

    // Vzájemná bilance ze skutečných soubojů. Bere obě strany historie:
    // souboj se ukládá k testovanému, takže když spolu hráli v testu A i v testu B,
    // najdeme ho jednou u A a jednou u B — proto se deduplikuje přes (datum, kit, skóre).
    function computeHeadToHead(idA, idB) {
        if (!idA || !idB) return null;
        const seen = new Set();
        let winsA = 0, winsB = 0, draws = 0;
        const bouts = [];

        const scan = (owner, other, flip) => {
            const byKit = tierHistory[owner] || {};
            for (const kitIcon of Object.keys(byKit)) {
                for (const h of byKit[kitIcon]) {
                    if (!Array.isArray(h.fights)) continue;
                    for (const f of h.fights) {
                        if (f.o !== other) continue;
                        // skóre vždy z pohledu hráče A
                        const sA = flip ? Number(f.os) : Number(f.s);
                        const sB = flip ? Number(f.s)  : Number(f.os);
                        // Klic NESMI obsahovat presny cas testu. Tyz souboj je
                        // ulozeny u obou hracu, ale kazdy u sveho testu s jinym
                        // casem - s casem v klici se nespojil a bilance ukazovala
                        // kazdy zapas dvakrat (12-4 misto 6-2).
                        const day = h.ts ? Math.floor(h.ts / 86400000) : 0;
                        const key = [day, kitIcon, Math.min(sA, sB), Math.max(sA, sB)].join('|');
                        if (seen.has(key)) continue;
                        seen.add(key);
                        if (sA > sB) winsA++; else if (sB > sA) winsB++; else draws++;
                        bouts.push({ ts: h.ts || 0, kitIcon, sA, sB });
                    }
                }
            }
        };
        scan(idA, idB, false);
        scan(idB, idA, true);

        if (!bouts.length) return null;
        bouts.sort((x, y) => y.ts - x.ts);
        return { winsA, winsB, draws, bouts, total: bouts.length };
    }

    function renderHeadToHead(h2h, pA, pB) {
        if (!h2h) {
            return `<div class="compare-h2h compare-h2h-empty">Zatím spolu nehráli žádný zaznamenaný souboj.</div>`;
        }
        // Pomer vyher jako pruh - z cisel samotnych neni na prvni pohled videt,
        // jak jednoznacne to je.
        const decided = h2h.winsA + h2h.winsB;
        const pctA = decided ? Math.round((h2h.winsA / decided) * 100) : 50;

        const list = h2h.bouts.slice(0, 8).map(b => {
            const when = b.ts ? new Date(b.ts).toLocaleDateString('cs-CZ') : '';
            const cls  = b.sA > b.sB ? 'h2h-a' : b.sB > b.sA ? 'h2h-b' : 'h2h-d';
            const winner = b.sA > b.sB ? _pEsc(pA.nick) : b.sB > b.sA ? _pEsc(pB.nick) : 'remíza';
            return `<div class="compare-h2h-row ${cls}">
                        <img src="${_pEsc(b.kitIcon)}" alt="" class="compare-h2h-kit">
                        <span class="compare-h2h-score">
                            <b class="h2h-sa">${b.sA}</b><i>\u2013</i><b class="h2h-sb">${b.sB}</b>
                        </span>
                        <span class="compare-h2h-winner">${winner}</span>
                        <span class="compare-h2h-date">${_pEsc(when)}</span>
                    </div>`;
        }).join('');

        return `<div class="compare-h2h">
                    <div class="compare-h2h-head">
                        <span class="compare-h2h-label">Vzájemná bilance</span>
                        <span class="compare-h2h-tally">
                            <b class="h2h-sa">${h2h.winsA}</b><i>\u2013</i><b class="h2h-sb">${h2h.winsB}</b>
                            ${h2h.draws ? `<em>${h2h.draws} remíz</em>` : ''}
                        </span>
                    </div>
                    <div class="compare-h2h-bar" title="${h2h.winsA}\u2013${h2h.winsB}">
                        <span class="compare-h2h-bar-a" style="width:${pctA}%"></span>
                    </div>
                    <div class="compare-h2h-list">${list}</div>
                    ${h2h.total > 8 ? `<div class="compare-h2h-more">+ dalších ${h2h.total - 8} soubojů</div>` : ''}
                </div>`;
    }

    function showCompareModal(pA, pB) {
        const modal = document.getElementById('compare-modal');
        if (!modal) return;

        const posA = getPlayerPosition(pA.nick);
        const posB = getPlayerPosition(pB.nick);
        const stA = getScoreTitle(pA.score);
        const stB = getScoreTitle(pB.score);

        const fillSide = (side, p, pos, st, otherScore) => {
            const el = modal.querySelector(side);
            el.querySelector('.compare-skin').src = `https://mc-heads.net/avatar/${p.uuid || p.nick}/64`;
            el.querySelector('.compare-name').textContent = p.nick;
            el.querySelector('.compare-rank').textContent = `#${pos}`;
            const scoreEl = el.querySelector('.compare-score');
            scoreEl.textContent = p.score;
            scoreEl.className = 'compare-score' +
                (p.score > otherScore ? ' compare-better' : p.score < otherScore ? ' compare-worse' : '');
            const titleEl = el.querySelector('.compare-score-title');
            titleEl.textContent = st.title;
            titleEl.style.color = st.color;
            return el;
        };
        fillSide('.compare-player-left', pA, posA, stA, pB.score);
        fillSide('.compare-player-right', pB, posB, stB, pA.score);

        // --- Kit po kitu ---
        const kitsDiv = modal.querySelector('.compare-kits');
        let rowsHtml = '';
        let winsA = 0, winsB = 0, draws = 0, shared = 0;

        const badgeFor = eff => {
            if (!eff) return '<span class="compare-tier-badge compare-tier-none">-</span>';
            const info = tierInfo(eff.display);
            const orig = getOriginalTierText(eff.display);
            const isR = orig.startsWith('R');
            const style = `background:${isR ? '#23242a' : info.barvaPozadi};color:${isR ? info.barvaTextu : '#23242a'};`;
            // Hvězdička = tier drží díky zamčenému peaku, ne díky aktuální roli
            const star = eff.fromPeak ? '<span class="compare-peak-star" title="Peak tier">&#9733;</span>' : '';
            return `<span class="compare-tier-badge" style="${style}">${info.novyText}${star}</span>`;
        };

        // Kity, které nehraje ani jeden, nemá smysl vypisovat — dřív zabíraly
        // půlku tabulky prázdnými pomlčkami.
        const rows = kits.map(kit => ({
            kit,
            a: getEffectiveTierForKit(pA, kit.icon),
            b: getEffectiveTierForKit(pB, kit.icon)
        })).filter(r => r.a || r.b);

        rows.forEach(r => {
            const valA = r.a ? r.a.value : 0;
            const valB = r.b ? r.b.value : 0;
            let winClass = '';
            if (valA > valB) { winClass = 'win-left'; winsA++; }
            else if (valB > valA) { winClass = 'win-right'; winsB++; }
            else if (valA > 0) { draws++; }
            if (r.a && r.b) shared++;

            rowsHtml += `
                <div class="compare-kit-row ${winClass}">
                    <div class="compare-kit-cell compare-kit-left">${badgeFor(r.a)}</div>
                    <div class="compare-kit-cell compare-kit-center">
                        <img src="${r.kit.icon}" alt="${_pEsc(r.kit.key || '')}" class="compare-kit-icon" title="${_pEsc(r.kit.key || '')}">
                    </div>
                    <div class="compare-kit-cell compare-kit-right">${badgeFor(r.b)}</div>
                </div>
            `;
        });

        kitsDiv.innerHTML = rowsHtml || '<div class="compare-empty">Ani jeden hráč nemá žádný tier.</div>';

        // --- Souhrn: kdo vede, o kolik, a v kolika kitech se potkávají ---
        const summaryDiv = modal.querySelector('.compare-summary');
        const diff = Math.abs(pA.score - pB.score);
        let verdict;
        if (winsA > winsB)      verdict = `<strong>${_pEsc(pA.nick)}</strong> vede ${winsA}:${winsB}`;
        else if (winsB > winsA) verdict = `<strong>${_pEsc(pB.nick)}</strong> vede ${winsB}:${winsA}`;
        else                    verdict = `Nerozhodně ${winsA}:${winsB}`;

        const h2h = computeHeadToHead(pA.discordId, pB.discordId);
        summaryDiv.innerHTML = `
            <div class="compare-verdict">${verdict}</div>
            <div class="compare-meta">
                <span>${draws} ${draws === 1 ? 'remíza' : 'remíz'}</span>
                <span>${shared} společných kitů</span>
                <span>${diff === 0 ? 'stejné skóre' : `rozdíl ${diff} pts`}</span>
            </div>
            ${renderHeadToHead(h2h, pA, pB)}
        `;

        modal.style.display = 'flex';
    }


    // Close compare modal
    (() => {
        const cm = document.getElementById('compare-modal');
        if (!cm) return;
        cm.querySelector('.compare-modal-close').onclick = () => { cm.style.display = 'none'; };
        cm.onclick = (e) => { if (e.target === cm) cm.style.display = 'none'; };
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && cm.style.display === 'flex') cm.style.display = 'none';
        });
    })();

    // ===== TIME MACHINE =====
    (() => {
        const tmBtn      = document.getElementById('time-machine-btn');
        const tmDropdown  = document.getElementById('time-machine-dropdown');
        const tmDateInput = document.getElementById('time-machine-date');
        const tmApply     = document.getElementById('tm-apply');
        const tmReset     = document.getElementById('tm-reset');
        const tmInfo      = document.getElementById('tm-info');
        if (!tmBtn || !tmDropdown || !tmDateInput || !tmApply || !tmReset) return;

        // Set max date to today
        const today = new Date();
        tmDateInput.max = today.toISOString().split('T')[0];

        // Toggle dropdown
        tmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = tmDropdown.style.display !== 'none';
            tmDropdown.style.display = open ? 'none' : 'block';
        });
        document.addEventListener('click', (e) => {
            if (!tmDropdown.contains(e.target) && e.target !== tmBtn && !tmBtn.contains(e.target)) {
                tmDropdown.style.display = 'none';
            }
        });

        // Reconstruct leaderboard at a given timestamp
        function reconstructAtDate(targetTs) {
            const currentDiscordIds = new Set(
                (_originalOverallData || overallData).map(p => p.discordId).filter(Boolean)
            );

            // Gather all discordIds from tierHistory that belong to current guild's kits
            const validIcons = new Set(kits.map(k => k.icon));
            const allDiscordIds = new Set();
            for (const [did, kitsObj] of Object.entries(tierHistory)) {
                for (const icon of Object.keys(kitsObj)) {
                    if (validIcons.has(icon)) { allDiscordIds.add(did); break; }
                }
            }
            // Also include current players
            currentDiscordIds.forEach(id => allDiscordIds.add(id));

            // Blacklisted (removed) players should only appear up to the date of
            // their own last recorded test - after that they're excluded entirely,
            // instead of being held forward forever at their last known tier.
            const blacklistedLastTestTs = {}; // discordId -> ts of last event (any kit)
            for (const did of allDiscordIds) {
                if (currentDiscordIds.has(did)) continue; // still active, not blacklisted
                let maxTs = null;
                const ph = tierHistory[did] || {};
                for (const kitIcon of Object.keys(ph)) {
                    if (!validIcons.has(kitIcon)) continue;
                    ph[kitIcon].forEach(e => {
                        const ts = parseCzechDate(e.date);
                        if (ts && (maxTs === null || ts > maxTs)) maxTs = ts;
                    });
                }
                if (maxTs !== null) blacklistedLastTestTs[did] = maxTs;
            }

            // Pre-compute peak tier scores using the same function as the overall page
            const peakScores = {}; // discordId -> kitIcon -> score
            for (const did of allDiscordIds) {
                peakScores[did] = {};
                for (const kit of kits) {
                    if (!validIcons.has(kit.icon)) continue;
                    const peakText = getPeakTierTextFromHistory(did, kit.icon);
                    if (peakText && PEAK_TIER_SCORE[peakText]) {
                        peakScores[did][kit.icon] = PEAK_TIER_SCORE[peakText];
                    }
                }
            }

            // Kit intro dates (earliest event per kit)
            const kitIntro = {};
            for (const did in tierHistory) {
                for (const kitIcon in tierHistory[did]) {
                    if (!validIcons.has(kitIcon)) continue;
                    for (const e of tierHistory[did][kitIcon]) {
                        const ts = parseCzechDate(e.date);
                        if (ts && (!kitIntro[kitIcon] || ts < kitIntro[kitIcon])) kitIntro[kitIcon] = ts;
                    }
                }
            }

            const reconstructed = [];

            for (const discordId of allDiscordIds) {
                // Blacklisted players stop appearing after the date of their last test
                if (blacklistedLastTestTs[discordId] !== undefined && targetTs > blacklistedLastTestTs[discordId]) continue;

                const playerHistory = tierHistory[discordId] || {};
                const tiers = [];
                let hasAnyTier = false;

                for (const kit of kits) {
                    const kitEvents = (playerHistory[kit.icon] || [])
                        .map(ev => ({ ...ev, _ts: parseCzechDate(ev.date) }))
                        .filter(ev => ev._ts && ev._ts <= targetTs)
                        .sort((a, b) => a._ts - b._ts || a._rowIdx - b._rowIdx);

                    if (kitEvents.length === 0) {
                        tiers.push({ tier: undefined, icon: kit.icon });
                        continue;
                    }

                    const lastEvent = kitEvents[kitEvents.length - 1];
                    const tierVal = resolveTierValue(lastEvent.tier);
                    if (tierVal) {
                        tiers.push({ tier: tierVal, icon: kit.icon });
                        hasAnyTier = true;
                    } else {
                        tiers.push({ tier: undefined, icon: kit.icon });
                    }
                }

                if (!hasAnyTier) continue;

                // Calculate score with peak bonuses and kit intro dates
                // Peak tier system was introduced on 5.3.2026
                const PEAK_SYS_TS = new Date(2026, 2, 5).getTime();
                let score = 0;
                const pe = peakScores[discordId] || {};
                tiers.forEach(t => {
                    const val = parseInt(t.tier);
                    if (isNaN(val) || val <= 0) return;
                    // Skip kits not yet introduced at target date
                    if (kitIntro[t.icon] && targetTs < kitIntro[t.icon]) return;
                    let peakScore = 0;
                    let peakText = null;
                    if (targetTs >= PEAK_SYS_TS && pe[t.icon]) {
                        peakScore = pe[t.icon];
                        // Find the peak tier text for display
                        peakText = getPeakTierTextFromHistory(discordId, t.icon);
                    }
                    score += Math.max(val, peakScore);
                    t.peakTierText = (peakScore > val) ? peakText : null;
                });

                const isBlacklisted = !currentDiscordIds.has(discordId);
                const nick = discordIdToNick[discordId] || '???';

                // Find UUID from original data if available
                const orig = (_originalOverallData || overallData).find(p => p.discordId === discordId);

                reconstructed.push({
                    uuid: orig ? orig.uuid : null,
                    nick: nick,
                    discordId: discordId,
                    score: score,
                    tiers: tiers,
                    hallOfFame: false,
                    tester: false,
                    allTestedIcons: new Set()
                });

                if (isBlacklisted) _tmBlacklistedIds.add(discordId);
            }

            return reconstructed;
        }

        // Format date for display
        function formatDateCz(dateStr) {
            const d = new Date(dateStr);
            return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
        }

        // Apply time travel
        tmApply.addEventListener('click', () => {
            const dateStr = tmDateInput.value;
            if (!dateStr) {
                tmInfo.textContent = 'Vyber datum!';
                tmInfo.style.color = '#ff6b6b';
                return;
            }

            const targetDate = new Date(dateStr);
            targetDate.setHours(23, 59, 59, 999);
            const targetTs = targetDate.getTime();

            if (targetTs > Date.now()) {
                tmInfo.textContent = 'Nelze cestovat do budoucnosti!';
                tmInfo.style.color = '#ff6b6b';
                return;
            }

            // Save original data on first travel
            if (!_originalOverallData) {
                _originalOverallData = overallData;
            }

            _tmActive = true;
            _tmBlacklistedIds = new Set();

            const reconstructed = reconstructAtDate(targetTs);

            if (reconstructed.length === 0) {
                tmInfo.textContent = 'Žádná data pro toto datum.';
                tmInfo.style.color = '#ff6b6b';
                return;
            }

            // Reset allPlayers so renderOverall can rebuild autocomplete
            allPlayers = [];

            overallData = reconstructed;
            renderOverall(overallData);

            // Hide recently tested during time travel
            const recentEl = document.getElementById('recently-tested');
            if (recentEl) recentEl.style.display = 'none';

            // Show banner
            let banner = document.querySelector('.tm-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.className = 'tm-banner';
                const container = document.getElementById('overall-tabulka');
                if (container) container.parentNode.insertBefore(banner, container);
            }
            banner.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Zobrazuješ tierlist z <strong>${formatDateCz(dateStr)}</strong> <button class="tm-banner-close" id="tm-banner-close">✕</button>`;
            banner.style.display = 'flex';
            document.getElementById('tm-banner-close').addEventListener('click', () => {
                timeTravelReset();
            });

            // UI state
            tmBtn.classList.add('tm-active');
            tmReset.style.display = '';
            tmInfo.textContent = reconstructed.length + ' hráčů nalezeno';
            tmInfo.style.color = '#aaffaa';
            tmDropdown.style.display = 'none';


        });

        function timeTravelReset() {
            if (!_originalOverallData) return;

            _tmActive = false;
            _tmBlacklistedIds = new Set();

            // Reset allPlayers so renderOverall can rebuild autocomplete
            allPlayers = [];

            overallData = _originalOverallData;
            _originalOverallData = null;
            renderOverall(overallData);

            // Remove banner
            const banner = document.querySelector('.tm-banner');
            if (banner) banner.style.display = 'none';

            // Restore recently tested
            const recentEl = document.getElementById('recently-tested');
            if (recentEl) recentEl.style.display = '';

            // UI state
            tmBtn.classList.remove('tm-active');
            tmReset.style.display = 'none';
            tmInfo.textContent = '';
        }

        // Reset button
        tmReset.addEventListener('click', () => {
            timeTravelReset();
        });

        // Set min date based on earliest tier history entry
        setTimeout(() => {
            let earliest = Infinity;
            for (const kitsObj of Object.values(tierHistory)) {
                for (const entries of Object.values(kitsObj)) {
                    for (const e of entries) {
                        const ts = parseCzechDate(e.date);
                        if (ts && ts < earliest) earliest = ts;
                    }
                }
            }
            if (earliest !== Infinity) {
                const d = new Date(earliest);
                tmDateInput.min = d.toISOString().split('T')[0];
            }
        }, 2000); // Delay to ensure tierHistory is loaded
    })();

});
