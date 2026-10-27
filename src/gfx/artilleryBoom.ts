// Разрыв артснаряда: четыре кадра public/assets/artillery-boom.png в ряд.
// Пыль всех кадров стоит на одной линии снизу, столб растёт вверх.
// Точка — земля под вспышкой. Воронку кладёт вызывающий код.

import Phaser from 'phaser';

export const artilleryBoom = {
  // Кадр листа 680×180 → 4×1. На поле чуть крупнее воронки, меньше гриба.
  display: 1.2,
  frame: { w: 170, h: 180 },
  frames: 4,
  animKey: 'artillery-boom',
  sheetKey: 'artillery-boom',
  // Вспышка, огонь со столбом, тёмный дым, рассеивание.
  holdMs: [90, 140, 200, 340],
  fadeMs: 420,
};

// Путь буквальный: singlefile-сборка подменяет его на data:.
export const artilleryBoomSheetPath = 'assets/artillery-boom.png';

export function preloadArtilleryBoom(scene: Phaser.Scene): void {
  if (scene.textures.exists(artilleryBoom.sheetKey)) {
    const first = scene.textures.get(artilleryBoom.sheetKey).get(0);
    if (first.width === artilleryBoom.frame.w && first.height === artilleryBoom.frame.h) {
      return;
    }
    scene.textures.remove(artilleryBoom.sheetKey);
  }
  scene.load.spritesheet(artilleryBoom.sheetKey, artilleryBoomSheetPath, {
    frameWidth: artilleryBoom.frame.w,
    frameHeight: artilleryBoom.frame.h,
  });
}

export function ensureArtilleryBoom(scene: Phaser.Scene): void {
  if (!scene.textures.exists(artilleryBoom.sheetKey)) {
    return;
  }
  scene.textures.get(artilleryBoom.sheetKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  // Три снаряда рвутся друг за другом. Повторное создание оборвало бы уже играющий кадр.
  if (scene.anims.exists(artilleryBoom.animKey)) {
    return;
  }
  scene.anims.create({
    key: artilleryBoom.animKey,
    frames: artilleryBoom.holdMs.map((duration, frame) => ({
      key: artilleryBoom.sheetKey,
      frame,
      duration,
    })),
    repeat: 0,
  });
}

export function artilleryBoomAt(
  scene: Phaser.Scene,
  x: number,
  y: number,
): Phaser.GameObjects.GameObject[] {
  ensureArtilleryBoom(scene);
  if (!scene.textures.exists(artilleryBoom.sheetKey)) {
    return [];
  }

  // Origin снизу: линия пыли в кадрах прижата к точке удара.
  const sprite = scene.add
    .sprite(x, y, artilleryBoom.sheetKey, 0)
    .setOrigin(0.5, 1)
    .setDepth(18)
    .setScale(artilleryBoom.display);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    scene.tweens.add({
      targets: sprite,
      alpha: 0,
      duration: artilleryBoom.fadeMs,
      ease: 'Quad.In',
      onComplete: () => sprite.destroy(),
    });
  });
  sprite.play(artilleryBoom.animKey);
  return [sprite];
}
