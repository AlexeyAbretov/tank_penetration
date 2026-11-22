// Публикует окно WebView2 и кладёт exe в release.
// Имя файла — tank-penetration-webview- и version из package.json.
// На машине сборки нужен .NET SDK 8. Рантайм .NET вшивается в exe.
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
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

const project = path.join(root, 'webview', 'TankPenetration.csproj');
const www = path.join(root, 'webview', 'www');
rmSync(www, { recursive: true, force: true });
cpSync(path.join(root, 'dist'), www, { recursive: true });
writeWindowsIcon(path.join(root, 'public', 'icons', 'icon-512.png'), path.join(root, 'webview', 'icon.ico'));

const outDir = path.join(root, 'build', 'webview');
rmSync(outDir, { recursive: true, force: true });

const publishArgs = [
  'publish',
  project,
  '-c', 'Release',
  '-r', 'win-x64',
  '--self-contained', 'true',
  '-p:PublishSingleFile=true',
  '-p:IncludeNativeLibrariesForSelfExtract=true',
  '-p:IncludeAllContentForSelfExtract=true',
  '-p:EnableCompressionInSingleFile=true',
  '-p:DebugType=none',
  '-p:DebugSymbols=false',
  '-p:IncludeSourceRevisionInInformationalVersion=false',
  `-p:Version=${version}`,
  '-o', outDir,
];

// Системный прокси иногда отвечает 407 без логина, хотя прямой HTTPS до NuGet открыт.
// Свой HTTP_PROXY уводит .NET с того прокси. Хосты NuGet в NO_PROXY идут напрямую.
function nugetDirectEnv() {
  const previous = process.env.NO_PROXY || process.env.no_proxy || '';
  const noProxy = [...previous.split(','), 'api.nuget.org', '.nuget.org', 'nuget.org', 'globalcdn.nuget.org']
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',');
  const dead = 'http://127.0.0.1:9';
  return {
    HTTP_PROXY: dead,
    HTTPS_PROXY: dead,
    ALL_PROXY: dead,
    NO_PROXY: noProxy,
  };
}

function publish(env, pipe) {
  return spawnSync('dotnet', publishArgs, {
    cwd: root,
    env,
    stdio: pipe ? 'pipe' : 'inherit',
    encoding: pipe ? 'utf8' : undefined,
  });
}

let published = publish(process.env, true);
const publishLog = `${published.stdout ?? ''}${published.stderr ?? ''}`;
if (published.status !== 0 && publishLog.includes('NU1301')) {
  process.stderr.write(publishLog);
  console.error('NuGet через системный прокси не открылся. Повторяю напрямую.');
  published = publish({ ...process.env, ...nugetDirectEnv() }, false);
} else {
  if (published.stdout) {
    process.stdout.write(published.stdout);
  }
  if (published.stderr) {
    process.stderr.write(published.stderr);
  }
}
if (published.status !== 0) {
  process.exit(published.status ?? 1);
}

const built = path.join(outDir, 'tank-penetration.exe');
if (!existsSync(built)) {
  console.error(`dotnet не положил ${built}`);
  process.exit(1);
}

const releaseDir = path.join(root, 'release');
mkdirSync(releaseDir, { recursive: true });
const out = path.join(releaseDir, `tank-penetration-webview-${version}.exe`);
copyFileSync(built, out);
console.log(out);
