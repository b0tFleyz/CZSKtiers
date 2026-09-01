// Shared tier utility constants and functions — used by script.js, autocomplete.js
const TIER_ORDER = ["60","48","32","24","16","10","5","3","2","1","54","43","29","22"];
// Skóre "retired" varianty tieru. HT3 tu dřív mělo 14 — hodnotu, která v TIER_ORDER
// vůbec není, takže getTierOrder('14') vracelo 999 a HT3 peak padal na konec seřazení.
// Retire z HT3 stejně není možný (bot: RETIREABLE_TIERS), takže tu HT3 nemá co dělat.
const PEAK_TIER_SCORE = { 'LT2': 22, 'HT2': 29, 'LT1': 43, 'HT1': 54 };

function getTierOrder(tier) {
    const idx = TIER_ORDER.indexOf(String(tier));
    return idx === -1 ? 999 : idx;
}

// Přijímá "D. M. YYYY" (formát z tabulky) i rovnou ms timestamp, který posílá
// snapshot z bota — díky tomu obě cesty načítání dat fungují bez rozlišování.
function parseCzechDate(str) {
    if (str == null || str === '') return null;
    if (typeof str === 'number') return Number.isFinite(str) ? str : null;
    if (typeof str !== 'string') return null;
    const m = str.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
    if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])).getTime();
    const n = Number(str);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveTierValue(tier) {
    tier = String(tier).trim();
    const upper = tier.toUpperCase();
    if (upper.includes('EVAL')) return '10';
    const validNums = ['1','2','3','5','10','16','24','32','48','60','22','29','43','54'];
    if (validNums.includes(tier)) return tier;
    const textMap = {
        'HT1':'60','LT1':'48','HT2':'32','LT2':'24','HT3':'16',
        'LT3':'10','HT4':'5','LT4':'3','HT5':'2','LT5':'1',
        'RHT1':'54','RLT1':'43','RHT2':'29','RLT2':'22'
    };
    return textMap[upper] || null;
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
        case "5":  return "HT4";
        case "3":  return "LT4";
        case "2":  return "HT5";
        case "1":  return "LT5";
        case "24": return "LT2";
        case "48": return "LT1";
        case "60": return "HT1";
        default: return "-";
    }
}

function tierInfo(hodnota) {
    let novyText = hodnota;
    let barvaTextu = "#23242a";
    let barvaPozadi = "#EEE0CB";
    switch (hodnota) {
        case "32": novyText = "HT2"; barvaPozadi = "#A4B3C7"; break;
        case "16": novyText = "HT3"; barvaPozadi = "#8F5931"; break;
        case "10": novyText = "LT3"; barvaPozadi = "#B56326"; break;
        case "5":  novyText = "HT4"; barvaPozadi = "#655B79"; break;
        case "3":  novyText = "LT4"; barvaPozadi = "#655B79"; break;
        case "2":  novyText = "HT5"; barvaPozadi = "#655B79"; break;
        case "1":  novyText = "LT5"; barvaPozadi = "#655B79"; break;
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

function getScoreTitle(score) {
    if (score >= 300) return { title: 'Legenda', color: '#FFCF4A' };
    if (score >= 200) return { title: 'Elita', color: '#A4B3C7' };
    if (score >= 100) return { title: 'Šampion', color: '#8F5931' };
    if (score >= 50)  return { title: 'Bojovník', color: '#6366f1' };
    return { title: 'Nováček', color: '#655B79' };
}

// Nejvyšší POTVRZENÝ peak tier z historie.
//
// POZOR: tohle je jen ODHAD pro zobrazení na webu. Autoritativní zdroj je bot —
// ten drží běžící hodiny (peakTierPending / peakTierPendingDate) i kredity za výhry
// nad stejným tierem (-10 dní za výhru, LT2/HT2 max 3×, LT1/HT1 max 2×), o kterých
// tabulka TierHistory nic neví. Web proto počítá jen holé dny a bez kreditů —
// výsledek může být PŘÍSNĚJŠÍ než to, co hráči ukáže /retire.
//
// Až bot začne peak publikovat do vlastního sloupce, tahle funkce se má smazat
// a číst se má rovnou ta hodnota.
//
// history: [{tier, oldTier, date}] — pořadí nezáleží, řadí se tu.
function computePeakTierText(history) {
    if (!history || history.length === 0) return null;
    // Stejné hodnoty jako PEAK_REQUIRED_DAYS_MAP v botovi.
    const PEAK_REQUIRED_DAYS = { 'HT3': 30, 'LT2': 60, 'HT2': 60, 'LT1': 90, 'HT1': 90 };
    const sorted = history
        .map(e => ({ ...e, ts: parseCzechDate(e.date) }))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
    let confirmedBestOrder = 999;
    let confirmedBestTier = null;
    for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        const tier = String(entry.tier || '').trim();
        if (!tier || tier.startsWith('R')) continue;
        if (!PEAK_REQUIRED_DAYS[tier]) continue;
        const oldTier = String(entry.oldTier || '').trim();
        if (oldTier === tier) continue;
        const startDate = entry.ts;
        if (!startDate) continue;
        // Konec úseku = první pozdější záznam, kde hráč z tohoto tieru odešel.
        let endDate = Date.now();
        for (let j = i + 1; j < sorted.length; j++) {
            const next = sorted[j];
            if (String(next.oldTier || '').trim() === tier && next.ts) { endDate = next.ts; break; }
        }
        const heldDays = (endDate - startDate) / (24 * 60 * 60 * 1000);
        if (heldDays >= PEAK_REQUIRED_DAYS[tier]) {
            const tierVal = resolveTierValue(tier);
            if (tierVal) {
                const order = getTierOrder(tierVal);
                if (order < confirmedBestOrder) { confirmedBestOrder = order; confirmedBestTier = tier; }
            }
        }
    }
    return confirmedBestTier;
}
