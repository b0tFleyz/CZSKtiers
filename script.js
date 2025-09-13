document.addEventListener('DOMContentLoaded', async function () {

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
            <circle cx="11" cy="11" r="9" />
                        const tabulka = document.getElementById(idTabulky);
                        if (!tabulka) {
                            console.warn('Element s id "' + idTabulky + '" nebyl na stránce nalezen, přeskočeno.');
                            return;
                        }
                        tabulka.innerHTML = html;
                        const firstTr = tabulka.querySelector('tr:first-child');
                        if (firstTr) firstTr.remove();
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
    <span class="kit-icon-circle" style="border-color:${circleColor};">
        <img src="${kit.icon}" alt="" class="kit-icon">
    </span>
    <span class="kit-tier-text" style="${style}">
        ${info.novyText}
    </span>
    <span class="tooltiptext">
        <strong>${origText}</strong><br>
        ${t.tier} points
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

    // Načti overall jako karty
    await nactiOverallExcel('https://docs.google.com/spreadsheets/d/e/2PACX-1vTsYd1Hv8XjsdskgT2O-_Otwe3DKxXTXECPE0s4JcPwPPnLMMpknU_-y8EHNBZTtVEQgzicFKcgluSU/pub?output=xlsx');

    zobrazTabulku('overall-tabulka');

    function renderOverall(overallData) {
        const container = document.getElementById('overall-tabulka');
        if (!container) return; // Pokud element neexistuje, neprováděj render
        container.innerHTML = '';
        // Seřaď hráče podle score (od nejvyššího)
        const sortedPlayers = [...overallData].sort((a, b) => b.score - a.score);
        let lastScore = null;
        let lastRank = 0;
        sortedPlayers.slice(0, 99).forEach((player, idx) => {
            // Pokud má stejný počet bodů jako předchozí, má stejné pořadí
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

            // Seřaď tiery hráče podle TIER_ORDER
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
                            <img src="${t.icon}" alt="" class="kit-icon">
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

            const card = document.createElement('div');
            card.className = 'player-card';
            card.innerHTML = `
                <div class="card-header compact-row">
                    <div class="rank-badge" style="background:${rankColor}; color:#23242a;">${rank}</div>
                    <div class="skin-bg rank-${rank}">
                        <img class="skin" src="https://render.crafty.gg/3d/bust/${player.uuid}" alt="${player.nick}">
                    </div>
                    <div class="player-info">
                        <div class="player-name">${player.nick}</div>
                        <div class="score">${player.score}</div>
                    </div>
                    <div class="kits-row">${kitsHtml}</div>
                </div>
            `;
            // MODAL: kliknutí na kartu hráče
            card.addEventListener('click', () => {
                showPlayerModal({
                    name: player.nick,
                    position: rank,
                    score: player.score,
                    skin: `https://render.crafty.gg/3d/bust/${player.uuid}`,
                    kitsHtml: kitsHtml
                });
            });
            container.appendChild(card);
        });
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
        modal.querySelector('.player-modal-skin').src = skin;
        modal.querySelector('.player-modal-tiers').innerHTML = kitsHtml;
        modal.style.display = 'flex';
    }

    // Zavření modalu
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.querySelector('.player-modal-close').onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }

    // Klávesová zkratka "/" pro focus
    document.addEventListener('keydown', function (e) {
        if (e.key === '/' && document.activeElement !== document.getElementById('search-input')) {
            e.preventDefault();
            document.getElementById('search-input').focus();
        }
    });

    // Vyhledávání hráče (case-insensitive, hledá v celém overallData)
    document.getElementById('search-form').onsubmit = function (e) {
        e.preventDefault();
        const nick = document.getElementById('search-input').value.trim().toLowerCase();
        if (!nick) return;

        // Najdi hráče v overallData seřazeném podle score
        const sortedPlayers = [...overallData].sort((a, b) => b.score - a.score);
        let lastScore = null;
        let lastRank = 0;
        let foundIdx = -1;
        let foundRank = 0;
        sortedPlayers.forEach((player, idx) => {
            if (!player.nick) return;
            if (player.score === lastScore) {
                var rank = lastRank;
            } else {
                var rank = idx + 1;
                lastScore = player.score;
                lastRank = rank;
            }
            if (player.nick.toLowerCase() === nick && foundIdx === -1) {
                foundIdx = idx;
                foundRank = rank;
            }
        });
        if (foundIdx === -1) {
            alert("Hráč nenalezen!");
            return;
        }
        const player = sortedPlayers[foundIdx];

        // Otevři modal s informacemi o hráči
        const kitsHtml = renderSortedBadges(player);
        showPlayerModal({
            name: player.nick,
            position: foundRank,
            score: player.score,
            skin: `https://render.crafty.gg/3d/bust/${player.nick}`,
            kitsHtml: kitsHtml
        });
    };

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

});
document.addEventListener('DOMContentLoaded', function () {
    // Zvýraznění aktivní tabulky v navigaci i pro overall
    function highlightNav() {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const path = window.location.pathname;
        // Opravena detekce pro overall.html
        if (path.match(/overall\.html$/)) {
            document.querySelector('.nav-btn[href="overall.html"]')?.classList.add('active');
        } else if (path.match(/tabulky\.html$/)) {
            let kit = (window.location.hash || '#cpvp-table').replace('#', '').replace('-table', '');
            if (!kit || kit === 'overall') kit = 'cpvp';
            document.querySelector(`.nav-btn[href*='${kit}-table']`)?.classList.add('active');
        }
    }
    window.addEventListener('hashchange', highlightNav);
    highlightNav();

    // Funkce pro zobrazení správné tabulky podle hashe v URL
    function zobrazTabulku(hash) {
        document.querySelectorAll('.tabulka').forEach(div => div.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const path = window.location.pathname;
        if (path.match(/overall\.html$/)) {
            // Jsme na overall.html, zvýrazni pouze Overall
            document.querySelector('.nav-btn[href="overall.html"]')?.classList.add('active');
            const overallTabulka = document.getElementById('overall-tabulka');
            if (overallTabulka) overallTabulka.classList.add('active');
        } else {
            let kit = (hash || '#cpvp-table').replace('#', '').replace('-table', '');
            if (!kit || kit === 'overall') kit = 'cpvp';
            const tabulka = document.getElementById(kit + '-tabulka');
            if (tabulka) tabulka.classList.add('active');
            // Zvýrazni aktivní tlačítko v navigaci (přesná shoda pro Pot)
            let navBtn;
            if (kit === 'pot') {
                navBtn = document.querySelector(`.nav-btn[href='tabulky.html#pot-table']`);
            } else {
                navBtn = document.querySelector(`.nav-btn[href*='${kit}-table']`);
            }
            if (navBtn) navBtn.classList.add('active');
            // Skryj overall-tabulka vždy
            const overallTabulka = document.getElementById('overall-tabulka');
            if (overallTabulka) overallTabulka.classList.remove('active');
        }
    }

    // Přepínání při kliknutí na menu
    // Navigace bez blokování přesměrování
    const odkazy = document.querySelectorAll('nav a');
    odkazy.forEach(a => {
        a.addEventListener('click', function (e) {
            // Necháme defaultní chování, aby se stránka opravdu přesměrovala
        });
    });

    // Přepnutí při načtení stránky nebo změně hashe
    window.addEventListener('hashchange', () => zobrazTabulku(window.location.hash));
    zobrazTabulku(window.location.hash);
});
