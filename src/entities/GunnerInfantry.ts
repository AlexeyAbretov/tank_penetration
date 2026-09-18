import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { EnemyShot } from './EnemyShot';
import { Infantry } from './Infantry';

export class GunnerInfantry extends Infantry {
  readonly coinReward = 2;
  readonly reachesBase = false;
  readonly contactDamage = 0;

  private readonly holdX = 640;
  private readonly fireDelay = 1500;
  private readonly bulletSpeed = 420;
  private readonly shotDamage = 8;

  private readonly shots: Phaser.Physics.Arcade.Group;
  private shooting = false;
  private fireCooldown = 400;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
  ) {
    super(scene, x, y, hp, 'gunner-0', 'gunner-walk', 0x3a8ad4);
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
      this.setTexture('gunner-0');
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
    const x = this.x - 38;
    const y = this.y - this.displayHeight * 0.42;
    const angle = Phaser.Math.Angle.Between(x, y, GAME.tankX + 24, GAME.tankY);
    const shot = new EnemyShot(this.scene, x, y, this.shotDamage);
    this.shots.add(shot);
    shot.launch(angle, this.bulletSpeed);
  }
}
