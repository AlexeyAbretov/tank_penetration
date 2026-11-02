// Мины: три заряда в случайные точки поля.
// Покупка в магазине открывает вызов по клавише 2 и по иконке на HUD.
// Расстановку и подрыв считает CombatSystem. Заряд лежит, пока на него не наступит пехота.

import Phaser from 'phaser';
import { boomAt } from '../gfx/boom';
import { placeCrater } from '../gfx/craters';
import { bake } from '../gfx/textures';
import { playBoom } from '../sounds/BoomSounds';

// Прямоугольник, куда центр мины ставить нельзя. Отступ на корпус уже снаружи.
export type MineKeepOut = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export class PlantedMine {
  readonly x: number;
  readonly y: number;

  private armed = false;
  private gone = false;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private dirt?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number, settled = false) {
    this.x = x;
    this.y = y;

    const frame = scene.textures.get(Mines.bodyKey).get();
    // У файла низ корпуса на строке 45. Запасной рисунок 36 px сидит своим низом.
    const originY = frame.height === 48 ? Mines.bodyOriginY : 1;
    this.body = scene.add
      .image(0, settled ? 0 : 4, Mines.bodyKey)
      .setOrigin(0.5, originY)
      .setScale(settled ? Mines.bodyScale : Mines.bodyScale * 0.72, settled ? Mines.bodyScale : 0.02);

    this.root = scene.add.container(x, y, [this.body]).setDepth(4);
    if (settled) {
      this.armed = true;
      return;
    }

    scene.tweens.add({
      targets: this.body,
      scaleX: Mines.bodyScale,
      scaleY: Mines.bodyScale,
      y: 0,
      delay: Phaser.Math.Between(40, 160),
      duration: 460,
      ease: 'Back.Out',
      onComplete: () => this.arm(),
    });

    this.dirt = scene.add.particles(x, y + 2, Mines.clodKey, {
      lifespan: { min: 220, max: 520 },
      speed: { min: 30, max: 110 },
      angle: { min: -170, max: -10 },
      scale: { start: 1.2, end: 0.15 },
      gravityY: 420,
      color: [0xc4a06a, 0x6a4a28, 0x3a2814],
      emitting: false,
    });
    this.dirt.setDepth(5);
    this.dirt.explode(12);
    scene.time.delayedCall(560, () => this.releaseDirt());
  }

  get isArmed(): boolean {
    return this.armed && !this.gone;
  }

  destroy(): void {
    if (this.gone) {
      return;
    }
    this.gone = true;
    this.armed = false;
    const scene = this.root.scene;
    if (scene) {
      scene.tweens.killTweensOf(this.body);
    }
    this.releaseDirt();
    this.root.destroy();
  }

  private arm(): void {
    if (this.gone) {
      return;
    }
    this.armed = true;
  }

  private releaseDirt(): void {
    if (this.dirt?.scene) {
      this.dirt.destroy();
    }
    this.dirt = undefined;
  }
}

export class Mines {
  static readonly iconKey = 'mine-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static readonly iconPath = 'assets/mine-icon.png';
  static readonly bodyKey = 'mine-body';
  static readonly clodKey = 'mine-clod';
  static readonly iconRadius = 30;
  // Холст 64×48. Корпус занимает строки 21..44, строка 45 — линия земли.
  static readonly bodyOriginY = 45 / 48;
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static readonly imagePath = 'assets/mine-body.png';
  // На поле корпус вдвое меньше холста. Половина этой ширины — отступ от танка, проволоки и чужой мины.
  static readonly bodyScale = 0.5;
  static readonly footprint = 13;

  static readonly shop = {
    cost: 100,
    count: 3,
    damage: 10,
    cooldownMs: 20_000,
    craterMs: 3_000,
    // Пехота в этом радиусе от центра получает урон. Соседняя дорожка (72 px) уже вне круга.
    blastRadius: 56,
    gap: 84,
  };

  // Прямоугольник поля. Чужие препятствия приходят списком keepOut.
  static readonly field = {
    minX: 200,
    maxX: 1160,
    minY: 160,
    maxY: 540,
  };

  static preload(scene: Phaser.Scene): void {
    if (!scene.textures.exists(Mines.bodyKey)) {
      scene.load.image(Mines.bodyKey, Mines.imagePath);
    }
    if (!scene.textures.exists(Mines.iconKey)) {
      scene.load.image(Mines.iconKey, Mines.iconPath);
    }
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(Mines.iconKey)) {
      scene.textures.get(Mines.iconKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    } else {
      bake(scene, Mines.iconKey, 64, 64, (g) => Mines.renderIcon(g));
    }
    if (scene.textures.exists(Mines.bodyKey)) {
      scene.textures.get(Mines.bodyKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    } else {
      bake(scene, Mines.bodyKey, 48, 36, (g) => Mines.renderBody(g));
    }
    if (!scene.textures.exists(Mines.clodKey)) {
      bake(scene, Mines.clodKey, 8, 8, (g) => {
        g.fillStyle(0xffffff);
        g.fillCircle(4, 4, 3);
      });
    }
  }

  // До трёх точек. Занятые места и переданные запреты пропускаются.
  // Пустой список — на поле некуда поставить даже одну мину.
  static spots(
    keepOut: MineKeepOut[],
    occupied: { x: number; y: number }[],
  ): { x: number; y: number }[] {
    const taken = occupied.slice();
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < Mines.shop.count; i += 1) {
      const point = Mines.findSpot(keepOut, taken);
      if (!point) {
        break;
      }
      points.push(point);
      taken.push(point);
    }
    return points;
  }

  static plant(scene: Phaser.Scene, x: number, y: number): PlantedMine {
    return new PlantedMine(scene, x, y);
  }

  // Уже лежит и взведена. Загрузка партии не проигрывает вылезание из земли заново.
  static restore(scene: Phaser.Scene, x: number, y: number): PlantedMine {
    return new PlantedMine(scene, x, y, true);
  }

  // Общий разрыв у земли: четыре кадра, звук и тряска.
  // Воронка общая, из gfx. Гаснет сама через craterMs.
  static boom(scene: Phaser.Scene, x: number, y: number): void {
    playBoom(scene);
    boomAt(scene, x, y);
    placeCrater(scene, x, y, Mines.shop.craterMs);
    scene.cameras.main.shake(90, 0.0035);
  }

  private static findSpot(
    keepOut: MineKeepOut[],
    occupied: { x: number; y: number }[],
  ): { x: number; y: number } | null {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const point = Mines.randomPoint();
      if (!Mines.blocked(keepOut, occupied, point.x, point.y)) {
        return point;
      }
    }
    return null;
  }

  private static blocked(
    keepOut: MineKeepOut[],
    occupied: { x: number; y: number }[],
    x: number,
    y: number,
  ): boolean {
    if (keepOut.some((zone) => x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY)) {
      return true;
    }
    const gap = Mines.shop.gap;
    return occupied.some((other) => Phaser.Math.Distance.Between(other.x, other.y, x, y) < gap);
  }

  private static randomPoint(): { x: number; y: number } {
    const field = Mines.field;
    return {
      x: Phaser.Math.Between(field.minX, field.maxX),
      y: Phaser.Math.Between(field.minY, field.maxY),
    };
  }

  private static renderIcon(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x2a0c0c);
    g.fillCircle(32, 32, Mines.iconRadius);
    g.fillStyle(0x5a1210);
    g.fillCircle(32, 32, 26);
    g.lineStyle(3, 0xf0d56a, 1);
    g.strokeCircle(32, 32, 28);

    g.fillStyle(0x1a1008);
    g.fillEllipse(32, 46, 28, 10);
    g.fillStyle(0x5c6a3e);
    g.fillRoundedRect(21, 30, 22, 14, 3);
    g.fillStyle(0x1e2416);
    g.fillEllipse(32, 32, 18, 8);
    g.fillStyle(0xff2a18);
    g.fillCircle(32, 24, 4);
    g.fillStyle(0xfff0c0);
    g.fillCircle(32, 24, 1.8);
  }

  // Низ картинки — линия земли. Origin спрайта стоит на ней, масштаб растёт вверх.
  private static renderBody(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x3a2a18);
    g.fillEllipse(24, 32, 36, 10);
    g.fillStyle(0x2a2418);
    g.fillRoundedRect(14, 8, 20, 24, 4);
    g.fillStyle(0x5c6a3e);
    g.fillRoundedRect(16, 10, 16, 18, 3);
    g.fillStyle(0x9aaa68);
    g.fillRect(18, 13, 6, 3);
    g.fillStyle(0x1e2416);
    g.fillEllipse(24, 12, 22, 10);
    g.fillStyle(0x6d7d48);
    g.fillEllipse(24, 11, 12, 5);
  }
}
