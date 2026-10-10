// Пулемёт перед люком башни: одна вертикальная опора, стреляет вдоль прицела.

import Phaser, { GameObjects } from 'phaser';
import {
  BULLET_FRAME,
  MG_BULLET_PAINT,
  MG_MOUNT_FRAME,
  type BulletPaint,
} from '../gfx/looks';
import { bake } from '../gfx/textures';

export class MachineGun extends GameObjects.Container {
  static readonly textureKey = 'mg-bullet';
  static readonly barrelKey = 'tank-mg';

  static readonly shop = {
    cost: 1,
    fireIntervalMs: 3000,
    damage: 1,
    bulletSpeed: 720,
  };

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
    MachineGun.ensureTextures(scene);

    this.barrel = scene.add.image(0, 0, MachineGun.barrelKey);
    this.barrel.setOrigin(mount.originX, mount.originY);
    this.add(this.barrel);
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
