import { build } from 'esbuild';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { refinedModelURL } from './src/model-asset.mjs';
const model = await readFile(refinedModelURL);
await writeFile('assets/cave61/interior-model.offline.js',
  `/* Generated from the same GLB for direct file opening. */\nwindow.__qianbiModelBase64='${model.toString('base64')}';\n`);
await build({
  entryPoints: ['src/gallery.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  loader: { '.webp': 'dataurl', '.jpg': 'dataurl' },
  outfile: 'gallery.bundle.js',
  legalComments: 'linked'
});
await copyFile('node_modules/three/LICENSE', 'THREE-LICENSE.txt');
console.log('洞窟原位构视已打包，可直接打开 index.html。');
