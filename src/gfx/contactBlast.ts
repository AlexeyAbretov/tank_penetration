// Хлопок о землю или броню: вспышка, кольцо, искры и дым.
// Куски формы рисует штурмовик, воронку — мина. Звук играет тот, кто вызвал.

import Phaser from 'phaser';
import { bake } from './textures';

// chest — центр хлопка. feetY — земля, от которой расходится кольцо.
export function contactBlast(scene: Phaser.Scene, x: number, chest: number, feetY: number): void {
  ensureSpark(scene);

  const flash = scene.add
    .circle(x, chest, 10, 0xfff6d0, 1)
    .setDepth(32)
    .setBlendMode(Phaser.BlendModes.ADD);
  const fire = scene.add
    .circle(x, chest, 22, 0xff4a12, 0.95)
    .setDepth(30)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: flash,
    scale: 3.2,
    alpha: 0,
    duration: 140,
    onComplete: () => flash.destroy(),
  });
  scene.tweens.add({
    targets: fire,
    scale: 3.6,
    alpha: 0,
    duration: 320,
    ease: 'Cubic.Out',
    onComplete: () => fire.destroy(),
  });

  const ring = scene.add
    .ellipse(x, feetY - 6, 24, 10, 0xfff4d0, 0)
    .setStrokeStyle(3, 0xffe080, 0.95)
    .setDepth(29)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: ring,
    scaleX: 5.4,
    scaleY: 2.6,
    alpha: 0,
    duration: 300,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy(),
  });

  const sparks = scene.add.particles(x, chest, 'spark', {
    lifespan: { min: 280, max: 640 },
    speed: { min: 80, max: 460 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.6, end: 0 },
    alpha: { start: 1, end: 0 },
    blendMode: Phaser.BlendModes.ADD,
    color: [0xfff6d0, 0xff8a22, 0xff2a10],
    gravityY: 520,
    emitting: false,
  });
  sparks.setDepth(33);
  sparks.explode(36);

  const smoke = scene.add.particles(x, chest, 'spark', {
    lifespan: { min: 420, max: 860 },
    speed: { min: 16, max: 90 },
    angle: { min: -120, max: -60 },
    scale: { start: 1.3, end: 3.4 },
    alpha: { start: 0.4, end: 0 },
    color: [0xd8d0c4, 0x6a645c],
    gravityY: -30,
    emitting: false,
  });
  smoke.setDepth(28);
  smoke.explode(10);

  scene.time.delayedCall(900, () => {
    if (sparks.scene) {
      sparks.destroy();
    }
    if (smoke.scene) {
      smoke.destroy();
    }
  });

  // Второй клуб чуть левее: заряд догорает, а не хлопает один раз.
  scene.time.delayedCall(80, () => {
    const lick = scene.add
      .circle(x - 18, chest - 6, 14, 0xff6a18, 0.9)
      .setDepth(31)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: lick,
      scale: 2.4,
      alpha: 0,
      duration: 200,
      onComplete: () => lick.destroy(),
    });
  });

  scene.cameras.main.shake(120, 0.005);
}

function ensureSpark(scene: Phaser.Scene): void {
  if (scene.textures.exists('spark')) {
    return;
  }
  bake(scene, 'spark', 12, 12, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(6, 6, 5);
  });
}
