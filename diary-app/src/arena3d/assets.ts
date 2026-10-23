/**
 * The 3D arena's models: KayKit "Adventurers", "Skeletons" and "Mini-Game Variety Pack" by Kay Lousberg (CC0).
 * See assets/game/CREDITS.md.
 */

export type HeroId = 'Knight' | 'Barbarian' | 'Mage' | 'Ranger' | 'Rogue' | 'Rogue_Hooded' | 'Skeleton_Warrior' | 'Skeleton_Mage' | 'Skeleton_Rogue' | 'Skeleton_Minion';

export const HERO_MODELS: Record<HeroId, number> = {
  Knight: require('../../assets/game3d/chars/Knight.glb'),
  Barbarian: require('../../assets/game3d/chars/Barbarian.glb'),
  Mage: require('../../assets/game3d/chars/Mage.glb'),
  Ranger: require('../../assets/game3d/chars/Ranger.glb'),
  Rogue: require('../../assets/game3d/chars/Rogue.glb'),
  Rogue_Hooded: require('../../assets/game3d/chars/Rogue_Hooded.glb'),
  Skeleton_Warrior: require('../../assets/game3d/chars/Skeleton_Warrior.glb'),
  Skeleton_Mage: require('../../assets/game3d/chars/Skeleton_Mage.glb'),
  Skeleton_Rogue: require('../../assets/game3d/chars/Skeleton_Rogue.glb'),
  Skeleton_Minion: require('../../assets/game3d/chars/Skeleton_Minion.glb'),
};

export const ANIM_FILES = [require('../../assets/game3d/anims/general.glb'), require('../../assets/game3d/anims/movement.glb')];

export const WEAPONS = {
  sword_1handed: require('../../assets/game3d/weapons/sword_1handed.glb'),
  shield_badge_color: require('../../assets/game3d/weapons/shield_badge_color.glb'),
  axe_2handed: require('../../assets/game3d/weapons/axe_2handed.glb'),
  shield_round_barbarian: require('../../assets/game3d/weapons/shield_round_barbarian.glb'),
  staff: require('../../assets/game3d/weapons/staff.glb'),
  spellbook_open: require('../../assets/game3d/weapons/spellbook_open.glb'),
  bow_withString: require('../../assets/game3d/weapons/bow_withString.glb'),
  dagger: require('../../assets/game3d/weapons/dagger.glb'),
  crossbow_1handed: require('../../assets/game3d/weapons/crossbow_1handed.glb'),
  Skeleton_Blade: require('../../assets/game3d/weapons/Skeleton_Blade.glb'),
  Skeleton_Shield_Small_A: require('../../assets/game3d/weapons/Skeleton_Shield_Small_A.glb'),
  Skeleton_Staff: require('../../assets/game3d/weapons/Skeleton_Staff.glb'),
  Skeleton_Axe: require('../../assets/game3d/weapons/Skeleton_Axe.glb'),
} as const;
export type WeaponId = keyof typeof WEAPONS;

/** What each hero holds in the right and left hand. */
export const LOADOUT: Record<HeroId, { r?: WeaponId; l?: WeaponId }> = {
  Knight: { r: 'sword_1handed', l: 'shield_badge_color' },
  Barbarian: { r: 'axe_2handed', l: 'shield_round_barbarian' },
  Mage: { r: 'staff', l: 'spellbook_open' },
  Ranger: { l: 'bow_withString', r: 'dagger' },
  Rogue: { r: 'dagger', l: 'dagger' },
  Rogue_Hooded: { r: 'crossbow_1handed', l: 'dagger' },
  Skeleton_Warrior: { r: 'Skeleton_Blade', l: 'Skeleton_Shield_Small_A' },
  Skeleton_Mage: { r: 'Skeleton_Staff' },
  Skeleton_Rogue: { r: 'Skeleton_Axe' },
  Skeleton_Minion: { r: 'Skeleton_Axe' },
};

export const ARENA = {
  tileForest: require('../../assets/game3d/arena/tileLarge_forest.glb'),
  tileBlue: require('../../assets/game3d/arena/tileLarge_teamBlue.glb'),
  tileRed: require('../../assets/game3d/arena/tileLarge_teamRed.glb'),
  tree: require('../../assets/game3d/arena/tree_forest.glb'),
  rocksA: require('../../assets/game3d/arena/rocksA_forest.glb'),
  rocksB: require('../../assets/game3d/arena/rocksB_forest.glb'),
  plantA: require('../../assets/game3d/arena/plantA_forest.glb'),
  plantB: require('../../assets/game3d/arena/plantB_forest.glb'),
  barrier: require('../../assets/game3d/arena/barrierMedium.glb'),
  flagBlue: require('../../assets/game3d/arena/flag_teamBlue.glb'),
  flagRed: require('../../assets/game3d/arena/flag_teamRed.glb'),
  gateBlue: require('../../assets/game3d/arena/gateLarge_teamBlue.glb'),
  gateRed: require('../../assets/game3d/arena/gateLarge_teamRed.glb'),
  detail: require('../../assets/game3d/arena/detail_forest.glb'),
  star: require('../../assets/game3d/arena/star.glb'),
};

/** Which hero stands in for each element in the 3D arena (until every fighter has its own model). */
export const HERO_FOR_ELEMENT: Record<string, HeroId> = {
  fire: 'Barbarian',
  water: 'Mage',
  nature: 'Ranger',
  earth: 'Knight',
  storm: 'Rogue_Hooded',
  shadow: 'Rogue',
};
export const SKELETON_FOR_ELEMENT: Record<string, HeroId> = {
  fire: 'Skeleton_Warrior',
  water: 'Skeleton_Mage',
  nature: 'Skeleton_Minion',
  earth: 'Skeleton_Warrior',
  storm: 'Skeleton_Rogue',
  shadow: 'Skeleton_Mage',
};
