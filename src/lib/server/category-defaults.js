// Standardpaletten för nya konton. Grupperna är rena visningsetiketter — de
// filtrerar kategoriväljaren och varuhusredigeraren, men refereras aldrig från
// en lista, ett varuhus eller en mall. Därför kan de inte bli "i bruk" och
// blockera något, till skillnad från listprofilerna de ersätter.
export const DEFAULT_CATEGORIES = [
    { name: 'Frukt & grönt',    color: '#bbf7d0', group: 'Livsmedel' },
    { name: 'Mejeri',           color: '#fef9c3', group: 'Livsmedel' },
    { name: 'Kött & fisk',      color: '#fecaca', group: 'Livsmedel' },
    { name: 'Frys',             color: '#cffafe', group: 'Livsmedel' },
    { name: 'Bröd',             color: '#fed7aa', group: 'Livsmedel' },
    { name: 'Dryck',            color: '#bfdbfe', group: 'Livsmedel' },
    { name: 'Torrvaror',        color: '#d9f99d', group: 'Livsmedel' },
    { name: 'Hygien & städ',    color: '#e9d5ff', group: 'Livsmedel' },
    { name: 'Snacks',           color: '#f5d0fe', group: 'Livsmedel' },

    { name: 'Verktyg',          color: '#fed7aa', group: 'Bygg & Järnhandel' },
    { name: 'Byggmaterial',     color: '#e2e8f0', group: 'Bygg & Järnhandel' },
    { name: 'El & belysning',   color: '#fef9c3', group: 'Bygg & Järnhandel' },
    { name: 'VVS',              color: '#bfdbfe', group: 'Bygg & Järnhandel' },
    { name: 'Trä & skivor',     color: '#d9f99d', group: 'Bygg & Järnhandel' },
    { name: 'Färg',             color: '#f5d0fe', group: 'Bygg & Järnhandel' },
    { name: 'Trädgård',         color: '#bbf7d0', group: 'Bygg & Järnhandel' },
    { name: 'Fästelement',      color: '#fecaca', group: 'Bygg & Järnhandel' },

    { name: 'Möbler',           color: '#fed7aa', group: 'Hem & Inredning' },
    { name: 'Förvaring',        color: '#e2e8f0', group: 'Hem & Inredning' },
    { name: 'Textilier',        color: '#f5d0fe', group: 'Hem & Inredning' },
    { name: 'Belysning',        color: '#fef9c3', group: 'Hem & Inredning' },
    { name: 'Kök & matlagning', color: '#bbf7d0', group: 'Hem & Inredning' },
    { name: 'Badrum',           color: '#bfdbfe', group: 'Hem & Inredning' },
    { name: 'Dekoration',       color: '#e9d5ff', group: 'Hem & Inredning' },
    { name: 'Barnrum',          color: '#fecaca', group: 'Hem & Inredning' },

    // Fanns tidigare en gång per profil. I en platt palett finns den en gång,
    // vilket är rätt: varorna joinade ändå på namn och såg samma hink.
    { name: 'Övrigt',           color: '#e2e8f0', group: null }
];
