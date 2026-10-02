// Искры удара о твёрдое: пуля по танку в бою и снаряд о плиту в просмотре.

import Phaser from 'phaser';
import { bake } from './textures';

export const ARMOR_SPARK_KEY = 'armor-spark';

// Горизонтальная черта. В полёте её крутят вдоль скорости, яркий конец смотрит вперёд.
export function ensureArmorSpark(scene: Phaser.Scene): void {
  if (scene.textures.exists(ARMOR_SPARK_KEY)) {
    return;
  }
  bake(scene, ARMOR_SPARK_KEY, 18, 6, (g) => {
    g.fillStyle(0xffffff, 0.45);
    g.fillRect(0, 2, 7, 2);
    g.fillStyle(0xffffff);
    g.fillRect(7, 1, 7, 4);
    g.fillCircle(15, 3, 2);
  });
}

// Излучатель выключен: искры только по emitArmorSparks. Координаты — локальные, если эмиттер лежит в контейнере.
export function createArmorSparks(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureArmorSpark(scene);
  const sparks = scene.add.particles(0, 0, ARMOR_SPARK_KEY, {
    lifespan: { min: 160, max: 340 },
    speed: { min: 180, max: 560 },
    scaleX: { start: 1, end: 0.15 },
    scaleY: { start: 0.55, end: 0 },
    alpha: { start: 1, end: 0 },
    // Белая черта за жизнь желтеет и догорает оранжевым.
    color: [0xffffff, 0xffe070, 0xff6a12],
    gravityY: 720,
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
    rotate: {
      onUpdate: (particle) =>
        Phaser.Math.RadToDeg(Math.atan2(particle.velocityY, particle.velocityX)),
    },
  });
  sparks.setDepth(28);
  return sparks;
}

// travel — угол полёта снаряда в радианах. 0 смотрит вправо. Искры летят назад.
export function emitArmorSparks(
  sparks: Phaser.GameObjects.Particles.ParticleEmitter,
  x: number,
  y: number,
  travel: number,
): void {
  const back = Phaser.Math.RadToDeg(travel) + 180;
  // Отрицательный угол — вверх. Веер шире вверх: искры срываются с поверхности, а не падают сразу вниз.
  sparks.setEmitterAngle({ min: back - 75, max: back + 40 });
  sparks.emitParticleAt(x, y, 9);
}
