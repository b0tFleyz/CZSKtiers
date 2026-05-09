let allPlayers = [];
let currentSuggestionIndex = -1;
let fullPlayerData = []; // Plná data pro modal
let kitPageTierHistory = {}; // discordId → kitIcon → [{tier, oldTier}]
let _fullDataLoading = false;

function _escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getPeakTierTextAC(discordId, kitIcon) {
    return computePeakTierText((kitPageTierHistory[discordId] || {})[kitIcon] || []);
}

function initAutocomplete(players) {
    allPlayers = players;
    const searchInput = document.getElementById('search-input');
    const searchForm = document.getElementById('search-form');
    
    if (!searchInput || !searchForm) return;
    
    // Načti plná data pro modaly
    loadFullPlayerData();

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
            player && player.nick && player.nick.toLowerCase().includes(query)
        ).slice(0, 8); // Max 8 návrhů

        if (matches.length === 0) {
            suggestionsDiv.innerHTML = '<div class="search-suggestions-empty">Žádní hráči nenalezeni</div>';
            suggestionsDiv.classList.add('active');
            return;
        }

        // Vygeneruj návrhy
        suggestionsDiv.innerHTML = matches.map((player, index) => {
            const nickEsc = _escHtml(player.nick);
            return `
                <div class="search-suggestion-item" data-index="${index}" data-nick="${nickEsc}" data-discord-id="${player.discordId || ''}">
                    <img src="https://mc-heads.net/avatar/${player.uuid || player.nick}/36" alt="${nickEsc}" class="player-avatar">
                    <div class="player-details">
                        <div class="name">${nickEsc}</div>
                    </div>
                </div>
            `;
        }).join('');
        suggestionsDiv.classList.add('active');

        // Přidej click handlery
        suggestionsDiv.querySelectorAll('.search-suggestion-item').forEach(item => {
            item.addEventListener('click', function() {
                const nick = this.dataset.nick;
                const discordId = this.dataset.discordId || '';
                showFullPlayerModal(nick, discordId);
                searchInput.value = '';
                suggestionsDiv.classList.remove('active');
            });
        });
    });

    // Keyboard navigation
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
    
    // Inicializuj modal
    initPlayerModal();
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

function loadFullPlayerData() {
    if (fullPlayerData.length > 0 || _fullDataLoading) return;
    _fullDataLoading = true;

    const _guild = (typeof getActiveGuild === 'function') ? getActiveGuild() : 'czsktiers';
    const _conf = (typeof getGuildConf === 'function') ? getGuildConf(_guild) : null;

    getWorkbook()
        .then(workbook => {

            // Load TierHistory for peak tier data
            kitPageTierHistory = {};
            const iconMap = {
                'Crystal': 'kit_icons/cpvp.png', 'Axe': 'kit_icons/axe.png',
                'Sword': 'kit_icons/sword.png', 'UHC': 'kit_icons/uhc.png',
                'Npot': 'kit_icons/npot.png', 'NPot': 'kit_icons/npot.png',
                'Pot': 'kit_icons/pot.png', 'SMP': 'kit_icons/smp.png',
                'DiaSMP': 'kit_icons/diasmp.png', 'Mace': 'kit_icons/mace.png',
                'Speed': 'kit_icons/speed.png', 'OGV': 'kit_icons/OGV.png',
                'Cart': 'kit_icons/cart.png', 'Creeper': 'kit_icons/creeper.png',
                'DiaVanilla': 'kit_icons/diavanilla.png'
            };
            const _histTab = _conf ? _conf.tierHistoryTab : 'TierHistory';
            const histSheetName = workbook.SheetNames.find(n => n === _histTab) || workbook.SheetNames.find(n => n === 'TierHistory');
            if (histSheetName) {
                const histRows = XLSX.utils.sheet_to_json(workbook.Sheets[histSheetName]);
                histRows.forEach(row => {
                    if (!row.Kit || !row.Tier) return;
                    const did = row['Discord ID'] ? String(row['Discord ID']).trim() : null;
                    if (!did) return;
                    const icon = iconMap[String(row.Kit).trim()] || null;
                    if (!icon) return;
                    const tier = String(row.Tier).trim();
                    const oldTier = row.OldTier ? String(row.OldTier).trim() : null;
                    const date    = row.Date    ? String(row.Date).trim()    : null;
                    if (!kitPageTierHistory[did]) kitPageTierHistory[did] = {};
                    if (!kitPageTierHistory[did][icon]) kitPageTierHistory[did][icon] = [];
                    kitPageTierHistory[did][icon].push({ tier, oldTier, date });
                });
            }

            // Pick correct sheet tab for active guild
            const _sheetTab = _conf ? _conf.sheetTab : null;
            let worksheet;
            if (_sheetTab) {
                worksheet = workbook.Sheets[_sheetTab];
            } else {
                worksheet = workbook.Sheets[workbook.SheetNames[0]];
            }
            if (!worksheet) worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet);

            // Use guild-specific kits
            const CZSK_KITS_AC = [
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
            const SUB_KITS_AC = [
                { key: "Speed", icon: "kit_icons/speed.png" },
                { key: "OGV", icon: "kit_icons/OGV.png" },
                { key: "Cart", icon: "kit_icons/cart.png" },
                { key: "Creeper", icon: "kit_icons/creeper.png" },
                { key: "DiaVanilla", icon: "kit_icons/diavanilla.png" }
            ];
            const kits = (_guild === 'subtiers') ? SUB_KITS_AC : CZSK_KITS_AC;
            
            fullPlayerData = rows.filter(row => row.UUID && row.Nick).map(row => {
                const tiers = [];
                kits.forEach(kit => {
                    const val = row[kit.key];
                    if (val && val !== "-" && val !== "N/A") {
                        tiers.push({ tier: String(val), icon: kit.icon });
                    }
                });
                
                let overallScore = 0;
                tiers.forEach(t => {
                    const num = parseFloat(t.tier);
                    if (!isNaN(num)) {
                        const discordId = row['Discord ID'] ? String(row['Discord ID']).trim() : '';
                        const peakText = discordId ? getPeakTierTextAC(discordId, t.icon) : null;
                        const peakScore = peakText ? (PEAK_TIER_SCORE[peakText] || 0) : 0;
                        overallScore += Math.max(num, peakScore);
                        t.peakTierText = (peakScore > num) ? peakText : null;
                    }
                });
                
                return {
                    uuid: row.UUID,
                    nick: row.Nick,
                    discordId: row['Discord ID'] ? String(row['Discord ID']).trim() : '',
                    score: overallScore,
                    tiers: tiers
                };
            });
        })
        .catch(err => {
            _fullDataLoading = false;
            console.error('Error loading full player data:', err);
        });
}

function showFullPlayerModal(nick, discordId) {
    const modal = document.getElementById('player-modal');
    if (!modal) return;
    
    if (!nick && !discordId) {
        console.error('showFullPlayerModal called without nick or discordId');
        return;
    }
    
    if (fullPlayerData.length === 0) {
        console.warn('Full player data not yet loaded');
        return;
    }
    
    // Lookup by Discord ID first (stable), then fall back to nick
    const player = (discordId && fullPlayerData.find(p => p.discordId === discordId))
        || fullPlayerData.find(p => p.nick === nick);
    if (!player) {
        console.error('Player not found in full data:', nick, discordId);
        return;
    }
    
    // Najdi pozici
    const sortedPlayers = [...fullPlayerData].sort((a, b) => b.score - a.score);
    let position = 1;
    let lastScore = null;
    let lastRank = 0;
    
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
    
    // Nastav data
    modal.querySelector('.player-modal-name').textContent = player.nick;
    modal.querySelector('.player-modal-score').textContent = player.score + ' points';

    // Score title badge
    const scoreTitleEl = modal.querySelector('.player-modal-score-title');
    if (scoreTitleEl) {
        const st = getScoreTitle(player.score);
        scoreTitleEl.textContent = st.title;
        scoreTitleEl.style.color = st.color;
    }
    // Days on tierlist
    const daysEl = modal.querySelector('.player-modal-days');
    if (daysEl) {
        const firstDate = getPlayerFirstDateAC(player.discordId);
        if (firstDate) {
            const days = Math.floor((Date.now() - firstDate) / (24 * 60 * 60 * 1000));
            daysEl.textContent = days + ' dní na tierlistu';
            daysEl.style.display = '';
        } else {
            daysEl.style.display = 'none';
        }
    }
    
    const modalSkinImg = modal.querySelector('.player-modal-skin');
    modalSkinImg.src = 'https://mc-heads.net/avatar/' + player.uuid + '/64';
    modalSkinImg.loading = 'lazy';
    
    // Nastav rank
    const rankElem = modal.querySelector('.player-modal-rank');
    if (rankElem) {
        rankElem.style.display = 'block';
        let rankClass = "rank-other";
        if (position === 1) rankClass = "rank-1";
        else if (position === 2) rankClass = "rank-2";
        else if (position === 3) rankClass = "rank-3";
        rankElem.className = "player-modal-rank " + rankClass;
        rankElem.textContent = position + ".";
    }
    
    // Vygeneruj kits HTML stejně jako v script.js
    const sortedTiers = player.tiers
        .filter(t => t.tier && t.tier !== "-")
        .sort((a, b) => getTierOrder(String(a.tier)) - getTierOrder(String(b.tier)));

    const kitsHtml = sortedTiers.map(t => {
        const info = tierInfo(String(t.tier));
        const origText = getOriginalTierText(String(t.tier));
        const isRetired = origText.startsWith("R");
        const style = isRetired
            ? "background:#23242a;color:" + info.barvaTextu + ";"
            : "background:" + info.barvaPozadi + ";color:#23242a;";
        const circleColor = isRetired ? "#23242a" : info.barvaPozadi;
        const tierColor = isRetired ? info.barvaTextu : info.barvaPozadi;

        return '<span class="kit-badge tooltip" style="--tier-color:' + tierColor + ';" data-kit-icon="' + t.icon + '" data-kit-tier="' + t.tier + '">' +
            '<span class="kit-icon-circle" style="border-color:' + circleColor + ';">' +
            '<img src="../' + t.icon + '" alt="" class="kit-icon" loading="lazy">' +
            '</span>' +
            '<span class="kit-tier-text" style="' + style + '">' +
            info.novyText +
            '</span>' +
            '<span class="tooltiptext">' +
            '<strong>' + origText + '</strong><br>' +
            (t.peakTierText ? PEAK_TIER_SCORE[t.peakTierText] : t.tier) + ' pts' +
            (t.peakTierText ? '<br><span style="font-size:0.85em;opacity:0.7;">Peak: ' + t.peakTierText + '</span>' : '') +
            '</span>' +
            '</span>';
    }).join('');
    
    const tiersDiv = modal.querySelector('.player-modal-tiers');
    if (tiersDiv) {
        tiersDiv.innerHTML = kitsHtml;
        // Wire Tier Journey click on kit badges (pokud je tierjourney.js načten)
        if (typeof window.showTierJourney === 'function') {
            tiersDiv.querySelectorAll('.kit-badge[data-kit-icon]').forEach(badge => {
                badge.classList.add('badge-journey-clickable');
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.showTierJourney(player.nick, badge.dataset.kitIcon, badge.dataset.kitTier, player.discordId);
                });
            });
        }
    }
    
    // Achievements
    const achEl = modal.querySelector('.player-modal-achievements');
    if (achEl) {
        const achList = computeAchievementsAC({ name: player.nick, position, score: player.score, tiers: player.tiers, discordId: player.discordId });
        if (achList.length > 0) {
            achEl.innerHTML = achList.map(a =>
                '<span class="achievement-badge" style="--ach-color:' + a.color + ';">' + a.label + '<span class="ach-tip">' + a.desc + '</span></span>'
            ).join('');
            achEl.style.display = '';
        } else {
            achEl.innerHTML = '';
            achEl.style.display = 'none';
        }
    }

    modal.style.display = 'flex';
}


function showKitPlayerModal(player) {
    // Pro zpětnou kompatibilitu - použij full modal pokud jsou data k dispozici
    if (fullPlayerData.length > 0) {
        showFullPlayerModal(player.nick, player.discordId || '');
    } else {
        // Fallback na jednoduchý modal
        const modal = document.getElementById('player-modal');
        if (!modal) return;
        
        modal.querySelector('.player-modal-name').textContent = player.nick;
        
        const tierValue = player.pot || player.axe || player.sword || player.uhc || 
                         player.npot || player.cpvp || player.smp || player.diasmp || 
                         player.mace || 'N/A';
        modal.querySelector('.player-modal-score').textContent = tierValue !== 'N/A' ? 'Tier: ' + tierValue : 'Neotestováno';
        
        const modalSkinImg = modal.querySelector('.player-modal-skin');
        modalSkinImg.src = 'https://mc-heads.net/avatar/' + (player.uuid || player.nick) + '/64';
        modalSkinImg.loading = 'lazy';
        
        const rankElem = modal.querySelector('.player-modal-rank');
        if (rankElem) {
            rankElem.style.display = 'none';
        }
        
        const tiersDiv = modal.querySelector('.player-modal-tiers');
        if (tiersDiv) {
            tiersDiv.innerHTML = '';
        }
        
        modal.style.display = 'flex';
    }
}


function getPlayerFirstDateAC(discordId) {
    if (!discordId || !kitPageTierHistory[discordId]) return null;
    let earliest = Infinity;
    for (const entries of Object.values(kitPageTierHistory[discordId])) {
        for (const e of entries) {
            const ts = parseCzechDate(e.date);
            if (ts && ts < earliest) earliest = ts;
        }
    }
    return earliest === Infinity ? null : earliest;
}

function computeAchievementsAC({ name, position, score, tiers, discordId }) {
    const achievements = [];
    const validTiers = (tiers || []).filter(t => t.tier && t.tier !== '-');
    const testedKits = validTiers.length;
    // Guild kits count
    const guild = (typeof getActiveGuild === 'function') ? getActiveGuild() : 'czsktiers';
    const conf = (typeof getGuildConf === 'function') ? getGuildConf(guild) : null;
    const guildKitCount = conf ? conf.kits.length : 9;

    if (validTiers.some(t => String(t.tier) === '60')) {
        achievements.push({ label: 'Kit Master', desc: 'Dosáhl HT1 v některém kitu', color: '#FFCF4A' });
    }
    if (position === 1) achievements.push({ label: '#1', desc: '1. místo v celkovém leaderboardu', color: '#eecd14' });
    else if (position === 2) achievements.push({ label: '#2', desc: '2. místo v celkovém leaderboardu', color: '#c0c0c0' });
    else if (position === 3) achievements.push({ label: '#3', desc: '3. místo v celkovém leaderboardu', color: '#cd7f32' });
    if (position >= 4 && position <= 10) {
        achievements.push({ label: 'Top 10', desc: 'Umístění v top 10 celkového leaderboardu', color: '#6366f1' });
    }
    if (testedKits >= guildKitCount && guildKitCount > 0) {
        achievements.push({ label: 'All-kits', desc: 'Testován ve všech kitech aktuální tierlistu', color: '#34d399' });
    }
    const eliteTiers = validTiers.filter(t => ['32','48','60'].includes(String(t.tier)));
    if (eliteTiers.length >= 3) {
        achievements.push({ label: 'Elite', desc: '3 nebo více kitů na HT2 nebo výše', color: '#f97316' });
    }
    if (discordId && kitPageTierHistory[discordId]) {
        let earliest = Infinity;
        for (const entries of Object.values(kitPageTierHistory[discordId])) {
            for (const e of entries) {
                const ts = parseCzechDate(e.date);
                if (ts && ts < earliest) earliest = ts;
            }
        }
        const years = (Date.now() - earliest) / (365.25 * 24 * 60 * 60 * 1000);
        if (years >= 2) {
            achievements.push({ label: '2+ roky', desc: 'Na tierlistu více než 2 roky', color: '#f59e0b' });
        }
    }
    return achievements;
}

function initPlayerModal() {
    const modal = document.getElementById('player-modal');
    if (!modal) return;
    
    const closeBtn = modal.querySelector('.player-modal-close');
    if (closeBtn) {
        closeBtn.onclick = () => modal.style.display = 'none';
    }
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });
}