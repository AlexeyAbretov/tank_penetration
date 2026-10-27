// Артиллерийский удар: три снаряда в случайные точки поля.
// Покупка в магазине открывает вызов по клавише 1 и по иконке на HUD. Сам залп считает CombatSystem.

import Phaser from 'phaser';
import { BarbedWire } from './BarbedWire';
import { bake } from '../gfx/textures';
import { playArtilleryBoom } from '../sounds/ArtillerySounds';

export type ArtilleryFlight = {
  cancel(): void;
};

export class ArtilleryStrike {
  static readonly iconKey = 'artillery-icon';
  static readonly shellKey = 'artillery-shell';
  // Радиус круга на иконке. Затемнение перезарядки рисуется чуть уже, чтобы золотой обод оставался виден.
  static readonly iconRadius = 30;

  // Четыре воронки с одной фотографии. Трава снята, у каждой свой край:
  // лучи, камни, плоская чаша, вал. Строки буквальные: singlefile-сборка подменяет их на data:.
  static readonly craterImages = {
    'artillery-crater-0': 'assets/artillery-crater-0.png',
    'artillery-crater-1': 'assets/artillery-crater-1.png',
    'artillery-crater-2': 'assets/artillery-crater-2.png',
    'artillery-crater-3': 'assets/artillery-crater-3.png',
  } as const;

  // Кадр около 200 px. На поле чаша меньше: иначе три воронки накрывают середину экрана.
  static readonly craterScale = 0.55;

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

  // Прямоугольник удара. Слева — линия проволоки плюс полкадра самой широкой
  // воронки (камни, 243 px): и точка разрыва, и чаша остаются перед ней.
  static readonly field = {
    minX: Math.ceil(BarbedWire.bounds.face + (243 * ArtilleryStrike.craterScale) / 2),
    maxX: 1160,
    minY: 160,
    maxY: 540,
  };

  // imagePreloader зовёт до create. Иконка и снаряд по-прежнему рисуются в ensureTextures.
  static preload(scene: Phaser.Scene): void {
    for (const [key, path] of Object.entries(ArtilleryStrike.craterImages)) {
      scene.load.image(key, path);
    }
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(ArtilleryStrike.iconKey)) {
      bake(scene, ArtilleryStrike.iconKey, 64, 64, (g) => ArtilleryStrike.renderIcon(g));
    }
    if (!scene.textures.exists(ArtilleryStrike.shellKey)) {
      bake(scene, ArtilleryStrike.shellKey, 16, 40, (g) => ArtilleryStrike.renderShell(g));
    }
    for (const key of Object.keys(ArtilleryStrike.craterImages)) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
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

  // Вспышка, искры и воронка. Воронка гаснет сама через craterMs.
  // Разрыв — artillery_explosion.mp3, свой звук на каждый снаряд.
  static boom(scene: Phaser.Scene, x: number, y: number): void {
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

    const keys = Object.keys(ArtilleryStrike.craterImages);
    const key = keys[Phaser.Math.Between(0, keys.length - 1)];
    if (scene.textures.exists(key)) {
      const crater = scene.add.image(x, y, key).setDepth(3).setScale(ArtilleryStrike.craterScale);
      scene.tweens.add({
        targets: crater,
        alpha: 0,
        delay: ArtilleryStrike.shop.craterMs - 400,
        duration: 400,
        onComplete: () => crater.destroy(),
      });
    }

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
}
