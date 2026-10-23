/**
 * Pet Arena ("קרב החיות"): the static game data — elements, fighters, moves, items, ranks and worlds.
 * Characters and items are Quaternius' CC0 3D models, rendered to sprite sheets (see assets/game/CREDITS.md).
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
  | 'YellowDragon' | 'Penguin' | 'Cactus' | 'Panda' | 'Bee' | 'Ghost'
  | 'Yeti' | 'Cyclops' | 'Demon' | 'GreenDemon' | 'Alien' | 'Alien_Tall' | 'Skull' | 'Tree' | 'Deer' | 'Crab' | 'Bat' | 'Cthulhu' | 'Mushroom' | 'Pig' | 'Chicken';

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

export const SPECIES: Record<SpeciesId, Species> = {
  YellowDragon: { id: 'YellowDragon', name: 'ספרקי', element: 'fire', base: { hp: 92, atk: 15, def: 8, spd: 10 }, signature: 'fireBreath', starter: true, desc: 'דרקון קטן עם לב ענק. נשימת אש שורפת.' },
  Penguin: { id: 'Penguin', name: 'פינגו', element: 'water', base: { hp: 104, atk: 14, def: 11, spd: 9 }, signature: 'iceBlast', starter: true, desc: 'מקפיא את היריבים במקום.' },
  Cactus: { id: 'Cactus', name: 'קקטי', element: 'nature', base: { hp: 105, atk: 12, def: 12, spd: 8 }, signature: 'vineWhip', starter: true, desc: 'קוצני ועקשן. גונב חיים מהיריב.' },
  Panda: { id: 'Panda', name: 'פנדי', element: 'earth', base: { hp: 116, atk: 13, def: 12, spd: 6 }, signature: 'quake', starter: true, desc: 'הכי חזק ועמיד. רעידת אדמה!' },
  Bee: { id: 'Bee', name: 'זמזום', element: 'storm', base: { hp: 88, atk: 15, def: 8, spd: 15 }, signature: 'zap', starter: true, desc: 'הכי מהיר בזירה. עוקץ שוב ושוב.' },
  Ghost: { id: 'Ghost', name: 'בו', element: 'shadow', base: { hp: 85, atk: 16, def: 8, spd: 11 }, signature: 'shadowClaw', starter: true, desc: 'מופיע ונעלם. עובר דרך שריון.' },
  Yeti: { id: 'Yeti', name: 'ייטי', element: 'water', base: { hp: 130, atk: 14, def: 12, spd: 6 }, signature: 'iceBlast', desc: 'שומר ההרים הקפואים.' },
  Cyclops: { id: 'Cyclops', name: 'עין-אחת', element: 'earth', base: { hp: 115, atk: 15, def: 11, spd: 7 }, signature: 'smash', desc: 'רואה הכול בעין אחת.' },
  Demon: { id: 'Demon', name: 'שדון אש', element: 'fire', base: { hp: 95, atk: 17, def: 8, spd: 10 }, signature: 'fireBreath', desc: 'שובב ולוהט.' },
  GreenDemon: { id: 'GreenDemon', name: 'גובלין', element: 'nature', base: { hp: 98, atk: 15, def: 9, spd: 11 }, signature: 'vineWhip', desc: 'הגובלין של היער.' },
  Alien: { id: 'Alien', name: 'זורג', element: 'storm', base: { hp: 90, atk: 15, def: 9, spd: 12 }, signature: 'zap', desc: 'נחת מכוכב אחר.' },
  Alien_Tall: { id: 'Alien_Tall', name: 'זורג הגבוה', element: 'storm', base: { hp: 100, atk: 16, def: 10, spd: 11 }, signature: 'thunder', desc: 'מנהיג החייזרים.' },
  Skull: { id: 'Skull', name: 'גולגולי', element: 'shadow', base: { hp: 88, atk: 17, def: 8, spd: 10 }, signature: 'shadowClaw', desc: 'מפחיד רק קצת.' },
  Tree: { id: 'Tree', name: 'עצי', element: 'nature', base: { hp: 135, atk: 12, def: 14, spd: 5 }, signature: 'vineWhip', desc: 'עץ עתיק ששומר על היער.' },
  Deer: { id: 'Deer', name: 'צביקי', element: 'nature', base: { hp: 92, atk: 14, def: 9, spd: 13 }, signature: 'vineWhip', desc: 'קופץ בין העצים.' },
  Crab: { id: 'Crab', name: 'סרטן', element: 'water', base: { hp: 105, atk: 14, def: 15, spd: 7 }, signature: 'shield', desc: 'שריון קשה מאוד.' },
  Bat: { id: 'Bat', name: 'עטלפי', element: 'shadow', base: { hp: 80, atk: 15, def: 7, spd: 14 }, signature: 'shadowClaw', desc: 'יוצא רק בלילה.' },
  Cthulhu: { id: 'Cthulhu', name: 'קת׳ולו', element: 'water', base: { hp: 145, atk: 16, def: 12, spd: 8 }, signature: 'iceBlast', scale: 1.25, desc: 'מלך המעמקים. בוס.' },
  Mushroom: { id: 'Mushroom', name: 'פטריון', element: 'nature', base: { hp: 95, atk: 13, def: 10, spd: 9 }, signature: 'heal', desc: 'מרפא את עצמו.' },
  Pig: { id: 'Pig', name: 'חזרזיר', element: 'earth', base: { hp: 110, atk: 13, def: 11, spd: 8 }, signature: 'smash', desc: 'קטן אבל עקשן.' },
  Chicken: { id: 'Chicken', name: 'תרנגולי', element: 'fire', base: { hp: 80, atk: 14, def: 8, spd: 13 }, signature: 'bite', desc: 'אל תעצבנו אותו.' },
};

export const STARTERS: SpeciesId[] = ['YellowDragon', 'Penguin', 'Cactus', 'Panda', 'Bee', 'Ghost'];

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

// Icons are rendered from Quaternius' "Ultimate RPG Items" pack (file names kept as ids)
export const ITEMS: ItemDef[] = [
  { id: 'Dagger', name: 'פגיון', slot: 'weapon', rarity: 'common', bonus: { atk: 3, spd: 1 }, move: 'slash', icon: 'Dagger' },
  { id: 'Axe_Small', name: 'גרזן קטן', slot: 'weapon', rarity: 'common', bonus: { atk: 4 }, move: 'slash', icon: 'Axe_Small' },
  { id: 'Sword', name: 'חרב', slot: 'weapon', rarity: 'rare', bonus: { atk: 5 }, move: 'slash', icon: 'Sword' },
  { id: 'Bow_Wooden', name: 'קשת עץ', slot: 'weapon', rarity: 'rare', bonus: { atk: 4, spd: 2 }, move: 'arrows', icon: 'Bow_Wooden' },
  { id: 'Hammer_Double', name: 'פטיש קרב', slot: 'weapon', rarity: 'epic', bonus: { atk: 7 }, move: 'smash', icon: 'Hammer_Double' },
  { id: 'Axe_Double', name: 'גרזן כפול', slot: 'weapon', rarity: 'epic', bonus: { atk: 7, def: 1 }, move: 'slash', icon: 'Axe_Double' },
  { id: 'Sword_Big', name: 'חרב ענק', slot: 'weapon', rarity: 'epic', bonus: { atk: 8 }, move: 'slash', icon: 'Sword_Big' },
  { id: 'Bow_Golden', name: 'קשת הזהב', slot: 'weapon', rarity: 'legendary', bonus: { atk: 8, spd: 3 }, move: 'arrows', icon: 'Bow_Golden' },
  { id: 'Hammer_Double_Golden', name: 'פטיש הרעם', slot: 'weapon', rarity: 'legendary', bonus: { atk: 10 }, move: 'thunder', icon: 'Hammer_Double_Golden' },
  { id: 'Sword_Golden', name: 'חרב הרעם', slot: 'weapon', rarity: 'legendary', bonus: { atk: 10, spd: 1 }, move: 'thunder', icon: 'Sword_Golden' },
  { id: 'Sword_Big_Golden', name: 'להב האגדה', slot: 'weapon', rarity: 'mythic', bonus: { atk: 13, spd: 2 }, move: 'thunder', icon: 'Sword_Big_Golden' },
  { id: 'Armor_Leather', name: 'שריון עור', slot: 'armor', rarity: 'common', bonus: { def: 3, hp: 8 }, icon: 'Armor_Leather' },
  { id: 'Armor_Metal', name: 'שריון ברזל', slot: 'armor', rarity: 'rare', bonus: { def: 5, hp: 12 }, icon: 'Armor_Metal' },
  { id: 'Armor_Metal2', name: 'שריון אבירים', slot: 'armor', rarity: 'epic', bonus: { def: 7, hp: 18 }, icon: 'Armor_Metal2' },
  { id: 'Armor_Black', name: 'שריון הצל', slot: 'armor', rarity: 'legendary', bonus: { def: 9, hp: 22, atk: 2 }, icon: 'Armor_Black' },
  { id: 'Armor_Golden', name: 'שריון הזהב', slot: 'armor', rarity: 'mythic', bonus: { def: 12, hp: 30 }, icon: 'Armor_Golden' },
  { id: 'Crown2', name: 'כתר נסיכים', slot: 'head', rarity: 'epic', bonus: { hp: 15, atk: 2 }, move: 'rage', icon: 'Crown2' },
  { id: 'Crown', name: 'כתר המלך', slot: 'head', rarity: 'legendary', bonus: { hp: 25, atk: 3, def: 2 }, move: 'rage', icon: 'Crown' },
  { id: 'Glove', name: 'כפפת כוח', slot: 'charm', rarity: 'common', bonus: { atk: 2 }, icon: 'Glove' },
  { id: 'Ring1', name: 'טבעת מהירות', slot: 'charm', rarity: 'rare', bonus: { spd: 3 }, icon: 'Ring1' },
  { id: 'Necklace1', name: 'שרשרת חיים', slot: 'charm', rarity: 'rare', bonus: { hp: 15 }, move: 'heal', icon: 'Necklace1' },
  { id: 'Ring3', name: 'טבעת הקרח', slot: 'charm', rarity: 'epic', bonus: { def: 3, spd: 2 }, move: 'shield', icon: 'Ring3' },
  { id: 'Necklace3', name: 'קמע הדרקון', slot: 'charm', rarity: 'legendary', bonus: { atk: 4, hp: 18 }, move: 'heal', icon: 'Necklace3' },
  { id: 'Crystal5', name: 'גביש הנצח', slot: 'charm', rarity: 'mythic', bonus: { atk: 5, def: 5, hp: 25, spd: 2 }, move: 'shield', icon: 'Crystal5' },
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
  { id: 1, name: 'יער הקסמים', colors: ['#14532D', '#22C55E'] as const, bg: 'world1', enemies: ['GreenDemon', 'Mushroom', 'Deer', 'Cactus', 'Tree'] as SpeciesId[], boss: 'Tree' as SpeciesId },
  { id: 2, name: 'חוף הסרטנים', colors: ['#0C4A6E', '#38BDF8'] as const, bg: 'world2', enemies: ['Crab', 'Penguin', 'Chicken', 'Pig', 'Bee'] as SpeciesId[], boss: 'Cthulhu' as SpeciesId },
  { id: 3, name: 'הר הגעש', colors: ['#7C2D12', '#F97316'] as const, bg: 'world3', enemies: ['Demon', 'Chicken', 'YellowDragon', 'Cyclops', 'Pig'] as SpeciesId[], boss: 'Cyclops' as SpeciesId },
  { id: 4, name: 'הפסגה הקפואה', colors: ['#1E3A8A', '#BAE6FD'] as const, bg: 'world4', enemies: ['Yeti', 'Penguin', 'Panda', 'Crab', 'Ghost'] as SpeciesId[], boss: 'Yeti' as SpeciesId },
  { id: 5, name: 'ממלכת הצללים', colors: ['#2E1065', '#A855F7'] as const, bg: 'world5', enemies: ['Skull', 'Bat', 'Ghost', 'Alien', 'Alien_Tall'] as SpeciesId[], boss: 'Alien_Tall' as SpeciesId },
];
export const STAGES_PER_WORLD = 50;
export const TOTAL_STAGES = WORLDS.length * STAGES_PER_WORLD;
