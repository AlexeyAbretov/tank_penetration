// Разрыв авиабомбы у земли: тридцать два кадра public/assets/bomb-boom.png в ряд.
// Пыль кадров стоит на одной строке, вспышка растёт вверх. Точка — земля под вспышкой.
// Воронку кладёт вызывающий код. Ролик играет только бомбардировщик.

import Phaser from 'phaser';

const frames = 32;
const frameMs = 100;

export const bombBoom = {
  frame: { w: 224, h: 216 },
  frames,
  animKey: 'bomb-boom',
  sheetKey: 'bomb-boom',
  // Как в исходном ролике: 10 кадров в секунду.
  frameMs,
  // Нижняя пыль на строке 190, не на краю холста 216.
  originY: 190 / 216,
  goneMs: frames * frameMs,
};

// Путь буквальный: singlefile-сборка подменяет его на data:.
export const bombBoomSheetPath = 'assets/bomb-boom.png';

export function preloadBombBoom(scene: Phaser.Scene): void {
  if (scene.textures.exists(bombBoom.sheetKey)) {
    const first = scene.textures.get(bombBoom.sheetKey).get(0);
    if (first.width === bombBoom.frame.w && first.height === bombBoom.frame.h) {
      return;
    }
    scene.textures.remove(bombBoom.sheetKey);
  }
  scene.load.spritesheet(bombBoom.sheetKey, bombBoomSheetPath, {
    frameWidth: bombBoom.frame.w,
    frameHeight: bombBoom.frame.h,
  });
}

export function ensureBombBoom(scene: Phaser.Scene): void {
  if (!scene.textures.exists(bombBoom.sheetKey)) {
    return;
  }
  scene.textures.get(bombBoom.sheetKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  if (scene.anims.exists(bombBoom.animKey)) {
    return;
  }
  scene.anims.create({
    key: bombBoom.animKey,
    frames: Array.from({ length: bombBoom.frames }, (_, frame) => ({
      key: bombBoom.sheetKey,
      frame,
      duration: bombBoom.frameMs,
    })),
    repeat: 0,
  });
}

export function bombBoomAt(scene: Phaser.Scene, x: number, y: number): void {
  ensureBombBoom(scene);
  if (!scene.textures.exists(bombBoom.sheetKey)) {
    return;
  }
  const sprite = scene.add
    .sprite(x, y, bombBoom.sheetKey, 0)
    .setOrigin(0.5, bombBoom.originY)
    .setDepth(18);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  sprite.play(bombBoom.animKey);
}
