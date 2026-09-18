import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { EnemyShot } from './EnemyShot';
import { Infantry } from './Infantry';

export abstract class RangedEnemy extends Infantry {
  protected abstract readonly holdX: number;
  protected abstract readonly fireDelay: number;
  protected abstract readonly bulletSpeed: number;
  protected abstract readonly shotDamage: number;
  protected abstract readonly idleTexture: string;
  protected abstract readonly muzzle: { x: number; y: number };

  readonly reachesBase = false;
  readonly contactDamage = 0;

  private readonly shots: Phaser.Physics.Arcade.Group;
  private shooting = false;
  private fireCooldown = 350;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    texture: string,
    walkKey: string,
    barColor: number,
    shots: Phaser.Physics.Arcade.Group,
  ) {
    super(scene, x, y, hp, texture, walkKey, barColor);
    this.shots = shots;
  }

  override kill(): void {
    this.shooting = false;
    super.kill();
  }

  protected override act(delta: number): void {
    if (!this.shooting && this.x <= this.holdX) {
      this.shooting = true;
      this.body?.stop();
      this.anims.stop();
      this.setTexture(this.idleTexture);
    }
    if (!this.shooting) {
      return;
    }

    this.fireCooldown -= delta;
    if (this.fireCooldown > 0) {
      return;
    }
    this.fireCooldown = this.fireDelay;
    this.fire();
  }

  private fire(): void {
    const x = this.x + this.muzzle.x;
    const y = this.y + this.muzzle.y;
    const angle = Phaser.Math.Angle.Between(x, y, GAME.tankX + 24, GAME.tankY);
    const shot = new EnemyShot(this.scene, x, y, this.shotDamage);
    this.shots.add(shot);
    shot.launch(angle, this.bulletSpeed);
  }
}
