// Разрыв у земли: четыре кадра public/assets/artillery-boom.png в ряд.
// Пыль всех кадров стоит на одной линии снизу, столб растёт вверх.
// Точка — земля под вспышкой. Воронку кладёт вызывающий код.
// Кадры общие: их играет и снаряд, и мина.

import Phaser from 'phaser';

export const boom = {
  // Кадр листа 680×180 → 4×1. На поле чуть крупнее воронки, меньше гриба.
  display: 1.2,
  frame: { w: 170, h: 180 },
  frames: 4,
  animKey: 'boom',
  sheetKey: 'boom',
  // Вспышка, огонь со столбом, тёмный дым, рассеивание.
  holdMs: [90, 140, 200, 340],
  fadeMs: 420,
};

// Путь буквальный: singlefile-сборка подменяет его на data:.
export const boomSheetPath = 'assets/artillery-boom.png';

export function preloadBoom(scene: Phaser.Scene): void {
  if (scene.textures.exists(boom.sheetKey)) {
    const first = scene.textures.get(boom.sheetKey).get(0);
    if (first.width === boom.frame.w && first.height === boom.frame.h) {
      return;
    }
    scene.textures.remove(boom.sheetKey);
  }
  scene.load.spritesheet(boom.sheetKey, boomSheetPath, {
    frameWidth: boom.frame.w,
    frameHeight: boom.frame.h,
  });
}

export function ensureBoom(scene: Phaser.Scene): void {
  if (!scene.textures.exists(boom.sheetKey)) {
    return;
  }
  scene.textures.get(boom.sheetKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  // Несколько разрывов идут друг за другом. Повторное создание оборвало бы уже играющий кадр.
  if (scene.anims.exists(boom.animKey)) {
    return;
  }
  scene.anims.create({
    key: boom.animKey,
    frames: boom.holdMs.map((duration, frame) => ({
      key: boom.sheetKey,
      frame,
      duration,
    })),
    repeat: 0,
  });
}

export function boomAt(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.GameObject[] {
  ensureBoom(scene);
  if (!scene.textures.exists(boom.sheetKey)) {
    return [];
  }

  // Origin снизу: линия пыли в кадрах прижата к точке удара.
  const sprite = scene.add
    .sprite(x, y, boom.sheetKey, 0)
    .setOrigin(0.5, 1)
    .setDepth(18)
    .setScale(boom.display);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    scene.tweens.add({
      targets: sprite,
      alpha: 0,
      duration: boom.fadeMs,
      ease: 'Quad.In',
      onComplete: () => sprite.destroy(),
    });
  });
  sprite.play(boom.animKey);
  return [sprite];
}
