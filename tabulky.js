let allPlayers = [];

const TIER_ORDER = [
    "60", "48", "32", "24", "16", "10", "5", "3", "2", "1",
    "54", "43", "29", "22"
];

function getTierOrder(tier) {
    const idx = TIER_ORDER.indexOf(String(tier));
    return idx === -1 ? 999 : idx;
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
        case "22": novyText = "LT2"; barvaTextu = "#888D95"; barvaPozadi = "#23242a"; break;
        case "29": novyText = "HT2"; barvaTextu = "#A4B3C7"; barvaPozadi = "#23242a"; break;
        case "43": novyText = "LT1"; barvaTextu = "#D5B355"; barvaPozadi = "#23242a"; break;
        case "54": novyText = "HT1"; barvaTextu = "#FFCF4A"; barvaPozadi = "#23242a"; break;
        default: barvaPozadi = "#EEE0CB"; break;
    }
    return { novyText, barvaTextu, barvaPozadi };
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

document.addEventListener('DOMContentLoaded', function () {
    // Načti data z Excelu (overall)
    let players = [];
    const cacheBuster = new Date().getTime();
    fetch(`https://docs.google.com/spreadsheets/d/e/2PACX-1vTsYd1Hv8XjsdskgT2O-_Otwe3DKxXTXECPE0s4JcPwPPnLMMpknU_-y8EHNBZTtVEQgzicFKcgluSU/pub?output=xlsx&_=${cacheBuster}`)
        .then(res => {
            if (!res.ok) throw new Error('Nepodařilo se načíst data');
            return res.arrayBuffer();
        })
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet);
            
            players = rows.map(row => {
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
                let overallScore = 0;
                tiers.forEach(t => {
                    const val = parseInt(t.tier);
                    if (!isNaN(val)) overallScore += val;
                });
                return {
                    uuid: row.UUID,
                    nick: row.Nick,
                    score: overallScore,
                    tiers: tiers
                };
            });
            allPlayers = [...players];
            setActiveKitFromHash();
            initAutocomplete();
        })
        .catch(error => {
            console.error('Chyba při načítání dat:', error);
            const tabulka = document.getElementById('overall-tabulka');
            if (tabulka) {
                tabulka.innerHTML = '<div style="text-align:center;padding:40px;color:#fff;"><h3>Nepodařilo se načíst data</h3><p>Zkuste obnovit stránku</p></div>';
            }
        });

    // Kits mapping for navigation
    const kitMap = {
        overall: 'overall',
        cpvp: 'cpvp',
        axe: 'axe',
        sword: 'sword',
        uhc: 'uhc',
        npot: 'npot',
        pot: 'pot',
        smp: 'smp',
        diasmp: 'diasmp',
        mace: 'mace'
    };

    function renderKitColumns(players, kitKey) {
        const tabulka = document.getElementById('overall-tabulka');
        if (!tabulka) return;
        tabulka.innerHTML = '';
        // Title
        const title = document.createElement('h2');
        title.className = 'kit-title';
        title.textContent = kitKey === 'overall' ? 'Overall' : kitKey.toUpperCase();
        tabulka.appendChild(title);
        // Columns
        const columns = document.createElement('div');
        columns.className = 'kit-columns';
        
        // Mapování tier hodnot na tier názvy a barvy
        const tierGroups = [
            { name: 'Tier 1', color: '#eecd14', icon: '🥇', values: ['60', '54'] }, // HT1, RHT1
            { name: 'Tier 2', color: '#c0c0c0', icon: '🥈', values: ['48', '43', '32', '29'] }, // LT1, RLT1, HT2, RHT2
            { name: 'Tier 3', color: '#cd7f32', icon: '🥉', values: ['24', '22', '16', '10'] }, // LT2, RLT2, HT3, LT3
            { name: 'Tier 4', color: '#23242a', icon: '', values: ['5', '3'] }, // HT4, LT4
            { name: 'Tier 5', color: '#23242a', icon: '', values: ['2', '1'] } // HT5, LT5
        ];
        
        // Always render columns in order, even if empty
        for (const tierObj of tierGroups) {
            const col = document.createElement('div');
            col.className = 'kit-tier-col';
            col.setAttribute('data-tier', tierObj.name);
            const header = document.createElement('div');
            header.className = 'kit-tier-header';
            header.style.background = tierObj.color;
            header.style.color = '#fff';
            header.innerHTML = tierObj.icon ? `<span style="font-size:1.3em;vertical-align:middle;">${tierObj.icon}</span> ${tierObj.name}` : tierObj.name;
            col.appendChild(header);
            const list = document.createElement('div');
            list.className = 'kit-tier-list';
            
            // Najdi hráče podle tier hodnot v daném kitu
            players.forEach(player => {
                // Najdi tier pro tento kit
                const kitTier = player.tiers?.find(t => {
                    // Mapování kit keys na ikony
                    const iconMap = {
                        'cpvp': 'kit_icons/cpvp.png',
                        'axe': 'kit_icons/axe.png',
                        'sword': 'kit_icons/sword.png',
                        'uhc': 'kit_icons/uhc.png',
                        'npot': 'kit_icons/npot.png',
                        'pot': 'kit_icons/pot.png',
                        'smp': 'kit_icons/smp.png',
                        'diasmp': 'kit_icons/diasmp.png',
                        'mace': 'kit_icons/mace.png'
                    };
                    return t.icon === iconMap[kitKey];
                });
                
                // Pokud hráč má tier v tomto kitu a odpovídá tier skupině
                if (kitTier && tierObj.values.includes(String(kitTier.tier))) {
                const div = document.createElement('div');
                div.className = 'kit-player';
                div.style.cursor = 'pointer';
                
                // Vytvoř img element s error handlingem
                const img = document.createElement('img');
                // Escapuj nick pro URL (mezery a speciální znaky)
                const escapedNick = encodeURIComponent(player.nick);
                img.src = `https://mc-heads.net/avatar/${escapedNick}/32`;
                img.alt = 'skin';
                img.style.cssText = 'width:32px;height:32px;border-radius:8px;margin-right:8px;vertical-align:middle;';
                
                // Fallback na placeholder pokud se skin nenačte
                img.onerror = function() {
                    this.src = `https://crafatar.com/avatars/${escapedNick}?size=32&default=MHF_Steve&overlay`;
                };
                
                const span = document.createElement('span');
                span.textContent = player.nick;
                
                div.appendChild(img);
                div.appendChild(span);
                
                // Click handler pro zobrazení modalu
                div.addEventListener('click', function() {
                    // Najdi celá data hráče z allPlayers
                    const fullPlayer = allPlayers.find(p => p.nick === player.nick);
                    if (!fullPlayer) return;
                    
                    // Najdi pozici hráče
                    const sortedPlayers = [...allPlayers].sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        return (a.nick || '').localeCompare(b.nick || '');
                    });
                    
                    let position = '?';
                    let lastScore = -1;
                    let lastRank = 0;
                    for (let i = 0; i < sortedPlayers.length; i++) {
                        const p = sortedPlayers[i];
                        let currentRank;
                        if (p.score !== lastScore) {
                            currentRank = i + 1;
                        } else {
                            currentRank = lastRank;
                        }
                        if (p.nick === fullPlayer.nick) {
                            position = currentRank + '.';
                            break;
                        }
                        lastScore = p.score;
                        lastRank = currentRank;
                    }
                    
                    // Vygeneruj kits HTML
                    const sortedTiers = (fullPlayer.tiers || [])
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
                        return '<span class="kit-badge tooltip">' +
                            '<span class="kit-icon-circle" style="border-color:' + circleColor + ';">' +
                            '<img src="' + t.icon + '" alt="" class="kit-icon" loading="lazy">' +
                            '</span>' +
                            '<span class="kit-tier-text" style="' + style + '">' +
                            info.novyText +
                            '</span>' +
                            '<span class="tooltiptext">' +
                            '<strong>' + origText + '</strong><br>' +
                            t.tier + ' points' +
                            '</span>' +
                            '</span>';
                    }).join('');
                    
                    showPlayerModal({
                        name: fullPlayer.nick,
                        position: position,
                        score: fullPlayer.score,
                        skin: 'https://mc-heads.net/avatar/' + escapedNick + '/64',
                        kitsHtml: kitsHtml
                    });
                });
                
                list.appendChild(div);
                }
            });
            col.appendChild(list);
            columns.appendChild(col);
        }
        tabulka.appendChild(columns);
    }

    // Navigation logic
    function setActiveKitFromHash() {
        let hash = window.location.hash.replace('#', '').replace('-table', '');
        let kitKey = kitMap[hash] || 'cpvp';
        // Highlight nav
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        if (kitKey === 'overall') {
            document.querySelector('.nav-btn[href="overall.html"]')?.classList.add('active');
        } else {
            document.querySelector(`.nav-btn[href*='${kitKey}-table']`)?.classList.add('active');
        }
        renderKitColumns(players, kitKey);
    }

    window.addEventListener('hashchange', setActiveKitFromHash);
    setActiveKitFromHash();

    // Autocomplete
    function initAutocomplete() {
        const searchForm = document.getElementById('search-form');
        const searchInput = document.getElementById('search-input');
        if (!searchForm || !searchInput) return;

        // Zabráň defaultnímu submit chování
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
        });

        // Dropdown pro suggestions
        let suggestionsDiv = document.querySelector('.search-suggestions');
        if (!suggestionsDiv) {
            suggestionsDiv = document.createElement('div');
            suggestionsDiv.className = 'search-suggestions';
            searchForm.appendChild(suggestionsDiv);
        }

        let currentSuggestionIndex = -1;

        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase().trim();
            currentSuggestionIndex = -1;
            
            if (query.length === 0) {
                suggestionsDiv.classList.remove('active');
                return;
            }

            // Filtruj hráče
            const matches = allPlayers.filter(p => 
                p.nick && p.nick.toLowerCase().includes(query)
            ).slice(0, 8);

            if (matches.length === 0) {
                suggestionsDiv.classList.remove('active');
                return;
            }

            // Zobraz suggestions
            suggestionsDiv.innerHTML = '';
            matches.forEach(player => {
                const div = document.createElement('div');
                div.className = 'search-suggestion-item';
                
                const escapedNick = encodeURIComponent(player.nick);
                const avatarUrl = 'https://mc-heads.net/avatar/' + escapedNick + '/32';
                
                div.innerHTML = '<img src="' + avatarUrl + '" alt="" class="player-avatar">' +
                    '<div class="player-details">' +
                    '<div class="name">' + player.nick + '</div>' +
                    '</div>';
                
                div.addEventListener('click', function() {
                    // Najdi pozici hráče
                    const sortedPlayers = [...allPlayers].sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        return (a.nick || '').localeCompare(b.nick || '');
                    });
                    
                    let position = '?';
                    let lastScore = -1;
                    let lastRank = 0;
                    for (let i = 0; i < sortedPlayers.length; i++) {
                        const p = sortedPlayers[i];
                        let currentRank;
                        if (p.score !== lastScore) {
                            currentRank = i + 1;
                        } else {
                            currentRank = lastRank;
                        }
                        if (p.nick === player.nick) {
                            position = currentRank + '.';
                            break;
                        }
                        lastScore = p.score;
                        lastRank = currentRank;
                    }
                    
                    // Vygeneruj kits HTML stejně jako v script.js
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
                        return '<span class="kit-badge tooltip">' +
                            '<span class="kit-icon-circle" style="border-color:' + circleColor + ';">' +
                            '<img src="' + t.icon + '" alt="" class="kit-icon" loading="lazy">' +
                            '</span>' +
                            '<span class="kit-tier-text" style="' + style + '">' +
                            info.novyText +
                            '</span>' +
                            '<span class="tooltiptext">' +
                            '<strong>' + origText + '</strong><br>' +
                            t.tier + ' points' +
                            '</span>' +
                            '</span>';
                    }).join('');
                    
                    showPlayerModal({
                        name: player.nick,
                        position: position,
                        score: player.score,
                        skin: 'https://mc-heads.net/avatar/' + escapedNick + '/64',
                        kitsHtml: kitsHtml
                    });
                    
                    searchInput.value = '';
                    suggestionsDiv.classList.remove('active');
                });
                
                suggestionsDiv.appendChild(div);
            });
            
            suggestionsDiv.classList.add('active');
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

    function showPlayerModal(data) {
        const modal = document.getElementById('player-modal');
        if (!modal) return;
        
        const skin = modal.querySelector('.player-modal-skin');
        const name = modal.querySelector('.player-modal-name');
        const rank = modal.querySelector('.player-modal-rank');
        const score = modal.querySelector('.player-modal-score');
        const tiers = modal.querySelector('.player-modal-tiers');
        const closeBtn = modal.querySelector('.player-modal-close');
        
        if (skin) skin.src = data.skin;
        if (name) name.textContent = data.name;
        if (rank) {
            rank.textContent = data.position;
            // Styling podle pozice
            rank.className = 'player-modal-rank';
            const pos = parseInt(data.position);
            if (pos === 1) rank.classList.add('rank-1');
            else if (pos === 2) rank.classList.add('rank-2');
            else if (pos === 3) rank.classList.add('rank-3');
        }
        if (score) score.textContent = data.score + ' bodů';
        if (tiers) tiers.innerHTML = data.kitsHtml;
        
        modal.style.display = 'flex';
        
        if (closeBtn) {
            closeBtn.onclick = function() {
                modal.style.display = 'none';
            };
        }
        
        modal.onclick = function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
});
