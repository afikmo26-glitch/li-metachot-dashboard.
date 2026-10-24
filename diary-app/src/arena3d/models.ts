/**
 * Live 3D fighters: Tripo3D models made from the game's own illustrations, auto-rigged, all sharing one set
 * of fight animations (bought once, copied onto every biped skeleton). Generated; do not edit by hand.
 */
export const MODELS3D: Record<string, number> = {
  boss_gorilla: require('../../assets/sim3d/boss_gorilla.glb'),
  boss_lavadragon: require('../../assets/sim3d/boss_lavadragon.glb'),
  boss_shadowking: require('../../assets/sim3d/boss_shadowking.glb'),
  boss_thunderbird: require('../../assets/sim3d/boss_thunderbird.glb'),
  dragon: require('../../assets/sim3d/dragon.glb'),
  dragon_gold: require('../../assets/sim3d/dragon_gold.glb'),
  eagle: require('../../assets/sim3d/eagle.glb'),
  fox: require('../../assets/sim3d/fox.glb'),
  frog: require('../../assets/sim3d/frog.glb'),
  panda: require('../../assets/sim3d/panda.glb'),
  penguin: require('../../assets/sim3d/penguin.glb'),
  raven: require('../../assets/sim3d/raven.glb'),
  rhino: require('../../assets/sim3d/rhino.glb'),
  shark: require('../../assets/sim3d/shark.glb'),
  wolf: require('../../assets/sim3d/wolf.glb'),
};

/** Each model's colours, kept as a plain image next to it (phones load these more reliably than textures packed in the .glb). */
export const TEX3D: Record<string, number> = {
  boss_gorilla: require('../../assets/sim3d/boss_gorilla.jpg'),
  boss_lavadragon: require('../../assets/sim3d/boss_lavadragon.jpg'),
  boss_shadowking: require('../../assets/sim3d/boss_shadowking.jpg'),
  boss_thunderbird: require('../../assets/sim3d/boss_thunderbird.jpg'),
  dragon: require('../../assets/sim3d/dragon.jpg'),
  dragon_gold: require('../../assets/sim3d/dragon_gold.jpg'),
  eagle: require('../../assets/sim3d/eagle.jpg'),
  fox: require('../../assets/sim3d/fox.jpg'),
  frog: require('../../assets/sim3d/frog.jpg'),
  panda: require('../../assets/sim3d/panda.jpg'),
  penguin: require('../../assets/sim3d/penguin.jpg'),
  raven: require('../../assets/sim3d/raven.jpg'),
  rhino: require('../../assets/sim3d/rhino.jpg'),
  shark: require('../../assets/sim3d/shark.jpg'),
  wolf: require('../../assets/sim3d/wolf.jpg'),
};
