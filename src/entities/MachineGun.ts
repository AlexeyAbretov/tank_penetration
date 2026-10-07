// Пулемёт на крыше башни: покупается в магазине, стреляет вдоль прицела башни.

import Phaser, { GameObjects } from 'phaser';
import {
  BULLET_FRAME,
  MG_BULLET_PAINT,
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

  // Точка на крыше башни, в координатах контейнера aim.
  static readonly layout = {
    x: 10,
    y: -34,
    barrelLength: 28,
    originX: 6 / 40,
    originY: 0.5,
  };

  private readonly barrel: Phaser.GameObjects.Image;
  private readonly worldPoint = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, tank: Tank) {
    const mount = MachineGun.layout;
    super(scene, mount.x, mount.y);
    MachineGun.ensureTextures(scene);

    const base = scene.add.image(0, 0, MachineGun.barrelKey);
    base.setOrigin(0.35, 0.5);
    this.barrel = scene.add.image(8, -2, MachineGun.barrelKey);
    this.barrel.setOrigin(mount.originX, mount.originY);
    this.barrel.setScale(0.55, 0.42);
    this.add([base, this.barrel]);
    tank.mountMachineGun(this);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(MachineGun.textureKey)) {
      bake(scene, MachineGun.textureKey, BULLET_FRAME.w, BULLET_FRAME.h, (g) => this.renderBullet(g));
    }
    if (!scene.textures.exists(MachineGun.barrelKey)) {
      bake(scene, MachineGun.barrelKey, 40, 16, (g) => this.renderMount(g));
    }
  }

  static renderBullet(g: Phaser.GameObjects.Graphics, paint: BulletPaint = MG_BULLET_PAINT): void {
    g.fillStyle(paint.body);
    g.fillRoundedRect(0, 1, 18, 6, 2);
    g.fillStyle(paint.tip);
    g.fillRect(12, 2, 5, 4);
  }

  static renderMount(g: Phaser.GameObjects.Graphics, paint: MgMountPaint = MG_MOUNT_PAINT): void {
    g.fillStyle(paint.base);
    g.fillRoundedRect(0, 4, 14, 8, 2);
    g.fillStyle(paint.barrel);
    g.fillRoundedRect(12, 5, 26, 6, 2);
    g.fillStyle(paint.tip);
    g.fillRect(34, 4, 4, 8);
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
