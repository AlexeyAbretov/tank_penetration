import Phaser from 'phaser';
import { GAME } from '../gameConfig';

export class Infantry extends Phaser.Physics.Arcade.Sprite {
  hp = GAME.infantryHp;
  reachedWall = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'infantry-0');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(10);
    this.setOrigin(0.5, 0.88);
    this.setScale(1.45);
    this.play('infantry-walk');

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 44);
    body.setOffset(16, 22);
    body.setVelocityX(-Phaser.Math.Between(38, 56));
    body.setImmovable(false);
  }

  hit(): boolean {
    this.hp -= 1;
    this.setTint(0xffccaa);
    this.scene.time.delayedCall(70, () => {
      if (this.active) {
        this.clearTint();
      }
    });
    return this.hp <= 0;
  }

  kill(): void {
    this.reachedWall = true;
    this.body?.stop();
    this.anims.stop();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.6,
      duration: 180,
      onComplete: () => this.destroy(),
    });
  }
}
