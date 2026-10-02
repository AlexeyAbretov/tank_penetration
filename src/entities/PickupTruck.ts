// Пикап: крупная машина. Едет быстрее солдат, встаёт на том же рубеже и стреляет чаще.
// Урон пули меньше, чем у стрелка, но здоровье выше и награда больше.

import Phaser from 'phaser';
import { bake } from '../gfx/textures';
import type { SpawnContext } from './SpawnContext';
import { Infantry } from './Infantry';
import { RangedEnemy } from './RangedEnemy';

export class PickupTruck extends RangedEnemy {
  readonly coinReward = 3;
  // Зона попадания шире солдатской (46): снаряд задевает машину с большего расстояния.
  // override: у родителя Infantry это поле уже есть, здесь мы задаём своё значение.
  override readonly hitRadius: number = 86;
  protected readonly holdX = 640;
  // Почти непрерывная очередь: пауза 280 мс.
  protected readonly fireDelay = 280;
  protected readonly bulletSpeed = 520;
  // Слабее винтовки стрелка, но выстрелов много.
  protected readonly shotDamage = 2;
  protected readonly idleTexture = 'pickup-0';
  // Дуло в кабине, левее и выше точки опоры машины.
  protected readonly muzzle = { x: -72, y: -54 };

  // Индексы 4, 9, 14, 19... — каждая пятая позиция, если считать с нуля и смотреть остаток 4.
  static matches(index: number): boolean {
    return index % 5 === 4;
  }

  static spawn(ctx: SpawnContext): Infantry {
    // Возвращаемый тип — общий Infantry, чтобы фабрика не зависела от конкретного класса.
    return new PickupTruck(ctx.scene, ctx.x, ctx.y, ctx.hp, ctx.shots);
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
  ) {
    // hp + 1: машина чуть живучее пехоты той же волны.
    // Жёлтая полоска HP, текстуры pickup-0 / pickup-1, анимация pickup-drive.
    super(scene, x, y, hp + 1, 'pickup-0', 'pickup-drive', 0xe0a020, shots);
    // Машина нарисована крупнее солдата, дополнительный масштаб небольшой.
    this.setScale(1.18);
    // Точка опоры ближе к низу кузова, чтобы колёса стояли на «земле» дорожки.
    this.setOrigin(0.5, 0.82);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Хитбокс шире и ниже, чем у солдата: это корпус машины, не человек.
    body.setSize(110, 42);
    body.setOffset(12, 28);
  }

  // Своя скорость: родительский march для пехоты слишком медленный.
  override march(wave = 1): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = 78 + wave * 6 + Phaser.Math.Between(0, 8);
    body.setVelocityX(-speed);
  }

  // Два кадра колёс. Анимация pickup-drive чередует их.
  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('pickup-0')) {
      bake(scene, 'pickup-0', 160, 80, (g) => this.draw(g, 0));
      bake(scene, 'pickup-1', 160, 80, (g) => this.draw(g, 1));
    }
    if (!scene.anims.exists('pickup-drive')) {
      scene.anims.create({
        key: 'pickup-drive',
        frames: [{ key: 'pickup-0' }, { key: 'pickup-1' }],
        frameRate: 8, // колёса чуть быстрее солдатского шага
        repeat: -1,
      });
    }
  }

  // Пикап боком, нос влево (к танку). wheelPhase сдвигает спицы, чтобы колёса «крутились».
  private static draw(g: Phaser.GameObjects.Graphics, wheelPhase: 0 | 1): void {
    // Тень под машиной. Холст 160×80, низ около y = 74.
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(84, 74, 128, 12);

    // Три цвета кузова, чтобы не повторять длинные числа в каждой фигуре.
    const body = 0x5a6a38; // оливковый борт
    const bodyDark = 0x3a4a24; // тень на борту
    const metal = 0x2a2e22; // тёмный металл рамы

    // Рама по всей длине, на ней потом стоят кабины и колёса.
    g.fillStyle(metal);
    g.fillRoundedRect(14, 50, 136, 10, 3);

    // Капот слева: машина едет влево, мотор впереди.
    g.fillStyle(body);
    g.fillRoundedRect(16, 40, 38, 20, 4);
    g.fillStyle(bodyDark);
    g.fillRect(18, 48, 34, 5);
    // Бампер.
    g.fillStyle(0x1a1c16);
    g.fillRect(12, 46, 8, 14);
    // Фара.
    g.fillStyle(0xd8d080);
    g.fillCircle(15, 50, 3);

    // Грузовой борт справа, позади кабины.
    g.fillStyle(bodyDark);
    g.fillRoundedRect(90, 34, 56, 26, 3);
    g.fillStyle(0x4a5a30); // светлый верхний край борта
    g.fillRect(92, 38, 52, 8);
    g.fillStyle(0x2a341c); // щель между досками
    g.fillRect(92, 44, 52, 4);
    // Металлическая обвязка кузова.
    g.fillStyle(metal);
    g.fillRect(90, 32, 56, 4);
    g.fillRect(90, 32, 4, 22);
    g.fillRect(142, 32, 4, 22);
    // Задний борт ещё правее.
    g.fillStyle(bodyDark);
    g.fillRect(144, 34, 6, 26);

    // Кабина по центру, выше капота.
    g.fillStyle(0x2a341c);
    g.fillRoundedRect(50, 14, 42, 46, 5);
    g.fillStyle(body);
    g.fillRoundedRect(52, 16, 38, 42, 4);
    g.fillStyle(bodyDark);
    g.fillRect(54, 40, 34, 8);

    // Лобовое стекло и блик. Второй аргумент цвета у fillStyle — прозрачность блика.
    g.fillStyle(0x1a3040);
    g.fillRoundedRect(54, 20, 22, 16, 3);
    g.fillStyle(0x88c8e0, 0.9);
    g.fillRoundedRect(56, 22, 18, 12, 2);
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(58, 24, 6, 4);
    // Боковое окошко.
    g.fillStyle(0x88c8e0, 0.7);
    g.fillRoundedRect(78, 22, 10, 12, 2);

    // Голова водителя над бортом и плечи.
    g.fillStyle(0x2a2218);
    g.fillCircle(118, 26, 7);
    g.fillStyle(0x3a4a28);
    g.fillRect(112, 30, 14, 14);

    // Антенна или стойка и длинный поручень вдоль крыши.
    g.fillStyle(0x2a2a26);
    g.fillRect(112, 16, 7, 16);
    g.fillStyle(0x1a1a16);
    g.fillRoundedRect(20, 18, 98, 5, 2);
    g.fillStyle(0x4a4a42);
    g.fillRect(20, 18, 10, 5);
    // Наконечник поручня.
    g.fillStyle(0x6a6a60);
    g.fillCircle(24, 20, 3);

    // В втором кадре спицы повёрнуты на 0.5 радиана, около 29 градусов.
    const spoke = wheelPhase === 0 ? 0 : 0.5;
    // Колесо в точке cx. Два вызова рисуют переднее и заднее.
    const drawWheel = (cx: number) => {
      g.fillStyle(0x1a1a16); // покрышка
      g.fillCircle(cx, 62, 14);
      g.fillStyle(0x3a3a32); // диск
      g.fillCircle(cx, 62, 9);
      g.fillStyle(0x1a1a16); // ступица
      g.fillCircle(cx, 62, 3);
      // Две спицы крест-накрест. Угол spoke задаёт поворот.
      g.lineStyle(2, 0x8a8a80, 1);
      g.beginPath();
      // cos и sin от угла дают точку на окружности радиуса 8 вокруг центра колеса.
      g.moveTo(cx + Math.cos(spoke) * 8, 62 + Math.sin(spoke) * 8);
      g.lineTo(cx - Math.cos(spoke) * 8, 62 - Math.sin(spoke) * 8);
      // Вторая спица повёрнута ещё на 1.2 радиана, чтобы крест не был ровно под 90°.
      g.moveTo(cx + Math.cos(spoke + 1.2) * 8, 62 + Math.sin(spoke + 1.2) * 8);
      g.lineTo(cx - Math.cos(spoke + 1.2) * 8, 62 - Math.sin(spoke + 1.2) * 8);
      g.strokePath();
    };
    drawWheel(40); // переднее, под капотом
    drawWheel(126); // заднее, под кузовом
  }
}
