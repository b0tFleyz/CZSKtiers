// Guild configuration — drives navigation, data loading, and theming
const GUILD_CONFIG = {
  czsktiers: {
    name: 'CZSKTiers',
    shortName: 'CZSK',
    accent: '#eecd14',
    accentRGB: '238, 205, 20',
    sheetTab: null, // first sheet
    tierHistoryTab: 'TierHistory',
    discord: 'https://discord.gg/rAnR4hfKzw',
    kits: [
      { key: 'Crystal', slug: 'cpvp',   icon: 'cpvp.png',   label: 'Cpvp' },
      { key: 'Axe',     slug: 'axe',    icon: 'axe.png',    label: 'Axe' },
      { key: 'Sword',   slug: 'sword',  icon: 'sword.png',  label: 'Sword' },
      { key: 'UHC',     slug: 'uhc',    icon: 'uhc.png',    label: 'UHC' },
      { key: 'Npot',    slug: 'npot',   icon: 'npot.png',   label: 'Npot' },
      { key: 'Pot',     slug: 'pot',    icon: 'pot.png',    label: 'Pot' },
      { key: 'SMP',     slug: 'smp',    icon: 'smp.png',    label: 'SMP' },
      { key: 'DiaSMP',  slug: 'diasmp', icon: 'diasmp.png', label: 'DiaSMP' },
      { key: 'Mace',    slug: 'mace',   icon: 'mace.png',   label: 'Mace' }
    ]
  },
  subtiers: {
    name: 'CZSKSubtiers',
    shortName: 'Sub',
    accent: '#6366f1',
    accentRGB: '99, 102, 241',
    sheetTab: 'SubTiers',
    tierHistoryTab: 'SubTiersTierHistory',
    discord: 'https://discord.gg/QHnserjc',
    kits: [
      { key: 'Speed',      slug: 'speed',      icon: 'speed.png',      label: 'Speed' },
      { key: 'OGV',        slug: 'ogv',        icon: 'OGV.png',        label: 'OGV' },
      { key: 'Cart',       slug: 'cart',       icon: 'cart.png',       label: 'Cart' },
      { key: 'Creeper',    slug: 'creeper',    icon: 'creeper.png',    label: 'Creeper' },
      { key: 'DiaVanilla', slug: 'diavanilla', icon: 'diavanilla.png', label: 'DiaVanilla' }
    ]
  }
};

const XLSX_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTsYd1Hv8XjsdskgT2O-_Otwe3DKxXTXECPE0s4JcPwPPnLMMpknU_-y8EHNBZTtVEQgzicFKcgluSU/pub?output=xlsx';

function getActiveGuild() {
  return localStorage.getItem('activeGuild') || 'czsktiers';
}

function setActiveGuild(guildKey) {
  localStorage.setItem('activeGuild', guildKey);
}

function getGuildConf(guildKey) {
  return GUILD_CONFIG[guildKey || getActiveGuild()] || GUILD_CONFIG.czsktiers;
}
