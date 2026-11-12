// Вспышка гибели машины: два клуба, второй чуть позже. Картинки взрыва нет.
// Точки ставит сама машина на свой корпус. Пикап, багги, вертолёт, тяжёлый танк, дрономатка и БТР зовут одну и ту же вспышку.

import Phaser from 'phaser';
import { bake } from './textures';

type BlastPoint = { x: number; y: number };

// Второй клуб не одновременно с первым: так вспышка читается как один взрыв, а не как два.
const secondPuffMs = 90;

export function vehicleDeathBlast(scene: Phaser.Scene, front: BlastPoint, rear: BlastPoint): void {
  puff(scene, front.x, front.y);
  scene.time.delayedCall(secondPuffMs, () => {
    puff(scene, rear.x, rear.y);
  });
}

// Один клуб: огонь, искры и горсть обломков. scale увеличивает радиус, скорость и осколки.
function puff(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const sparkKey = 'spark';
  const muzzleKey = 'muzzle';
  if (!scene.textures.exists(sparkKey)) {
    bake(scene, sparkKey, 12, 12, (g) => {
      g.fillStyle(0xffffff);
      g.fillCircle(6, 6, 5);
    });
  }
  const sparks = scene.add.particles(x, y, sparkKey, {
    lifespan: { min: 280, max: 640 },
    speed: { min: 40 * scale, max: 420 * scale },
    scale: { start: 1.7 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    blendMode: Phaser.BlendModes.ADD,
    color: [0xfff6d0, 0xff8a22, 0xff2a10],
    gravityY: 460 * scale,
    emitting: false,
  });
  sparks.setDepth(18);
  sparks.explode(32);
  scene.time.delayedCall(700, () => sparks.destroy());

  const fire = scene.add.circle(x, y, 26 * scale, 0xff4a12, 0.95).setDepth(17);
  const core = scene.add.circle(x, y, 12 * scale, 0xfff4c8, 1).setDepth(19);
  const flash = scene.add.image(x, y, muzzleKey).setDepth(18).setBlendMode(Phaser.BlendModes.ADD);
  flash.setScale(1.6 * scale);
  scene.tweens.add({
    targets: [fire, core, flash],
    alpha: 0,
    scale: 3.4 * scale,
    duration: 320,
    onComplete: () => {
      fire.destroy();
      core.destroy();
      flash.destroy();
    },
  });

  for (let i = 0; i < 5; i += 1) {
    const bit = scene.add
      .rectangle(x, y, 10 * scale, 4 * scale, i % 2 === 0 ? 0x3a4a24 : 0x1a1c16)
      .setDepth(16);
    const angle = Phaser.Math.FloatBetween(-Math.PI * 0.9, -Math.PI * 0.1);
    const dist = Phaser.Math.Between(50, 150) * scale;
    scene.tweens.add({
      targets: bit,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist + 36 * scale,
      angle: Phaser.Math.Between(-160, 160),
      alpha: 0,
      duration: 460,
      onComplete: () => bit.destroy(),
    });
  }
}
