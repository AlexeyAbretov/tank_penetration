// Пулемёт перед люком башни: одна вертикальная опора, стреляет вдоль прицела.

import Phaser, { GameObjects } from 'phaser';
import {
  BULLET_FRAME,
  MG_BULLET_PAINT,
  MG_MOUNT_FRAME,
  MG_MOUNT_PAINT,
  type BulletPaint,
  type MgMountPaint,
} from '../gfx/looks';
import { bake } from '../gfx/textures';
import { Tank } from './Tank';

export class MachineGun extends GameObjects.Container {
  static readonly textureKey = 'mg-bullet';
  static readonly barrelKey = 'mg-mount';

  static readonly shop = {
    cost: 100,
    fireIntervalMs: 3000,
    damage: 1,
    bulletSpeed: 720,
  };

  // Цапфа в координатах контейнера aim. Пятка опоры стоит на крыше башни, ближе к стволу.
  static readonly layout = {
    x: 16,
    y: -22,
    barrelLength: 30,
    originX: 14 / MG_MOUNT_FRAME.w,
    originY: 3 / MG_MOUNT_FRAME.h,
  };

  private readonly barrel: Phaser.GameObjects.Image;
  private readonly worldPoint = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, tank: Tank) {
    const mount = MachineGun.layout;
    super(scene, mount.x, mount.y);
    MachineGun.ensureTextures(scene);

    this.barrel = scene.add.image(0, 0, MachineGun.barrelKey);
    this.barrel.setOrigin(mount.originX, mount.originY);
    this.add(this.barrel);
    tank.mountMachineGun(this, MachineGun.aimBox());
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

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(MachineGun.textureKey)) {
      bake(scene, MachineGun.textureKey, BULLET_FRAME.w, BULLET_FRAME.h, (g) => this.renderBullet(g));
    }
    if (!scene.textures.exists(MachineGun.barrelKey)) {
      bake(scene, MachineGun.barrelKey, MG_MOUNT_FRAME.w, MG_MOUNT_FRAME.h, (g) => this.renderMount(g));
    }
  }

  static renderBullet(g: Phaser.GameObjects.Graphics, paint: BulletPaint = MG_BULLET_PAINT): void {
    g.fillStyle(paint.body);
    g.fillRoundedRect(0, 1, 18, 6, 2);
    g.fillStyle(paint.tip);
    g.fillRect(12, 2, 5, 4);
  }

  static renderMount(g: Phaser.GameObjects.Graphics, paint: MgMountPaint = MG_MOUNT_PAINT): void {
    // Казённик сзади ствола, затыльник и рукоять. Цапфа текстуры — (14, 3).
    g.fillStyle(paint.base);
    g.fillRoundedRect(3, 0, 16, 8, 2);
    g.fillRect(6, 7, 3, 4);
    g.fillStyle(paint.tip);
    g.fillRect(3, 1, 3, 6);
    g.fillStyle(paint.base);
    g.fillRect(15, 6, 5, 13);
    g.fillStyle(paint.barrel);
    g.fillRoundedRect(14, 1, 26, 5, 2);
    g.fillStyle(paint.tip);
    g.fillRect(39, 0, 5, 7);
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
