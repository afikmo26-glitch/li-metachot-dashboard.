const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'tools/**'] },
  {
    // react-three-fiber: JSX props are three.js object props, and frame loops mutate three.js objects in place by design
    files: ['src/arena3d/**'],
    rules: {
      'react/no-unknown-property': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
