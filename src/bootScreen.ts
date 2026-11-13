// Полоса до первого кадра. Её рисует index.html, чтобы она была видна до скрипта.
// Процент — доля очереди Phaser. Пока очередь молчит, полоса едет сама:
// страница и шрифт ещё не отчитались. restart() сцены полосу не возвращает.

import Phaser from 'phaser';
import { t } from './locale';

const SCENE_KEY = 'game';

let shown = 0;
let hidden = false;

// Ноль не переключает полосу на процент: очередь ещё не начала отвечать.
export function showBootProgress(fraction: number): void {
  if (hidden) {
    return;
  }
  const bar = document.getElementById('boot-fill');
  const label = document.getElementById('boot-label');
  const rail = document.getElementById('boot-track');
  if (!bar || !label || !rail) {
    return;
  }
  const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  if (pct <= 0 || pct <= shown) {
    return;
  }
  shown = pct;
  rail.classList.add('is-known');
  bar.style.width = `${pct}%`;
  const text = t().boot.progress(pct);
  label.textContent = text;
  rail.setAttribute('aria-valuenow', String(pct));
  rail.setAttribute('aria-valuetext', text);
}

// До первого кадра: сохранённый язык уже на полосе, пока Phaser ещё молчит.
export function paintBootLabel(): void {
  const label = document.getElementById('boot-label');
  const rail = document.getElementById('boot-track');
  const text = t().boot.label;
  if (label) {
    label.textContent = text;
  }
  rail?.setAttribute('aria-label', text);
}

export function hideBootScreen(): void {
  const boot = document.getElementById('boot');
  if (!boot || hidden) {
    return;
  }
  hidden = true;
  boot.classList.add('is-done');
  const remove = (): void => {
    boot.remove();
  };
  boot.addEventListener('transitionend', remove, { once: true });
  window.setTimeout(remove, 500);
}

// postBoot: сцена уже в очереди файлов, первый кадр ещё не нарисован.
export function watchBootProgress(game: Phaser.Game): void {
  const scene = game.scene.getScene(SCENE_KEY);
  if (!scene) {
    hideBootScreen();
    return;
  }

  const onProgress = (value: number): void => {
    showBootProgress(value);
  };
  scene.load.on(Phaser.Loader.Events.PROGRESS, onProgress);
  showBootProgress(scene.load.progress);

  const finish = (): void => {
    scene.load.off(Phaser.Loader.Events.PROGRESS, onProgress);
    showBootProgress(1);
    // Снять после отрисовки: иначе на кадр вспыхнет пустой холст.
    game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      hideBootScreen();
    });
  };

  if (scene.scene.isActive()) {
    finish();
    return;
  }

  scene.events.once(Phaser.Scenes.Events.CREATE, finish);
}
