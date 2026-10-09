// Отдельная сборка одного HTML. Обычный vite.config.ts и команды dev, build, preview её не читают.
// Готовый файл лежит в release/tank-defense.html и открывается двойным кликом:
// браузер не ходит за скриптом, картинками танка и музыкой, потому что они уже внутри страницы.

import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Те же пути, что GameScene.load берёт из public/. Студия в эту сборку не входит.
const packedFiles = [
  ['assets/tank-hull.png', 'image/png'],
  ['assets/tank-turret.png', 'image/png'],
  ['assets/tank-gun.png', 'image/png'],
  ['assets/tank-mg.png', 'image/png'],
  ['audio/TRACK_01.mp3', 'audio/mpeg'],
  ['audio/boss.mp3', 'audio/mpeg'],
  ['audio/tank_shot.mp3', 'audio/mpeg'],
  ['audio/tank_mg_shot.mp3', 'audio/mpeg'],
  ['audio/tank_dead.mp3', 'audio/mpeg'],
  ['audio/assault_explosion.mp3', 'audio/mpeg'],
  ['audio/infantry_dead0.mp3', 'audio/mpeg'],
  ['audio/infantry_dead1.mp3', 'audio/mpeg'],
  ['audio/impact0.mp3', 'audio/mpeg'],
  ['audio/impact1.mp3', 'audio/mpeg'],
  ['audio/impact2.mp3', 'audio/mpeg'],
] as const;

// Phaser сам понимает адрес data: и не ходит за файлом.
// Подмена только в этой сборке: исходники и обычный npm run build по-прежнему грузят public/.
function inlinePackedFiles(): Plugin {
  const dataUrls = new Map<string, string>();
  let replaced = 0;

  return {
    name: 'inline-packed-files',
    apply: 'build',
    // До транспиляции TypeScript: иначе кавычки вокруг пути уже другие, и строка не находится.
    enforce: 'pre',
    buildStart() {
      replaced = 0;
      for (const [relativePath, mime] of packedFiles) {
        const filePath = path.resolve('public', relativePath);
        const base64 = fs.readFileSync(filePath).toString('base64');
        dataUrls.set(relativePath, `data:${mime};base64,${base64}`);
      }
    },
    transform(code, id) {
      if (!id.endsWith('.ts')) {
        return null;
      }

      let next = code;
      for (const [relativePath, dataUrl] of dataUrls) {
        for (const quote of ["'", '"'] as const) {
          const needle = `${quote}${relativePath}${quote}`;
          const hits = next.split(needle).length - 1;
          if (hits === 0) {
            continue;
          }
          replaced += hits;
          next = next.replaceAll(needle, `${quote}${dataUrl}${quote}`);
        }
      }

      if (next === code) {
        return null;
      }

      return next;
    },
    generateBundle() {
      if (replaced !== packedFiles.length) {
        throw new Error(
          `В сборку попало ${replaced} файлов из public/, ожидалось ${packedFiles.length}`,
        );
      }
    },
  };
}

// Vite называет страницу index.html по имени входного файла.
// На релизе нужно другое имя, чтобы скачанный файл было видно среди ассетов.
function nameReleaseHtml(): Plugin {
  return {
    name: 'name-release-html',
    apply: 'build',
    closeBundle() {
      const directory = path.resolve('release');
      const from = path.join(directory, 'index.html');
      if (!fs.existsSync(from)) {
        return;
      }

      const to = path.join(directory, 'tank-defense.html');
      fs.renameSync(from, to);

      const html = fs.readFileSync(to, 'utf8');
      // Firefox не выполняет <script type="module"> у файла, открытого двойным кликом:
      // даже вшитый модуль он пытается загрузить по адресу file: и блокирует страницу.
      // Сборка уже один кусок без import, поэтому тег можно сделать обычным скриптом.
      const moduleTag = '<script type="module">';
      const moduleAt = html.indexOf(moduleTag);
      const classic =
        moduleAt === -1
          ? html
          : html.slice(0, moduleAt) + '<script>' + html.slice(moduleAt + moduleTag.length);
      const externalScript = /<script\b[^>]*\bsrc=/i.test(classic);
      const stillModule = classic.includes(moduleTag);
      const looseFiles = packedFiles.some(([relativePath]) => classic.includes(relativePath));
      const imageCount = classic.split('data:image/png;base64,').length - 1;
      const audioCount = classic.split('data:audio/mpeg;base64,').length - 1;

      if (moduleAt === -1 || externalScript || stillModule || looseFiles || imageCount < 4 || audioCount < 11) {
        throw new Error(
          'release/tank-defense.html всё ещё зависит от внешнего скрипта, картинок танка или музыки',
        );
      }

      fs.writeFileSync(to, classic);
    },
  };
}

export default defineConfig({
  // Картинки и музыку читает плагин выше. Копировать public/ рядом с HTML не нужно:
  // иначе релиз был бы папкой, а не одним файлом.
  publicDir: false,
  base: './',
  build: {
    outDir: 'release',
    emptyOutDir: true,
    target: 'es2022',
  },
  plugins: [
    inlinePackedFiles(),
    // Скрипт страницы вшивается в сам HTML. Загрузчик модулей Vite после этого не нужен:
    // ему нечего догружать, а с диска лишний запрос всё равно бы не прошёл.
    viteSingleFile({ removeViteModuleLoader: true }),
    nameReleaseHtml(),
  ],
});
