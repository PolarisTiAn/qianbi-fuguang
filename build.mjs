import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
await build({
  entryPoints: ['src/gallery.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  loader: { '.webp': 'dataurl' },
  outfile: 'gallery.bundle.js',
  legalComments: 'linked'
});
await copyFile('node_modules/three/LICENSE', 'THREE-LICENSE.txt');
console.log('洞窟原位构视已打包，可直接打开 index.html。');
