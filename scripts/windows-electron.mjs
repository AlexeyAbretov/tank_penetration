// Упаковывает окно Electron и кладёт exe в release.
// Имя файла — tank-penetration-electron- и version из package.json.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeWindowsIcon } from './windows-icon.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

const index = path.join(root, 'dist', 'index.html');
if (!existsSync(index)) {
  console.error('Нет dist/index.html. Сначала нужна сборка desktop.');
  process.exit(1);
}

writeWindowsIcon(path.join(root, 'public', 'icons', 'icon-512.png'), path.join(root, 'build', 'icon.ico'));

const outDir = path.join(root, 'build', 'electron');
rmSync(outDir, { recursive: true, force: true });

const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');
if (!existsSync(cli)) {
  console.error('Нет electron-builder. Поставьте зависимости: npm install.');
  process.exit(1);
}

// Подпись не ищем: сертификата разработчика Windows у сборки нет.
execFileSync(process.execPath, [cli, '--win', 'portable', '--config', 'electron/builder.yml'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
});

const exes = existsSync(outDir) ? readdirSync(outDir).filter((name) => name.endsWith('.exe')) : [];
if (exes.length !== 1) {
  console.error(`Ожидался один exe в ${outDir}, нашлось: ${exes.join(', ') || 'ничего'}`);
  process.exit(1);
}

const releaseDir = path.join(root, 'release');
mkdirSync(releaseDir, { recursive: true });
const out = path.join(releaseDir, `tank-penetration-electron-${version}.exe`);
copyFileSync(path.join(outDir, exes[0]), out);
console.log(out);
