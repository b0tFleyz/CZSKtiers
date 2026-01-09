// Univerzální autocomplete funkcionalita pro vyhledávání hráčů
let allPlayers = [];
let currentSuggestionIndex = -1;
let fullPlayerData = []; // Plná data pro modal

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
                <div class="search-suggestion-item" data-index="${index}" data-nick="${player.nick}">
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
                showFullPlayerModal(nick);
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
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet);
            
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
                    if (!isNaN(num)) overallScore += num;
                });
                
                return {
                    uuid: row.UUID,
                    nick: row.Nick,
                    score: overallScore,
                    tiers: tiers
                };
            });
        })
        .catch(err => console.error('Error loading full player data:', err));
}

function showFullPlayerModal(nick) {
    const modal = document.getElementById('player-modal');
    if (!modal) return;
    
    if (!nick) {
        console.error('showFullPlayerModal called without nick parameter');
        return;
    }
    
    if (fullPlayerData.length === 0) {
        console.warn('Full player data not yet loaded');
        return;
    }
    
    const player = fullPlayerData.find(p => p.nick === nick);
    if (!player) {
        console.error('Player not found in full data:', nick);
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
        if (p.nick === nick) {
            position = currentRank;
            break;
        }
        lastScore = p.score;
        lastRank = currentRank;
    }
    
    // Nastav data
    modal.querySelector('.player-modal-name').textContent = player.nick;
    modal.querySelector('.player-modal-score').textContent = player.score + ' points';
    
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
        
        return '<span class="kit-badge tooltip">' +
            '<span class="kit-icon-circle" style="border-color:' + circleColor + ';">' +
            '<img src="../' + t.icon + '" alt="" class="kit-icon" loading="lazy">' +
            '</span>' +
            '<span class="kit-tier-text" style="' + style + '">' +
            info.text +
            '</span>' +
            '<span class="tooltiptext">' +
            '<strong>' + origText + '</strong><br>' +
            t.tier + ' points' +
            '</span>' +
            '</span>';
    }).join('');
    
    const tiersDiv = modal.querySelector('.player-modal-tiers');
    if (tiersDiv) {
        tiersDiv.innerHTML = kitsHtml;
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
        showFullPlayerModal(player.nick);
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
