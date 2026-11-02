// Холостой ход машины: целый пиксель тряски и серый выхлоп с кормы.

import Phaser from 'phaser';
import { bake } from './textures';

const PUFF_KEY = 'smoke-puff';

// Сдвиг корпуса от мотора. gain 1 — сила в бою.
// Только целые пиксели: дробный сдвиг перерисовывает повёрнутую башню и она дрожит отдельно от корпуса.
export function idleShift(ms: number, gain = 1): { x: number; y: number } {
  const wobble = ms * 0.028;
  const amount = Math.max(0, gain);
  return {
    x: Math.round((Math.sin(wobble) * 0.4 + Math.sin(wobble * 2.17) * 0.25) * amount),
    y: Math.round((Math.cos(wobble * 1.31) * 0.4 + Math.sin(wobble * 2.63) * 0.15) * amount),
  };
}

// Редкий серый выхлоп назад и вверх. Машина смотрит вправо, корма слева.
export function exhaustAt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const engine = scene.add.particles(x, y, puffKey(scene), {
    lifespan: { min: 900, max: 1600 },
    frequency: 40,
    quantity: 2,
    speed: { min: 12 * scale, max: 30 * scale },
    angle: { min: -165, max: -105 },
    scale: { start: 0.4 * scale, end: 1.55 * scale },
    alpha: { start: 0.72, end: 0 },
    color: [0xe6e2da, 0xb4aea6, 0x7c766e],
    gravityY: -18 * scale,
  });
  engine.setDepth(26);
  return engine;
}

function puffKey(scene: Phaser.Scene): string {
  if (!scene.textures.exists(PUFF_KEY)) {
    bake(scene, PUFF_KEY, 32, 32, (g) => {
      g.fillStyle(0xffffff, 0.18);
      g.fillCircle(16, 16, 15);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(16, 16, 9);
      g.fillStyle(0xffffff, 0.75);
      g.fillCircle(16, 16, 4);
    });
  }
  return PUFF_KEY;
}
