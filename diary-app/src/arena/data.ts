/**
 * "הסים שלך" (Your Sim): the static game data — elements, fighters, skins, moves, items, ranks and worlds.
 * Fighters, items and worlds are original illustrations made for the game (see assets/sim/CREDITS.md).
 */

export type Element = 'water' | 'fire' | 'nature' | 'earth' | 'storm' | 'shadow';

/** Each element beats the next one in the ring and loses to the one before it. */
const RING: Element[] = ['water', 'fire', 'nature', 'earth', 'storm', 'shadow'];

export const ELEMENTS: Record<Element, { label: string; color: string; icon: string }> = {
  water: { label: 'מים וקרח', color: '#38BDF8', icon: '💧' },
  fire: { label: 'אש', color: '#FB923C', icon: '🔥' },
  nature: { label: 'טבע', color: '#4ADE80', icon: '🌿' },
  earth: { label: 'אדמה', color: '#D6A77A', icon: '⛰️' },
  storm: { label: 'סערה', color: '#FACC15', icon: '⚡' },
  shadow: { label: 'צל', color: '#A78BFA', icon: '🌑' },
};

/** Damage multiplier when `a` hits `b`. */
export function elementBonus(a: Element, b: Element): number {
  const i = RING.indexOf(a);
  if (RING[(i + 1) % RING.length] === b) return 1.5;
  if (RING[(i + RING.length - 1) % RING.length] === b) return 0.67;
  return 1;
}

export const beats = (e: Element): Element => RING[(RING.indexOf(e) + 1) % RING.length];

export type Stats = { hp: number; atk: number; def: number; spd: number };

export type MoveId = 'bite' | 'fireBreath' | 'iceBlast' | 'vineWhip' | 'quake' | 'zap' | 'shadowClaw' | 'thunder' | 'slash' | 'shield' | 'heal' | 'rage' | 'arrows' | 'smash';

export type Move = {
  id: MoveId;
  name: string;
  cost: number;
  /** multiplier of attack */
  power: number;
  element?: Element;
  effect?: 'burn' | 'freeze' | 'stun' | 'shield' | 'heal' | 'rage' | 'drain';
  color: string;
  icon: string;
  desc: string;
};

export const MOVES: Record<MoveId, Move> = {
  bite: { id: 'bite', name: 'נשיכה', cost: 2, power: 1.2, color: '#F472B6', icon: '🦷', desc: 'מכה מהירה וזולה' },
  fireBreath: { id: 'fireBreath', name: 'נשימת אש', cost: 4, power: 1.6, element: 'fire', effect: 'burn', color: '#FB923C', icon: '🔥', desc: 'שורף את היריב לכמה שניות' },
  iceBlast: { id: 'iceBlast', name: 'סופת קרח', cost: 4, power: 1.3, element: 'water', effect: 'freeze', color: '#38BDF8', icon: '❄️', desc: 'מקפיא — היריב לא תוקף 2 שניות' },
  vineWhip: { id: 'vineWhip', name: 'שוט קוצים', cost: 3, power: 1.25, element: 'nature', effect: 'drain', color: '#4ADE80', icon: '🌵', desc: 'פוגע ומחזיר לך חיים' },
  quake: { id: 'quake', name: 'רעידת אדמה', cost: 5, power: 2.1, element: 'earth', effect: 'stun', color: '#D6A77A', icon: '⛰️', desc: 'נזק ענק ומשתק לשנייה' },
  zap: { id: 'zap', name: 'עקיצת ברק', cost: 2, power: 1.1, element: 'storm', color: '#FACC15', icon: '🐝', desc: 'זול ומהיר, אפשר להפציץ' },
  shadowClaw: { id: 'shadowClaw', name: 'טופר צל', cost: 3, power: 1.7, element: 'shadow', color: '#A78BFA', icon: '👻', desc: 'מתעלם מחצי מההגנה' },
  thunder: { id: 'thunder', name: 'מכת רעם', cost: 5, power: 2.4, element: 'storm', effect: 'stun', color: '#FDE047', icon: '⚡', desc: 'הנשק האגדי: נזק פי 2.4 ומשתק' },
  slash: { id: 'slash', name: 'חרב', cost: 3, power: 1.6, color: '#E0F2FE', icon: '🗡️', desc: 'מכת חרב חזקה' },
  smash: { id: 'smash', name: 'פטיש', cost: 4, power: 2.0, effect: 'stun', color: '#FCA5A5', icon: '🔨', desc: 'מכה כבדה שמשתקת' },
  arrows: { id: 'arrows', name: 'מטר חיצים', cost: 3, power: 1.5, color: '#FDBA74', icon: '🏹', desc: 'פוגע מרחוק' },
  shield: { id: 'shield', name: 'מגן', cost: 2, power: 0, effect: 'shield', color: '#6EE7B7', icon: '🛡️', desc: 'בולע את המכה הבאה' },
  heal: { id: 'heal', name: 'שיקוי ריפוי', cost: 3, power: 0, effect: 'heal', color: '#F9A8D4', icon: '🧪', desc: 'מחזיר 25% חיים' },
  rage: { id: 'rage', name: 'זעם', cost: 3, power: 0, effect: 'rage', color: '#F87171', icon: '💢', desc: 'התקפה ×1.5 ל-5 שניות' },
};

export type SpeciesId =
  | 'dragon' | 'cat' | 'fox' | 'penguin' | 'shark' | 'octopus' | 'frog' | 'bunny' | 'owl'
  | 'panda' | 'rhino' | 'mole' | 'wolf' | 'bee' | 'eagle' | 'raven' | 'bat' | 'snake'
  | 'boss_gorilla' | 'boss_kraken' | 'boss_lavadragon' | 'boss_thunderbird' | 'boss_shadowking';

export type Species = {
  id: SpeciesId;
  name: string;
  element: Element;
  base: Stats;
  signature: MoveId;
  starter?: boolean;
  /** extra scale on screen (bosses and big ones) */
  scale?: number;
  desc: string;
};

const sp = (id: SpeciesId, name: string, element: Element, hp: number, atk: number, def: number, spd: number, signature: MoveId, desc: string, extra: Partial<Species> = {}): Species => ({ id, name, element, base: { hp, atk, def, spd }, signature, desc, ...extra });

export const SPECIES: Record<SpeciesId, Species> = {
  dragon: sp('dragon', 'דרקו', 'fire', 92, 15, 8, 10, 'fireBreath', 'דרקון קטן עם עצבים גדולים. נושף אש!', { starter: true }),
  cat: sp('cat', 'בלייז', 'fire', 86, 16, 7, 13, 'slash', 'חתול רחוב לוהט. מהיר וחד.', { starter: true }),
  fox: sp('fox', 'פוקסי', 'fire', 88, 15, 8, 12, 'fireBreath', 'שועל ערמומי עם זנב בוער.'),
  penguin: sp('penguin', 'פינגו', 'water', 104, 14, 11, 9, 'iceBlast', 'מקפיא את היריבים במקום.', { starter: true }),
  shark: sp('shark', 'שארקי', 'water', 108, 16, 10, 8, 'bite', 'החיוך הכי מפחיד בים.'),
  octopus: sp('octopus', 'אוקטו', 'water', 96, 14, 10, 11, 'iceBlast', 'שמונה זרועות, אפס רחמים.'),
  frog: sp('frog', 'קרואק', 'nature', 105, 12, 12, 9, 'vineWhip', 'צפרדע היער. גונב חיים מהיריב.', { starter: true }),
  bunny: sp('bunny', 'באני', 'nature', 90, 13, 9, 14, 'heal', 'שומרת היער. מרפאה את עצמה.'),
  owl: sp('owl', 'ינשופי', 'nature', 92, 15, 8, 11, 'arrows', 'קשת שלא מפספס אף פעם.'),
  panda: sp('panda', 'פנדי', 'earth', 116, 13, 12, 6, 'quake', 'הכי חזק ועמיד. רעידת אדמה!', { starter: true }),
  rhino: sp('rhino', 'רינו', 'earth', 122, 14, 13, 5, 'smash', 'דוהר קדימה ולא עוצר.'),
  mole: sp('mole', 'חפרי', 'earth', 100, 14, 11, 9, 'quake', 'חופר מתחת לזירה ומפתיע.'),
  wolf: sp('wolf', 'וולטי', 'storm', 94, 15, 8, 13, 'zap', 'זאב הברקים. הכי מהיר בלהקה.', { starter: true }),
  bee: sp('bee', 'זמזום', 'storm', 88, 15, 8, 15, 'zap', 'עוקץ שוב ושוב בלי הפסקה.'),
  eagle: sp('eagle', 'נשרי', 'storm', 96, 16, 9, 12, 'thunder', 'מלך השמיים. מטיל רעמים.'),
  raven: sp('raven', 'רייבן', 'shadow', 86, 16, 8, 11, 'shadowClaw', 'מופיע ונעלם. עובר דרך שריון.', { starter: true }),
  bat: sp('bat', 'עטלפי', 'shadow', 82, 15, 7, 14, 'shadowClaw', 'יוצא רק בלילה.'),
  snake: sp('snake', 'קוברה', 'shadow', 90, 17, 8, 10, 'bite', 'נשיכה אחת ונגמר.'),
  boss_gorilla: sp('boss_gorilla', 'קינג קונגי', 'nature', 150, 15, 14, 5, 'smash', 'שומר היער העתיק. בוס.', { scale: 1.3 }),
  boss_kraken: sp('boss_kraken', 'קרקן', 'water', 145, 16, 12, 8, 'iceBlast', 'מלך המעמקים. בוס.', { scale: 1.3 }),
  boss_lavadragon: sp('boss_lavadragon', 'מלך הלבה', 'fire', 140, 18, 11, 8, 'fireBreath', 'הדרקון שבתוך הר הגעש. בוס.', { scale: 1.3 }),
  boss_thunderbird: sp('boss_thunderbird', 'ציפור הרעם', 'storm', 135, 18, 10, 11, 'thunder', 'שולטת בסערה. בוס.', { scale: 1.3 }),
  boss_shadowking: sp('boss_shadowking', 'מלך הצללים', 'shadow', 150, 19, 11, 9, 'shadowClaw', 'השליט של ממלכת הצללים. הבוס האחרון.', { scale: 1.35 }),
};

export const STARTERS: SpeciesId[] = ['dragon', 'cat', 'penguin', 'frog', 'panda', 'wolf', 'raven'];

/** Ids from the first version of the game (Quaternius sprites), mapped onto the new roster. */
const LEGACY: Record<string, SpeciesId> = {
  YellowDragon: 'dragon', Demon: 'fox', Chicken: 'fox', Penguin: 'penguin', Crab: 'shark', Cthulhu: 'boss_kraken', Yeti: 'octopus',
  Cactus: 'frog', GreenDemon: 'frog', Mushroom: 'bunny', Deer: 'bunny', Tree: 'boss_gorilla', Panda: 'panda', Pig: 'rhino', Cyclops: 'mole',
  Bee: 'bee', Alien: 'wolf', Alien_Tall: 'eagle', Ghost: 'raven', Bat: 'bat', Skull: 'snake',
};
export const normSpecies = (id: string): SpeciesId => (id in SPECIES ? (id as SpeciesId) : (LEGACY[id] ?? 'dragon'));

/** Cosmetic skins: same fighter and stats, a new look. Bought with gems. */
export type Skin = { id: string; species: SpeciesId; name: string; price: number; rarity: 'epic' | 'legendary' };
export const SKINS: Skin[] = [
  { id: 'dragon_gold', species: 'dragon', name: 'דרקו אביר הזהב', price: 80, rarity: 'legendary' },
  { id: 'dragon_ice', species: 'dragon', name: 'דרקו הקרח', price: 40, rarity: 'epic' },
  { id: 'cat_ninja', species: 'cat', name: 'בלייז נינג׳ה', price: 40, rarity: 'epic' },
  { id: 'cat_space', species: 'cat', name: 'בלייז האסטרונאוט', price: 80, rarity: 'legendary' },
  { id: 'penguin_pirate', species: 'penguin', name: 'פינגו קפטן פיראטים', price: 40, rarity: 'epic' },
  { id: 'panda_samurai', species: 'panda', name: 'פנדי סמוראי', price: 80, rarity: 'legendary' },
  { id: 'wolf_neon', species: 'wolf', name: 'וולטי סייבר', price: 80, rarity: 'legendary' },
  { id: 'frog_king', species: 'frog', name: 'קרואק המלך', price: 40, rarity: 'epic' },
];
export const skinDef = (id?: string) => SKINS.find((k) => k.id === id);

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY: Record<Rarity, { label: string; color: string; mult: number; glow: string }> = {
  common: { label: 'רגיל', color: '#94A3B8', mult: 1, glow: 'rgba(148,163,184,0.35)' },
  rare: { label: 'נדיר', color: '#22C55E', mult: 1.3, glow: 'rgba(34,197,94,0.45)' },
  epic: { label: 'אפי', color: '#3B82F6', mult: 1.7, glow: 'rgba(59,130,246,0.5)' },
  legendary: { label: 'אגדי', color: '#F59E0B', mult: 2.2, glow: 'rgba(245,158,11,0.6)' },
  mythic: { label: 'מיתי', color: '#E879F9', mult: 3, glow: 'rgba(232,121,249,0.65)' },
};
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export type Slot = 'weapon' | 'armor' | 'head' | 'charm';
export const SLOTS: Record<Slot, string> = { weapon: 'נשק', armor: 'שריון', head: 'כתר / כובע', charm: 'קמע' };

export type ItemDef = {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  /** stat bonus at item level 1, before rarity */
  bonus: Partial<Stats>;
  move?: MoveId;
  icon: string;
};

// Item ids stay from the first version (saves keep working); icons are the new illustrations in assets/sim/items
export const ITEMS: ItemDef[] = [
  { id: 'Dagger', name: 'פגיון', slot: 'weapon', rarity: 'common', bonus: { atk: 3, spd: 1 }, move: 'slash', icon: 'it_flame_dagger' },
  { id: 'Axe_Small', name: 'גרזן קטן', slot: 'weapon', rarity: 'common', bonus: { atk: 4 }, move: 'slash', icon: 'it_battle_axe' },
  { id: 'Sword', name: 'חרב', slot: 'weapon', rarity: 'rare', bonus: { atk: 5 }, move: 'slash', icon: 'it_ice_sword' },
  { id: 'Bow_Wooden', name: 'קשת עץ', slot: 'weapon', rarity: 'rare', bonus: { atk: 4, spd: 2 }, move: 'arrows', icon: 'it_vine_bow' },
  { id: 'Hammer_Double', name: 'פטיש קרב', slot: 'weapon', rarity: 'epic', bonus: { atk: 7 }, move: 'smash', icon: 'it_rock_hammer' },
  { id: 'Axe_Double', name: 'גרזן כפול', slot: 'weapon', rarity: 'epic', bonus: { atk: 7, def: 1 }, move: 'slash', icon: 'it_battle_axe' },
  { id: 'Sword_Big', name: 'חרב ענק', slot: 'weapon', rarity: 'epic', bonus: { atk: 8 }, move: 'slash', icon: 'it_ice_sword' },
  { id: 'Bow_Golden', name: 'קשת הזהב', slot: 'weapon', rarity: 'legendary', bonus: { atk: 8, spd: 3 }, move: 'arrows', icon: 'it_vine_bow' },
  { id: 'Hammer_Double_Golden', name: 'פטיש הרעם', slot: 'weapon', rarity: 'legendary', bonus: { atk: 10 }, move: 'thunder', icon: 'it_thunder_hammer' },
  { id: 'Sword_Golden', name: 'חרב הרעם', slot: 'weapon', rarity: 'legendary', bonus: { atk: 10, spd: 1 }, move: 'thunder', icon: 'it_flame_sword' },
  { id: 'Sword_Big_Golden', name: 'להב האגדה', slot: 'weapon', rarity: 'mythic', bonus: { atk: 13, spd: 2 }, move: 'thunder', icon: 'it_shadow_scythe' },
  { id: 'Armor_Leather', name: 'שריון עור', slot: 'armor', rarity: 'common', bonus: { def: 3, hp: 8 }, icon: 'it_leather_armor' },
  { id: 'Armor_Metal', name: 'שריון ברזל', slot: 'armor', rarity: 'rare', bonus: { def: 5, hp: 12 }, icon: 'it_iron_armor' },
  { id: 'Armor_Metal2', name: 'שריון אבירים', slot: 'armor', rarity: 'epic', bonus: { def: 7, hp: 18 }, icon: 'it_knight_armor' },
  { id: 'Armor_Black', name: 'שריון הצל', slot: 'armor', rarity: 'legendary', bonus: { def: 9, hp: 22, atk: 2 }, icon: 'it_shadow_armor' },
  { id: 'Armor_Golden', name: 'שריון הזהב', slot: 'armor', rarity: 'mythic', bonus: { def: 12, hp: 30 }, icon: 'it_gold_armor' },
  { id: 'Crown2', name: 'כתר נסיכים', slot: 'head', rarity: 'epic', bonus: { hp: 15, atk: 2 }, move: 'rage', icon: 'it_prince_crown' },
  { id: 'Crown', name: 'כתר המלך', slot: 'head', rarity: 'legendary', bonus: { hp: 25, atk: 3, def: 2 }, move: 'rage', icon: 'it_king_crown' },
  { id: 'Glove', name: 'כפפת כוח', slot: 'charm', rarity: 'common', bonus: { atk: 2 }, icon: 'it_power_glove' },
  { id: 'Ring1', name: 'טבעת מהירות', slot: 'charm', rarity: 'rare', bonus: { spd: 3 }, icon: 'it_speed_ring' },
  { id: 'Necklace1', name: 'שרשרת חיים', slot: 'charm', rarity: 'rare', bonus: { hp: 15 }, move: 'heal', icon: 'it_life_necklace' },
  { id: 'Ring3', name: 'טבעת הקרח', slot: 'charm', rarity: 'epic', bonus: { def: 3, spd: 2 }, move: 'shield', icon: 'it_ice_ring' },
  { id: 'Necklace3', name: 'קמע הדרקון', slot: 'charm', rarity: 'legendary', bonus: { atk: 4, hp: 18 }, move: 'heal', icon: 'it_dragon_amulet' },
  { id: 'Crystal5', name: 'גביש הנצח', slot: 'charm', rarity: 'mythic', bonus: { atk: 5, def: 5, hp: 25, spd: 2 }, move: 'shield', icon: 'it_eternal_crystal' },
];
export const itemDef = (id: string) => ITEMS.find((i) => i.id === id);

export const MAX_LEVEL = 500;
export const MAX_ITEM_LEVEL = 50;

/** Trophy ranks, from Bronze to "Legend of Israel". */
export const RANKS = [
  { id: 'bronze', name: 'ארד', min: 0, color: '#CD7F32', icon: 'rank_bronze' },
  { id: 'silver', name: 'כסף', min: 400, color: '#CBD5E1', icon: 'rank_silver' },
  { id: 'gold', name: 'זהב', min: 1000, color: '#FACC15', icon: 'rank_gold' },
  { id: 'diamond', name: 'יהלום', min: 2000, color: '#38BDF8', icon: 'rank_diamond' },
  { id: 'master', name: 'מאסטר', min: 3500, color: '#A78BFA', icon: 'rank_master' },
  { id: 'legend', name: 'אגדת ישראל', min: 5000, color: '#F472B6', icon: 'rank_legend' },
] as const;

export function rankOf(trophies: number) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (trophies >= RANKS[k].min) i = k;
  const r = RANKS[i];
  const next = RANKS[i + 1];
  // Three tiers (III → I) inside every rank but the last
  const span = next ? next.min - r.min : 1;
  const tier = next ? 3 - Math.min(2, Math.floor(((trophies - r.min) / span) * 3)) : 0;
  return { ...r, index: i, tier, next, progress: next ? (trophies - r.min) / span : 1, label: tier ? `${r.name} ${['', 'I', 'II', 'III'][tier]}` : r.name };
}

/** Five worlds of 50 stages; a boss every 10th stage and a world boss at 50. */
export const WORLDS = [
  { id: 1, name: 'יער הקסמים', colors: ['#14532D', '#22C55E'] as const, bg: 'forest', enemies: ['frog', 'bunny', 'owl', 'mole', 'fox'] as SpeciesId[], boss: 'boss_gorilla' as SpeciesId },
  { id: 2, name: 'איי הכרישים', colors: ['#0C4A6E', '#38BDF8'] as const, bg: 'ocean', enemies: ['shark', 'octopus', 'penguin', 'frog', 'bee'] as SpeciesId[], boss: 'boss_kraken' as SpeciesId },
  { id: 3, name: 'הר הגעש', colors: ['#7C2D12', '#F97316'] as const, bg: 'volcano', enemies: ['fox', 'cat', 'dragon', 'rhino', 'mole'] as SpeciesId[], boss: 'boss_lavadragon' as SpeciesId },
  { id: 4, name: 'פסגות הסערה', colors: ['#3B0764', '#FACC15'] as const, bg: 'storm', enemies: ['wolf', 'bee', 'eagle', 'panda', 'rhino'] as SpeciesId[], boss: 'boss_thunderbird' as SpeciesId },
  { id: 5, name: 'ממלכת הצללים', colors: ['#2E1065', '#A855F7'] as const, bg: 'shadow', enemies: ['raven', 'bat', 'snake', 'wolf', 'octopus'] as SpeciesId[], boss: 'boss_shadowking' as SpeciesId },
];
export const STAGES_PER_WORLD = 50;
export const TOTAL_STAGES = WORLDS.length * STAGES_PER_WORLD;
