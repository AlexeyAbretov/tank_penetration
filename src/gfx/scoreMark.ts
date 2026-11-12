// Белый знак очков. Чёрное в файле — прозрачность.
// Счёт партии и магазин очков ставят его рядом с числом. Оба только вызывают.

import Phaser from 'phaser';

export const scoreMarkKey = 'score-mark';

export function preloadScoreMark(scene: Phaser.Scene): void {
  if (scene.textures.exists(scoreMarkKey)) {
    return;
  }
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  scene.load.image(scoreMarkKey, 'assets/score-mark.png');
}

// Ближайший пиксель: знак мелкий, сглаживание его размывает.
export function ensureScoreMark(scene: Phaser.Scene): void {
  if (!scene.textures.exists(scoreMarkKey)) {
    return;
  }
  scene.textures.get(scoreMarkKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
}
