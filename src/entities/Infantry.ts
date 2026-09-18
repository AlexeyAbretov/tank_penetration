import Phaser from 'phaser';
import { GAME } from '../gameConfig';

export type InfantryRole = 'assault' | 'gunner';

export class Infantry extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  readonly maxHp: number;
  readonly role: InfantryRole;
  readonly coinReward: number;
  reachedWall = false;
  fireAtTank?: (from: Infantry) => void;

  private shooting = false;
  private fireCooldown = 400;
  private readonly barBg: Phaser.GameObjects.Rectangle;
  private readonly barFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number, role: InfantryRole = 'assault') {
    super(scene, x, y, role === 'gunner' ? 'gunner-0' : 'infantry-0');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.role = role;
    this.maxHp = hp;
    this.hp = hp;
    this.coinReward = role === 'gunner' ? GAME.shooterCoins : GAME.killCoins;

    this.setDepth(10);
    this.setOrigin(0.5, 0.88);
    this.setScale(1.45);
    this.play(role === 'gunner' ? 'gunner-walk' : 'infantry-walk');

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(36, 52);
    body.setOffset(14, 10);
    body.setImmovable(false);
    body.setAllowGravity(false);

    this.barBg = scene.add.rectangle(x, y, 30, 5, 0x2a0a0a).setDepth(11);
    this.barFill = scene.add
      .rectangle(x, y, 30, 5, role === 'gunner' ? 0x3a8ad4 : 0xd42a2a)
      .setOrigin(0, 0.5)
      .setDepth(12);
    this.once('destroy', () => {
      this.barBg.destroy();
      this.barFill.destroy();
    });
    this.syncBar();
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.syncBar();
    if (this.reachedWall || this.scene.registry.get('combat') === false) {
      return;
    }
    this.updateGunner(delta);
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
    this.shooting = false;
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

  private updateGunner(delta: number): void {
    if (this.role !== 'gunner') {
      return;
    }
    if (!this.shooting && this.x <= GAME.shooterHoldX) {
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
    this.fireCooldown = GAME.shooterFireDelay;
    this.fireAtTank?.(this);
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
