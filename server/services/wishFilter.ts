/**
 * server/services/wishFilter.ts
 *
 * Backend filter for the "Пожелания" (user wishes) field.
 * Strips body/identity/face modification requests before AI prompt assembly.
 *
 * Defense-in-depth layer — runs server-side only.
 * Cannot be bypassed via DevTools, API calls, or frontend manipulation.
 *
 * ALLOWED:  accessories, glasses, clothing, background, lighting, location, mood.
 * FORBIDDEN: body weight, body shape, face anatomy, age, ethnicity, identity changes.
 */

/** Hard cap on wish field length. Longer inputs are truncated before filtering. */
export const WISH_MAX_LENGTH = 300;

// ── Tier 1: Always forbidden regardless of context ───────────────────────────
// Each pattern matches a forbidden concept. If ANY fires on a fragment → fragment is dropped.

const TIER1: readonly RegExp[] = [
  // Body slimming / weight loss (RU)
  /худе[её]/i,              // худее, худей
  /похуде/i,                // похудеть, похудей
  /стройне[её]/i,           // стройнее
  /потоньш/i,               // потоньше
  /тоньш[её]/i,             // тоньше
  /живот/i,                 // убери живот
  /целлюлит/i,
  /морщин/i,                // морщины
  /жир\b/i,                 // жир (not жираф)
  /жирн/i,                  // жирный, жирнее
  /складки/i,               // складки кожи
  /лишн.*вес/i,             // лишний вес
  /вес.*убра/i,             // вес убрать

  // Body slimming / weight loss (EN)
  /\bslimm/i,               // slim, slimmer, slimming
  /\bskinn[yi]/i,           // skinny, skinniest
  /\bthinne/i,              // thinner, thinnest
  /lose\s+weight/i,
  /weight\s*loss/i,
  /belly\s*fat/i,
  /remove\s*fat/i,

  // Age changes (RU)
  /моложе/i,                // моложе
  /помолоде/i,              // помолодеть
  /постаре/i,               // постареть
  /состари/i,               // состарить
  /выгляде.*молод/i,        // выглядеть моложе

  // Age changes (EN)
  /\byounger\b/i,
  /look\s+older/i,
  /make.*older\b/i,
  /\brejuvenat/i,
  /anti.?aging/i,
  /\bwrinkle/i,

  // Muscles / body transformation (RU)
  /накача/i,                // накачать, накачай
  /мышц.*больш/i,           // мышцы больше

  // Muscles / body transformation (EN)
  /\bripped\b/i,
  /\bbuff\b/i,
  /\bjacked\b/i,
  /more\s+muscl/i,
  /bigger\s+muscl/i,

  // Identity / celebrity swap (RU)
  /как\s+модел/i,           // как модель
  /как\s+актрис/i,          // как актриса
  /как\s+знаменит/i,        // как знаменитость
  /как\s+другой\s+человек/i,
  /как\s+другую?\s+девушк/i,
  /похожей?\s+на/i,         // похожа на, похожей на
  /похожим\s+на/i,
  /выглядеть\s+как/i,
  /сделай\s+как/i,          // сделай как X

  // Identity swap (EN)
  /look\s+like/i,
  /\bceleb(?:rity)?\b/i,
  /as\s+a\s+model/i,
];

// ── Tier 2: Forbidden action + body/face target combination ──────────────────
// Both patterns must match the SAME fragment for it to be forbidden.

const ACTION = /измени|поменяй|убери|исправь|уменьш|увелич|сделай|подтяни|изменить|убрать|поправь|увеличь|уменьши|change|alter|reshape|enlarge|reduce|shrink|remove|make\b/i;

const TARGETS = /\bнос\b|глаза?\b|губ[ыаи]|скул[ыа]?|подбород|челюст|лиц[оа]|форм.{0,10}лиц|фигур[уа]|тел[оа]\b|телосложен|грудь|груди|бедр[аы]?|ягодиц|талию?\b|\bface\b|\bnose\b|\beyes?\b|\blips?\b|\bjaw\b|cheekbone|\bchin\b|\bfigure\b|\bbody\b|\bbreast|\bwaist\b|\bhips?\b|\bbuttock|\bthigh/i;

// ── Core logic ───────────────────────────────────────────────────────────────

/** Returns true if this text fragment should be removed from the wish. */
function isForbiddenFragment(fragment: string): boolean {
  const f = fragment.trim();
  if (!f) return false;
  if (TIER1.some(re => re.test(f))) return true;
  if (ACTION.test(f) && TARGETS.test(f)) return true;
  return false;
}

/**
 * Filters user wish text, removing body/identity modification requests.
 *
 * Strategy: split by phrase separators (commas, semicolons, periods),
 * check each fragment independently, discard forbidden ones, rejoin the rest.
 *
 * @param raw  Raw user input from the "Пожелания" / customPrompt field.
 * @returns    Sanitised string. Empty string if all content was forbidden.
 *
 * @example
 *   filterWish('добавить очки, сделать худее')  → 'добавить очки'
 *   filterWish('сделай как модель')             → ''
 *   filterWish('поменяй фон на пляж')           → 'поменяй фон на пляж'
 *   filterWish('добавить очки')                 → 'добавить очки'
 */
export function filterWish(raw?: string): string {
  if (!raw?.trim()) return '';
  const text = raw.slice(0, WISH_MAX_LENGTH);
  const fragments = text.split(/[,;.]+/).map(f => f.trim()).filter(Boolean);
  if (!fragments.length) return '';
  const allowed = fragments.filter(f => !isForbiddenFragment(f));
  return allowed.join(', ');
}

/**
 * Returns the text fragments that were filtered out.
 * Used for server-side logging and analytics.
 *
 * @example
 *   getFilteredParts('добавить очки, сделать худее')
 *   → ['сделать худее']
 */
export function getFilteredParts(raw?: string): string[] {
  if (!raw?.trim()) return [];
  const text = raw.slice(0, WISH_MAX_LENGTH);
  return text
    .split(/[,;.]+/)
    .map(f => f.trim())
    .filter(f => f && isForbiddenFragment(f));
}

// ── Environment detection ─────────────────────────────────────────────────────

/**
 * Scene environment inferred from the user's wish field.
 * Used to select an outfit appropriate for the described location.
 */
export type EnvironmentHint =
  | 'beach_resort'    // пляж, море, Чёрное море, resort, tropical…
  | 'alpine_winter'   // горы, снег, лыжи, alpine…
  | 'yacht_nautical'  // яхта, Monaco, Riviera…
  | 'evening_dinner'  // ресторан, ужин, gala, dinner…
  | 'business_formal' // офис, деловой, конференция…
  | 'nature_outdoor'  // лес, парк, природа, outdoor…
  | 'city_casual';    // город, улица, кафе, прогулка…

/**
 * Detects the primary scene environment from already-filtered user wish text.
 * Returns undefined if no clear environment cue is present — caller falls back
 * to the default random wardrobe pool.
 *
 * @example
 *   detectEnvironment('на пляже на Чёрном море')  → 'beach_resort'
 *   detectEnvironment('добавить очки')             → undefined
 *   detectEnvironment('в горах')                   → 'alpine_winter'
 */
export function detectEnvironment(filteredWish: string): EnvironmentHint | undefined {
  if (!filteredWish.trim()) return undefined;
  const w = filteredWish;

  // Beach / sea / resort — most visually distinctive, checked first
  if (/пляж|черн\w*\s+мор|черного\s+мор|мор[еяю]\b|средиземн|лазурн|тропик|курорт|riviera|resort\b|beach|sea\s|\bocean\b|bali|maldiv|карибск|tropical/i.test(w))
    return 'beach_resort';

  // Yacht / nautical (subset of sea, but distinct fashion)
  if (/яхт|монако\b|monaco|яхтен|яхтсм/i.test(w))
    return 'yacht_nautical';

  // Mountains / alpine / snow
  if (/в\s+горах|горн\w+|на\s+гор|снег|альпийск|courchevel|mountain|snow\b|alpine|ski\b|зимн\w*\s+горн|горнолыж/i.test(w))
    return 'alpine_winter';

  // Evening / dinner / gala
  if (/ресторан|ужин|вечер\w*\s+прием|гала\b|банкет|светский\s+прием|dinner\b|restaurant|gala\b|evening\s+event|banquet/i.test(w))
    return 'evening_dinner';

  // Business / office / corporate
  if (/офис|деловой|деловая\s+встреч|бизнес\w*\s+встреч|конференц|переговор|business\b|office\b|corporate|formal\s+meeting/i.test(w))
    return 'business_formal';

  // Nature / outdoor
  if (/в\s+лесу|в\s+парке|в\s+поле|на\s+природ|луг\b|лес\b|парк\b|\bforest\b|\bpark\b|\bnature\b|\boutdoor\b|\bfield\b|\bmeadow/i.test(w))
    return 'nature_outdoor';

  // City / street / casual walk
  if (/в\s+городе|на\s+улице|кафе\b|city\b|street\b|urban\b|cafe\b|downtown|на\s+прогулке/i.test(w))
    return 'city_casual';

  return undefined;
}
