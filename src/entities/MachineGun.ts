// Пулемёт перед люком башни: одна вертикальная опора, стреляет вдоль прицела.

import Phaser, { GameObjects } from 'phaser';
import { ejectCasing } from '../gfx/casing';
import {
  BULLET_FRAME,
  MG_BULLET_PAINT,
  MG_MOUNT_FRAME,
  paintQuiet,
  type BulletPaint,
} from '../gfx/looks';
import { bake } from '../gfx/textures';

export class MachineGun extends GameObjects.Container {
  static readonly textureKey = 'mg-bullet';
  static readonly barrelKey = 'tank-mg';
  // Путь в public/. Строка буквальная: singlefile-сборка подменяет её на data:.
  static readonly imagePath = 'assets/tank-mg.png';

  static readonly shop = {
    cost: 100,
    damage: 1,
  };

  // Пауза между очередями. Без покупок 3 с.
  static readonly baseFireDelay = 3000;
  // Магазин партии добивает паузу до 0,20 с. Прогресс сам останавливается на 0,50 с.
  static readonly minFireDelay = 200;
  static readonly minProgressFireDelay = 500;
  // Шаг партии 0,02 с, шаг прогресса 0,01 с.
  static readonly fireRateStep = 20;
  static readonly progressSpeedStepMs = 10;
  static progressSpeedLevel = 0;

  static get maxProgressSpeedLevel(): number {
    return (MachineGun.baseFireDelay - MachineGun.minProgressFireDelay) / MachineGun.progressSpeedStepMs;
  }

  static setProgressSpeedLevel(level: number): void {
    MachineGun.progressSpeedLevel = Math.min(
      MachineGun.maxProgressSpeedLevel,
      Math.max(0, Math.round(level)),
    );
  }

  // Прогресс не уводит паузу ниже 0,50 с, даже если в сохранении уровень выше нового потолка.
  private static progressCutMs(progressSpeed: number): number {
    const cut = Math.max(0, Math.round(progressSpeed)) * MachineGun.progressSpeedStepMs;
    return Math.min(cut, MachineGun.baseFireDelay - MachineGun.minProgressFireDelay);
  }

  // Магазин между волнами добивает остаток до 0,20 с. Прогресс сам останавливается на 0,50 с.
  static get maxFireRateLevel(): number {
    const room =
      MachineGun.baseFireDelay - MachineGun.progressCutMs(MachineGun.progressSpeedLevel) - MachineGun.minFireDelay;
    return Math.max(0, Math.floor(room / MachineGun.fireRateStep));
  }

  static fireDelayFor(level: number, progressSpeed = MachineGun.progressSpeedLevel): number {
    const progressCut = MachineGun.progressCutMs(progressSpeed);
    const room = MachineGun.baseFireDelay - progressCut - MachineGun.minFireDelay;
    const maxShop = Math.max(0, Math.floor(room / MachineGun.fireRateStep));
    const capped = Math.min(Math.max(0, Math.round(level)), maxShop);
    // Шаг партии 0,02 с, шаг прогресса 0,01 с. На потолке остаток короче шага
    // всё равно добирается до 0,20 с, иначе кнопка пишет «максимум» на 0,21 с.
    if (maxShop > 0 && capped >= maxShop) {
      return MachineGun.minFireDelay;
    }
    return Math.max(
      MachineGun.minFireDelay,
      MachineGun.baseFireDelay - capped * MachineGun.fireRateStep - progressCut,
    );
  }

  // Нарисованное поле по горизонтали. Широкое окно холст растягивает, скорость от этого не растёт.
  static readonly crossPx = 1280;
  // Полёт через это поле при ровном стволе. Без покупок 2 с, это 640 пикселей в секунду.
  static readonly baseFlightMs = 2000;
  // Магазин партии добивает полёт до 0,40 с. Прогресс сам останавливается на 0,60 с.
  static readonly minFlightMs = 400;
  static readonly minProgressFlightMs = 600;
  // Оба магазина снимают по 0,10 с за уровень.
  static readonly flightStepMs = 100;
  static progressFlightLevel = 0;

  static get maxProgressFlightLevel(): number {
    return (MachineGun.baseFlightMs - MachineGun.minProgressFlightMs) / MachineGun.flightStepMs;
  }

  static setProgressFlightLevel(level: number): void {
    MachineGun.progressFlightLevel = Math.min(
      MachineGun.maxProgressFlightLevel,
      Math.max(0, Math.round(level)),
    );
  }

  // Прогресс не уводит полёт ниже 0,60 с, даже если в сохранении уровень выше нового потолка.
  private static progressFlightCutMs(progressLevel: number): number {
    const cut = Math.max(0, Math.round(progressLevel)) * MachineGun.flightStepMs;
    return Math.min(cut, MachineGun.baseFlightMs - MachineGun.minProgressFlightMs);
  }

  // Магазин между волнами добивает остаток до 0,40 с. Прогресс сам останавливается на 0,60 с.
  static get maxShopFlightLevel(): number {
    const room =
      MachineGun.baseFlightMs - MachineGun.progressFlightCutMs(MachineGun.progressFlightLevel) - MachineGun.minFlightMs;
    return Math.max(0, Math.floor(room / MachineGun.flightStepMs));
  }

  static flightMsFor(level: number, progressLevel = MachineGun.progressFlightLevel): number {
    const progressCut = MachineGun.progressFlightCutMs(progressLevel);
    const room = MachineGun.baseFlightMs - progressCut - MachineGun.minFlightMs;
    const maxShop = Math.max(0, Math.floor(room / MachineGun.flightStepMs));
    const capped = Math.min(Math.max(0, Math.round(level)), maxShop);
    return Math.max(MachineGun.minFlightMs, MachineGun.baseFlightMs - capped * MachineGun.flightStepMs - progressCut);
  }

  // Пиксели в секунду за поле crossPx за время flightMsFor.
  static bulletSpeedFor(level: number, progressLevel = MachineGun.progressFlightLevel): number {
    return (MachineGun.crossPx * 1000) / MachineGun.flightMsFor(level, progressLevel);
  }

  // Очередь из магазина после проигрыша. Без покупок одна пуля, каждая покупка добавляет ещё одну.
  static readonly bulletMin = 1;
  static readonly bulletMax = 10;
  // Пауза между пулями одной очереди. Одиночный выстрел её не ждёт.
  static readonly burstGap = 100;

  static get maxBulletLevel(): number {
    return MachineGun.bulletMax - MachineGun.bulletMin;
  }

  static bulletCount(level: number): number {
    const extra = Math.max(0, Math.round(level));
    return Math.min(MachineGun.bulletMax, MachineGun.bulletMin + extra);
  }

  // Цапфа на оси ствола. Пятка опоры стоит на крыше башни, ближе к пушке.
  static readonly layout = {
    x: 26,
    y: -36,
    barrelLength: 44,
    originX: 27.5 / MG_MOUNT_FRAME.w,
    originY: 5.5 / MG_MOUNT_FRAME.h,
  };
  // Окно наверху коробки, левее цапфы. Дуло у правого края картинки.
  static readonly casingPort = { x: 20, y: 0 };

  private readonly barrel: Phaser.GameObjects.Image;
  private readonly worldPoint = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene) {
    const mount = MachineGun.layout;
    super(scene, mount.x, mount.y);

    this.barrel = scene.add.image(0, 0, MachineGun.barrelKey);
    this.barrel.setOrigin(mount.originX, mount.originY);
    this.add(this.barrel);
  }

  // Серый ствол, пока очередь выключена.
  setQuiet(quiet: boolean): void {
    paintQuiet(this.barrel, quiet);
  }

  // Прямоугольник картинки в координатах башни. Просмотр и попадания берут одно и то же.
  static aimBox(): { x: number; y: number; w: number; h: number } {
    const mount = MachineGun.layout;
    return {
      x: mount.x - mount.originX * MG_MOUNT_FRAME.w,
      y: mount.y - mount.originY * MG_MOUNT_FRAME.h,
      w: MG_MOUNT_FRAME.w,
      h: MG_MOUNT_FRAME.h,
    };
  }

  // GameScene и студия зовут до create. Пуля по-прежнему рисуется в ensureTextures.
  static preload(scene: Phaser.Scene): void {
    scene.load.image(MachineGun.barrelKey, MachineGun.imagePath);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(MachineGun.textureKey)) {
      bake(scene, MachineGun.textureKey, BULLET_FRAME.w, BULLET_FRAME.h, (g) => this.renderBullet(g));
    }
    if (scene.textures.exists(MachineGun.barrelKey)) {
      scene.textures.get(MachineGun.barrelKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  static renderBullet(g: Phaser.GameObjects.Graphics, paint: BulletPaint = MG_BULLET_PAINT): void {
    g.fillStyle(paint.body);
    g.fillRoundedRect(0, 1, 18, 6, 2);
    g.fillStyle(paint.tip);
    g.fillRect(12, 2, 5, 4);
  }

  // Гильза из окна на коробке. Бой зовёт на каждую пулю очереди.
  dropCasing(): void {
    this.barrel.setRotation(0);
    const matrix = this.barrel.getWorldTransformMatrix();
    const localX = MachineGun.casingPort.x - MachineGun.layout.originX * MG_MOUNT_FRAME.w;
    const localY = MachineGun.casingPort.y - MachineGun.layout.originY * MG_MOUNT_FRAME.h;
    const port = this.worldPoint;
    matrix.transformPoint(localX, localY, port);
    const scale = Math.hypot(matrix.a, matrix.b);
    ejectCasing(this.scene, port.x, port.y, Math.atan2(matrix.b, matrix.a), this.pictureDepth(), scale);
  }

  // Ствол смотрит вместе с башней; отдаёт мировые координаты дула и угол выстрела.
  muzzle(): { x: number; y: number; angle: number } {
    this.barrel.setRotation(0);

    const tip = this.worldPoint;
    const matrix = this.barrel.getWorldTransformMatrix();
    matrix.transformPoint(MachineGun.layout.barrelLength, 0, tip);

    return {
      x: tip.x,
      y: tip.y,
      angle: Math.atan2(matrix.b, matrix.a),
    };
  }

  // Пулемёт вложен в башню. Глубина контейнера танка, не локальный ноль внутри неё.
  private pictureDepth(): number {
    let node: Phaser.GameObjects.Container = this;
    while (node.parentContainer) {
      node = node.parentContainer;
    }
    return node.depth;
  }
}
