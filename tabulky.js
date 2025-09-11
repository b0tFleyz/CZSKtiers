document.addEventListener('DOMContentLoaded', function () {
    // Načti data z Excelu (overall)
    let players = [];
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vTsYd1Hv8XjsdskgT2O-_Otwe3DKxXTXECPE0s4JcPwPPnLMMpknU_-y8EHNBZTtVEQgzicFKcgluSU/pub?output=xlsx')
        .then(res => res.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet);
            // Předpoklad: jméno hráče v rows[i].Nick, body v rows[i].Score, kity v rows[i].Cpvp, Axe, Sword, ...
            players = rows.map(row => ({
                nick: row.Nick,
                score: row.Score,
                cpvp: row.Cpvp,
                axe: row.Axe,
                sword: row.Sword,
                uhc: row.Uhc,
                npot: row.Npot,
                pot: row.Pot,
                smp: row.Smp,
                diasmp: row.Diasmp,
                mace: row.Mace
            }));
            setActiveKitFromHash();
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
        const tiers = [
            { name: 'Tier 1', color: '#eecd14', icon: '🥇' },
            { name: 'Tier 2', color: '#c0c0c0', icon: '🥈' },
            { name: 'Tier 3', color: '#cd7f32', icon: '🥉' },
            { name: 'Tier 4', color: '#23242a', icon: '' },
            { name: 'Tier 5', color: '#23242a', icon: '' }
        ];
        // Always render columns in order, even if empty
        for (const tierObj of tiers) {
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
            // Hráči podle tieru v aktivním kitu
            players.filter(p => (p[kitKey] || '').trim() === tierObj.name).forEach(player => {
                const div = document.createElement('div');
                div.className = 'kit-player';
                div.innerHTML = `<img src='https://render.crafty.gg/3d/bust/${player.nick}' alt='skin' style='width:32px;height:32px;border-radius:8px;margin-right:8px;vertical-align:middle;'><span>${player.nick}</span>`;
                list.appendChild(div);
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
});
