// Отдельная сборка одного HTML. Обычный vite.config.ts и команды dev, build, preview её не читают.
// Готовый файл лежит в release/tank-defense.html и открывается двойным кликом:
// браузер не ходит за скриптом и картинками танка, потому что они уже внутри страницы.

import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Те же пути, что GameScene.load.image берёт из public/. Студия в эту сборку не входит.
const tankImages = [
  'assets/tank-hull.png',
  'assets/tank-turret.png',
  'assets/tank-gun.png',
  'assets/tank-mg.png',
] as const;

// Phaser сам понимает адрес data:image и рисует картинку без запроса к диску.
// Подмена только в этой сборке: исходники и обычный npm run build по-прежнему грузят png из public/.
function inlineTankImages(): Plugin {
  const dataUrls = new Map<string, string>();
  let replaced = 0;

  return {
    name: 'inline-tank-images',
    apply: 'build',
    // До транспиляции TypeScript: иначе кавычки вокруг пути уже другие, и строка не находится.
    enforce: 'pre',
    buildStart() {
      replaced = 0;
      for (const relativePath of tankImages) {
        const filePath = path.resolve('public', relativePath);
        const base64 = fs.readFileSync(filePath).toString('base64');
        dataUrls.set(relativePath, `data:image/png;base64,${base64}`);
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
      if (replaced !== tankImages.length) {
        throw new Error(
          `В сборку попало ${replaced} картинок танка, ожидалось ${tankImages.length}`,
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
      const inlinedImages = tankImages.every((relativePath) => !classic.includes(relativePath));
      const imageCount = classic.split('data:image/png;base64,').length - 1;

      if (moduleAt === -1 || externalScript || stillModule || !inlinedImages || imageCount < tankImages.length) {
        throw new Error(
          'release/tank-defense.html всё ещё зависит от внешнего скрипта или картинок танка',
        );
      }

      fs.writeFileSync(to, classic);
    },
  };
}

export default defineConfig({
  // Картинки читает плагин выше. Копировать public/ рядом с HTML не нужно:
  // иначе релиз был бы папкой, а не одним файлом.
  publicDir: false,
  base: './',
  build: {
    outDir: 'release',
    emptyOutDir: true,
    target: 'es2022',
  },
  plugins: [
    inlineTankImages(),
    // Скрипт страницы вшивается в сам HTML. Загрузчик модулей Vite после этого не нужен:
    // ему нечего догружать, а с диска лишний запрос всё равно бы не прошёл.
    viteSingleFile({ removeViteModuleLoader: true }),
    nameReleaseHtml(),
  ],
});
