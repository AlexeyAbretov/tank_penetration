// Эмиттеры частиц сцены: фоновые угольки и взрыв снаряда.

import Phaser from 'phaser';

export function createAmbientEmbers(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  const embers = scene.add.particles(700, 360, 'ember', {
    x: { min: 40, max: 1260 },
    y: { min: 80, max: 620 },
    lifespan: { min: 900, max: 2200 },
    speedY: { min: -40, max: -12 },
    speedX: { min: -12, max: 18 },
    scale: { start: 0.8, end: 0 },
    alpha: { start: 0.7, end: 0 },
    blendMode: Phaser.BlendModes.ADD,
    frequency: 80,
    quantity: 1,
  });
  embers.setDepth(2);
  return embers;
}

export function createShellBlast(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  const blast = scene.add.particles(0, 0, 'spark', {
    lifespan: 380,
    speed: { min: 60, max: 280 },
    scale: { start: 1.3, end: 0 },
    alpha: { start: 1, end: 0 },
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
    quantity: 18,
  });
  blast.setDepth(16);
  return blast;
}
