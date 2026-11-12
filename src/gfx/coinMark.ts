// Белый знак монеты. Чёрное в файле — прозрачность.
// Счёт партии и магазин волны ставят его рядом с числом. Оба только вызывают.

import Phaser from 'phaser';

export const coinMarkKey = 'coin-mark';

export function preloadCoinMark(scene: Phaser.Scene): void {
  if (scene.textures.exists(coinMarkKey)) {
    return;
  }
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  scene.load.image(coinMarkKey, 'assets/coin-mark.png');
}

// Ближайший пиксель: знак мелкий, сглаживание его размывает.
export function ensureCoinMark(scene: Phaser.Scene): void {
  if (!scene.textures.exists(coinMarkKey)) {
    return;
  }
  scene.textures.get(coinMarkKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
}
