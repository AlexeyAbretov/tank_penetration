// Ядерный гриб: белая вспышка, ударная волна по земле и шапка, которая темнеет и гаснет.
// Только атомная бомба. Гибель танка рисует свой спрайт в tankBoom.ts.
// Точка — очаг. Ножка растёт от земли на ground ниже. Обломки сюда не входят: их рисуют заранее.

import Phaser from 'phaser';
import { bake } from './textures';

// rise и half — высота и полуширина шапки в пикселях.
export const nuke = {
  rise: 168,
  half: 210,
  ground: 28,
  // Последний кадр облака: шапка гаснет раньше, дым и искры снимаются здесь.
  goneMs: 1400,
};

export function nukeAt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.GameObject[] {
  const made: Phaser.GameObjects.GameObject[] = [];
  const rise = nuke.rise * scale;
  const groundY = y + nuke.ground * scale;

  scene.cameras.main.flash(320, 255, 246, 230);

  const flash = scene.add
    .circle(x, y, 36 * scale, 0xffffff, 1)
    .setDepth(46)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(0.3);
  scene.tweens.add({
    targets: flash,
    scale: 8,
    alpha: 0,
    duration: 240,
    ease: 'Cubic.Out',
    onComplete: () => flash.destroy(),
  });

  const fire = scene.add
    .circle(x, y, 34 * scale, 0xff5a12, 0.95)
    .setDepth(42)
    .setBlendMode(Phaser.BlendModes.ADD);
  const core = scene.add
    .circle(x, y, 14 * scale, 0xfff6d0, 1)
    .setDepth(45)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: fire,
    scale: 4.4,
    alpha: 0,
    y: y - 36 * scale,
    duration: 520,
    ease: 'Cubic.Out',
    onComplete: () => fire.destroy(),
  });
  scene.tweens.add({
    targets: core,
    scale: 3.2,
    alpha: 0,
    y: y - 48 * scale,
    duration: 400,
    ease: 'Cubic.Out',
    onComplete: () => core.destroy(),
  });

  // Плоское кольцо по земле: ударная волна, не шар.
  const ring = scene.add
    .ellipse(x, groundY, 32 * scale, 12 * scale, 0xfff4d0, 0)
    .setStrokeStyle(Math.max(2, 5 * scale), 0xfff6d8, 0.95)
    .setDepth(40)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: ring,
    scaleX: 12,
    scaleY: 4.5,
    alpha: 0,
    duration: 680,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy(),
  });

  // Ножка растёт от земли вверх. origin снизу, поэтому scaleY тянет её к небу, а не в обе стороны.
  const stem = scene.add
    .ellipse(x, groundY, 46 * scale, 22 * scale, 0x5c4636, 0.95)
    .setOrigin(0.5, 1)
    .setDepth(36);
  scene.tweens.add({
    targets: stem,
    scaleY: 8,
    scaleX: 1.55,
    duration: 880,
    ease: 'Cubic.Out',
  });
  scene.tweens.add({
    targets: stem,
    alpha: 0,
    delay: 620,
    duration: 520,
    onComplete: () => stem.destroy(),
  });

  const capY = y - 8 * scale;
  const cap = scene.add.ellipse(x, capY, 72 * scale, 30 * scale, 0x6a5646, 0.94).setDepth(38);
  const capHot = scene.add
    .ellipse(x, capY + 6 * scale, 60 * scale, 18 * scale, 0xffb040, 0.95)
    .setDepth(39)
    .setBlendMode(Phaser.BlendModes.ADD);
  const capCore = scene.add
    .ellipse(x, capY, 22 * scale, 12 * scale, 0xfff8e4, 1)
    .setDepth(41)
    .setBlendMode(Phaser.BlendModes.ADD);
  const crownY = groundY - rise;
  scene.tweens.add({
    targets: [cap, capHot, capCore],
    y: crownY,
    scaleX: 5.6,
    scaleY: 2.15,
    duration: 920,
    ease: 'Cubic.Out',
  });
  scene.tweens.add({
    targets: capCore,
    alpha: 0,
    delay: 160,
    duration: 280,
    onComplete: () => capCore.destroy(),
  });
  scene.tweens.add({
    targets: capHot,
    alpha: 0,
    delay: 280,
    duration: 460,
    onComplete: () => capHot.destroy(),
  });
  scene.tweens.add({
    targets: cap,
    alpha: 0,
    delay: 700,
    duration: 520,
    onComplete: () => cap.destroy(),
  });

  // Боковые доли шапки разъезжаются в стороны и делают силуэт грибом, а не столбом.
  for (const side of [-1, 1]) {
    const lobe = scene.add
      .ellipse(x + side * 16 * scale, capY, 40 * scale, 24 * scale, 0x5a4638, 0.88)
      .setDepth(37);
    scene.tweens.add({
      targets: lobe,
      x: x + side * 150 * scale,
      y: crownY + 16 * scale,
      scaleX: 2.6,
      scaleY: 1.5,
      duration: 920,
      ease: 'Cubic.Out',
    });
    scene.tweens.add({
      targets: lobe,
      alpha: 0,
      delay: 640,
      duration: 480,
      onComplete: () => lobe.destroy(),
    });
    made.push(lobe);
  }

  if (!scene.textures.exists('spark')) {
    bake(scene, 'spark', 12, 12, (g) => {
      g.fillStyle(0xffffff);
      g.fillCircle(6, 6, 5);
    });
  }
  const sparks = scene.add.particles(x, y, 'spark', {
    lifespan: { min: 380, max: 980 },
    speed: { min: 80 * scale, max: 560 * scale },
    angle: { min: -110, max: -70 },
    scale: { start: 2.1 * scale, end: 0 },
    alpha: { start: 1, end: 0 },
    blendMode: Phaser.BlendModes.ADD,
    color: [0xffffff, 0xffe090, 0xff6a10, 0xff2200],
    gravityY: 260 * scale,
    emitting: false,
  });
  sparks.setDepth(44);
  sparks.explode(56);
  const smoke = scene.add.particles(x, groundY - 10 * scale, 'spark', {
    lifespan: { min: 700, max: 1300 },
    speed: { min: 20 * scale, max: 140 * scale },
    angle: { min: -100, max: -80 },
    scale: { start: 2.2 * scale, end: 5 * scale },
    alpha: { start: 0.4, end: 0 },
    color: [0x8a7868, 0x4a4038],
    gravityY: -30 * scale,
    emitting: false,
  });
  smoke.setDepth(35);
  smoke.explode(22);
  scene.time.delayedCall(nuke.goneMs, () => {
    if (sparks.scene) {
      sparks.destroy();
    }
    if (smoke.scene) {
      smoke.destroy();
    }
  });

  const scrap = [0x3d4a28, 0x1a1c16, 0x2a341c, 0x4a5830, 0x6a4a22];
  for (let i = 0; i < 10; i += 1) {
    const wide = i % 3 === 0;
    const bit = scene.add
      .rectangle(
        x,
        y,
        (wide ? 20 : 11) * scale,
        (wide ? 8 : 5) * scale,
        scrap[i % scrap.length],
      )
      .setDepth(43);
    const angle = Phaser.Math.FloatBetween(-Math.PI * 0.95, -Math.PI * 0.05);
    const dist = Phaser.Math.Between(90, 240) * scale;
    scene.tweens.add({
      targets: bit,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist + 60 * scale,
      angle: Phaser.Math.Between(-240, 240),
      alpha: 0,
      duration: Phaser.Math.Between(560, 920),
      ease: 'Quad.Out',
      onComplete: () => bit.destroy(),
    });
    made.push(bit);
  }

  made.push(flash, fire, core, ring, stem, cap, capHot, capCore, sparks, smoke);
  return made;
}
