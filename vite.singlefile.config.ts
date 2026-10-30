// Отдельная сборка одного HTML. Обычный vite.config.ts и команды dev, build, preview её не читают.
// Готовый файл лежит в release/tank-penetration.html и открывается двойным кликом:
// браузер не ходит за скриптом, картинками танка и музыкой, потому что они уже внутри страницы.
// npm run build:html:gift — тот же файл, но Vite ставит mode gift, и покупки в обоих магазинах стоят 1.
// Он называется tank-penetration-gift.html. Релиз на GitHub прикрепляет оба файла.

import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Те же пути, что GameScene.load берёт из public/.
const packedFiles = [
  ['assets/tank-hull.png', 'image/png'],
  ['assets/tank-turret.png', 'image/png'],
  ['assets/tank-gun.png', 'image/png'],
  ['assets/tank-mg.png', 'image/png'],
  ['assets/tank-wreck.png', 'image/png'],
  ['assets/barbed-wire.png', 'image/png'],
  ['assets/tank-boom.png', 'image/png'],
  ['assets/nuke-boom.png', 'image/png'],
  ['assets/artillery-boom.png', 'image/png'],
  ['assets/nuclear-bomb.png', 'image/png'],
  ['assets/artillery-crater-0.png', 'image/png'],
  ['assets/artillery-crater-1.png', 'image/png'],
  ['assets/artillery-crater-2.png', 'image/png'],
  ['assets/artillery-crater-3.png', 'image/png'],
  ['assets/battlefield.jpg', 'image/jpeg'],
  ['assets/infantry-0.png', 'image/png'],
  ['assets/infantry-1.png', 'image/png'],
  ['assets/infantry-2.png', 'image/png'],
  ['assets/infantry-3.png', 'image/png'],
  ['assets/infantry-4.png', 'image/png'],
  ['assets/infantry-5.png', 'image/png'],
  ['assets/infantry-corpse.png', 'image/png'],
  ['assets/gunner-0.png', 'image/png'],
  ['assets/gunner-1.png', 'image/png'],
  ['assets/gunner-2.png', 'image/png'],
  ['assets/gunner-3.png', 'image/png'],
  ['assets/gunner-4.png', 'image/png'],
  ['assets/gunner-5.png', 'image/png'],
  ['assets/gunner-aim.png', 'image/png'],
  ['assets/gunner-rifle.png', 'image/png'],
  ['assets/gunner-corpse.png', 'image/png'],
  ['assets/rocketman-0.png', 'image/png'],
  ['assets/rocketman-1.png', 'image/png'],
  ['assets/rocketman-2.png', 'image/png'],
  ['assets/rocketman-3.png', 'image/png'],
  ['assets/rocketman-4.png', 'image/png'],
  ['assets/rocketman-5.png', 'image/png'],
  ['assets/rocketman-aim.png', 'image/png'],
  ['assets/rocketman-launcher.png', 'image/png'],
  ['assets/rocketman-corpse.png', 'image/png'],
  ['assets/super-0.png', 'image/png'],
  ['assets/super-1.png', 'image/png'],
  ['assets/super-2.png', 'image/png'],
  ['assets/super-3.png', 'image/png'],
  ['assets/super-4.png', 'image/png'],
  ['assets/super-5.png', 'image/png'],
  ['assets/super-aim.png', 'image/png'],
  ['assets/super-gun.png', 'image/png'],
  ['assets/super-corpse.png', 'image/png'],
  ['audio/TRACK_01.mp3', 'audio/mpeg'],
  ['audio/boss.mp3', 'audio/mpeg'],
  ['audio/tank_shot.mp3', 'audio/mpeg'],
  ['audio/tank_mg_shot.mp3', 'audio/mpeg'],
  ['audio/gunner_shot.mp3', 'audio/mpeg'],
  ['audio/bullet_hit_tank.mp3', 'audio/mpeg'],
  ['audio/tank_dead.mp3', 'audio/mpeg'],
  ['audio/assault_explosion.mp3', 'audio/mpeg'],
  ['audio/pickup_exposion.mp3', 'audio/mpeg'],
  ['audio/infantry_dead0.mp3', 'audio/mpeg'],
  ['audio/infantry_dead1.mp3', 'audio/mpeg'],
  ['audio/impact0.mp3', 'audio/mpeg'],
  ['audio/impact1.mp3', 'audio/mpeg'],
  ['audio/impact2.mp3', 'audio/mpeg'],
  ['audio/rocket_shot.mp3', 'audio/mpeg'],
  ['audio/rocket_hit_tank.mp3', 'audio/mpeg'],
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

// Live Server ищет в файле первое `</body>` и вставляет перед ним свой <script>.
// В бандле Phaser эта последовательность стоит внутри строки, не в разметке страницы.
// Вставка попадает в середину скрипта, и браузер сообщает Invalid or unexpected token.
// \u003c — тот же символ «<», но букв </body> в тексте скрипта уже нет,
// поэтому сервер доходит до настоящего закрывающего тега.
function keepLiveServerOutOfScript(html: string): string {
  const scriptOpen = '<script>';
  const openAt = html.indexOf(scriptOpen);
  const closeAt = html.lastIndexOf('</script>');
  if (openAt === -1 || closeAt < openAt) {
    return html;
  }

  const jsAt = openAt + scriptOpen.length;
  const js = html.slice(jsAt, closeAt).replace(/<\/body>/gi, (match) => `\\u003c${match.slice(1)}`);
  return html.slice(0, jsAt) + js + html.slice(closeAt);
}

// Vite называет страницу index.html по имени входного файла.
// На релизе нужно другое имя, чтобы скачанный файл было видно среди ассетов.
function nameReleaseHtml(fileName: string): Plugin {
  return {
    name: 'name-release-html',
    apply: 'build',
    closeBundle() {
      const directory = path.resolve('release');
      const from = path.join(directory, 'index.html');
      if (!fs.existsSync(from)) {
        return;
      }

      const to = path.join(directory, fileName);
      // Повторная подарочная сборка не чистит release/, и старый файл на Windows не даёт переименовать.
      if (fs.existsSync(to)) {
        fs.unlinkSync(to);
      }
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
      const page = keepLiveServerOutOfScript(classic);
      const scriptOpen = '<script>';
      const scriptAt = page.indexOf(scriptOpen);
      const scriptCloseAt = page.lastIndexOf('</script>');
      const script =
        scriptAt === -1 || scriptCloseAt < scriptAt
          ? ''
          : page.slice(scriptAt + scriptOpen.length, scriptCloseAt);
      const externalScript = /<script\b[^>]*\bsrc=/i.test(page);
      const stillModule = page.includes(moduleTag);
      const looseFiles = packedFiles.some(([relativePath]) => page.includes(relativePath));
      const imageCount = page.split('data:image/png;base64,').length - 1;
      const audioCount = page.split('data:audio/mpeg;base64,').length - 1;
      const bodyInsideScript = /<\/body>/i.test(script);

      if (moduleAt === -1 || externalScript || stillModule || looseFiles || imageCount < 4 || audioCount < 16) {
        throw new Error(
          `release/${fileName} всё ещё зависит от внешнего скрипта, картинок танка или музыки`,
        );
      }

      if (bodyInsideScript) {
        throw new Error(
          `release/${fileName} содержит </body> внутри скрипта: Live Server вставит туда свой код и сломает страницу`,
        );
      }

      fs.writeFileSync(to, page);
    },
  };
}

export default defineConfig(({ mode }) => {
  const gift = mode === 'gift';
  const fileName = gift ? 'tank-penetration-gift.html' : 'tank-penetration.html';

  return {
    // Картинки и музыку читает плагин выше. Копировать public/ рядом с HTML не нужно:
    // иначе релиз был бы папкой, а не одним файлом.
    publicDir: false,
    base: './',
    build: {
      outDir: 'release',
      // Обычная сборка чистит release/. Подарочная оставляет tank-penetration.html на месте.
      emptyOutDir: !gift,
      target: 'es2022',
    },
    plugins: [
      inlinePackedFiles(),
      // Скрипт страницы вшивается в сам HTML. Загрузчик модулей Vite после этого не нужен:
      // ему нечего догружать, а с диска лишний запрос всё равно бы не прошёл.
      viteSingleFile({ removeViteModuleLoader: true }),
      nameReleaseHtml(fileName),
    ],
  };
});
