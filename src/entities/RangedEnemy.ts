// Общий предок врагов, которые не доходят до стены, а встают и стреляют по танку.
// Конкретные числа (где встать, как часто стрелять) задают GunnerInfantry и PickupTruck.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { EnemyShot } from './EnemyShot';
import { Infantry } from './Infantry';

export abstract class RangedEnemy extends Infantry {
  // Координата X, до которой юнит идёт. Дальше останавливается и стреляет.
  protected abstract readonly holdX: number;
  // Пауза между выстрелами, миллисекунды.
  protected abstract readonly fireDelay: number;
  // Скорость пули, пиксели в секунду.
  protected abstract readonly bulletSpeed: number;
  // Урон одной пули по базе.
  protected abstract readonly shotDamage: number;
  // Картинка «стою и стреляю». У шага две картинки, у стойки — первая из них.
  protected abstract readonly idleTexture: string;
  // Смещение дула относительно точки спрайта: отрицательный X — влево, к танку.
  protected abstract readonly muzzle: { x: number; y: number };

  // Стрелок не бьёт базу корпусом.
  readonly reachesBase = false;
  // Контактного урона нет: урон наносят только пули.
  readonly contactDamage = 0;

  // Общая группа пуль сцены. Сюда кладём каждый выстрел, чтобы сцена могла их обновлять.
  private readonly shots: Phaser.Physics.Arcade.Group;
  // false, пока юнит ещё идёт к рубежу.
  private shooting = false;
  // Сколько миллисекунд осталось до следующего выстрела. Стартовые 350 — короткая задержка после остановки.
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
    // Родитель создаёт спрайт, полоску HP и физическое тело.
    super(scene, x, y, hp, texture, walkKey, barColor);
    this.shots = shots;
  }

  // override: заменяем kill родителя, но всё равно вызываем его через super.
  override kill(): void {
    // Чтобы труп не выстрелил на последнем кадре, пока идёт анимация исчезновения.
    this.shooting = false;
    super.kill();
  }

  // Каждый кадр, пока идёт бой. delta — время с прошлого кадра в миллисекундах.
  protected override act(delta: number): void {
    // Дошли до рубежа впервые: гасим скорость и переключаемся на неподвижную картинку.
    if (!this.shooting && this.x <= this.holdX) {
      this.shooting = true;
      this.body?.stop();
      this.anims.stop();
      this.setTexture(this.idleTexture);
    }
    // Пока идём — стрелять рано, скорость уже задана методом march.
    if (!this.shooting) {
      return;
    }

    // Кулдаун тикает только в бою: act не вызывается, когда магазин на паузе.
    this.fireCooldown -= delta;
    if (this.fireCooldown > 0) {
      return;
    }
    // Списываем интервал сразу, до выстрела, чтобы следующий ждал полную паузу.
    this.fireCooldown = this.fireDelay;
    this.fire();
  }

  // Создаёт одну пулю из точки дула в сторону танка.
  private fire(): void {
    // Координаты дула в мире: позиция юнита плюс смещение, заданное наследником.
    const x = this.x + this.muzzle.x;
    const y = this.y + this.muzzle.y;
    // Угол от дула к точке чуть правее центра танка, чтобы пуля целилась в корпус.
    const angle = Phaser.Math.Angle.Between(x, y, GAME.tankX + 24, GAME.tankY);
    const shot = new EnemyShot(this.scene, x, y, this.shotDamage);
    this.shots.add(shot);
    shot.launch(angle, this.bulletSpeed);
    this.onFire(x, y, angle);
  }

  // Точка дула и угол пули уже посчитаны. Наследник здесь рисует вспышку и отдачу.
  protected onFire(_x: number, _y: number, _angle: number): void {}
}
