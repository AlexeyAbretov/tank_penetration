// Разрыв сбитой ракеты в воздухе: девятнадцать кадров public/assets/rocket-burst.png в ряд.
// Вспышка в центре кадра. Точка — место ракеты в момент сбития.

import Phaser from 'phaser';

export const airBurst = {
  frame: { w: 100, h: 88 },
  frames: 19,
  animKey: 'air-burst',
  sheetKey: 'air-burst',
  // Ролик мелкий относительно ракеты. На поле тот же кадр, вдвое крупнее.
  display: 2,
  // Как в исходном ролике: 50 мс на кадр.
  frameMs: 50,
};

// Путь буквальный: singlefile-сборка подменяет его на data:.
export const airBurstSheetPath = 'assets/rocket-burst.png';

export function preloadAirBurst(scene: Phaser.Scene): void {
  if (scene.textures.exists(airBurst.sheetKey)) {
    const first = scene.textures.get(airBurst.sheetKey).get(0);
    if (first.width === airBurst.frame.w && first.height === airBurst.frame.h) {
      return;
    }
    scene.textures.remove(airBurst.sheetKey);
  }
  scene.load.spritesheet(airBurst.sheetKey, airBurstSheetPath, {
    frameWidth: airBurst.frame.w,
    frameHeight: airBurst.frame.h,
  });
}

export function ensureAirBurst(scene: Phaser.Scene): void {
  if (!scene.textures.exists(airBurst.sheetKey)) {
    return;
  }
  scene.textures.get(airBurst.sheetKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  if (scene.anims.exists(airBurst.animKey)) {
    return;
  }
  scene.anims.create({
    key: airBurst.animKey,
    frames: Array.from({ length: airBurst.frames }, (_, frame) => ({
      key: airBurst.sheetKey,
      frame,
      duration: airBurst.frameMs,
    })),
    repeat: 0,
  });
}

export function airBurstAt(scene: Phaser.Scene, x: number, y: number): void {
  ensureAirBurst(scene);
  if (!scene.textures.exists(airBurst.sheetKey)) {
    return;
  }
  const sprite = scene.add
    .sprite(x, y, airBurst.sheetKey, 0)
    .setOrigin(0.5, 0.5)
    .setDepth(27)
    .setScale(airBurst.display);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  sprite.play(airBurst.animKey);
}
