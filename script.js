document.addEventListener('DOMContentLoaded', async function () {

    // Autocomplete proměnné - definovány na začátku
    let allPlayers = [];
    let currentSuggestionIndex = -1;
    let autocompleteInitialized = false;

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
        ` + t.tier + ` points
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
    // Načti overall jako pole objektů a vygeneruj karty
    async function nactiOverallExcel(url) {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        overallData = rows.map(row => {
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
            // Součet všech tierů kromě neotestovaných
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
                tiers: p.tiers
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
                    <span class="kit-badge tooltip">
                        <span class="kit-icon-circle" style="border-color:${circleColor};">
                            <img src="${t.icon}" alt="" class="kit-icon" loading="lazy">
                        </span>
                        <span class="kit-tier-text" style="${style}">
                            ${info.novyText}
                        </span>
                        <span class="tooltiptext">
                            <strong>${origText}</strong><br>
                            ${t.tier} points
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
                    kitsHtml: kitsHtml
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

    // MODAL funkce
    function showPlayerModal({ name, position, score, skin, kitsHtml }) {
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
                            if (p.nick === nick) {
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
                            skin: 'https://mc-heads.net/avatar/' + (player.uuid || player.nick) + '/64',
                            kitsHtml: kitsHtml
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
