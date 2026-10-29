// Bundles the TypeScript engine into one readable ES module the app loads directly.
// Run after changing anything in src/:  npm install && npm test && npm run build
import { build } from 'esbuild';
await build({
  entryPoints: ['src/index.ts'], bundle: true, format: 'esm', target: 'es2020', minify: false,
  outfile: '../js/future/engine.js', legalComments: 'none',
  banner: { js: '/* GENERATED from future-engine/src by future-engine/build.mjs — edit the TypeScript, not this file. */' },
});
console.log('wrote js/future/engine.js');
