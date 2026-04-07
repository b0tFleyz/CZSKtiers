let allPlayers = [];

const TIER_ORDER = [
    "60", "48", "32", "24", "16", "10", "5", "3", "2", "1",
    "54", "43", "29", "22"
];

function getTierOrder(tier) {
    const idx = TIER_ORDER.indexOf(String(tier));
    return idx === -1 ? 999 : idx;
}

let tierHistory = {};

const PEAK_TIER_SCORE = {
    'HT3': 14, 'LT2': 22, 'HT2': 29, 'LT1': 43, 'HT1': 54
};

function resolveTierValue(tier) {
    tier = String(tier).trim();
    // Handle "LT3 + Evaluation", "LT3 + Eval", "Evaluation" etc.
    const upper = tier.toUpperCase();
    if (upper.includes('EVAL')) {
        return '10'; // LT3
    }
    const validNums = ['1','2','3','5','10','16','24','32','48','60','22','29','43','54'];
    if (validNums.includes(tier)) return tier;
    const textMap = {
        'HT1':'60','LT1':'48','HT2':'32','LT2':'24','HT3':'16',
        'LT3':'10','HT4':'5','LT4':'3','HT5':'2','LT5':'1',
        'RHT1':'54','RLT1':'43','RHT2':'29','RLT2':'22'
    };
    return textMap[upper] || null;
}

// Parses Czech locale date string "D. M. YYYY" or "D.M.YYYY" into a timestamp
function parseCzechDate(str) {
    if (!str) return null;
    const m = str.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
    if (!m) return null;
    return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])).getTime();
}

// Returns the highest peak tier confirmed by holding it long enough:
// HT3 = 30 days, LT2/HT2 = 60 days, LT1/HT1 = 90 days
function getPeakTierTextFromHistory(discordId, kitIcon) {
    const history = (tierHistory[discordId] || {})[kitIcon] || [];
    if (history.length === 0) return null;
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
        if (heldDays >= PEAK_REQUIRED_DAYS[tier]) {
            const tierVal = resolveTierValue(tier);
            if (tierVal) {
                const order = getTierOrder(tierVal);
                if (order < confirmedBestOrder) {
                    confirmedBestOrder = order;
                    confirmedBestTier = tier;
                }
            }
        }
    }
    return confirmedBestTier;
}

function processTierHistoryFromSheet(worksheet) {
    const iconMap = {
        'Crystal': 'kit_icons/cpvp.png',
        'Axe': 'kit_icons/axe.png',
        'Sword': 'kit_icons/sword.png',
        'UHC': 'kit_icons/uhc.png',
        'Npot': 'kit_icons/npot.png', 'NPot': 'kit_icons/npot.png',
        'Pot': 'kit_icons/pot.png',
        'SMP': 'kit_icons/smp.png',
        'DiaSMP': 'kit_icons/diasmp.png',
        'Mace': 'kit_icons/mace.png'
    };
    const rows = XLSX.utils.sheet_to_json(worksheet);
    rows.forEach(row => {
        if (!row.Kit || !row.Tier) return;
        const discordId = row['Discord ID'] ? String(row['Discord ID']).trim() : null;
        if (!discordId) return;
        const kit     = String(row.Kit).trim();
        const tier    = String(row.Tier).trim();
        const oldTier = row.OldTier ? String(row.OldTier).trim() : null;
        const date    = row.Date    ? String(row.Date).trim()    : null;
        const icon    = iconMap[kit] || null;
        if (!icon) return;
        if (!tierHistory[discordId]) tierHistory[discordId] = {};
        if (!tierHistory[discordId][icon]) tierHistory[discordId][icon] = [];
        tierHistory[discordId][icon].push({ tier, kit, oldTier, date });
    });
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

const SUB_KITS = [
    { key: "Speed", icon: "kit_icons/speed.png" },
    { key: "OGV", icon: "kit_icons/OGV.png" },
    { key: "Cart", icon: "kit_icons/cart.png" },
    { key: "Creeper", icon: "kit_icons/creeper.png" },
    { key: "DiaVanilla", icon: "kit_icons/diavanilla.png" }
];

function getScoreTitle(score) {
    if (score >= 300) return { title: 'Legenda', color: '#FFCF4A' };
    if (score >= 200) return { title: 'Elita', color: '#A4B3C7' };
    if (score >= 100) return { title: 'Šampion', color: '#8F5931' };
    if (score >= 50)  return { title: 'Bojovník', color: '#6366f1' };
    return { title: 'Nováček', color: '#655B79' };
}

function getPlayerFirstDate(discordId) {
    if (!discordId || !tierHistory[discordId]) return null;
    let earliest = Infinity;
    for (const entries of Object.values(tierHistory[discordId])) {
        for (const e of entries) {
            const ts = parseCzechDate(e.date);
            if (ts && ts < earliest) earliest = ts;
        }
    }
    return earliest === Infinity ? null : earliest;
}

function computeAchievements({ name, position, score, tiers, discordId, hallOfFame, tester, allTestedIcons }) {
    const achievements = [];
    const validTiers = (tiers || []).filter(t => t.tier && t.tier !== '-');
    const testedKits = validTiers.length;
    const nick = name || '';

    if (nick === 'ownedbyshifty') achievements.push({ label: 'Exekutor', desc: 'První tester', color: '#5adc26' });
    if (nick === 'EBAN92') achievements.push({ label: 'Eban', desc: 'Stvořitel tierlistu', color: '#ff0000' });
    if (nick === 'Fleyz') achievements.push({ label: 'Fleyz', desc: 'Spolumajitel, vytvořil bota a stránky', color: '#eb9525' });

    if (position === 1) achievements.push({ label: '#1', desc: '1. místo v celkovém leaderboardu', color: '#eecd14' });
    else if (position === 2) achievements.push({ label: '#2', desc: '2. místo v celkovém leaderboardu', color: '#c0c0c0' });
    else if (position === 3) achievements.push({ label: '#3', desc: '3. místo v celkovém leaderboardu', color: '#cd7f32' });
    if (position >= 4 && position <= 10) achievements.push({ label: 'Top 10', desc: 'Umístění v top 10 celkového leaderboardu', color: '#6366f1' });

    if (validTiers.some(t => String(t.tier) === '60')) achievements.push({ label: 'Kit Master', desc: 'Dosáhl HT1 v některém kitu', color: '#FFCF4A' });

    const eliteTiers = validTiers.filter(t => ['32','48','60'].includes(String(t.tier)));
    if (eliteTiers.length >= 3) achievements.push({ label: 'Elite', desc: '3 nebo více kitů na HT2 nebo výše', color: '#f97316' });

    if (testedKits >= kits.length && kits.length > 0) achievements.push({ label: 'All-kits', desc: 'Testován ve všech kitech', color: '#34d399' });

    const ALL_KIT_ICONS = [...kits, ...SUB_KITS].map(k => k.icon);
    if (allTestedIcons && ALL_KIT_ICONS.every(icon => allTestedIcons.has(icon))) {
        achievements.push({ label: 'Tierlist GOD', desc: 'Testován ve všech kitech na Tiers i Subtiers', color: '#ef4444' });
    }

    if (score === 1) achievements.push({ label: 'První kroky', desc: 'Získal první bod na tierlistu', color: '#94a3b8' });

    let earliestDate = Infinity;
    let totalTestCount = 0;
    if (discordId && tierHistory[discordId]) {
        for (const entries of Object.values(tierHistory[discordId])) {
            totalTestCount += entries.length;
            for (const e of entries) {
                const ts = parseCzechDate(e.date);
                if (ts && ts < earliestDate) earliestDate = ts;
            }
        }
        const daysSinceFirst = (Date.now() - earliestDate) / (24 * 60 * 60 * 1000);
        const years = daysSinceFirst / 365.25;
        if (years >= 2) achievements.push({ label: '2+ roky', desc: 'Na tierlistu více než 2 roky', color: '#f59e0b' });
        if (daysSinceFirst >= 1000) achievements.push({ label: 'Unc', desc: '1000+ dní na tierlistu', color: '#7c3aed' });
    }

    if (totalTestCount >= 50) achievements.push({ label: '50+ testů', desc: 'Absolvoval 50 nebo více testů', color: '#14b8a6' });
    if (totalTestCount >= 100) achievements.push({ label: '100+ testů', desc: 'Absolvoval 100 nebo více testů', color: '#0ea5e9' });
    if (totalTestCount >= 200) achievements.push({ label: '200+ testů', desc: 'Absolvoval 200 nebo více testů', color: '#8b5cf6' });

    return achievements;
}

// ---- Rank History ----

function _rhEscape(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _rhRankColor(rank) {
    if (rank === 1) return '#FFCF4A';
    if (rank <= 3) return '#D5B355';
    if (rank <= 10) return '#A4B3C7';
    if (rank <= 20) return '#8F5931';
    return '#655B79';
}

function computeRankHistory(targetDiscordId) {
    if (!targetDiscordId) return [];

    var PEAK_REQUIRED_DAYS = { 'HT3': 30, 'LT2': 60, 'HT2': 60, 'LT1': 90, 'HT1': 90 };
    var DAY_MS = 24 * 60 * 60 * 1000;

    // Pre-compute peak tier earned timestamps for every player/kit
    var playerPeakEarned = {}; // discordId -> { kitIcon -> { score, earnedTs } }
    for (var did in tierHistory) {
        playerPeakEarned[did] = {};
        for (var kitIcon in tierHistory[did]) {
            var history = tierHistory[did][kitIcon];
            if (!history.length) continue;
            var sorted = history
                .map(function(e) { return Object.assign({}, e, { ts: parseCzechDate(e.date) }); })
                .sort(function(a, b) { return (a.ts || 0) - (b.ts || 0); });
            var bestOrder = 999, bestScore = 0, bestEarnedTs = 0;
            for (var i = 0; i < sorted.length; i++) {
                var entry = sorted[i];
                var tier = String(entry.tier || '').trim();
                if (!tier || tier.startsWith('R')) continue;
                if (!PEAK_REQUIRED_DAYS[tier]) continue;
                var oldTier = String(entry.oldTier || '').trim();
                if (oldTier === tier) continue;
                var startDate = entry.ts;
                if (!startDate) continue;
                var endDate = Date.now();
                for (var j = i + 1; j < sorted.length; j++) {
                    var next = sorted[j];
                    if (String(next.oldTier || '').trim() === tier && next.ts) {
                        endDate = next.ts;
                        break;
                    }
                }
                var heldDays = (endDate - startDate) / DAY_MS;
                if (heldDays >= PEAK_REQUIRED_DAYS[tier]) {
                    var tierVal = resolveTierValue(tier);
                    if (tierVal) {
                        var order = getTierOrder(tierVal);
                        if (order < bestOrder) {
                            bestOrder = order;
                            bestScore = PEAK_TIER_SCORE[tier] || 0;
                            bestEarnedTs = startDate + PEAK_REQUIRED_DAYS[tier] * DAY_MS;
                        }
                    }
                }
            }
            if (bestScore > 0) {
                playerPeakEarned[did][kitIcon] = { score: bestScore, earnedTs: bestEarnedTs };
            }
        }
    }

    // Compute kit introduction dates from tier history (earliest event per kit)
    var kitIntroDate = {};
    for (var did3 in tierHistory) {
        for (var ki in tierHistory[did3]) {
            tierHistory[did3][ki].forEach(function(entry) {
                var ts = parseCzechDate(entry.date);
                if (ts && (!kitIntroDate[ki] || ts < kitIntroDate[ki])) {
                    kitIntroDate[ki] = ts;
                }
            });
        }
    }

    // Build current kit states for all players
    var playerKitVals = {};
    var playerScores = {};

    allPlayers.forEach(function(p) {
        if (!p.discordId) return;
        playerKitVals[p.discordId] = {};
        p.tiers.forEach(function(t) {
            playerKitVals[p.discordId][t.icon] = parseInt(t.tier) || 0;
        });
    });

    // Include players from tierHistory not in allPlayers (blacklisted/removed)
    for (var did2 in tierHistory) {
        if (!playerKitVals[did2]) {
            playerKitVals[did2] = {};
            for (var ki2 in tierHistory[did2]) {
                var entries = tierHistory[did2][ki2];
                if (!entries.length) continue;
                var latestTs = 0, latestTier = null;
                entries.forEach(function(e) {
                    var ts = parseCzechDate(e.date);
                    if (ts && ts > latestTs) { latestTs = ts; latestTier = e.tier; }
                });
                if (latestTier) {
                    var val2 = parseInt(resolveTierValue(latestTier)) || 0;
                    playerKitVals[did2][ki2] = val2;
                }
            }
        }
    }

    // Time-aware score: only count kits that existed at atTs, peak bonus only if earned
    function calcScore(discordId, atTs) {
        var s = 0;
        var kits = playerKitVals[discordId] || {};
        var pe = playerPeakEarned[discordId] || {};
        for (var kit in kits) {
            // Skip kits that didn't exist yet at this timestamp
            if (kitIntroDate[kit] && atTs < kitIntroDate[kit]) continue;
            var peakScore = 0;
            if (pe[kit] && atTs >= pe[kit].earnedTs) {
                peakScore = pe[kit].score;
            }
            s += Math.max(kits[kit] || 0, peakScore);
        }
        return s;
    }

    function recalcAllScores(atTs) {
        for (var id in playerKitVals) {
            playerScores[id] = calcScore(id, atTs);
        }
    }

    recalcAllScores(Date.now());

    function getRank() {
        var ts = playerScores[targetDiscordId];
        if (ts === undefined || ts <= 0) return null;
        var rank = 1;
        for (var d in playerScores) {
            if (d !== targetDiscordId && playerScores[d] > ts) rank++;
        }
        return rank;
    }

    // Collect ALL tier events from ALL players
    var allEvts = [];
    for (var dId in tierHistory) {
        for (var kitIcon2 in tierHistory[dId]) {
            tierHistory[dId][kitIcon2].forEach(function(entry) {
                var ts = parseCzechDate(entry.date);
                if (ts) {
                    allEvts.push({
                        discordId: dId, kitIcon: kitIcon2,
                        tier: entry.tier, oldTier: entry.oldTier,
                        date: entry.date, ts: ts
                    });
                }
            });
        }
    }

    // Sort newest-first (walk backward)
    allEvts.sort(function(a, b) { return b.ts - a.ts; });

    var rawHistory = [];
    var currentRank = getRank();
    if (currentRank !== null) {
        rawHistory.push({ ts: Date.now(), date: new Date().toLocaleDateString('cs-CZ'), rank: currentRank });
    }

    // Walk backward
    for (var i2 = 0; i2 < allEvts.length; i2++) {
        var evt = allEvts[i2];
        if (!playerKitVals[evt.discordId]) continue;
        var oldVal = evt.oldTier ? (parseInt(resolveTierValue(evt.oldTier)) || 0) : 0;
        playerKitVals[evt.discordId][evt.kitIcon] = oldVal;
        recalcAllScores(evt.ts);
        var rank = getRank();
        if (rank !== null) {
            rawHistory.push({ ts: evt.ts, date: evt.date, rank: rank });
        }
    }

    rawHistory.reverse(); // chronological

    // Consolidate by date (keep last entry per date)
    var byDate = {};
    var dateOrder = [];
    rawHistory.forEach(function(h) {
        if (!byDate[h.date]) dateOrder.push(h.date);
        byDate[h.date] = h;
    });
    var historyResult = dateOrder.map(function(d) { return byDate[d]; });

    // Remove consecutive duplicates (keep endpoints and rank-changes)
    if (historyResult.length > 2) {
        var filtered = [historyResult[0]];
        for (var j2 = 1; j2 < historyResult.length - 1; j2++) {
            if (historyResult[j2].rank !== historyResult[j2-1].rank || historyResult[j2].rank !== historyResult[j2+1].rank) {
                filtered.push(historyResult[j2]);
            }
        }
        filtered.push(historyResult[historyResult.length - 1]);
        historyResult = filtered;
    }

    return { history: historyResult, kitIntroDate: kitIntroDate };
}

function renderRankHistoryChart(container, history, kitIntroDate) {
    container.innerHTML = '';

    // Scrollable wider chart — min 80px per data point, min 700
    var PL = 56, PR = 24, PT = 50, PB = 44;
    var BASE_SVG_W = Math.max(700, history.length * 80) + PL + PR;
    var SVG_H = 360;
    var BASE_PLOT_W = BASE_SVG_W - PL - PR;
    var PLOT_H = SVG_H - PT - PB;

    var ranks = history.map(function(h) { return h.rank; });
    var dataMinRank = Math.min.apply(null, ranks);
    var dataMaxRank = Math.max.apply(null, ranks);

    // Zoom state — controls Y-axis range
    var yPadding = 1;
    var ZOOM_MIN_PAD = 0, ZOOM_MAX_PAD = Math.max(5, Math.floor((dataMaxRank - dataMinRank) * 2));

    // Kit intro annotation lines — only kits from the active guild
    var KIT_ICON_NAMES = {};
    kits.forEach(function(k) { KIT_ICON_NAMES[k.icon] = k.key; });

    var firstTs = history[0].ts;
    var lastTs = history[history.length - 1].ts;

    function buildSvg() {
        var SVG_W = BASE_SVG_W;
        var PLOT_W = BASE_PLOT_W;
        var yMin = Math.max(1, dataMinRank - yPadding);
        var yMax = dataMaxRank + yPadding;

        function yFor(rank) {
            if (yMin === yMax) return PT + PLOT_H / 2;
            return PT + ((rank - yMin) / (yMax - yMin)) * PLOT_H;
        }
        function xFor(i) {
            return history.length === 1 ? PL + PLOT_W / 2 : PL + (i / (history.length - 1)) * PLOT_W;
        }
        function xForTs(ts) {
            if (lastTs === firstTs) return PL + PLOT_W / 2;
            var bestIdx = 0, bestDist = Infinity;
            for (var k = 0; k < history.length; k++) {
                var d = Math.abs(history[k].ts - ts);
                if (d < bestDist) { bestDist = d; bestIdx = k; }
            }
            return xFor(bestIdx);
        }

        var svg = '';

        // Kit intro annotation lines
        if (kitIntroDate) {
            var dateGroups = {};
            for (var icon in kitIntroDate) {
                if (!KIT_ICON_NAMES[icon]) continue;
                var ts2 = kitIntroDate[icon];
                if (ts2 >= firstTs && ts2 <= lastTs) {
                    var key = ts2.toString();
                    if (!dateGroups[key]) dateGroups[key] = { ts: ts2, names: [] };
                    dateGroups[key].names.push(KIT_ICON_NAMES[icon]);
                }
            }
            for (var gk in dateGroups) {
                var g = dateGroups[gk];
                var gx = xForTs(g.ts);
                svg += '<line x1="' + gx.toFixed(1) + '" y1="' + PT + '" x2="' + gx.toFixed(1) + '" y2="' + (PT + PLOT_H) + '" stroke="rgba(238,205,20,0.18)" stroke-width="1" stroke-dasharray="5,4"/>';
                var label = '+' + g.names.join(', ');
                var dateStr = new Date(g.ts).toLocaleDateString('cs-CZ');
                svg += '<text x="' + gx.toFixed(1) + '" y="' + (PT - 16) + '" text-anchor="middle" font-family="Poppins,sans-serif" font-size="9" font-weight="600" fill="rgba(238,205,20,0.55)">' + _rhEscape(label) + '</text>';
                svg += '<text x="' + gx.toFixed(1) + '" y="' + (PT - 5) + '" text-anchor="middle" font-family="Poppins,sans-serif" font-size="7.5" fill="rgba(238,205,20,0.35)">' + _rhEscape(dateStr) + '</text>';
            }
        }

        // Y-axis labels
        var range = yMax - yMin;
        var step = 1;
        if (range > 40) step = 10;
        else if (range > 20) step = 5;
        else if (range > 10) step = 2;

        for (var r = yMin; r <= yMax; r += step) {
            var yy = yFor(r);
            svg += '<line x1="' + PL + '" y1="' + yy + '" x2="' + (PL + PLOT_W) + '" y2="' + yy + '" stroke="rgba(255,255,255,0.055)" stroke-width="1"/>';
            svg += '<text x="' + (PL - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-family="Poppins,sans-serif" font-size="11" font-weight="700" fill="' + _rhRankColor(r) + '">#' + r + '</text>';
        }

        // X-axis date labels
        var maxLabels = Math.max(12, Math.floor(PLOT_W / 70));
        var labelStep = Math.max(1, Math.ceil(history.length / maxLabels));
        history.forEach(function(h, i) {
            if (i % labelStep === 0 || i === history.length - 1) {
                var x = xFor(i);
                svg += '<text x="' + x + '" y="' + (SVG_H - 6) + '" text-anchor="middle" font-family="Poppins,sans-serif" font-size="9.5" fill="rgba(255,255,255,0.38)">' + _rhEscape(h.date) + '</text>';
            }
        });

        // Connecting path
        if (history.length > 1) {
            var d = '';
            history.forEach(function(h, i) {
                var x = xFor(i), y = yFor(h.rank);
                d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
            });
            svg += '<path d="' + d + '" fill="none" stroke="rgba(238,205,20,0.3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
        }

        // Data points
        history.forEach(function(h, i) {
            var x = xFor(i), y = yFor(h.rank);
            var col = _rhRankColor(h.rank);
            var isLast = (i === history.length - 1);
            if (isLast) {
                svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="15" fill="' + col + '" opacity="0.13"/>';
            }
            svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="9" fill="' + col + '" stroke="' + col + '" stroke-width="2.5"/>';
            svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="' + col + '" opacity="' + (isLast ? '1' : '0.65') + '"/>';
            svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="17" fill="transparent" class="rh-hit" data-i="' + i + '" style="cursor:pointer"/>';
        });

        return { svg: svg, SVG_W: SVG_W };
    }

    var initResult = buildSvg();

    var svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('viewBox', '0 0 ' + initResult.SVG_W + ' ' + SVG_H);
    svgEl.setAttribute('width', initResult.SVG_W + 'px');
    svgEl.style.display = 'block';
    svgEl.style.overflow = 'visible';
    svgEl.style.minWidth = initResult.SVG_W + 'px';
    svgEl.innerHTML = initResult.svg;
    container.appendChild(svgEl);

    // Scroll to rightmost (current) position
    requestAnimationFrame(function() { container.scrollLeft = container.scrollWidth; });

    // Mouse wheel → horizontal scroll
    container.addEventListener('wheel', function(e) {
        e.preventDefault();
        container.scrollLeft += e.deltaY * 2;
    }, { passive: false });

    // Zoom controls (Y-axis range)
    var contentEl = container.closest('.rank-history-content');
    var zoomWrap = contentEl ? contentEl.querySelector('.rh-zoom-controls') : null;
    if (!zoomWrap && contentEl) {
        zoomWrap = document.createElement('div');
        zoomWrap.className = 'rh-zoom-controls';
        zoomWrap.innerHTML =
            '<button class="rh-zoom-btn rh-zoom-out" title="Oddálit (zobrazit více pozic)">−</button>' +
            '<span class="rh-zoom-label">Zoom</span>' +
            '<button class="rh-zoom-btn rh-zoom-in" title="Přiblížit (méně pozic, větší detail)">+</button>';
        contentEl.querySelector('.rank-history-header').after(zoomWrap);
    }

    function redraw() {
        var result = buildSvg();
        svgEl.setAttribute('viewBox', '0 0 ' + result.SVG_W + ' ' + SVG_H);
        svgEl.setAttribute('width', result.SVG_W + 'px');
        svgEl.style.minWidth = result.SVG_W + 'px';
        svgEl.innerHTML = result.svg;
        bindTooltip();
    }

    if (zoomWrap) {
        zoomWrap.querySelector('.rh-zoom-in').onclick = function() {
            if (yPadding > ZOOM_MIN_PAD) { yPadding = Math.max(ZOOM_MIN_PAD, yPadding - 1); redraw(); }
        };
        zoomWrap.querySelector('.rh-zoom-out').onclick = function() {
            if (yPadding < ZOOM_MAX_PAD) { yPadding = Math.min(ZOOM_MAX_PAD, yPadding + 2); redraw(); }
        };
    }

    // Tooltip — placed on body with position:fixed to avoid overflow clipping
    var tip = document.createElement('div');
    tip.className = 'rank-history-tooltip';
    tip.style.cssText = 'display:none;position:fixed;';
    document.body.appendChild(tip);

    var removeTip = function() { if (tip.parentNode) tip.parentNode.removeChild(tip); };
    var modal = document.getElementById('rank-history-modal');
    if (modal) {
        var obs = new MutationObserver(function() {
            if (modal.style.display === 'none') { removeTip(); obs.disconnect(); }
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['style'] });
    }

    function bindTooltip() {
        svgEl.querySelectorAll('.rh-hit').forEach(function(circle) {
            circle.addEventListener('mouseenter', function() {
                var idx = parseInt(this.getAttribute('data-i'));
                var h = history[idx];
                var col = _rhRankColor(h.rank);
                var isLast = (idx === history.length - 1);
                tip.innerHTML =
                    '<div class="rank-history-tooltip-rank" style="color:' + col + '">#' + h.rank + '</div>' +
                    '<div class="rank-history-tooltip-date">' + _rhEscape(h.date) + '</div>' +
                    (isLast ? '<div class="rank-history-tooltip-current">Aktuální pozice</div>' : '');
                tip.style.display = 'block';
                var circleRect = this.getBoundingClientRect();
                tip.style.left = (circleRect.left + circleRect.width / 2 - tip.offsetWidth / 2) + 'px';
                tip.style.top = (circleRect.top - tip.offsetHeight - 10) + 'px';
            });
            circle.addEventListener('mouseleave', function() { tip.style.display = 'none'; });
        });
    }
    bindTooltip();
}

function showRankHistory(playerNick, discordId) {
    var modal = document.getElementById('rank-history-modal');
    if (!modal) return;

    modal.querySelector('.rank-history-title').textContent = 'Rank History';
    modal.querySelector('.rank-history-player').textContent = playerNick;
    var wrapper = modal.querySelector('.rank-history-timeline-wrapper');

    // Show loading state
    wrapper.innerHTML = '<div class="rank-history-loading"><div class="rh-spinner"></div><div class="rh-loading-text">Počítám historii...</div></div>';
    modal.style.display = 'flex';

    // Defer computation so the loading UI renders first
    requestAnimationFrame(function() {
        setTimeout(function() {
            var result = computeRankHistory(discordId);
            var history = result.history;
            var kitIntroDate = result.kitIntroDate;

            if (history.length < 2) {
                wrapper.innerHTML = '<div class="rank-history-no-data">Nedostatek dat pro zobrazení historie umístění.</div>';
            } else {
                renderRankHistoryChart(wrapper, history, kitIntroDate);
            }
        }, 20);
    });

    // Close handlers
    var closeBtn = modal.querySelector('.rank-history-close');
    if (closeBtn) closeBtn.onclick = function() { modal.style.display = 'none'; };
    modal.onclick = function(e) { if (e.target === modal) modal.style.display = 'none'; };
}

// Close rank history on Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        var rm = document.getElementById('rank-history-modal');
        if (rm && rm.style.display === 'flex') rm.style.display = 'none';
    }
});

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

            // Process TierHistory sheet for peak tier data
            tierHistory = {};
            const histSheetName = workbook.SheetNames.find(n => n === 'TierHistory');
            if (histSheetName) {
                processTierHistoryFromSheet(workbook.Sheets[histSheetName]);
            }

            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet);
            
            players = rows.map(row => {
                const discordId = row['Discord ID'] ? String(row['Discord ID']).trim() : '';
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
                    if (!isNaN(val)) {
                        const peakText = discordId ? getPeakTierTextFromHistory(discordId, t.icon) : null;
                        const peakScore = peakText ? (PEAK_TIER_SCORE[peakText] || 0) : 0;
                        overallScore += Math.max(val, peakScore);
                        t.peakTierText = (peakScore > val) ? peakText : null;
                    }
                });
                return {
                    uuid: row.UUID,
                    nick: row.Nick,
                    discordId,
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

        // Retired toggle button (only for kit pages, not overall)
        if (kitKey !== 'overall') {
            const toggleWrap = document.createElement('div');
            toggleWrap.className = 'retired-toggle-wrap';
            toggleWrap.innerHTML = '<button class="retired-toggle-btn" id="retired-toggle-btn"><span class="retired-toggle-icon">R</span> Zobrazit retired</button>';
            tabulka.appendChild(toggleWrap);
        }

        // Columns
        const columns = document.createElement('div');
        columns.className = 'kit-columns';
        
        // Retired tier values
        const RETIRED_VALUES = new Set(['22', '29', '43', '54']);

        // Mapování tier hodnot na tier názvy a barvy
        const tierGroups = [
            { name: 'Tier 1', color: '#eecd14', icon: '🥇', values: ['60', '54', '48', '43'] }, // HT1, RHT1, LT1, RLT1
            { name: 'Tier 2', color: '#c0c0c0', icon: '🥈', values: ['32', '29', '24', '22'] }, // HT2, RHT2, LT2, RLT2
            { name: 'Tier 3', color: '#cd7f32', icon: '🥉', values: ['16', '10'] }, // HT3, LT3
            { name: 'Tier 4', color: '#23242a', icon: '', values: ['5', '3'] }, // HT4, LT4
            { name: 'Tier 5', color: '#23242a', icon: '', values: ['2', '1'] } // HT5, LT5
        ];
        
        // Track retired state
        let showRetired = false;

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
            // Render players in value order (HT → RHT → LT → RLT)
            for (const val of tierObj.values) {
                const isRetired = RETIRED_VALUES.has(val);
                if (isRetired && !showRetired) continue;
                players.forEach(player => {
                const kitTier = player.tiers?.find(t => t.icon === iconMap[kitKey]);
                if (!kitTier || String(kitTier.tier) !== val) return;
                
                const div = document.createElement('div');
                div.className = 'kit-player' + (isRetired ? ' kit-player-retired' : '');
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
                
                // Add retired badge
                if (isRetired) {
                    const badge = document.createElement('span');
                    badge.className = 'retired-badge';
                    badge.textContent = 'R';
                    div.appendChild(badge);
                }
                
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
                        const ptsDisplay = t.peakTierText ? PEAK_TIER_SCORE[t.peakTierText] : t.tier;
                        const peakExtra = t.peakTierText ? '<br><span style="font-size:0.85em;opacity:0.7;">Peak: ' + t.peakTierText + '</span>' : '';
                        return '<span class="kit-badge tooltip" data-kit-icon="' + t.icon + '" style="--tier-color:' + (origText.startsWith('R') ? info.barvaTextu : info.barvaPozadi) + ';">' +
                            '<span class="kit-icon-circle" style="border-color:' + circleColor + ';">' +
                            '<img src="' + t.icon + '" alt="" class="kit-icon" loading="lazy">' +
                            '</span>' +
                            '<span class="kit-tier-text" style="' + style + '">' +
                            info.novyText +
                            '</span>' +
                            '<span class="tooltiptext">' +
                            '<strong>' + origText + '</strong><br>' +
                            ptsDisplay + ' pts' + peakExtra +
                            '</span>' +
                            '</span>';
                    }).join('');
                    
                    showPlayerModal({
                        name: fullPlayer.nick,
                        nick: fullPlayer.nick,
                        discordId: fullPlayer.discordId || '',
                        position: position,
                        score: fullPlayer.score,
                        skin: 'https://mc-heads.net/avatar/' + escapedNick + '/64',
                        kitsHtml: kitsHtml
                    });
                });
                
                list.appendChild(div);
                });
            }
            col.appendChild(list);
            columns.appendChild(col);
        }
        tabulka.appendChild(columns);
        
        // Retired toggle handler
        if (kitKey !== 'overall') {
            const toggleBtn = document.getElementById('retired-toggle-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', function() {
                    showRetired = !showRetired;
                    toggleBtn.classList.toggle('active', showRetired);
                    toggleBtn.innerHTML = showRetired
                        ? '<span class="retired-toggle-icon">R</span> Skrýt retired'
                        : '<span class="retired-toggle-icon">R</span> Zobrazit retired';
                    // Re-render columns
                    tabulka.querySelector('.kit-columns')?.remove();
                    const newColumns = document.createElement('div');
                    newColumns.className = 'kit-columns';
                    
                    for (const tg of tierGroups) {
                        const col2 = document.createElement('div');
                        col2.className = 'kit-tier-col';
                        col2.setAttribute('data-tier', tg.name);
                        const hdr = document.createElement('div');
                        hdr.className = 'kit-tier-header';
                        hdr.style.background = tg.color;
                        hdr.style.color = '#fff';
                        hdr.innerHTML = tg.icon ? `<span style="font-size:1.3em;vertical-align:middle;">${tg.icon}</span> ${tg.name}` : tg.name;
                        col2.appendChild(hdr);
                        const lst = document.createElement('div');
                        lst.className = 'kit-tier-list';
                        
                        const iconMap2 = {
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
                        for (const val of tg.values) {
                            const isRetVal = RETIRED_VALUES.has(val);
                            if (isRetVal && !showRetired) continue;
                            players.forEach(player => {
                            const kitTier = player.tiers?.find(t => t.icon === iconMap2[kitKey]);
                            if (!kitTier || String(kitTier.tier) !== val) return;
                            const isRet = isRetVal;
                                
                                const div = document.createElement('div');
                                div.className = 'kit-player' + (isRet ? ' kit-player-retired' : '');
                                div.style.cursor = 'pointer';
                                
                                const img = document.createElement('img');
                                const escapedNick = encodeURIComponent(player.nick);
                                img.src = `https://mc-heads.net/avatar/${escapedNick}/32`;
                                img.alt = 'skin';
                                img.style.cssText = 'width:32px;height:32px;border-radius:8px;margin-right:8px;vertical-align:middle;';
                                img.onerror = function() {
                                    this.src = `https://crafatar.com/avatars/${escapedNick}?size=32&default=MHF_Steve&overlay`;
                                };
                                
                                const span = document.createElement('span');
                                span.textContent = player.nick;
                                
                                div.appendChild(img);
                                div.appendChild(span);
                                
                                if (isRet) {
                                    const badge = document.createElement('span');
                                    badge.className = 'retired-badge';
                                    badge.textContent = 'R';
                                    div.appendChild(badge);
                                }
                                
                                div.addEventListener('click', function() {
                                    const fullPlayer = allPlayers.find(p => p.nick === player.nick);
                                    if (!fullPlayer) return;
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
                                        if (p.score !== lastScore) { currentRank = i + 1; }
                                        else { currentRank = lastRank; }
                                        if (p.nick === fullPlayer.nick) { position = currentRank + '.'; break; }
                                        lastScore = p.score;
                                        lastRank = currentRank;
                                    }
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
                                        const ptsDisplay = t.peakTierText ? PEAK_TIER_SCORE[t.peakTierText] : t.tier;
                                        const peakExtra = t.peakTierText ? '<br><span style="font-size:0.85em;opacity:0.7;">Peak: ' + t.peakTierText + '</span>' : '';
                                        return '<span class="kit-badge tooltip" data-kit-icon="' + t.icon + '" style="--tier-color:' + (origText.startsWith('R') ? info.barvaTextu : info.barvaPozadi) + ';">' +
                                            '<span class="kit-icon-circle" style="border-color:' + circleColor + ';">' +
                                            '<img src="' + t.icon + '" alt="" class="kit-icon" loading="lazy">' +
                                            '</span>' +
                                            '<span class="kit-tier-text" style="' + style + '">' +
                                            info.novyText +
                                            '</span>' +
                                            '<span class="tooltiptext">' +
                                            '<strong>' + origText + '</strong><br>' +
                                            ptsDisplay + ' pts' + peakExtra +
                                            '</span>' +
                                            '</span>';
                                    }).join('');
                                    showPlayerModal({
                                        name: fullPlayer.nick,
                                        nick: fullPlayer.nick,
                                        discordId: fullPlayer.discordId || '',
                                        position: position,
                                        score: fullPlayer.score,
                                        skin: 'https://mc-heads.net/avatar/' + escapedNick + '/64',
                                        kitsHtml: kitsHtml
                                    });
                                });
                                
                                lst.appendChild(div);
                            });
                        }
                        col2.appendChild(lst);
                        newColumns.appendChild(col2);
                    }
                    tabulka.appendChild(newColumns);
                });
            }
        }
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
                        const ptsDisplay = t.peakTierText ? PEAK_TIER_SCORE[t.peakTierText] : t.tier;
                        const peakExtra = t.peakTierText ? '<br><span style="font-size:0.85em;opacity:0.7;">Peak: ' + t.peakTierText + '</span>' : '';
                        return '<span class="kit-badge tooltip" data-kit-icon="' + t.icon + '" style="--tier-color:' + (origText.startsWith('R') ? info.barvaTextu : info.barvaPozadi) + ';">' +
                            '<span class="kit-icon-circle" style="border-color:' + circleColor + ';">' +
                            '<img src="' + t.icon + '" alt="" class="kit-icon" loading="lazy">' +
                            '</span>' +
                            '<span class="kit-tier-text" style="' + style + '">' +
                            info.novyText +
                            '</span>' +
                            '<span class="tooltiptext">' +
                            '<strong>' + origText + '</strong><br>' +
                            ptsDisplay + ' pts' + peakExtra +
                            '</span>' +
                            '</span>';
                    }).join('');
                    
                    showPlayerModal({
                        name: player.nick,
                        nick: player.nick,
                        discordId: player.discordId || '',
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
        const scoreTitle = modal.querySelector('.player-modal-score-title');
        const daysEl = modal.querySelector('.player-modal-days');
        const achEl = modal.querySelector('.player-modal-achievements');
        const banner = modal.querySelector('#player-modal-banner');
        const bioEl = modal.querySelector('#player-modal-bio');
        const content = modal.querySelector('.player-modal-content');
        const favkitEl = modal.querySelector('#player-modal-favkit');
        const decoWrap = modal.querySelector('#avatar-deco-wrap');
        const decoOverlay = modal.querySelector('#avatar-deco-overlay');

        // Reset decoration, name effect, theme
        if (decoWrap) decoWrap.removeAttribute('data-deco');
        if (decoOverlay) { decoOverlay.style.display = 'none'; decoOverlay.src = ''; }
        if (name) name.className = 'player-modal-name';
        if (content) { content.className = 'player-modal-content'; content.removeAttribute('data-theme'); }

        // Reset customization defaults
        if (banner) banner.style.display = 'none';
        if (bioEl) bioEl.style.display = 'none';
        if (name) name.style.color = '';
        if (content) content.style.borderColor = '';
        if (favkitEl) favkitEl.style.display = 'none';
        
        if (skin) skin.src = data.skin;
        if (name) name.textContent = data.name;
        if (rank) {
            rank.textContent = data.position;
            rank.className = 'player-modal-rank';
            const pos = parseInt(data.position);
            if (pos === 1) rank.classList.add('rank-1');
            else if (pos === 2) rank.classList.add('rank-2');
            else if (pos === 3) rank.classList.add('rank-3');
        }
        if (score) score.textContent = data.score + ' bodů';
        if (tiers) tiers.innerHTML = data.kitsHtml;

        // Score title
        if (scoreTitle && typeof getScoreTitle === 'function') {
            const st = getScoreTitle(data.score);
            scoreTitle.textContent = st.title;
            scoreTitle.style.color = st.color;
        }

        // Days on tierlist
        if (daysEl && typeof getPlayerFirstDate === 'function') {
            const firstDate = getPlayerFirstDate(data.discordId);
            if (firstDate) {
                const days = Math.floor((Date.now() - firstDate) / (24 * 60 * 60 * 1000));
                daysEl.textContent = days + ' dni na tierlistu';
                daysEl.style.display = '';
            } else {
                daysEl.style.display = 'none';
            }
        }

        // Card customization
        const playerNickForCard = (data.nick || data.name || '').toLowerCase();
        let cardSettings = null;
        try {
            // Try localStorage first (instant, for own card)
            const auth = window.CZSKAuth && CZSKAuth.getCurrentUser();
            const isMyCard = auth && auth.nick && auth.nick.toLowerCase() === playerNickForCard;
            if (isMyCard) {
                const raw = localStorage.getItem('czsktiers_card_' + auth.nick.toLowerCase());
                if (raw) cardSettings = JSON.parse(raw);
            }
        } catch(e) {}

        // Apply card settings helper
        function applyCardSettings(cs) {
            if (cs) {
                if (banner && cs.banner) { banner.style.background = cs.banner; banner.style.display = ''; }
                else if (banner) { banner.style.display = 'none'; }
                if (name && cs.accent) { name.style.color = cs.accent; content.style.borderColor = cs.accent + '33'; }
                else { if (name) name.style.color = ''; if (content) content.style.borderColor = ''; }
                if (bioEl && cs.bio) { bioEl.textContent = cs.bio; bioEl.style.display = ''; }
                else if (bioEl) { bioEl.style.display = 'none'; }
                if (favkitEl && cs.favoriteKit) {
                    favkitEl.innerHTML = '<span class="favkit-label">Oblíbený kit:</span> <span class="favkit-value">' + cs.favoriteKit + '</span>';
                    favkitEl.style.display = '';
                } else if (favkitEl) { favkitEl.style.display = 'none'; }
                // Avatar decoration
                if (decoWrap && cs.decoration) {
                    decoWrap.setAttribute('data-deco', cs.decoration);
                    if (decoOverlay) {
                        decoOverlay.src = 'decorations/' + cs.decoration + '.png';
                        decoOverlay.style.display = '';
                        decoOverlay.onerror = function() { decoOverlay.style.display = 'none'; };
                    }
                }
                // Name effect
                if (name && cs.nameEffect) {
                    name.classList.add('name-effect-' + cs.nameEffect);
                    if (cs.nameEffect === 'gradient' || cs.nameEffect === 'rainbow') {
                        name.style.color = '';
                    }
                }
                // Profile theme
                if (content && cs.theme) {
                    content.setAttribute('data-theme', cs.theme);
                }
            } else {
                if (banner) banner.style.display = 'none';
                if (bioEl) bioEl.style.display = 'none';
                if (name) name.style.color = '';
                if (content) content.style.borderColor = '';
                if (favkitEl) favkitEl.style.display = 'none';
            }
        }

        // Apply immediately if we have localStorage settings
        applyCardSettings(cardSettings);

        // Load from Firestore for all players (async, updates card when loaded)
        if (!cardSettings && playerNickForCard) {
            try {
                const db = typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null;
                if (db) {
                    db.collection('cardSettings').doc(playerNickForCard).get().then(doc => {
                        if (doc.exists) {
                            applyCardSettings(doc.data());
                        }
                    }).catch(e => console.warn('[CardSettings] Firestore load failed for "' + playerNickForCard + '":', e));
                }
            } catch(e) { console.warn('[CardSettings] Error:', e); }
        }

        // Achievements
        if (achEl && typeof computeAchievements === 'function') {
            const achList = computeAchievements({
                name: data.name, position: parseInt(data.position), score: data.score,
                tiers: data.rawTiers || [], discordId: data.discordId,
                hallOfFame: data.hallOfFame, tester: data.tester, allTestedIcons: data.allTestedIcons
            });
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
        
        // Wire Tier Journey click on kit badges
        if (typeof window.showTierJourney === 'function' && tiers && data.nick) {
            tiers.querySelectorAll('.kit-badge[data-kit-icon]').forEach(badge => {
                badge.classList.add('badge-journey-clickable');
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.showTierJourney(data.nick, badge.dataset.kitIcon, badge.dataset.kitTier || '', data.discordId || '');
                });
            });
        }

        // Wire Rank History button
        var rankBtn = document.getElementById('rank-history-btn');
        if (rankBtn) {
            var newBtn = rankBtn.cloneNode(true);
            rankBtn.parentNode.replaceChild(newBtn, rankBtn);
            if (data.discordId) {
                newBtn.style.display = '';
                newBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showRankHistory(data.nick || data.name, data.discordId);
                });
            } else {
                newBtn.style.display = 'none';
            }
        }
        
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
