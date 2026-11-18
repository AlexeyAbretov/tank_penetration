// Собирает отладочный APK и кладёт его в release.
// Имя файла — tank-penetration- и version из package.json.
// Capacitor компилирует Java 21: JDK 17 для этой команды не годится.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

// Старший номер из `java -version`. У Java 8 в строке 1.8, дальше — сразу 17, 21, 25.
function javaMajor(home) {
  const java = path.join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  if (!existsSync(java)) {
    return 0;
  }
  const result = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const match = text.match(/version "(\d+)(?:\.(\d+))?/);
  if (!match) {
    return 0;
  }
  const major = Number(match[1]);
  return major === 1 ? Number(match[2]) : major;
}

function jdkHomes() {
  const homes = [];
  if (process.env.JAVA_HOME) {
    homes.push(process.env.JAVA_HOME);
  }
  const programFiles = process.env['ProgramFiles'];
  if (programFiles) {
    homes.push(path.join(programFiles, 'Android', 'Android Studio', 'jbr'));
    for (const folder of ['Eclipse Adoptium', 'Java', 'Microsoft']) {
      const dir = path.join(programFiles, folder);
      if (!existsSync(dir)) {
        continue;
      }
      for (const name of readdirSync(dir)) {
        homes.push(path.join(dir, name));
      }
    }
  }
  return homes;
}

const jdk = jdkHomes().find((home) => javaMajor(home) >= 21);
if (!jdk) {
  console.error('Нужен JDK 21 или новее. Capacitor не собирается тем JDK, который сейчас в PATH.');
  process.exit(1);
}

const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '');

if (!sdk || !existsSync(sdk)) {
  console.error('Android SDK не найден. Поставьте Android Studio или задайте ANDROID_HOME.');
  process.exit(1);
}

// Gradle читает sdk.dir. Обратные слэши в properties — экранирование, поэтому прямые.
const sdkDir = sdk.replace(/\\/g, '/');
writeFileSync(path.join(root, 'android', 'local.properties'), `sdk.dir=${sdkDir}\n`, 'utf8');

const androidDir = path.join(root, 'android');
const gradleEnv = {
  ...process.env,
  JAVA_HOME: jdk,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
};
// cmd.exe /c, а не shell:true: иначе Node предупреждает, что аргументы склеиваются.
if (process.platform === 'win32') {
  execFileSync('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleDebug'], {
    cwd: androidDir,
    stdio: 'inherit',
    env: gradleEnv,
  });
} else {
  execFileSync(path.join(androidDir, 'gradlew'), ['assembleDebug'], {
    cwd: androidDir,
    stdio: 'inherit',
    env: gradleEnv,
  });
}

const built = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!existsSync(built)) {
  console.error(`Gradle не положил ${built}`);
  process.exit(1);
}

const outDir = path.join(root, 'release');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `tank-penetration-${version}.apk`);
copyFileSync(built, out);
console.log(out);
