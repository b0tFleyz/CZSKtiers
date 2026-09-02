// Shared tier utility constants and functions — used by script.js, autocomplete.js

// =====================================================================
//  PEAK TIER Z HISTORIE  (dočasné řešení, než se přejde na databázi)
// =====================================================================
//  Hráč, který si tier odsloužil, má za něj body i po demotu — skóre je
//  max(aktuální tier, peak). Peak se zatím odvozuje z listu TierHistory.
//
//  POZOR na past: dřív se konec držení tieru hledal jen podle záznamu,
//  kde oldTier === tier. Když takový záznam chyběl (a v datech často
//  chybí), skript usoudil, že hráč tier drží DODNES — a potvrdil peak,
//  který nikdy nenastal. Hráči pak skákali v žebříčku nahoru.
//
//  computePeakTierText() proto bere i AKTUÁLNÍ tier hráče a používá
//  konzervativnější pravidlo (viz komentáře uvnitř funkce).
//
//  Až se web přepne na snapshot (DEFAULT_USE_SNAPSHOT v js/data-source.js),
//  peak počítá bot ze svých hodin a tenhle odhad zmizí.
var USE_DERIVED_PEAK = true;
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

// Nejvyšší peak tier, který hráč podle historie skutečně odsloužil.
//
// history:      [{tier, oldTier, date}] pro JEDEN kit
// currentTier:  aktuální tier hráče v tom kitu ("HT2", "LT3", …) — nepovinné,
//               ale bez něj se nedá poznat, jestli tier pořád drží
// asOfTs:       nepovinné — počítej peak "k tomuhle datu" (stroj času, rank history).
//               V tomhle režimu je konec nedokončeného úseku právě asOfTs; do té
//               doby totiž žádná změna zaznamenaná není, což je platný důkaz držení.
function computePeakTierText(history, currentTier, asOfTs) {
    if (!history || history.length === 0) return null;
    const PEAK_REQUIRED_DAYS = { 'HT3': 30, 'LT2': 60, 'HT2': 60, 'LT1': 90, 'HT1': 90 };

    const sorted = history
        .map(e => ({ ...e, ts: parseCzechDate(e.date) }))
        .filter(e => e.ts)
        .sort((a, b) => a.ts - b.ts);
    if (!sorted.length) return null;

    const lastKnown = sorted[sorted.length - 1].ts;
    const historical = (typeof asOfTs === 'number' && isFinite(asOfTs));
    const nowTs = historical ? asOfTs : Date.now();
    const cur = String(currentTier || '').trim().replace(/^R/, '');

    let bestOrder = 999, best = null;

    for (let i = 0; i < sorted.length; i++) {
        const tier = String(sorted[i].tier || '').trim();
        if (!tier || tier.startsWith('R')) continue;
        if (!PEAK_REQUIRED_DAYS[tier]) continue;
        if (String(sorted[i].oldTier || '').trim() === tier) continue;  // beze změny

        const startDate = sorted[i].ts;

        // Konec držení = první POZDĚJŠÍ záznam, který ukazuje JINÝ tier.
        // (Dřív se hledal jen záznam s oldTier === tier; ten ale často chybí.)
        let endDate = null;
        for (let j = i + 1; j < sorted.length; j++) {
            const nextTier = String(sorted[j].tier || '').trim();
            const nextOld  = String(sorted[j].oldTier || '').trim();
            if (nextOld === tier || (nextTier && nextTier !== tier)) { endDate = sorted[j].ts; break; }
        }

        if (endDate === null) {
            // Žádný pozdější záznam o změně. Dvě možnosti:
            if (cur === tier || historical) {
                // Drží ho dodnes, nebo se ptáme na konkrétní datum a do něj
                // žádná změna nepřišla — obojí je doložené držení.
                endDate = nowTs;
            } else if (cur) {
                // Hráč je dnes JINDE, ale odchod není zaznamenaný. Nevíme kdy
                // odešel, takže nejzazší doložený okamžik je poslední záznam
                // v historii — dál si nic vymýšlet nebudeme.
                endDate = lastKnown;
            } else {
                // Aktuální tier neznáme; bez něj by "dodnes" byla čirá domněnka.
                endDate = lastKnown;
            }
        }

        const heldDays = (endDate - startDate) / (24 * 60 * 60 * 1000);
        if (heldDays >= PEAK_REQUIRED_DAYS[tier]) {
            const val = resolveTierValue(tier);
            if (val) {
                const order = getTierOrder(val);
                if (order < bestOrder) { bestOrder = order; best = tier; }
            }
        }
    }
    return best;
}
