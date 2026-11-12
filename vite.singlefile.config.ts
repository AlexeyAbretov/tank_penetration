// Отдельная сборка одного HTML. Обычный vite.config.ts и команды dev, build, preview её не читают.
// Готовый файл лежит в release/tank-penetration.html и открывается двойным кликом:
// браузер не ходит за скриптом, картинками, звуками и шрифтом, потому что они уже внутри страницы.
// npm run build:html:gift — тот же файл, но Vite ставит mode gift, и покупки в обоих магазинах стоят 1.
// Он называется tank-penetration-gift.html.
// npm run build:html:debug — дебаг-партия без адреса ?debug, файл tank-penetration-debug.html.
// Релиз на GitHub прикрепляет все три файла.

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
  ['assets/laser-hull.png', 'image/png'],
  ['assets/laser-turret.png', 'image/png'],
  ['assets/rocket-salvo.png', 'image/png'],
  ['assets/flame-hull.png', 'image/png'],
  ['assets/flame-turret.png', 'image/png'],
  ['assets/flame-patch.png', 'image/png'],
  ['assets/flame-stream.png', 'image/png'],
  ['assets/flame-scorch.png', 'image/png'],
  ['assets/tank-wreck.png', 'image/png'],
  ['assets/barbed-wire.png', 'image/png'],
  ['assets/tank-boom.png', 'image/png'],
  ['assets/nuke-boom.png', 'image/png'],
  ['assets/artillery-boom.png', 'image/png'],
  ['assets/bomb-boom.png', 'image/png'],
  ['assets/rocket-burst.png', 'image/png'],
  ['assets/nuclear-bomb.png', 'image/png'],
  ['assets/mine-body.png', 'image/png'],
  ['assets/mine-icon.png', 'image/png'],
  ['assets/artillery-icon.png', 'image/png'],
  ['assets/bomber.png', 'image/png'],
  ['assets/air-bomb.png', 'image/png'],
  ['assets/bomber-icon.png', 'image/png'],
  ['assets/ion-icon.png', 'image/png'],
  ['assets/ion-beam.png', 'image/png'],
  ['assets/energy-wall-icon.png', 'image/png'],
  ['assets/emp-flash-icon.png', 'image/png'],
  ['assets/emp-flash.png', 'image/png'],
  ['assets/auto-aim-icon.png', 'image/png'],
  ['assets/auto-fire-icon.png', 'image/png'],
  ['assets/auto-shop-icon.png', 'image/png'],
  ['assets/enemy-damage-icon.png', 'image/png'],
  ['assets/nuclear-icon.png', 'image/png'],
  ['assets/artillery-crater-0.png', 'image/png'],
  ['assets/artillery-crater-1.png', 'image/png'],
  ['assets/artillery-crater-2.png', 'image/png'],
  ['assets/artillery-crater-3.png', 'image/png'],
  ['assets/battlefield.jpg', 'image/jpeg'],
  ['assets/banner.png', 'image/png'],
  ['assets/coin-mark.png', 'image/png'],
  ['assets/score-mark.png', 'image/png'],
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
  ['assets/heavy-tank.png', 'image/png'],
  ['assets/heavy-tank-wreck.png', 'image/png'],
  ['assets/heavy-tank-gun.png', 'image/png'],
  ['assets/heavy-tank-shot.png', 'image/png'],
  ['assets/heavy-tank-shell.png', 'image/png'],
  ['assets/heavy-shell-burst.png', 'image/png'],
  ['assets/pickup-0.png', 'image/png'],
  ['assets/pickup-1.png', 'image/png'],
  ['assets/pickup-2.png', 'image/png'],
  ['assets/pickup-3.png', 'image/png'],
  ['assets/pickup-4.png', 'image/png'],
  ['assets/pickup-5.png', 'image/png'],
  ['assets/pickup-aim.png', 'image/png'],
  ['assets/pickup-gun.png', 'image/png'],
  ['assets/pickup-wreck.png', 'image/png'],
  ['assets/buggy-0.png', 'image/png'],
  ['assets/buggy-wreck.png', 'image/png'],
  ['assets/helicopter-spin.png', 'image/png'],
  ['assets/helicopter-gun.png', 'image/png'],
  ['assets/helicopter-wreck.png', 'image/png'],
  ['assets/drone-carrier.png', 'image/png'],
  ['assets/drone-carrier-wreck.png', 'image/png'],
  ['assets/btr.png', 'image/png'],
  ['assets/btr-gun.png', 'image/png'],
  ['assets/btr-wreck.png', 'image/png'],
  ['assets/strike-drone.png', 'image/png'],
  ['audio/TRACK_01.mp3', 'audio/mpeg'],
  ['audio/boss.mp3', 'audio/mpeg'],
  ['audio/tank_shot.mp3', 'audio/mpeg'],
  ['audio/tank_mg_shot.mp3', 'audio/mpeg'],
  ['audio/laserSmall_000.ogg', 'audio/ogg'],
  ['audio/ion_appear.ogg', 'audio/ogg'],
  ['audio/forceField_000.ogg', 'audio/ogg'],
  ['audio/lowFrequency_explosion_000.ogg', 'audio/ogg'],
  ['audio/thrusterFire_000.ogg', 'audio/ogg'],
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
  ['audio/rocket_burst.mp3', 'audio/mpeg'],
  ['audio/artillery_shot.mp3', 'audio/mpeg'],
  ['audio/artillery_explosion.mp3', 'audio/mpeg'],
  ['audio/nuclear_explosion.mp3', 'audio/mpeg'],
  ['audio/heavy-tank-boss-engine.mp3', 'audio/mpeg'],
  ['audio/heavy-tank-boss-tracks.mp3', 'audio/mpeg'],
  ['audio/drone-carrier-boss.wav', 'audio/wav'],
  ['fonts/russo-one-cyrillic.woff2', 'font/woff2'],
  ['fonts/russo-one-latin-ext.woff2', 'font/woff2'],
  ['fonts/russo-one-latin.woff2', 'font/woff2'],
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
function nameReleaseHtml(fileName: string, debug: boolean): Plugin {
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
      // Повторная сборка не чистит release/, и старый файл на Windows не даёт переименовать.
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
      const audioCount =
        page.split('data:audio/mpeg;base64,').length -
        1 +
        (page.split('data:audio/ogg;base64,').length - 1);
      const fontCount = page.split('data:font/woff2;base64,').length - 1;
      const googleFont = page.includes('fonts.googleapis.com') || page.includes('fonts.gstatic.com');
      const bodyInsideScript = /<\/body>/i.test(script);

      if (
        moduleAt === -1 ||
        externalScript ||
        stillModule ||
        looseFiles ||
        googleFont ||
        imageCount < 4 ||
        audioCount < 20 ||
        fontCount < 3
      ) {
        throw new Error(
          `release/${fileName} всё ещё зависит от внешнего скрипта, картинок танка, музыки или шрифта`,
        );
      }

      if (bodyInsideScript) {
        throw new Error(
          `release/${fileName} содержит </body> внутри скрипта: Live Server вставит туда свой код и сломает страницу`,
        );
      }

      // Ключ дебаг-партии остаётся строкой после минификации.
      // В файле для игроков и в подарочном его быть не должно: иначе дебаг-классы не выпали из бандла.
      const debugMarker = 'tank-penetration-combat:debug';
      const hasDebug = page.includes(debugMarker);
      if (debug !== hasDebug) {
        throw new Error(
          debug
            ? `release/${fileName} собран без дебаг-партии`
            : `release/${fileName} содержит дебаг-партию`,
        );
      }

      fs.writeFileSync(to, page);
    },
  };
}

export default defineConfig(({ mode }) => {
  const gift = mode === 'gift';
  const debug = mode === 'debug';
  const fileName = debug
    ? 'tank-penetration-debug.html'
    : gift
      ? 'tank-penetration-gift.html'
      : 'tank-penetration.html';

  return {
    // Картинки и музыку читает плагин выше. Копировать public/ рядом с HTML не нужно:
    // иначе релиз был бы папкой, а не одним файлом.
    publicDir: false,
    base: './',
    build: {
      outDir: 'release',
      // Обычная сборка чистит release/. Подарочная и дебаг оставляют соседние файлы на месте.
      emptyOutDir: !gift && !debug,
      target: 'es2022',
    },
    plugins: [
      inlinePackedFiles(),
      // Скрипт страницы вшивается в сам HTML. Загрузчик модулей Vite после этого не нужен:
      // ему нечего догружать, а с диска лишний запрос всё равно бы не прошёл.
      viteSingleFile({ removeViteModuleLoader: true }),
      nameReleaseHtml(fileName, debug),
    ],
  };
});
