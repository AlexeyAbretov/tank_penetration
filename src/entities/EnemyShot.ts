// Пуля врага: маленькая картинка с физическим телом и своим уроном.

import { GameObjects, Physics, Scene } from 'phaser';
import { BULLET_FRAME, BULLET_PAINT, type BulletPaint } from '../gfx/looks';
import { bake } from '../gfx/textures';

// Image, не Sprite: у пули нет покадровой анимации, только одна текстура enemy-bullet.
export class EnemyShot extends Physics.Arcade.Image {
  // Урон этой пули. Стрелок и пикап задают разное число при создании.
  readonly damage: number;
  // Узкий хитбокс по форме пули. Попадание в танк сцена проверяет отдельно, по координате.
  static readonly bodySize = { w: 14, h: 8 };

  // Короткая жёлтая пуля, 18×8. Светлый носик справа, в игре картинку ещё поворачивают по углу полёта.
  static ensureTextures(scene: Scene): void {
    if (scene.textures.exists('enemy-bullet')) {
      return;
    }
    bake(scene, 'enemy-bullet', BULLET_FRAME.w, BULLET_FRAME.h, (g) => this.render(g));
  }

  static render(g: GameObjects.Graphics, paint: BulletPaint = BULLET_PAINT): void {
    g.fillStyle(paint.body);
    g.fillRoundedRect(0, 1, 18, 6, 2);
    g.fillStyle(paint.tip);
    g.fillRect(12, 2, 5, 4);
  }

  constructor(scene: Scene, x: number, y: number, damage: number, texture = 'enemy-bullet') {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.damage = damage;
    // Чуть выше солдат (10) и чуть ниже снаряда танка (15), чтобы вспышки читались.
    this.setDepth(14);

    const body = this.body as Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(EnemyShot.bodySize.w, EnemyShot.bodySize.h);
  }

  // Запускает пулю под углом angle (радианы) со скоростью speed (пиксели в секунду).
  // Возвращает this, чтобы при желании писать цепочкой: new EnemyShot(...).launch(...).
  launch(angle: number, speed: number): this {
    // Картинка поворачивается носом по направлению полёта.
    this.setRotation(angle);
    // cos даёт долю скорости по X, sin — по Y. Угол 0 — строго вправо, Math.PI — строго влево.
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    return this;
  }
}
