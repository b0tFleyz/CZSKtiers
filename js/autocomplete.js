let allPlayers = [];
let currentSuggestionIndex = -1;
let fullPlayerData = []; // Plná data pro modal
let kitPageTierHistory = {}; // discordId → kitIcon → [{tier, oldTier}]

const PEAK_TIER_SCORE_AUTOCOMPLETE = {
    'HT3': 14, 'LT2': 22, 'HT2': 29, 'LT1': 43, 'HT1': 54
};

function resolveTierValueAC(tier) {
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

// Parses Czech locale date string "D. M. YYYY" or "D.M.YYYY" into a timestamp
function parseCzechDateAC(str) {
    if (!str) return null;
    const m = str.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
    if (!m) return null;
    return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])).getTime();
}

// Returns the highest peak tier confirmed by holding it long enough:
// HT3 = 30 days, LT2/HT2 = 60 days, LT1/HT1 = 90 days
function getPeakTierTextAC(discordId, kitIcon) {
    const history = (kitPageTierHistory[discordId] || {})[kitIcon] || [];
    if (history.length === 0) return null;
    const TIER_ORDER_AC = ['60','48','32','24','16','10','5','3','2','1','54','43','29','22'];
    const PEAK_REQUIRED_DAYS_AC = { 'HT3': 30, 'LT2': 60, 'HT2': 60, 'LT1': 90, 'HT1': 90 };
    const sorted = history
        .map(e => ({ ...e, ts: parseCzechDateAC(e.date) }))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
    let confirmedBestOrder = 999;
    let confirmedBestTier = null;
    for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        const tier = String(entry.tier || '').trim();
        if (!tier || tier.startsWith('R')) continue;
        if (!PEAK_REQUIRED_DAYS_AC[tier]) continue;
        const oldTier = String(entry.oldTier || '').trim();
        if (oldTier === tier) continue; // holds event, not a promotion
        const startDate = entry.ts;
        if (!startDate) continue;
        let endDate = Date.now();
        for (let j = i + 1; j < sorted.length; j++) {
            const next = sorted[j];
            if (String(next.oldTier || '').trim() === tier && next.ts) {
                endDate = next.ts;
                break;
            }
        }
        const heldDays = (endDate - startDate) / (24 * 60 * 60 * 1000);
        if (heldDays >= PEAK_REQUIRED_DAYS_AC[tier]) {
            const tierVal = resolveTierValueAC(tier);
            if (tierVal) {
                const order = TIER_ORDER_AC.indexOf(tierVal);
                if (order !== -1 && order < confirmedBestOrder) {
                    confirmedBestOrder = order;
                    confirmedBestTier = tier;
                }
            }
        }
    }
    return confirmedBestTier;
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
            return `
                <div class="search-suggestion-item" data-index="${index}" data-nick="${player.nick}" data-discord-id="${player.discordId || ''}">
                    <img src="https://mc-heads.net/avatar/${player.uuid || player.nick}/36" alt="${player.nick}" class="player-avatar">
                    <div class="player-details">
                        <div class="name">${player.nick}</div>
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
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vTsYd1Hv8XjsdskgT2O-_Otwe3DKxXTXECPE0s4JcPwPPnLMMpknU_-y8EHNBZTtVEQgzicFKcgluSU/pub?output=xlsx')
        .then(res => res.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });

            // Load TierHistory for peak tier data
            kitPageTierHistory = {};
            const iconMap = {
                'Crystal': 'kit_icons/cpvp.png', 'Axe': 'kit_icons/axe.png',
                'Sword': 'kit_icons/sword.png', 'UHC': 'kit_icons/uhc.png',
                'Npot': 'kit_icons/npot.png', 'NPot': 'kit_icons/npot.png',
                'Pot': 'kit_icons/pot.png', 'SMP': 'kit_icons/smp.png',
                'DiaSMP': 'kit_icons/diasmp.png', 'Mace': 'kit_icons/mace.png'
            };
            const histSheetName = workbook.SheetNames.find(n => n === 'TierHistory');
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

            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet);
            
            const kits = [
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
                        const peakScore = peakText ? (PEAK_TIER_SCORE_AUTOCOMPLETE[peakText] || 0) : 0;
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
        .catch(err => console.error('Error loading full player data:', err));
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
        const st = getScoreTitleAC(player.score);
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
        .sort((a, b) => {
            const TIER_ORDER = ["60", "48", "32", "24", "16", "10", "5", "3", "2", "1", "54", "43", "29", "22"];
            const aIdx = TIER_ORDER.indexOf(String(a.tier));
            const bIdx = TIER_ORDER.indexOf(String(b.tier));
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });
    
    const kitsHtml = sortedTiers.map(t => {
        const info = getTierInfoForModal(String(t.tier));
        const origText = getOriginalTierText(String(t.tier));
        let style = "";
        let circleColor = "";
        
        if (origText.startsWith("R")) {
            style = "background:#23242a;color:" + info.color + ";";
            circleColor = "#23242a";
        } else {
            style = "background:" + info.color + ";color:#23242a;";
            circleColor = info.color;
        }
        
        return '<span class="kit-badge tooltip" style="--tier-color:' + info.color + ';" data-kit-icon="' + t.icon + '" data-kit-tier="' + t.tier + '">' +
            '<span class="kit-icon-circle" style="border-color:' + circleColor + ';">' +
            '<img src="../' + t.icon + '" alt="" class="kit-icon" loading="lazy">' +
            '</span>' +
            '<span class="kit-tier-text" style="' + style + '">' +
            info.text +
            '</span>' +
            '<span class="tooltiptext">' +
            '<strong>' + origText + '</strong><br>' +
            (t.peakTierText ? PEAK_TIER_SCORE_AUTOCOMPLETE[t.peakTierText] : t.tier) + ' pts' +
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

function getTierInfoForModal(tier) {
    const tierMap = {
        '60': { text: 'HT1', color: '#FFCF4A' },
        '54': { text: 'HT1', color: '#FFCF4A' },
        '48': { text: 'LT1', color: '#D5B355' },
        '43': { text: 'LT1', color: '#D5B355' },
        '32': { text: 'HT2', color: '#A4B3C7' },
        '29': { text: 'HT2', color: '#A4B3C7' },
        '24': { text: 'LT2', color: '#888D95' },
        '22': { text: 'LT2', color: '#888D95' },
        '16': { text: 'HT3', color: '#8F5931' },
        '10': { text: 'LT3', color: '#B56326' },
        '5': { text: 'HT4', color: '#655B79' },
        '3': { text: 'LT4', color: '#655B79' },
        '2': { text: 'HT5', color: '#655B79' },
        '1': { text: 'LT5', color: '#655B79' }
    };
    return tierMap[tier] || { text: tier, color: '#EEE0CB' };
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

function getScoreTitleAC(score) {
    if (score >= 300) return { title: 'Legenda', color: '#FFCF4A' };
    if (score >= 200) return { title: 'Elita', color: '#A4B3C7' };
    if (score >= 100) return { title: 'Šampion', color: '#8F5931' };
    if (score >= 50)  return { title: 'Bojovník', color: '#6366f1' };
    return { title: 'Nováček', color: '#655B79' };
}

function getPlayerFirstDateAC(discordId) {
    if (!discordId || !kitPageTierHistory[discordId]) return null;
    let earliest = Infinity;
    for (const entries of Object.values(kitPageTierHistory[discordId])) {
        for (const e of entries) {
            const ts = parseCzechDateAC(e.date);
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
                const ts = parseCzechDateAC(e.date);
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