// Артиллерийский удар: три снаряда в случайные точки поля.
// Покупка в магазине открывает вызов по клавише 1. Сам залп считает CombatSystem.

import Phaser from 'phaser';
import { bake } from '../gfx/textures';
import { playArtilleryBoom } from '../systems/ArtillerySounds';

export type ArtilleryFlight = {
  cancel(): void;
};

export class ArtilleryStrike {
  static readonly iconKey = 'artillery-icon';
  static readonly shellKey = 'artillery-shell';
  static readonly craterKey = 'artillery-crater';
  // Радиус круга на иконке. Затемнение перезарядки рисуется чуть уже, чтобы золотой обод оставался виден.
  static readonly iconRadius = 30;

  static readonly shop = {
    cost: 100,
    shells: 3,
    damage: 20,
    cooldownMs: 20_000,
    craterMs: 5_000,
    blastRadius: 74,
    gapMs: 180,
    fallMs: 480,
    // Пауза после конца хлопка, потом снаряды начинают падать.
    afterShotMs: 0,
  };

  // Прямоугольник, куда можно положить воронку, не наезжая на танк и баннер.
  static readonly field = {
    minX: 250,
    maxX: 1160,
    minY: 160,
    maxY: 540,
  };

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(ArtilleryStrike.iconKey)) {
      bake(scene, ArtilleryStrike.iconKey, 64, 64, (g) => ArtilleryStrike.renderIcon(g));
    }
    if (!scene.textures.exists(ArtilleryStrike.shellKey)) {
      bake(scene, ArtilleryStrike.shellKey, 16, 40, (g) => ArtilleryStrike.renderShell(g));
    }
    if (!scene.textures.exists(ArtilleryStrike.craterKey)) {
      bake(scene, ArtilleryStrike.craterKey, 168, 96, (g) => ArtilleryStrike.renderCrater(g));
    }
  }

  // Три точки с зазором, чтобы воронки не легли друг на друга.
  static impacts(): { x: number; y: number }[] {
    const minGap = ArtilleryStrike.shop.blastRadius * 2;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < ArtilleryStrike.shop.shells; i += 1) {
      let point = ArtilleryStrike.randomPoint();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const clear = points.every(
          (other) => Phaser.Math.Distance.Between(other.x, other.y, point.x, point.y) >= minGap,
        );
        if (clear) {
          break;
        }
        point = ArtilleryStrike.randomPoint();
      }
      points.push(point);
    }
    return points;
  }

  // Светящийся снаряд падает сверху. onImpact — взрыв в точке, куда сел носик.
  // Хлопок батареи к этому моменту уже отзвучал: его играет нажатие клавиши.
  static drop(scene: Phaser.Scene, x: number, y: number, onImpact: () => void): ArtilleryFlight {
    ArtilleryStrike.ensureTextures(scene);
    const drift = Phaser.Math.Between(-28, 28);
    const shell = scene.add.image(x + drift, -8, ArtilleryStrike.shellKey).setDepth(18);
    shell.setOrigin(0.5, 1);
    shell.setRotation(drift * 0.004);
    shell.setBlendMode(Phaser.BlendModes.ADD);

    let settled = false;
    const tween = scene.tweens.add({
      targets: shell,
      x,
      y,
      duration: ArtilleryStrike.shop.fallMs,
      ease: 'Quad.In',
      onComplete: () => {
        if (settled) {
          return;
        }
        settled = true;
        shell.destroy();
        onImpact();
      },
    });

    return {
      cancel() {
        if (settled) {
          return;
        }
        settled = true;
        tween.stop();
        shell.destroy();
      },
    };
  }

  // Вспышка, искры и тёмная яма. Яма гаснет сама через craterMs.
  // Разрыв — artillery_explosion.mp3, свой звук на каждый снаряд.
  static boom(scene: Phaser.Scene, x: number, y: number): void {
    ArtilleryStrike.ensureTextures(scene);
    playArtilleryBoom(scene);

    const flash = scene.add
      .circle(x, y, 16, 0xfff6d0, 1)
      .setDepth(17)
      .setBlendMode(Phaser.BlendModes.ADD);
    const fire = scene.add
      .circle(x, y, 28, 0xff4a12, 0.95)
      .setDepth(16)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: flash,
      scale: 2.8,
      alpha: 0,
      duration: 160,
      onComplete: () => flash.destroy(),
    });
    scene.tweens.add({
      targets: fire,
      scale: 3.2,
      alpha: 0,
      duration: 280,
      ease: 'Cubic.Out',
      onComplete: () => fire.destroy(),
    });

    const ring = scene.add
      .ellipse(x, y + 4, 28, 12, 0xfff4d0, 0)
      .setStrokeStyle(3, 0xffe080, 0.95)
      .setDepth(16)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: ring,
      scaleX: 5.2,
      scaleY: 2.4,
      alpha: 0,
      duration: 340,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    const sparks = scene.add.particles(x, y, 'spark', {
      lifespan: { min: 220, max: 520 },
      speed: { min: 50, max: 280 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      color: [0xffffff, 0xffe090, 0xff4a10],
      gravityY: 200,
      emitting: false,
    });
    sparks.setDepth(17);
    sparks.explode(22);
    scene.time.delayedCall(640, () => {
      if (sparks.scene) {
        sparks.destroy();
      }
    });

    const crater = scene.add.image(x, y, ArtilleryStrike.craterKey).setDepth(3);
    scene.tweens.add({
      targets: crater,
      alpha: 0,
      delay: ArtilleryStrike.shop.craterMs - 400,
      duration: 400,
      onComplete: () => crater.destroy(),
    });

    scene.cameras.main.shake(90, 0.0035);
  }

  private static randomPoint(): { x: number; y: number } {
    const field = ArtilleryStrike.field;
    return {
      x: Phaser.Math.Between(field.minX, field.maxX),
      y: Phaser.Math.Between(field.minY, field.maxY),
    };
  }

  private static renderIcon(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x2a0c0c);
    g.fillCircle(32, 32, ArtilleryStrike.iconRadius);
    g.fillStyle(0x5a1210);
    g.fillCircle(32, 32, 26);
    g.lineStyle(3, 0xf0d56a, 1);
    g.strokeCircle(32, 32, 28);

    g.fillStyle(0x1a0806);
    g.fillEllipse(32, 46, 28, 12);
    g.fillStyle(0xff4a12);
    g.fillCircle(32, 42, 8);
    g.fillStyle(0xffe080);
    g.fillCircle(32, 41, 4);

    // Один снаряд сверху, чтобы значок не читался как цифры.
    g.fillStyle(0xf0d56a);
    g.fillRoundedRect(28, 8, 8, 18, 2);
    g.fillTriangle(26, 24, 38, 24, 32, 32);
  }

  // Носик у нижнего края: origin спрайта стоит на острие.
  private static renderShell(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xff2200, 0.35);
    g.fillEllipse(8, 18, 14, 34);
    g.fillStyle(0xff6600, 0.9);
    g.fillRoundedRect(4, 2, 8, 24, 3);
    g.fillStyle(0xffee66);
    g.fillTriangle(2, 22, 14, 22, 8, 38);
    g.fillStyle(0xffffff);
    g.fillCircle(8, 8, 2.5);
  }

  private static renderCrater(g: Phaser.GameObjects.Graphics): void {
    const cx = 84;
    const cy = 48;
    // Светлый вал и чёрная яма: на тёмном поле мягкое пятно не читается.
    g.fillStyle(0x000000, 0.55);
    g.fillEllipse(cx, cy + 8, 166, 70);
    g.fillStyle(0xf0d2a0, 1);
    g.fillEllipse(cx, cy, 158, 82);
    g.fillStyle(0x8a5a32, 1);
    g.fillEllipse(cx, cy, 132, 64);
    g.fillStyle(0x140804, 1);
    g.fillEllipse(cx, cy + 1, 104, 48);
    g.fillStyle(0x000000, 1);
    g.fillEllipse(cx + 1, cy + 3, 70, 32);
    g.fillStyle(0xfff0c8, 1);
    g.fillEllipse(cx - 50, cy - 10, 26, 10);
    g.fillEllipse(cx + 46, cy + 12, 20, 8);
    g.fillStyle(0xff6a18, 1);
    g.fillCircle(cx - 12, cy + 2, 3);
    g.fillCircle(cx + 18, cy + 6, 2);
  }
}
