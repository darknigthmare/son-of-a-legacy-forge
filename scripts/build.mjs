import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const syncStandalone = process.argv.includes('--sync-standalone');
const standaloneName = 'PLAY_SON_OF_A_LEGACY_FORGE.html';
const scriptSources = [
  'src/data.js',
  'src/utils.js',
  'src/validation.js',
  'src/storage.js',
  'src/audio.js',
  'src/render.js',
  'src/fusion.js',
  'src/arena.js',
  'src/main.js'
];
const copiedFiles = [
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'sw.js'
];

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'src'), { recursive: true });

for (const relative of [...copiedFiles, ...scriptSources]) {
  await mkdir(dirname(join(dist, relative)), { recursive: true });
  await cp(join(root, relative), join(dist, relative));
}

const index = await readFile(join(root, 'index.html'), 'utf8');
const css = await readFile(join(root, 'styles.css'), 'utf8');
const icon = await readFile(join(root, 'icon.svg'), 'utf8');
let standalone = index
  .replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]+>\s*/i, '\n')
  .replace(/\s*<link rel="manifest"[^>]+>\s*/i, '\n')
  .replace(/<link rel="icon"[^>]+>/i, '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(icon) + '" type="image/svg+xml" />')
  .replace('<link rel="stylesheet" href="styles.css" />', '<style>\n' + css + '\n</style>');

for (const relative of scriptSources) {
  const source = (await readFile(join(root, relative), 'utf8')).replaceAll('</script', '<\\/script');
  standalone = standalone.replace(
    '<script defer src="' + relative + '"></script>',
    '<script>\n' + source + '\n</script>'
  );
}

if (/\ssrc="src\//.test(standalone) || /href="styles\.css"/.test(standalone)) {
  throw new Error('La génération autonome contient encore des dépendances externes.');
}

await writeFile(join(dist, standaloneName), standalone, 'utf8');
if (syncStandalone) await writeFile(join(root, standaloneName), standalone, 'utf8');

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const manifest = {};
for (const relative of [...copiedFiles, ...scriptSources, standaloneName]) {
  const content = await readFile(join(dist, relative));
  manifest[relative] = createHash('sha256').update(content).digest('hex');
}
await writeFile(
  join(dist, 'build-manifest.json'),
  JSON.stringify({ version: packageJson.version, files: manifest }, null, 2) + '\n'
);

console.log('Legacy Forge ' + packageJson.version + ' construit dans dist : ' + Object.keys(manifest).length + ' fichiers vérifiés.');
if (syncStandalone) console.log(standaloneName + ' synchronisé explicitement dans la racine.');
