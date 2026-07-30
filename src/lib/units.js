/**
 * Mängder och enheter — delad mellan servern och komponenterna.
 *
 * `quantity` betydde tidigare två saker: "hur många paket jag plockar" i en
 * lista och "hur mycket" i ett recept. Utan enhet gick de inte att skilja åt,
 * och avrundningen fick behandla 1,5 kg som om det vore ett antal paket.
 *
 * Modulen får inte importera något server- eller Svelte-specifikt: samma
 * avrundning måste kunna köras både i API-handlern och i den optimistiska
 * kopian i klienten, annars hoppar talen när serversvaret landar.
 */

/** Enheter man räknar i hela steg — man köper inte en halv förpackning. */
export const COUNTABLE_UNITS = ['', 'förp', 'burk', 'pkt', 'knippe'];

/** Enheter som är kontinuerliga — decimaler är meningsfulla. */
export const CONTINUOUS_UNITS = ['g', 'hg', 'kg', 'ml', 'cl', 'dl', 'l', 'msk', 'tsk', 'krm'];

/** Max antal tecken i en egen enhet. Samma tak som i templates-schemat. */
export const MAX_UNIT_LENGTH = 20;

/**
 * Snabbvalen i inmatningsformulären. Tom sträng är styck och visas som "st" —
 * den vanligaste enheten ska inte kräva ett val.
 * @type {{ value: string, label: string }[]}
 */
export const QUICK_UNITS = [
    { value: '', label: 'st' },
    { value: 'g', label: 'g' },
    { value: 'kg', label: 'kg' },
    { value: 'dl', label: 'dl' },
    { value: 'l', label: 'l' },
    { value: 'msk', label: 'msk' },
    { value: 'tsk', label: 'tsk' },
    { value: 'förp', label: 'förp' }
];

/**
 * Enheter tolkningen känner igen. "st" finns med som skrivsätt men lagras som
 * tom sträng — styck är frånvaron av enhet, inte en egen enhet.
 */
const KNOWN_UNITS = [...CONTINUOUS_UNITS, ...COUNTABLE_UNITS.filter(Boolean), 'st'];

/**
 * Normaliserar en enhet från inmatning. Kända enheter får sitt kanoniska
 * skrivsätt, "st" blir tom sträng, och allt annat behålls som fritext.
 * @param {unknown} value
 */
export function normalizeUnit(value) {
    const raw = String(value ?? '').trim().slice(0, MAX_UNIT_LENGTH);
    if (!raw) return '';
    const lower = raw.toLowerCase();
    if (lower === 'st' || lower === 'styck') return '';
    const known = KNOWN_UNITS.find(u => u === lower);
    return known ?? raw;
}

/** @param {string} unit */
export function isContinuousUnit(unit) {
    return CONTINUOUS_UNITS.includes(unit);
}

/**
 * Håller mängden inom 0 < q <= 9999 och kapar flyttalsbruset som uppstår när
 * ett decimaltal multipliceras med en skalfaktor (0,1 × 3 = 0,30000000000000004).
 * Returnerar null för allt som inte är en giltig mängd — null betyder "ingen
 * mängd angiven" och är ett fullt giltigt tillstånd.
 * @param {unknown} value
 * @returns {number | null}
 */
export function sanitizeQuantity(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(9999, Math.round(n * 100) / 100);
}

/**
 * Avrundar en skalad mängd till ett tal man kan handla efter. Ingen
 * enhetsomvandling sker — 1500 g förblir 1500 g.
 *
 * Trappan är grov med flit: 1,5 kg × 1,5 ska bli 2,5 kg, inte 2,25.
 * Golvet på 0,5 finns för att en nedskalning aldrig ska landa på noll och
 * tyst radera varan ur listan.
 * @param {number} n
 */
export function roundToNiceStep(n) {
    if (n < 10) return Math.max(0.5, Math.round(n * 2) / 2);
    if (n <= 100) return Math.round(n);
    return Math.round(n / 10) * 10;
}

/**
 * Skalar en mängd vid import av ett recept.
 *
 * - Ingen mängd angiven ⇒ ingen mängd. Salt utan mängd blir inte "×2 salt".
 * - Räknbar enhet ⇒ uppåt till närmaste hela, minst 1. Hellre ett paket för
 *   mycket än ett för lite.
 * - Kontinuerlig enhet ⇒ närmaste trevliga steg.
 *
 * Vid skalfaktor 1 lämnas mängden orörd. En vanlig mall-import ska inte kunna
 * skriva om 0,25 tsk till 0,5 tsk bara för att den passerar den här funktionen.
 * @param {unknown} quantity
 * @param {string} unit
 * @param {number} scale
 * @returns {number | null}
 */
export function scaleQuantity(quantity, unit, scale = 1) {
    const base = sanitizeQuantity(quantity);
    if (base === null) return null;
    if (!Number.isFinite(scale) || scale <= 0 || scale === 1) return base;
    const scaled = base * scale;
    return sanitizeQuantity(
        isContinuousUnit(unit) ? roundToNiceStep(scaled) : Math.max(1, Math.ceil(scaled))
    );
}

/**
 * Hur mycket stegknapparna i listan flyttar mängden. Steget är i varans egen
 * enhet — ingen dold matematik, ingen omräkning till gram.
 * @param {string} unit
 */
export function stepForUnit(unit) {
    switch (unit) {
        case 'l':
        case 'kg':
            return 0.5;
        case 'g':
            return 50;
        default:
            return 1;
    }
}

/**
 * Ett tal som det ska se ut i gränssnittet: svenskt decimalkomma, inga
 * onödiga nollor. Internt är punkten kvar.
 * @param {number} n
 */
export function formatQuantity(n) {
    const rounded = Math.round(n * 100) / 100;
    return String(rounded).replace('.', ',');
}

/**
 * Mängden som den visas bredvid en vara.
 * - ingen mängd ⇒ tomt
 * - enhet ⇒ "3 dl"
 * - ingen enhet, fler än en ⇒ "×3"
 * - ingen enhet, exakt en ⇒ "1"
 * @param {number | null | undefined} quantity
 * @param {string} [unit]
 */
export function formatAmount(quantity, unit = '') {
    const q = sanitizeQuantity(quantity);
    if (q === null) return '';
    if (unit) return `${formatQuantity(q)} ${unit}`;
    if (q > 1) return `×${formatQuantity(q)}`;
    return formatQuantity(q);
}

/**
 * Läser ett mängdfält. Tomt fält förblir tomt — det får aldrig hoppa till 1.
 * Svenskt komma accepteras, eftersom det är vad telefonens tangentbord ger.
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseQuantityInput(value) {
    const raw = String(value ?? '').trim().replace(',', '.');
    if (!raw) return null;
    return sanitizeQuantity(raw);
}

// Längsta enheten först, annars matchar "l" i "liter" innan "dl" hinner testas.
const UNIT_PATTERN = [...KNOWN_UNITS].sort((a, b) => b.length - a.length).join('|');
const LEADING_AMOUNT = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})?\\s+(.+)$`, 'i');

/**
 * Tolkar en inledande mängd i varunamnet: "3 dl grädde" blir grädde, 3, dl.
 *
 * Ett hjälpmedel, aldrig ett lagringsformat — anroparen fyller i fälten så att
 * en feltolkning syns och går att rätta. Matchar mönstret inte lämnas allt som
 * varunamn, vilket är varför "Kaffe Zoégas 500" förblir orört: mängden måste
 * stå först, och något måste stå kvar efter den.
 * @param {string} text
 * @returns {{ name: string, quantity: number, unit: string } | null}
 */
export function parseLeadingAmount(text) {
    const match = LEADING_AMOUNT.exec(String(text ?? '').trim());
    if (!match) return null;
    const quantity = sanitizeQuantity(match[1].replace(',', '.'));
    if (quantity === null) return null;
    const name = match[3].trim();
    // "3 dl" utan varunamn backtrackar annars till varan "dl" med mängden 3.
    // En ensam enhet är ingen vara.
    if (!name || KNOWN_UNITS.includes(name.toLowerCase())) return null;
    return { name, quantity, unit: normalizeUnit(match[2] ?? '') };
}
