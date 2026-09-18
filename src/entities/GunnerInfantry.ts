import Phaser from 'phaser';
import { RangedEnemy } from './RangedEnemy';

export class GunnerInfantry extends RangedEnemy {
  readonly coinReward = 2;
  protected readonly holdX = 640;
  protected readonly fireDelay = 1500;
  protected readonly bulletSpeed = 420;
  protected readonly shotDamage = 8;
  protected readonly idleTexture = 'gunner-0';
  protected readonly muzzle = { x: -38, y: -42 };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
  ) {
    super(scene, x, y, hp, 'gunner-0', 'gunner-walk', 0x3a8ad4, shots);
  }
}
