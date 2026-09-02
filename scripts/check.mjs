import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const testMode = process.argv.includes('--tests');

function collectTests(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectTests(absolute));
    else if (entry.isFile() && entry.name.endsWith('.test.mjs')) files.push(absolute);
  }
  return files.sort();
}

if (testMode) {
  const testFiles = collectTests(join(root, 'tests'));
  if (!testFiles.length) throw new Error('Gate refusé : aucun fichier *.test.mjs trouvé dans tests/.');

  const result = spawnSync(
    process.execPath,
    ['--test', '--test-reporter=tap', ...testFiles],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  const summaries = [...result.stdout.matchAll(/^# tests (\d+)$/gm)];
  const executed = summaries.length ? Number(summaries.at(-1)[1]) : 0;
  if (!Number.isFinite(executed) || executed < 1) {
    throw new Error('Gate refusé : le runner Node n’a exécuté aucun test.');
  }
  console.log(`${executed} tests exécutés depuis ${testFiles.length} fichier(s).`);
  process.exit(0);
}

const scripts = [
  'src/data.js', 'src/utils.js', 'src/validation.js', 'src/storage.js',
  'src/audio.js', 'src/render.js', 'src/fusion.js', 'src/arena.js', 'src/main.js',
  'sw.js', 'scripts/build.mjs', 'scripts/check.mjs'
];

for (const relative of scripts) {
  execFileSync(process.execPath, ['--check', join(root, relative)], { stdio: 'pipe' });
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const data = readFileSync(join(root, 'src/data.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const required = [
  'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'sw.js',
  'src/data.js', 'src/utils.js', 'src/validation.js', 'src/storage.js',
  'src/audio.js', 'src/render.js', 'src/fusion.js', 'src/arena.js', 'src/main.js'
];

for (const relative of required) {
  if (!existsSync(join(root, relative))) throw new Error('Référence manquante : ' + relative);
}
if (!data.includes("LF.VERSION = '" + pkg.version + "'")) throw new Error('Version package/data incohérente.');
if (!sw.includes('legacy-forge-v' + pkg.version)) throw new Error('Version package/cache incohérente.');
const shortVersion = pkg.version.split('.').slice(0, 2).join('.');
if (!html.includes('ÉDITION NAVIGATEUR ' + shortVersion)) throw new Error('Version footer incohérente.');
if (pkg.scripts.test !== 'node scripts/check.mjs --tests') throw new Error('Le gate test zéro n’est pas configuré.');
if (pkg.scripts['sync:standalone'] !== 'node scripts/build.mjs --sync-standalone') throw new Error('La synchronisation autonome n’est pas isolée.');
if (vercel.buildCommand !== 'npm run build') throw new Error('Commande de build Vercel incohérente.');
if (vercel.outputDirectory !== 'dist') throw new Error('Répertoire de sortie Vercel incohérent.');

console.log(scripts.length + ' scripts valides ; versions, références et chaîne Vercel cohérentes.');
