// Мины: три заряда в случайные точки поля.
// Покупка в магазине открывает вызов по клавише 2 и по иконке на HUD.
// Расстановку и подрыв считает CombatSystem. Заряд лежит, пока на него не наступит пехота.

import Phaser from 'phaser';
import { contactBlast } from '../gfx/contactBlast';
import { placeCrater } from '../gfx/craters';
import { bake } from '../gfx/textures';

// Прямоугольник, куда центр мины ставить нельзя. Отступ на корпус уже снаружи.
export type MineKeepOut = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

// Лампа над крышкой. Текстура корпуса якорится низом, поэтому точка выше нуля контейнера.
const LAMP_Y = -30;

export class PlantedMine {
  readonly x: number;
  readonly y: number;

  private armed = false;
  private gone = false;
  private readonly root: Phaser.GameObjects.Container;
  private readonly hole: Phaser.GameObjects.Ellipse;
  private readonly body: Phaser.GameObjects.Image;
  private readonly lamps: Phaser.GameObjects.Arc[];
  private dirt?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;

    // Яма на месте ещё до корпуса: заряд вылезает из неё, а не появляется в воздухе.
    this.hole = scene.add.ellipse(0, 2, 34, 12, 0x140804, 0.9).setScale(0.35, 0.45);
    this.body = scene.add.image(0, 6, Mines.bodyKey).setOrigin(0.5, 1).setScale(0.72, 0.02);
    const lamp = scene.add.circle(0, LAMP_Y, 3.6, 0xff2a18, 0);
    const core = scene.add.circle(0, LAMP_Y, 1.6, 0xfff0c0, 0);
    this.lamps = [lamp, core];

    this.root = scene.add.container(x, y, [this.hole, this.body, lamp, core]).setDepth(4);

    scene.tweens.add({
      targets: this.hole,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: 'Quad.Out',
    });
    scene.tweens.add({
      targets: this.body,
      scaleX: 1,
      scaleY: 1,
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
      scene.tweens.killTweensOf([this.hole, this.body, ...this.lamps]);
    }
    this.releaseDirt();
    this.root.destroy();
  }

  private arm(): void {
    if (this.gone) {
      return;
    }
    this.armed = true;
    for (const lamp of this.lamps) {
      lamp.setAlpha(1);
    }
    this.root.scene.tweens.add({
      targets: this.lamps,
      alpha: 0.15,
      duration: 260,
      yoyo: true,
      repeat: -1,
    });
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
  static readonly bodyKey = 'mine-body';
  static readonly clodKey = 'mine-clod';
  static readonly iconRadius = 30;
  // Половина корпуса. Отступ, чтобы картинка не легла на танк, проволоку и чужую мину.
  static readonly footprint = 18;

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

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(Mines.iconKey)) {
      bake(scene, Mines.iconKey, 64, 64, (g) => Mines.renderIcon(g));
    }
    if (!scene.textures.exists(Mines.bodyKey)) {
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

  // Тот же хлопок, что у штурмовика о броню, без кусков формы.
  // Звук assault_explosion играет CombatSystem: у вспышки нет своего ползунка.
  // Чаша общая, из gfx. Гаснет сама через craterMs.
  static boom(scene: Phaser.Scene, x: number, y: number): void {
    // feetY - 6 в contactBlast совпадает с центром мины, кольцо не уезжает под землю.
    contactBlast(scene, x, y, y + 6);
    placeCrater(scene, x, y, Mines.shop.craterMs);
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
