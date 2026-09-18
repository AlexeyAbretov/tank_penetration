import Phaser from 'phaser';
import type { SpawnContext } from './EnemyFactory';
import { Infantry } from './Infantry';
import { RangedEnemy } from './RangedEnemy';

export class GunnerInfantry extends RangedEnemy {
  readonly coinReward = 2;
  protected readonly holdX = 640;
  protected readonly fireDelay = 1500;
  protected readonly bulletSpeed = 420;
  protected readonly shotDamage = 8;
  protected readonly idleTexture = 'gunner-0';
  protected readonly muzzle = { x: -38, y: -42 };

  static matches(index: number): boolean {
    return index % 4 === 2;
  }

  static spawn(ctx: SpawnContext): Infantry {
    return new GunnerInfantry(ctx.scene, ctx.x, ctx.y, ctx.hp, ctx.shots);
  }

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
