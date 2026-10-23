// Metro config: the default Expo setup, plus 3D model files (.glb) bundled as assets for the 3D arena.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb', 'gltf');

module.exports = config;
