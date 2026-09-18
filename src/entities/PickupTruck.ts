import Phaser from 'phaser';
import type { SpawnContext } from './EnemyFactory';
import { Infantry } from './Infantry';
import { RangedEnemy } from './RangedEnemy';

export class PickupTruck extends RangedEnemy {
  readonly coinReward = 3;
  override readonly hitRadius: number = 86;
  protected readonly holdX = 640;
  protected readonly fireDelay = 280;
  protected readonly bulletSpeed = 520;
  protected readonly shotDamage = 2;
  protected readonly idleTexture = 'pickup-0';
  protected readonly muzzle = { x: -68, y: -40 };

  static matches(index: number): boolean {
    return index % 5 === 4;
  }

  static spawn(ctx: SpawnContext): Infantry {
    return new PickupTruck(ctx.scene, ctx.x, ctx.y, ctx.hp, ctx.shots);
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
  ) {
    super(scene, x, y, hp + 1, 'pickup-0', 'pickup-drive', 0xe0a020, shots);
    this.setScale(1.18);
    this.setOrigin(0.5, 0.82);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(110, 42);
    body.setOffset(12, 28);
  }

  override march(wave = 1): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = 78 + wave * 6 + Phaser.Math.Between(0, 8);
    body.setVelocityX(-speed);
  }
}
