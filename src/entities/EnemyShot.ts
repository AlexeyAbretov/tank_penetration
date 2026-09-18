import Phaser from 'phaser';

export class EnemyShot extends Phaser.Physics.Arcade.Image {
  readonly damage: number;

  constructor(scene: Phaser.Scene, x: number, y: number, damage: number) {
    super(scene, x, y, 'enemy-bullet');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.damage = damage;
    this.setDepth(14);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(14, 8);
  }

  launch(angle: number, speed: number): this {
    this.setRotation(angle);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    return this;
  }
}
