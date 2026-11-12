// Столб дыма над сгоревшей машиной. Пикап, багги, вертолёт, тяжёлый танк, дрономатка и БТР зовут его с остова.
// Эмиттер живёт, пока обломок, на котором он сидит, не исчезнет.

import Phaser from 'phaser';
import { bake } from './textures';

export function wreckSmokeAt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const key = 'smoke-puff';
  if (!scene.textures.exists(key)) {
    bake(scene, key, 32, 32, (g) => {
      g.fillStyle(0xffffff, 0.18);
      g.fillCircle(16, 16, 15);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(16, 16, 9);
      g.fillStyle(0xffffff, 0.75);
      g.fillCircle(16, 16, 4);
    });
  }
  const smoke = scene.add.particles(x, y, key, {
    lifespan: { min: 900, max: 1700 },
    frequency: 110,
    quantity: 1,
    speed: { min: 10 * scale, max: 28 * scale },
    angle: { min: -105, max: -75 },
    scale: { start: 0.35 * scale, end: 1.6 * scale },
    alpha: { start: 0.72, end: 0 },
    color: [0xd8d0c4, 0xa09890, 0x6a645c],
    gravityY: -18 * scale,
  });
  smoke.setDepth(12);
  return smoke;
}
