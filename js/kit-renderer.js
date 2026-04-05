// Generic kit page renderer — used by all kit pages
// Usage: renderKitPage('axe', 'Axe') or renderKitPage('speed', 'Speed')
function renderKitPage(slug, columnKey) {
  document.addEventListener('DOMContentLoaded', function () {
    let players = [];
    // Show loading indicator
    const container = document.getElementById(slug + '-tabulka');
    if (container) {
      container.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Načítání dat...</p></div>';
    }
    fetch(XLSX_URL)
      .then(res => res.arrayBuffer())
      .then(data => {
        const workbook = XLSX.read(data, { type: 'array' });
        const guild = getActiveGuild();
        const conf = getGuildConf(guild);
        // Pick correct sheet tab
        let worksheet;
        if (conf.sheetTab) {
          worksheet = workbook.Sheets[conf.sheetTab];
        } else {
          worksheet = workbook.Sheets[workbook.SheetNames[0]];
        }
        if (!worksheet) {
          document.getElementById(slug + '-tabulka').innerHTML = '<p style="color:#888;text-align:center;padding:40px;">Žádná data pro tento tierlist.</p>';
          return;
        }
        const rows = XLSX.utils.sheet_to_json(worksheet);
        players = rows.filter(row => row.UUID && row.Nick).map(row => ({
          uuid: row.UUID,
          nick: row.Nick,
          discordId: row['Discord ID'] ? String(row['Discord ID']).trim() : '',
          tier: normalizeTier(row[columnKey])
        }));
        renderKitTable(slug, players);
      })
      .catch(err => {
        console.error('Error loading kit data:', err);
        const el = document.getElementById(slug + '-tabulka');
        if (el) el.innerHTML = '<p style="color:#f66;text-align:center;padding:40px;">Chyba při načítání dat.</p>';
      });

    function normalizeTier(val) {
      if (!val) return '';
      val = String(val).trim().toLowerCase();
      if (val === '60' || val === 'ht1') return 'HT1';
      if (val === '48' || val === 'lt1') return 'LT1';
      if (val === '32' || val === 'ht2') return 'HT2';
      if (val === '24' || val === 'lt2') return 'LT2';
      if (val === '16' || val === 'ht3') return 'HT3';
      if (val === '10' || val === 'lt3') return 'LT3';
      if (val === '5' || val === 'ht4') return 'HT4';
      if (val === '3' || val === 'lt4') return 'LT4';
      if (val === '2' || val === 'ht5') return 'HT5';
      if (val === '1' || val === 'lt5') return 'LT5';
      // Retired tiers
      if (val === '54' || val === 'rht1') return 'RHT1';
      if (val === '43' || val === 'rlt1') return 'RLT1';
      if (val === '29' || val === 'rht2') return 'RHT2';
      if (val === '22' || val === 'rlt2') return 'RLT2';
      return val.toUpperCase();
    }

    let _showRetired = false;

    function renderKitTable(slug, players) {
      const tabulka = document.getElementById(slug + '-tabulka');
      if (!tabulka) return;
      tabulka.innerHTML = '';

      // Retired toggle button
      const hasRetired = players.some(p => ['RHT1','RLT1','RHT2','RLT2'].includes(p.tier));
      if (hasRetired) {
        const toggleWrap = document.createElement('div');
        toggleWrap.className = 'retired-toggle-wrap';
        const btn = document.createElement('button');
        btn.className = 'retired-toggle-btn' + (_showRetired ? ' active' : '');
        btn.innerHTML = _showRetired
          ? '<span class="retired-toggle-icon">R</span> Skrýt retired'
          : '<span class="retired-toggle-icon">R</span> Zobrazit retired';
        btn.addEventListener('click', function() {
          _showRetired = !_showRetired;
          renderKitTable(slug, players);
        });
        toggleWrap.appendChild(btn);
        tabulka.appendChild(toggleWrap);
      }

      const columns = document.createElement('div');
      columns.className = 'kit-columns';
      columns.style.justifyContent = 'flex-start';
      const tiers = [
        { name: 'Tier 1', color: 'var(--accent, #eecd14)', icon: '🥇', ht: 'HT1', lt: 'LT1', rht: 'RHT1', rlt: 'RLT1' },
        { name: 'Tier 2', color: '#c0c0c0', icon: '🥈', ht: 'HT2', lt: 'LT2', rht: 'RHT2', rlt: 'RLT2' },
        { name: 'Tier 3', color: '#cd7f32', icon: '🥉', ht: 'HT3', lt: 'LT3', rht: null, rlt: null },
        { name: 'Tier 4', color: '#23242a', icon: '', ht: 'HT4', lt: 'LT4', rht: null, rlt: null },
        { name: 'Tier 5', color: '#23242a', icon: '', ht: 'HT5', lt: 'LT5', rht: null, rlt: null }
      ];
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
        // HT players
        players.filter(p => p.tier === tierObj.ht).forEach(player => {
          list.appendChild(createPlayerDiv(player, false, false));
        });
        // RHT players (retired HT, shown between HT and LT)
        if (_showRetired && tierObj.rht) {
          players.filter(p => p.tier === tierObj.rht).forEach(player => {
            list.appendChild(createPlayerDiv(player, false, true));
          });
        }
        // LT players
        players.filter(p => p.tier === tierObj.lt).forEach(player => {
          list.appendChild(createPlayerDiv(player, true, false));
        });
        // RLT players (retired LT, shown after LT)
        if (_showRetired && tierObj.rlt) {
          players.filter(p => p.tier === tierObj.rlt).forEach(player => {
            list.appendChild(createPlayerDiv(player, false, true));
          });
        }
        col.appendChild(list);
        columns.appendChild(col);
      }
      tabulka.appendChild(columns);
      // Update player count badge (exclude retired from count)
      var testedCount = players.filter(function(p) { return p.tier !== '' && !['RHT1','RLT1','RHT2','RLT2'].includes(p.tier); }).length;
      if (typeof updatePlayerCount === 'function') updatePlayerCount(testedCount);
      if (typeof initAutocomplete === 'function') {
        initAutocomplete(players);
      }
    }

    function createPlayerDiv(player, isLt, isRetired) {
      const div = document.createElement('div');
      div.className = 'kit-player' + (isLt ? ' kit-player-lt' : '') + (isRetired ? ' kit-player-retired' : '');
      div.innerHTML = `<img src='https://mc-heads.net/avatar/${player.uuid}/32' alt='skin' loading='lazy'><span>${player.nick}</span>`;
      if (isRetired) {
        const badge = document.createElement('span');
        badge.className = 'retired-badge';
        badge.textContent = 'R';
        div.appendChild(badge);
      }
      div.style.cursor = 'pointer';
      div.onclick = () => {
        if (typeof showFullPlayerModal === 'function') {
          showFullPlayerModal(player.nick, player.discordId);
        } else if (typeof showKitPlayerModal === 'function') {
          showKitPlayerModal(player);
        }
      };
      return div;
    }
  });
}
