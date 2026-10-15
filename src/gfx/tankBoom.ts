// Взрыв базы: только спрайт-лист из assets/.
// Без летящих кругов и фонтана искр — они уезжали вверх и казались скачком.
// Атомная бомба по-прежнему в nuke.ts.

import Phaser from 'phaser';

export const tankBoom = {
  // Высота и полуширина кадра при scale=1 (с учётом display).
  // Просмотр берёт их, чтобы взрыв помещался в кадр вместе с обломками.
  rise: 250,
  half: 130,
  ground: 8,
  goneMs: 900,
  // Сырой кадр листа public/assets/tank-boom.png (576×384 → 3×2).
  display: 1.4,
  frame: { w: 192, h: 192 },
  animKey: 'tank-boom',
  sheetKey: 'tank-boom',
  fps: 10,
};

// Путь буквальный: singlefile-сборка подменяет его на data:.
export const tankBoomSheetPath = 'assets/tank-boom.png';

export function preloadTankBoom(scene: Phaser.Scene): void {
  // Старый лист мог остаться в кэше с другим размером кадра — тогда анимация ломается.
  if (scene.textures.exists(tankBoom.sheetKey)) {
    const first = scene.textures.get(tankBoom.sheetKey).get(0);
    if (first.width === tankBoom.frame.w && first.height === tankBoom.frame.h) {
      return;
    }
    scene.textures.remove(tankBoom.sheetKey);
  }
  scene.load.spritesheet(tankBoom.sheetKey, tankBoomSheetPath, {
    frameWidth: tankBoom.frame.w,
    frameHeight: tankBoom.frame.h,
  });
}

export function ensureTankBoom(scene: Phaser.Scene): void {
  if (!scene.textures.exists(tankBoom.sheetKey)) {
    return;
  }
  scene.textures.get(tankBoom.sheetKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  if (scene.anims.exists(tankBoom.animKey)) {
    scene.anims.remove(tankBoom.animKey);
  }
  scene.anims.create({
    key: tankBoom.animKey,
    frames: scene.anims.generateFrameNumbers(tankBoom.sheetKey, { start: 0, end: 5 }),
    frameRate: tankBoom.fps,
    repeat: 0,
  });
}

export function tankBoomAt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.GameObject[] {
  ensureTankBoom(scene);
  const made: Phaser.GameObjects.GameObject[] = [];
  const groundY = y + tankBoom.ground * scale;
  const size = tankBoom.display * scale;

  scene.cameras.main.flash(180, 255, 246, 230);

  // Короткая вспышка на месте удара — без смещения по Y.
  const flash = scene.add
    .circle(x, groundY - 6 * scale, 22 * scale, 0xffffff, 0.95)
    .setDepth(46)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(0.4);
  scene.tweens.add({
    targets: flash,
    scale: 2.8,
    alpha: 0,
    duration: 160,
    ease: 'Cubic.Out',
    onComplete: () => flash.destroy(),
  });

  if (!scene.textures.exists(tankBoom.sheetKey)) {
    made.push(flash);
    return made;
  }

  // Origin снизу: база пыли в кадрах прижата к общей линии.
  const sprite = scene.add
    .sprite(x, groundY, tankBoom.sheetKey, 0)
    .setOrigin(0.5, 1)
    .setDepth(38)
    .setScale(size);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    scene.tweens.add({
      targets: sprite,
      alpha: 0,
      duration: 280,
      ease: 'Quad.In',
      onComplete: () => sprite.destroy(),
    });
  });
  sprite.play(tankBoom.animKey);

  made.push(flash, sprite);
  return made;
}
