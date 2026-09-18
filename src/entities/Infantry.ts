import Phaser from 'phaser';
import { GAME } from '../gameConfig';

export class Infantry extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  readonly maxHp: number;
  reachedWall = false;

  private readonly barBg: Phaser.GameObjects.Rectangle;
  private readonly barFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number) {
    super(scene, x, y, 'infantry-0');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.maxHp = hp;
    this.hp = hp;

    this.setDepth(10);
    this.setOrigin(0.5, 0.88);
    this.setScale(1.45);
    this.play('infantry-walk');

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(36, 52);
    body.setOffset(14, 10);
    body.setImmovable(false);
    body.setAllowGravity(false);

    this.barBg = scene.add.rectangle(x, y, 30, 5, 0x2a0a0a).setDepth(11);
    this.barFill = scene.add.rectangle(x, y, 30, 5, 0xd42a2a).setOrigin(0, 0.5).setDepth(12);
    this.once('destroy', () => {
      this.barBg.destroy();
      this.barFill.destroy();
    });
    this.syncBar();
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.syncBar();
  }

  march(wave = 1): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = 36 + wave * 4 + Phaser.Math.Between(0, 10);
    body.setVelocityX(-speed);
  }

  hit(damage: number = GAME.shellDamage): boolean {
    this.hp = Math.max(0, this.hp - damage);
    this.setTint(0xffccaa);
    this.scene.time.delayedCall(70, () => {
      if (this.active) {
        this.clearTint();
      }
    });
    this.syncBar();
    return this.hp <= 0;
  }

  kill(): void {
    this.reachedWall = true;
    this.body?.stop();
    this.anims.stop();
    this.barBg.setVisible(false);
    this.barFill.setVisible(false);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.6,
      duration: 180,
      onComplete: () => this.destroy(),
    });
  }

  private syncBar(): void {
    if (!this.barBg.active) {
      return;
    }
    const top = this.y - this.displayHeight * 0.95;
    this.barBg.setPosition(this.x, top);
    this.barFill.setPosition(this.x - 15, top);
    this.barFill.width = 30 * (this.hp / this.maxHp);
  }
}
