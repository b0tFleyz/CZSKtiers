document.addEventListener('DOMContentLoaded', function () {
	let players = [];
	fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vTsYd1Hv8XjsdskgT2O-_Otwe3DKxXTXECPE0s4JcPwPPnLMMpknU_-y8EHNBZTtVEQgzicFKcgluSU/pub?output=xlsx')
		.then(res => res.arrayBuffer())
		.then(data => {
			const workbook = XLSX.read(data, { type: 'array' });
			const worksheet = workbook.Sheets[workbook.SheetNames[0]];
			const rows = XLSX.utils.sheet_to_json(worksheet);
			players = rows.filter(row => row.UUID && row.Nick).map(row => ({
				uuid: row.UUID,
				nick: row.Nick,
				mace: normalizeTier(row.Mace)
			}));
			renderMaceTable(players);
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
		return val.toUpperCase();
	}
	function renderMaceTable(players) {
		const tabulka = document.getElementById('mace-tabulka');
		if (!tabulka) return;
		tabulka.innerHTML = '';
		const columns = document.createElement('div');
		columns.className = 'kit-columns';
		columns.style.justifyContent = 'flex-start';
		const tiers = [
			{ name: 'Tier 1', color: '#eecd14', icon: '🥇', ht: 'HT1', lt: 'LT1' },
			{ name: 'Tier 2', color: '#c0c0c0', icon: '🥈', ht: 'HT2', lt: 'LT2' },
			{ name: 'Tier 3', color: '#cd7f32', icon: '🥉', ht: 'HT3', lt: 'LT3' },
			{ name: 'Tier 4', color: '#23242a', icon: '', ht: 'HT4', lt: 'LT4' },
			{ name: 'Tier 5', color: '#23242a', icon: '', ht: 'HT5', lt: 'LT5' }
		];
		for (const tierObj of tiers) {
			const col = document.createElement('div');
			col.className = 'kit-tier-col';
			col.setAttribute('data-tier', tierObj.name);
			const header = document.createElement('div');
			header.className = 'kit-tier-header';
			header.style.background = tierObj.color;
			header.style.color = '#fff';
			header.innerHTML = tierObj.icon ? `<span style=\"font-size:1.3em;vertical-align:middle;\">${tierObj.icon}</span> ${tierObj.name}` : tierObj.name;
			col.appendChild(header);
			const list = document.createElement('div');
			list.className = 'kit-tier-list';
			// Nejprve HT hráči
			players.filter(p => p.mace === tierObj.ht).forEach(player => {
				const div = document.createElement('div');
				div.className = 'kit-player';
				div.innerHTML = `<img src='https://mc-heads.net/avatar/${player.uuid}/32' alt='skin' style='width:32px;height:32px;border-radius:8px;margin-right:8px;vertical-align:middle;' loading='lazy'><span>${player.nick}</span>`;
				div.style.cursor = 'pointer';
				div.onclick = () => {
					if (typeof showFullPlayerModal === 'function') {
						showFullPlayerModal(player.nick);
					} else if (typeof showKitPlayerModal === 'function') {
						showKitPlayerModal(player);
					}
				};
				list.appendChild(div);
			});
			// Poté LT hráči
			players.filter(p => p.mace === tierObj.lt).forEach(player => {
				const div = document.createElement('div');
				div.className = 'kit-player kit-player-lt';
				div.innerHTML = `<img src='https://mc-heads.net/avatar/${player.uuid}/32' alt='skin' style='width:32px;height:32px;border-radius:8px;margin-right:8px;vertical-align:middle;' loading='lazy'><span>${player.nick}</span>`;
				div.style.cursor = 'pointer';
				div.onclick = () => {
					if (typeof showFullPlayerModal === 'function') {
						showFullPlayerModal(player.nick);
					} else if (typeof showKitPlayerModal === 'function') {
						showKitPlayerModal(player);
					}
				};
				list.appendChild(div);
			});
			col.appendChild(list);
			columns.appendChild(col);
		}
		tabulka.appendChild(columns);
		
		// Inicializuj autocomplete
		if (typeof initAutocomplete === 'function') {
			initAutocomplete(players);
		}
	}
});
