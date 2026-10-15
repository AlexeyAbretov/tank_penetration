// Ядерный гриб: девять кадров public/assets/nuke-boom.png (3×3).
// Пыль всех кадров стоит на одной линии снизу, шапка растёт вверх.
// Точка — земля под грибом. Воронку рисует NuclearStrike отдельно.

import Phaser from 'phaser';

export const nuke = {
  // Высота и полуширина кадра при scale=1.
  rise: 212,
  half: 200,
  ground: 0,
  // Рост девяти кадров и затухание последнего. Магазин волны ждёт это время.
  goneMs: 1650,
  frame: { w: 401, h: 212 },
  frames: 9,
  animKey: 'nuke-boom',
  sheetKey: 'nuke-boom',
  fps: 8,
};

// Путь буквальный: singlefile-сборка подменяет его на data:.
export const nukeSheetPath = 'assets/nuke-boom.png';

export function preloadNuke(scene: Phaser.Scene): void {
  if (scene.textures.exists(nuke.sheetKey)) {
    const first = scene.textures.get(nuke.sheetKey).get(0);
    if (first.width === nuke.frame.w && first.height === nuke.frame.h) {
      return;
    }
    scene.textures.remove(nuke.sheetKey);
  }
  scene.load.spritesheet(nuke.sheetKey, nukeSheetPath, {
    frameWidth: nuke.frame.w,
    frameHeight: nuke.frame.h,
  });
}

export function ensureNuke(scene: Phaser.Scene): void {
  if (!scene.textures.exists(nuke.sheetKey)) {
    return;
  }
  scene.textures.get(nuke.sheetKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  if (scene.anims.exists(nuke.animKey)) {
    scene.anims.remove(nuke.animKey);
  }
  scene.anims.create({
    key: nuke.animKey,
    frames: scene.anims.generateFrameNumbers(nuke.sheetKey, {
      start: 0,
      end: nuke.frames - 1,
    }),
    frameRate: nuke.fps,
    repeat: 0,
  });
}

export function nukeAt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.GameObject[] {
  ensureNuke(scene);
  const made: Phaser.GameObjects.GameObject[] = [];
  const groundY = y + nuke.ground * scale;

  scene.cameras.main.flash(220, 255, 246, 220);

  const flash = scene.add
    .circle(x, groundY - 8 * scale, 28 * scale, 0xffffff, 0.95)
    .setDepth(46)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(0.4);
  scene.tweens.add({
    targets: flash,
    scale: 3.2,
    alpha: 0,
    duration: 180,
    ease: 'Cubic.Out',
    onComplete: () => flash.destroy(),
  });
  made.push(flash);

  if (!scene.textures.exists(nuke.sheetKey)) {
    return made;
  }

  // Origin снизу: линия пыли в кадрах прижата к земле удара.
  const sprite = scene.add
    .sprite(x, groundY, nuke.sheetKey, 0)
    .setOrigin(0.5, 1)
    .setDepth(38)
    .setScale(scale);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    scene.tweens.add({
      targets: sprite,
      alpha: 0,
      duration: 480,
      ease: 'Quad.In',
      onComplete: () => sprite.destroy(),
    });
  });
  sprite.play(nuke.animKey);
  made.push(sprite);
  return made;
}
