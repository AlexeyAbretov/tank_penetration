// Пулемёт перед люком башни: одна вертикальная опора, стреляет вдоль прицела.

import Phaser, { GameObjects } from 'phaser';
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
    fireIntervalMs: 3000,
    damage: 1,
    // Нарисованное поле 1280 по горизонтали за 2 с. Широкое окно холст растягивает, скорость от этого не растёт.
    bulletSpeed: 640,
  };

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
}
