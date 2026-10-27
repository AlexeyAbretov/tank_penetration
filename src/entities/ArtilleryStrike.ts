// Артиллерийский удар: три снаряда в случайные точки поля.
// Покупка в магазине открывает вызов по клавише 1 и по иконке на HUD. Сам залп считает CombatSystem.

import Phaser from 'phaser';
import { artilleryBoomAt } from '../gfx/artilleryBoom';
import { placeCrater } from '../gfx/craters';
import { bake } from '../gfx/textures';
import { playArtilleryBoom } from '../sounds/ArtillerySounds';

export type ArtilleryFlight = {
  cancel(): void;
};

export type ArtilleryMark = {
  clear(): void;
};

export class ArtilleryStrike {
  static readonly iconKey = 'artillery-icon';
  static readonly shellKey = 'artillery-shell';
  // private static readonly flareKey = 'artillery-flare';
  private static readonly flarePuffKey = 'artillery-flare-puff';
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

  // Прямоугольник удара без левого края: его даёт бой, чтобы чаша не ушла за проволоку.
  static readonly field = {
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
  }

  // Три точки с зазором, чтобы воронки не легли друг на друга.
  // minX приходит снаружи: артиллерия не знает, где стоит проволока.
  static impacts(minX: number): { x: number; y: number }[] {
    const minGap = ArtilleryStrike.shop.blastRadius * 2;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < ArtilleryStrike.shop.shells; i += 1) {
      let point = ArtilleryStrike.randomPoint(minX);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const clear = points.every(
          (other) => Phaser.Math.Distance.Between(other.x, other.y, point.x, point.y) >= minGap,
        );
        if (clear) {
          break;
        }
        point = ArtilleryStrike.randomPoint(minX);
      }
      points.push(point);
    }
    return points;
  }

  // Оранжевый дым в точке, куда сядет снаряд. Трубка и струя огня ниже выключены.
  // clear гасит метку: удар уже случился или залп отменён.
  static mark(scene: Phaser.Scene, x: number, y: number): ArtilleryMark {
    ArtilleryStrike.ensureFlareTextures(scene);
    const puff = ArtilleryStrike.flarePuffKey;
    // Один шлейф вправо и вверх. Оранжевый и светлый летят одним ветром, светлый чуть выше по тому же следу.
    const smoke = scene.add.particles(x, y, puff, {
      x: { min: 0, max: 6 },
      y: { min: -2, max: 3 },
      lifespan: { min: 1100, max: 1600 },
      frequency: 20,
      quantity: 2,
      speedX: { min: 40, max: 72 },
      speedY: { min: -22, max: -8 },
      gravityX: 6,
      gravityY: -8,
      scaleX: { start: 0.45, end: 1.6 },
      scaleY: { start: 0.22, end: 0.62 },
      rotate: { min: -22, max: 4 },
      alpha: { start: 0.85, end: 0 },
      color: [0xff6a22, 0xff3c0c, 0xd42c08],
    });
    smoke.setDepth(16);
    const cap = scene.add.particles(x + 16, y - 10, puff, {
      x: { min: 0, max: 12 },
      y: { min: -8, max: 0 },
      lifespan: { min: 1000, max: 1500 },
      frequency: 28,
      quantity: 1,
      speedX: { min: 38, max: 68 },
      speedY: { min: -24, max: -10 },
      gravityX: 6,
      gravityY: -8,
      scaleX: { start: 0.4, end: 1.5 },
      scaleY: { start: 0.22, end: 0.58 },
      rotate: { min: -22, max: 4 },
      alpha: { start: 0.5, end: 0 },
      color: [0xffd48a, 0xffa040, 0xff6a22],
    });
    cap.setDepth(17);

    let gone = false;
    return {
      clear() {
        if (gone) {
          return;
        }
        gone = true;
        smoke.destroy();
        cap.destroy();
      },
    };
  }

  // Светящийся снаряд падает сверху. onImpact — взрыв в точке, куда сел носик.
  // Хлопок батареи к этому моменту уже отзвучал: его играет вызов удара.
  static drop(scene: Phaser.Scene, x: number, y: number, onImpact: () => void): ArtilleryFlight {
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

  // Четыре кадра разрыва и воронка. Воронка гаснет сама через craterMs.
  // Разрыв — artillery_explosion.mp3, свой звук на каждый снаряд.
  static boom(scene: Phaser.Scene, x: number, y: number): void {
    playArtilleryBoom(scene);
    artilleryBoomAt(scene, x, y);
    placeCrater(scene, x, y, ArtilleryStrike.shop.craterMs);
    scene.cameras.main.shake(90, 0.0035);
  }

  // Трубка факела и мягкое пятно для огня и дыма. Пятно белое: цвет задаёт tint частиц.
  private static ensureFlareTextures(scene: Phaser.Scene): void {
    // if (!scene.textures.exists(ArtilleryStrike.flareKey)) {
    //   bake(scene, ArtilleryStrike.flareKey, 64, 18, (g) => ArtilleryStrike.renderFlare(g));
    // }
    if (!scene.textures.exists(ArtilleryStrike.flarePuffKey)) {
      // Вытянутый клок, не круг: по ветру читается полоса, а не шар.
      bake(scene, ArtilleryStrike.flarePuffKey, 64, 28, (g) => {
        g.fillStyle(0xffffff, 0.16);
        g.fillEllipse(34, 14, 52, 16);
        g.fillStyle(0xffffff, 0.4);
        g.fillEllipse(26, 14, 32, 12);
        g.fillStyle(0xffffff, 0.72);
        g.fillEllipse(18, 14, 16, 8);
      });
    }
  }

  private static randomPoint(minX: number): { x: number; y: number } {
    const field = ArtilleryStrike.field;
    return {
      x: Phaser.Math.Between(minX, field.maxX),
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
}
