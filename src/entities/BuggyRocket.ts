// Ракета багги. Сначала чуть задирает нос и держит свой изгиб, у танка изгиб сходит на нет.
// Дуга не выходит за поле: у края вертикаль гасится, и ракета скользит вдоль рамки.
// Лазер, завеса и броня видят её как обычную ракету: это тот же класс Rocket.

import Phaser from 'phaser';
import { enemyHasteOf, GAME } from '../gameConfig';
import { Rocket } from './Rocket';
import type { WorldPoint } from '../types/WorldPoint';

export class BuggyRocket extends Rocket {
  // Радиан в секунду. За полёт через поле ракета успевает лечь на танк, но не ломает дугу в точку.
  static readonly turnRate = 2.4;
  // Сколько миллисекунд после пуска нос ещё тянет вверх. Дальше остаётся только цель.
  static readonly climbMs = 520;
  // Насколько вверх уходит желаемый курс в момент пуска. К концу climbMs добавка нулевая.
  static readonly climb = 0.85;
  // Ближе этого расстояния свой изгиб тает, и ракета ложится прямо на танк.
  static readonly spreadHold = 220;
  // Общая картинка ракетчика нарисована под его масштаб 1.8. Трубка багги короче, поэтому здесь меньше.
  static readonly spriteScale = 0.7;

  private readonly target: WorldPoint;
  // Свой изгиб этой трубки. Пока цель далеко, курс держит его, иначе залп сливается в одну дугу.
  private readonly spread: number;
  private guided = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    damage: number,
    target: WorldPoint,
    spread: number,
  ) {
    super(scene, x, y, damage);
    this.setScale(BuggyRocket.spriteScale);
    this.target = target;
    this.spread = spread;
    const steer = (_time: number, delta: number) => {
      if (this.active) {
        this.guide(delta);
      }
    };
    scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, steer);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, steer);
    });
  }

  override launch(angle: number, speed: number): this {
    this.guided = true;
    return super.launch(angle, speed);
  }

  // Отскок уже сменил курс. Дальше ракета летит прямо и врагов на пути считает бой.
  private guide(delta: number): void {
    if (!this.guided || this.hasBounced()) {
      return;
    }
    if (this.scene.time.paused || this.scene.registry.get('combat') === false) {
      return;
    }
    const haste = enemyHasteOf(this.scene.registry);
    const maxTurn = BuggyRocket.turnRate * haste * (delta / 1000);
    const desired = this.desiredAngle();
    const step = Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(desired - this.rotation), -maxTurn, maxTurn);
    this.setRotation(this.keepInside(this.rotation + step));
    this.syncPace();
  }

  // Курс на точку танка. В начале полёта к нему примешана доля вверх, она тает.
  // Свой изгиб держится на дальней части пути и сходит к нулю у танка.
  private desiredAngle(): number {
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    let aimY = dy;
    const flown = this.flownMs(this.scene.time.now);
    if (flown < BuggyRocket.climbMs && this.y > 90) {
      const lift = BuggyRocket.climb * (1 - flown / BuggyRocket.climbMs);
      aimY -= dist * lift;
    }
    const fade = dist > BuggyRocket.spreadHold ? 1 : dist / BuggyRocket.spreadHold;
    return Math.atan2(aimY, dx) + this.spread * fade;
  }

  // Взгляд на шаг вперёд. Если он за рамкой поля, эта ось курса обнуляется.
  // Ракета доезжает до края и идёт вдоль него, пока цель снова не окажется внутри.
  private keepInside(angle: number): number {
    const pad = 16;
    const minY = pad;
    const maxY = GAME.bannerY - pad;
    const minX = pad;
    const maxX = GAME.width - pad;
    const look = 28;
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);
    if (this.y + dy * look < minY && dy < 0) {
      dy = 0;
    }
    if (this.y + dy * look > maxY && dy > 0) {
      dy = 0;
    }
    if (this.x + dx * look < minX && dx < 0) {
      dx = 0;
    }
    if (this.x + dx * look > maxX && dx > 0) {
      dx = 0;
    }
    if (dx * dx + dy * dy < 1e-4) {
      dx = this.target.x - this.x;
      dy = 0;
    }
    return Math.atan2(dy, dx);
  }
}
