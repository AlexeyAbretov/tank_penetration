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

// Редкий выхлоп. По умолчанию назад и вверх: машина смотрит вправо, корма слева.
// true — струя на юго-запад, вниз и назад. 'southeast' — вниз и вправо, корма машины, которая смотрит влево.
// soot — чёрный дым. Обычный выхлоп остаётся серым.
export function exhaustAt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale = 1,
  drift: boolean | 'southeast' = false,
  soot = false,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const southeast = drift === 'southeast';
  const down = drift === true || southeast;
  const engine = scene.add.particles(x, y, puffKey(scene), {
    lifespan: { min: 900, max: 1600 },
    frequency: 40,
    quantity: 2,
    speed: { min: 12 * scale, max: 30 * scale },
    angle: southeast ? { min: 20, max: 70 } : down ? { min: 105, max: 165 } : { min: -165, max: -105 },
    scale: { start: 0.4 * scale, end: 1.55 * scale },
    alpha: { start: soot ? 0.9 : 0.72, end: 0 },
    color: soot ? [0x2a2a2a, 0x121212, 0x050505] : [0xe6e2da, 0xb4aea6, 0x7c766e],
    gravityY: (down ? 18 : -18) * scale,
  });
  engine.setDepth(26);
  return engine;
}

// След летящей ракеты. Эмиттер стоит в нуле: клуб кладётся в точку позади носика и там гаснет.
export function trailAt(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  const smoke = scene.add.particles(0, 0, puffKey(scene), {
    lifespan: { min: 380, max: 720 },
    speed: { min: 8, max: 24 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.45, end: 1.35 },
    alpha: { start: 0.8, end: 0 },
    color: [0xffe0c0, 0xe4e0d8, 0x9a968e],
    emitting: false,
  });
  smoke.setDepth(13);
  return smoke;
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
