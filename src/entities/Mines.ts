// Мины: заряды в случайные точки поля.
// Покупка в магазине открывает вызов по клавише 2 и по иконке на HUD.
// Расстановку и подрыв считает CombatSystem. Заряд лежит, пока на него не наступит пехота.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
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
  private spotX: number;
  readonly y: number;

  private armed = false;
  private gone = false;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private dirt?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number, settled = false) {
    this.spotX = x;
    this.y = y;

    this.body = scene.add
      .image(0, settled ? 0 : 4, Mines.bodyKey)
      .setOrigin(0.5, Mines.bodyOriginY)
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

  get x(): number {
    return this.spotX;
  }

  get isArmed(): boolean {
    return this.armed && !this.gone;
  }

  // Корпус и комья едут вместе. Высота остаётся: сужение холста двигает только правый край.
  moveTo(x: number): void {
    if (this.gone || x === this.spotX) {
      return;
    }
    this.spotX = x;
    this.root.setX(x);
    this.dirt?.setPosition(x, this.y + 2);
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
    cooldownMs: 60_000,
    craterMs: 3_000,
    // Пехота в этом радиусе от центра получает урон. Соседняя дорожка (72 px) уже вне круга.
    blastRadius: 56,
    gap: 84,
  };

  // Постановка из магазина после проигрыша. Без покупок три мины, каждая покупка добавляет ещё одну.
  static readonly mineMax = 6;
  static progressMineLevel = 0;

  static get maxMineLevel(): number {
    return Mines.mineMax - Mines.shop.count;
  }

  static setProgressMineLevel(level: number): void {
    Mines.progressMineLevel = Math.min(Mines.maxMineLevel, Math.max(0, Math.round(level)));
  }

  static mineCount(level = Mines.progressMineLevel): number {
    const extra = Math.max(0, Math.round(level));
    return Math.min(Mines.mineMax, Mines.shop.count + extra);
  }

  // Вместе с магазином очков откат не короче 20 с. У каждого магазина свой запас в 20 с, шаг — 1 с.
  static readonly minCooldownMs = 20_000;
  static readonly cooldownStepMs = 1_000;
  static readonly shopCutMsMax = 20_000;
  static readonly progressCutMsMax = 20_000;
  static progressCooldownLevel = 0;
  // Сколько секунд партия уже докупила в этом заходе. Прогресс читает это, чтобы карточка показывала текущий откат.
  static shopCooldownLevel = 0;

  static setShopCooldownLevel(level: number): void {
    Mines.shopCooldownLevel = Math.min(Mines.maxShopCooldownLevel, Math.max(0, Math.round(level)));
  }

  static get maxShopCooldownLevel(): number {
    return Mines.shopCutMsMax / Mines.cooldownStepMs;
  }

  static get maxProgressCooldownLevel(): number {
    return Mines.progressCutMsMax / Mines.cooldownStepMs;
  }

  static setProgressCooldownLevel(level: number): void {
    Mines.progressCooldownLevel = Math.min(
      Mines.maxProgressCooldownLevel,
      Math.max(0, Math.round(level)),
    );
  }

  // Свой запас прогресса уже выбран — следующий уровень откат не укорачивает.
  static progressCooldownShortens(progressLevel: number): boolean {
    const shop = Mines.shopCooldownLevel;
    return Mines.cooldownFor(shop, progressLevel + 1) < Mines.cooldownFor(shop, progressLevel);
  }

  static cooldownFor(shopLevel: number, progressLevel = Mines.progressCooldownLevel): number {
    const progressCut = Math.min(
      Mines.progressCutMsMax,
      Math.max(0, Math.round(progressLevel)) * Mines.cooldownStepMs,
    );
    const shopCut = Math.min(Mines.shopCutMsMax, Math.max(0, Math.round(shopLevel)) * Mines.cooldownStepMs);
    return Math.max(Mines.minCooldownMs, Mines.shop.cooldownMs - progressCut - shopCut);
  }

  // Полоса постановки. Правый край — текущая ширина холста: на широком окне мины доходят до него.
  // Чужие препятствия приходят списком keepOut.
  static readonly field = {
    minX: 200,
    get maxX(): number {
      return GAME.width - 120;
    },
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
    }
    if (scene.textures.exists(Mines.bodyKey)) {
      scene.textures.get(Mines.bodyKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (!scene.textures.exists(Mines.clodKey)) {
      bake(scene, Mines.clodKey, 8, 8, (g) => {
        g.fillStyle(0xffffff);
        g.fillCircle(4, 4, 3);
      });
    }
  }

  // До купленного числа точек. Занятые места и переданные запреты пропускаются.
  // Пустой список — на поле некуда поставить даже одну мину.
  static spots(
    keepOut: MineKeepOut[],
    occupied: { x: number; y: number }[],
  ): { x: number; y: number }[] {
    const taken = occupied.slice();
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < Mines.mineCount(); i += 1) {
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

  // Та же высота и не правее текущего края. Влево, пока центр не выйдет из запрета и не отойдёт от чужих зарядов.
  // null — на этой высоте свободной точки нет.
  static pullInside(
    keepOut: MineKeepOut[],
    occupied: { x: number; y: number }[],
    y: number,
  ): number | null {
    const field = Mines.field;
    for (let x = field.maxX; x >= field.minX; x -= 1) {
      if (!Mines.blocked(keepOut, occupied, x, y)) {
        return x;
      }
    }
    return null;
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
}
