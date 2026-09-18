import Phaser from 'phaser';
import { GAME } from '../gameConfig';

export class Tank extends Phaser.GameObjects.Container {
  private readonly turret: Phaser.GameObjects.Image;
  private cooldown = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    const hull = scene.add.image(8, 16, 'tank-hull');
    this.turret = scene.add.image(18, -10, 'tank-turret');
    this.turret.setOrigin(0.22, 0.5);

    this.add([hull, this.turret]);
    scene.add.existing(this);
    this.setDepth(25);
    this.setSize(160, 96);
  }

  aimAt(x: number, y: number): void {
    const angle = Phaser.Math.Angle.Between(
      this.x + this.turret.x,
      this.y + this.turret.y,
      x,
      y,
    );
    this.turret.setRotation(Phaser.Math.Clamp(angle, -0.85, 0.85));
  }

  tick(delta: number): void {
    this.cooldown = Math.max(0, this.cooldown - delta);
  }

  tryFire(): { x: number; y: number; angle: number } | null {
    if (this.cooldown > 0) {
      return null;
    }
    this.cooldown = GAME.fireDelay;
    this.scene.tweens.add({
      targets: this.turret,
      x: 10,
      duration: 40,
      yoyo: true,
    });
    return this.getMuzzle();
  }

  private getMuzzle(): { x: number; y: number; angle: number } {
    const angle = this.turret.rotation;
    const length = 118;
    return {
      x: this.x + this.turret.x + Math.cos(angle) * length,
      y: this.y + this.turret.y + Math.sin(angle) * length,
      angle,
    };
  }
}
