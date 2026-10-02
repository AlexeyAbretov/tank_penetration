// Пикап: крупная машина. Едет быстрее солдат, встаёт на том же рубеже и стреляет чаще.
// Урон пули меньше, чем у стрелка, но здоровье выше и награда больше.

import Phaser from 'phaser';
import { GAME, growthRank, vehicleDebutWave, waveHp } from '../gameConfig';
import {
  PICKUP_FLASH_FRAME,
  PICKUP_FRAME,
  PICKUP_GUN_FRAME,
  PICKUP_PAINT,
  type PickupPaint,
} from '../gfx/looks';
import { bake } from '../gfx/textures';
import type { SpawnContext } from './SpawnContext';
import { Infantry } from './Infantry';
import { RangedEnemy } from './RangedEnemy';

export class PickupTruck extends RangedEnemy {
  // Крест через центр повторяется каждые 180°. Шесть кадров делят эту половину оборота.
  static readonly wheelFrames = 6;
  static readonly corpseKey = 'pickup-wreck';
  // 12 кадров/с: полный оборот креста примерно за полсекунды, рядом со скоростью машины.
  static readonly driveFps = 12;
  static readonly placed = {
    scale: 1.18,
    originX: 0.5,
    originY: 0.82,
    bodyW: 110,
    bodyH: 42,
    bodyX: 12,
    bodyY: 28,
  };
  // Дуло на высоте рук стрелка, выше крыши кабины.
  static readonly muzzleOffset = { x: -80, y: -54 };
  // Почти непрерывная очередь: пауза 280 мс. Пули слабее винтовки, но их много.
  static readonly shotInterval = 280;
  static readonly shotSpeed = 520;
  // Откат: пиксели текстуры назад и подъём дула. Потом ствол возвращается за ms.
  static readonly recoilKick = { x: 11, climb: 0.07, ms: 110 };
  // Веер у дула. Доли меньше единицы: картинка вспышки сама по себе шире пули.
  static readonly flashPop = { x: 0.4, y: 0.45, ms: 140 };
  // Левый верх текстуры ствола внутри кадра машины 160×80.
  static readonly gunCut = { x: 7, y: 14 };
  // Казённик: ось, вокруг которой ствол поворачивается к танку и отскакивает назад.
  static readonly breech = { x: 108, y: 20 };
  // Наконечник в кадре машины. От казённика эта точка уходит влево и крутится вместе со стволом.
  static readonly muzzleTip = { x: 12, y: 20 };

  readonly coinReward = 3;
  private smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Зона попадания шире солдатской (46): снаряд задевает машину с большего расстояния.
  // override: у родителя Infantry это поле уже есть, здесь мы задаём своё значение.
  override readonly hitRadius: number = 86;
  protected readonly holdX = 640;
  protected readonly fireDelay = PickupTruck.shotInterval;
  protected readonly bulletSpeed = PickupTruck.shotSpeed;
  // Слабее винтовки стрелка, но выстрелов много.
  protected readonly shotDamage = 2;
  protected readonly idleTexture = 'pickup-0';
  protected readonly muzzle = PickupTruck.muzzleOffset;

  // Ствол — отдельная картинка поверх кузова: так же, как в рисунке, металл перекрывает руку и станок.
  private gun!: Phaser.GameObjects.Image;
  // x — пиксели текстуры назад вдоль ствола. climb — добавка к прицелу, подъём дула в радианах.
  private readonly recoil = { x: 0, climb: 0 };
  // Поворот картинки ствола к танку, без отдачи. Ноль — строго влево.
  private aim = 0;

  static spawn(ctx: SpawnContext): Infantry {
    // На 20-й волне ранг 1: здоровье и скорость как у первой волны. Дальше ранг растёт.
    // Возвращаемый тип — общий Infantry, чтобы фабрика не зависела от конкретного класса.
    // Пикап — первая техника в списке фабрики, поэтому индекс дебюта 0.
    const rank = growthRank(ctx.wave, vehicleDebutWave(0));
    const unit = new PickupTruck(ctx.scene, ctx.x, ctx.y, waveHp(rank), ctx.shots);
    unit.paceWave = rank;
    return unit;
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
  ) {
    // hp + 1: машина чуть живучее пехоты той же волны.
    // Жёлтая полоска HP, текстуры pickup-0 … pickup-5, анимация pickup-drive.
    super(scene, x, y, hp + 1, 'pickup-0', 'pickup-drive', 0xe0a020, shots);
    const placed = PickupTruck.placed;
    // Машина нарисована крупнее солдата, дополнительный масштаб небольшой.
    this.setScale(placed.scale);
    // Точка опоры ближе к низу кузова, чтобы колёса стояли на «земле» дорожки.
    this.setOrigin(placed.originX, placed.originY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Хитбокс шире и ниже, чем у солдата: это корпус машины, не человек.
    body.setSize(placed.bodyW, placed.bodyH);
    body.setOffset(placed.bodyX, placed.bodyY);

    this.gun = scene.add.image(x, y, 'pickup-gun');
    this.gun.setOrigin(
      (PickupTruck.breech.x - PickupTruck.gunCut.x) / PICKUP_GUN_FRAME.w,
      (PickupTruck.breech.y - PickupTruck.gunCut.y) / PICKUP_GUN_FRAME.h,
    );
    // Та же глубина, что у кузова. Картинку добавляем позже, поэтому при равной глубине ствол сверху.
    this.gun.setDepth(this.depth);
    this.once('destroy', () => {
      this.scene.tweens.killTweensOf(this.recoil);
      this.gun.destroy();
      this.smoke?.destroy();
    });
    this.syncGun();
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.syncGun();
  }

  protected override corpseTexture(): string | null {
    return PickupTruck.corpseKey;
  }

  // Взрыв в момент гибели, потом на поле остаётся текстура разбитой машины.
  // Ствол — отдельный спрайт: на обломках он уже нарисован сломанным.
  protected override onDie(slain: boolean): void {
    if (!slain) {
      return;
    }
    this.scene.tweens.killTweensOf(this.recoil);
    if (this.gun.active) {
      this.gun.setVisible(false);
    }
    this.playDeathBlast();
    const anchor = PickupTruck.smokeAnchor(this.scaleX);
    this.smoke = PickupTruck.smokeAt(this.scene, this.x + anchor.x, this.y + anchor.y, this.scaleX);
  }

  override hit(damage?: number): boolean {
    const dead = damage === undefined ? super.hit() : super.hit(damage);
    this.gun.setTint(0xffccaa);
    this.scene.time.delayedCall(70, () => {
      if (this.gun.active) {
        this.gun.clearTint();
      }
    });
    return dead;
  }

  // Дуло уже повёрнуто к танку: пуля выходит из наконечника и летит вдоль ствола.
  protected override shotPose(): { x: number; y: number; angle: number } {
    this.aim = PickupTruck.aimAt(this.x, this.y, this.scaleX);
    return PickupTruck.muzzleAt(this.x, this.y, this.scaleX, this.aim);
  }

  // Вспышка остаётся в точке дула, ствол в этот момент отскакивает назад.
  protected override onFire(x: number, y: number, angle: number): void {
    this.kickGun();
    const flash = this.scene.add.image(x, y, 'pickup-flash').setOrigin(0, 0.5).setDepth(16);
    flash.setRotation(angle);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    // Шире пули, но меньше кузова. Вдоль выстрела не сжимаем: иначе вспышка снова становится чёрточкой.
    const pop = PickupTruck.flashPop;
    flash.setScale(pop.x, pop.y);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: pop.ms,
      ease: 'Quad.In',
      onComplete: () => flash.destroy(),
    });
  }

  private kickGun(): void {
    this.scene.tweens.killTweensOf(this.recoil);
    const kick = PickupTruck.recoilKick;
    this.recoil.x = kick.x;
    this.recoil.climb = kick.climb;
    this.scene.tweens.add({
      targets: this.recoil,
      x: 0,
      climb: 0,
      duration: kick.ms,
      ease: 'Quad.Out',
    });
  }

  private syncGun(): void {
    if (!this.gun.active) {
      return;
    }
    this.aim = PickupTruck.aimAt(this.x, this.y, this.scaleX);
    PickupTruck.poseGun(this.gun, this.x, this.y, this.scaleX, this.aim, this.recoil);
    this.gun.setAlpha(this.alpha);
  }

  // Угол картинки ствола, чтобы наконечник смотрел в корпус танка.
  // Сама текстура при нуле уже смотрит влево, поэтому к углу на цель прибавляется разворот.
  static aimAt(anchorX: number, anchorY: number, scale: number): number {
    const mount = PickupTruck.mountPoint(anchorX, anchorY, scale);
    const at = Phaser.Math.Angle.Between(mount.x, mount.y, GAME.tankX + 24, GAME.tankY);
    return Phaser.Math.Angle.Wrap(at + Math.PI);
  }

  // Мировые координаты наконечника и направление пули. aim — поворот картинки без отдачи.
  static muzzleAt(
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
  ): { x: number; y: number; angle: number } {
    const mount = PickupTruck.mountPoint(anchorX, anchorY, scale);
    const tip = PickupTruck.turned(
      aim,
      PickupTruck.muzzleTip.x - PickupTruck.breech.x,
      PickupTruck.muzzleTip.y - PickupTruck.breech.y,
      scale,
    );
    return {
      x: mount.x + tip.x,
      y: mount.y + tip.y,
      angle: Phaser.Math.Angle.Wrap(aim - Math.PI),
    };
  }

  // Казённик на спрайте машины. anchor — точка опоры кузова, scale — его масштаб.
  private static mountPoint(anchorX: number, anchorY: number, scale: number): { x: number; y: number } {
    return {
      x: anchorX + (PickupTruck.breech.x - PickupTruck.placed.originX * PICKUP_FRAME.w) * scale,
      y: anchorY + (PickupTruck.breech.y - PickupTruck.placed.originY * PICKUP_FRAME.h) * scale,
    };
  }

  // localX/localY — пиксели текстуры от казённика. Положительный X смотрит назад, к прикладу.
  private static turned(
    rotation: number,
    localX: number,
    localY: number,
    scale: number,
  ): { x: number; y: number } {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: (localX * cos - localY * sin) * scale,
      y: (localX * sin + localY * cos) * scale,
    };
  }

  // Ставит ствол казёнником в крепление. Отдача сдвигается назад вдоль уже повёрнутого ствола.
  static poseGun(
    gun: Phaser.GameObjects.Image,
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number },
  ): void {
    const rotation = aim + recoil.climb;
    const mount = PickupTruck.mountPoint(anchorX, anchorY, scale);
    const kick = PickupTruck.turned(rotation, recoil.x, 0, scale);
    gun.setPosition(mount.x + kick.x, mount.y + kick.y);
    gun.setScale(scale);
    gun.setRotation(rotation);
  }

  // Своя скорость: родительский march для пехоты слишком медленный.
  override march(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = 78 + this.paceWave * 6 + Phaser.Math.Between(0, 8);
    body.setVelocityX(-speed);
  }

  // Кадры колёс. Анимация pickup-drive проигрывает их по порядку и замыкает круг.
  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('pickup-0')) {
      for (let phase = 0; phase < PickupTruck.wheelFrames; phase += 1) {
        // Без ствола: в бою его рисует отдельный спрайт и двигает при отдаче.
        bake(scene, `pickup-${phase}`, PICKUP_FRAME.w, PICKUP_FRAME.h, (g) =>
          this.render(g, phase, PICKUP_PAINT, false),
        );
      }
    }
    if (!scene.textures.exists(this.corpseKey)) {
      bake(scene, this.corpseKey, PICKUP_FRAME.w, PICKUP_FRAME.h, (g) => this.renderWreck(g));
    }
    if (!scene.textures.exists('pickup-gun')) {
      bake(scene, 'pickup-gun', PICKUP_GUN_FRAME.w, PICKUP_GUN_FRAME.h, (g) => this.renderGun(g));
    }
    if (!scene.textures.exists('pickup-flash')) {
      bake(scene, 'pickup-flash', PICKUP_FLASH_FRAME.w, PICKUP_FLASH_FRAME.h, (g) => this.renderFlash(g));
    }
    if (!scene.anims.exists('pickup-drive')) {
      scene.anims.create({
        key: 'pickup-drive',
        frames: Array.from({ length: PickupTruck.wheelFrames }, (_, phase) => ({
          key: `pickup-${phase}`,
        })),
        frameRate: this.driveFps,
        repeat: -1,
      });
    }
  }

  // Пикап боком, нос влево (к танку). wheelPhase — номер кадра, от него зависит угол спиц.
  static render(
    g: Phaser.GameObjects.Graphics,
    wheelPhase: number,
    paint: PickupPaint = PICKUP_PAINT,
    withGun = true,
  ): void {
    // Тень под машиной. Холст 160×80, низ около y = 74.
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(84, 74, 128, 12);

    // Рама по всей длине, на ней потом стоят кабины и колёса.
    g.fillStyle(paint.metal);
    g.fillRoundedRect(14, 50, 136, 10, 3);

    // Капот слева: машина едет влево, мотор впереди.
    g.fillStyle(paint.body);
    g.fillRoundedRect(16, 40, 38, 20, 4);
    g.fillStyle(paint.bodyDark);
    g.fillRect(18, 48, 34, 5);
    // Бампер.
    g.fillStyle(paint.bumper);
    g.fillRect(12, 46, 8, 14);
    // Фара.
    g.fillStyle(paint.headlight);
    g.fillCircle(15, 50, 3);

    // Грузовой борт справа, позади кабины.
    g.fillStyle(paint.bodyDark);
    g.fillRoundedRect(90, 34, 56, 26, 3);
    g.fillStyle(paint.bodyLight); // светлый верхний край борта
    g.fillRect(92, 38, 52, 8);
    g.fillStyle(paint.cabin); // щель между досками
    g.fillRect(92, 44, 52, 4);
    // Металлическая обвязка кузова.
    g.fillStyle(paint.metal);
    g.fillRect(90, 32, 56, 4);
    g.fillRect(90, 32, 4, 22);
    g.fillRect(142, 32, 4, 22);
    // Задний борт ещё правее.
    g.fillStyle(paint.bodyDark);
    g.fillRect(144, 34, 6, 26);

    // Кабина. Крыша на y = 26, чтобы ствол на уровне рук всё равно шёл выше неё.
    g.fillStyle(paint.cabin);
    g.fillRoundedRect(50, 26, 42, 34, 5);
    g.fillStyle(paint.body);
    g.fillRoundedRect(52, 28, 38, 30, 4);
    g.fillStyle(paint.bodyDark);
    g.fillRect(54, 46, 34, 8);

    // Лобовое стекло и блик. Второй аргумент цвета у fillStyle — прозрачность блика.
    g.fillStyle(paint.glass);
    g.fillRoundedRect(54, 32, 22, 12, 3);
    g.fillStyle(paint.glassLight, 0.9);
    g.fillRoundedRect(56, 34, 18, 8, 2);
    g.fillStyle(paint.glassShine, 0.35);
    g.fillRect(58, 36, 6, 3);
    // Боковое окошко.
    g.fillStyle(paint.glassLight, 0.7);
    g.fillRoundedRect(78, 34, 10, 8, 2);

    // Стрелок в кузове. Плечи на y = 18 — туда же ляжет ствол. Пояс за бортом (борт с y = 32).
    g.fillStyle(paint.driverShirt);
    g.fillRoundedRect(112, 18, 16, 18, 3);
    g.fillRoundedRect(96, 18, 18, 5, 2);

    // Упор в кузов. Ствол на высоте рук, выше крыши, носом влево.
    g.fillStyle(paint.mount);
    g.fillRect(100, 20, 6, 14);
    // В бою ствол живёт отдельно. В просмотре его рисуем прямо на кадре машины.
    if (withGun) {
      this.drawBarrel(g, paint, 0, 0);
    }

    // Голова выше ствола. Кисти на стволе: в бою они едут вместе с оружием, в просмотре рисуются здесь.
    g.fillStyle(paint.skin);
    g.fillCircle(120, 13, 5);
    if (withGun) {
      this.drawHands(g, paint, 0, 0);
    }
    g.fillStyle(paint.driver);
    g.fillRoundedRect(112, 2, 16, 9, 3);
    g.fillRect(110, 9, 20, 3);

    // Линия через центр выглядит так же после поворота на 180° (π радиан).
    // Кадры делят эту половину оборота поровну, следующий после последнего совпадает с первым.
    // Минус: на экране Y растёт вниз, и положительный угол крутит колесо по часовой.
    // Машина едет влево, верх покрышки должен уходить влево — это против часовой.
    const spokeAngle = -(wheelPhase * Math.PI) / PickupTruck.wheelFrames;
    // Колесо в точке cx. Два вызова рисуют переднее и заднее.
    const drawWheel = (cx: number) => {
      g.fillStyle(paint.wheel); // покрышка
      g.fillCircle(cx, 62, 14);
      g.fillStyle(paint.wheelDisk); // диск
      g.fillCircle(cx, 62, 9);
      g.fillStyle(paint.wheel); // ступица
      g.fillCircle(cx, 62, 3);
      // Две спицы крест-накрест. Угол spokeAngle задаёт поворот.
      g.lineStyle(2, paint.spoke, 1);
      g.beginPath();
      // cos и sin от угла дают точку на окружности радиуса 8 вокруг центра колеса.
      g.moveTo(cx + Math.cos(spokeAngle) * 8, 62 + Math.sin(spokeAngle) * 8);
      g.lineTo(cx - Math.cos(spokeAngle) * 8, 62 - Math.sin(spokeAngle) * 8);
      // Вторая спица повёрнута ещё на 1.2 радиана, чтобы крест не был ровно под 90°.
      g.moveTo(cx + Math.cos(spokeAngle + 1.2) * 8, 62 + Math.sin(spokeAngle + 1.2) * 8);
      g.lineTo(cx - Math.cos(spokeAngle + 1.2) * 8, 62 - Math.sin(spokeAngle + 1.2) * 8);
      g.strokePath();
    };
    drawWheel(40); // переднее, под капотом
    drawWheel(126); // заднее, под кузовом
  }

  // Разбитый пикап в том же кадре 160×80, чтобы колёса остались на линии земли живой машины.
  static renderWreck(g: Phaser.GameObjects.Graphics, paint: PickupPaint = PICKUP_PAINT): void {
    g.fillStyle(0x140806, 0.6);
    g.fillEllipse(82, 73, 140, 18);
    g.fillStyle(0x6a140c, 0.5);
    g.fillEllipse(70, 71, 78, 10);

    // Переднее колесо сорвано и лежит плашмя слева от рамы.
    g.fillStyle(paint.wheel);
    g.fillEllipse(20, 67, 28, 12);
    g.fillStyle(paint.wheelDisk);
    g.fillEllipse(20, 67, 14, 6);

    // Ствол отломан и валяется перед кабиной.
    g.fillStyle(paint.barrel);
    g.fillRoundedRect(34, 66, 42, 5, 1);
    g.fillStyle(paint.muzzleTip);
    g.fillCircle(34, 68, 3);

    g.fillStyle(paint.metal);
    g.fillRoundedRect(32, 56, 100, 8, 2);

    // Капот смят и выгорел, из щели торчит пламя.
    g.fillStyle(paint.bodyDark);
    g.fillRoundedRect(34, 46, 30, 14, 3);
    g.fillStyle(0x1a0c08);
    g.fillRect(38, 48, 16, 8);
    g.fillStyle(0xff4a10);
    g.fillTriangle(40, 46, 48, 32, 56, 46);
    g.fillStyle(0xffe080);
    g.fillTriangle(44, 46, 48, 36, 52, 46);

    // Заднее колесо ещё на оси, но покрышка спущена.
    g.fillStyle(paint.wheel);
    g.fillEllipse(114, 64, 26, 18);
    g.fillStyle(paint.wheelDisk);
    g.fillEllipse(114, 64, 12, 8);
    g.fillStyle(paint.wheel);
    g.fillCircle(114, 64, 3);

    // Кузов короче: борт вырван, в досках дыра.
    g.fillStyle(paint.bodyDark);
    g.fillRoundedRect(100, 42, 34, 18, 2);
    g.fillStyle(paint.bodyLight);
    g.fillRect(102, 44, 22, 6);
    g.fillStyle(0x1a120c);
    g.fillRect(110, 46, 12, 8);
    g.fillStyle(paint.metal);
    g.fillRect(132, 44, 4, 18);
    g.fillStyle(paint.body);
    g.fillRect(138, 58, 16, 6);

    // Крыша кабины просела, стекло — чёрная дыра с трещиной.
    g.fillStyle(paint.cabin);
    g.fillRoundedRect(60, 38, 36, 22, 3);
    g.fillStyle(paint.body);
    g.fillRoundedRect(62, 40, 32, 18, 2);
    g.fillStyle(0x0c0e12);
    g.fillRect(66, 42, 16, 9);
    g.lineStyle(1, 0xd8e4ea, 0.8);
    g.beginPath();
    g.moveTo(68, 43);
    g.lineTo(78, 50);
    g.lineTo(72, 50);
    g.strokePath();

    // Копоть у щели капота. Сам столб дыма — частицы, их в текстуру не запечь.
    g.fillStyle(0x2a2622, 0.7);
    g.fillCircle(48, 34, 6);
  }

  // Точка над щелью капота в координатах спрайта. От неё поднимается дым.
  static smokeAnchor(scale: number): { x: number; y: number } {
    return {
      x: (48 - PickupTruck.placed.originX * PICKUP_FRAME.w) * scale,
      y: (34 - PickupTruck.placed.originY * PICKUP_FRAME.h) * scale,
    };
  }

  // Непрерывный столб. Эмиттер живёт, пока его не уничтожат вместе с обломками.
  static smokeAt(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale = 1,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const key = 'smoke-puff';
    if (!scene.textures.exists(key)) {
      bake(scene, key, 32, 32, (g) => {
        g.fillStyle(0xffffff, 0.18);
        g.fillCircle(16, 16, 15);
        g.fillStyle(0xffffff, 0.4);
        g.fillCircle(16, 16, 9);
        g.fillStyle(0xffffff, 0.75);
        g.fillCircle(16, 16, 4);
      });
    }
    const smoke = scene.add.particles(x, y, key, {
      lifespan: { min: 900, max: 1700 },
      frequency: 110,
      quantity: 1,
      speed: { min: 10 * scale, max: 28 * scale },
      angle: { min: -105, max: -75 },
      scale: { start: 0.35 * scale, end: 1.6 * scale },
      alpha: { start: 0.72, end: 0 },
      color: [0xd8d0c4, 0xa09890, 0x6a645c],
      gravityY: -18 * scale,
    });
    smoke.setDepth(12);
    return smoke;
  }

  // Вспышка по центру машины. Обломки уже под ней: вспышка гаснет, корпус остаётся.
  private playDeathBlast(): void {
    const scale = this.scaleX;
    const x = this.x - 8 * scale;
    const y = this.y - 26 * scale;
    PickupTruck.burstAt(this.scene, x, y);
    this.scene.time.delayedCall(90, () => {
      PickupTruck.burstAt(this.scene, x + 22 * scale, y + 8 * scale);
    });
  }

  // Один клуб взрыва. scale увеличивает радиус, скорость и осколки вместе с картинкой в просмотре.
  static burstAt(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale = 1,
    keys: { spark?: string; muzzle?: string } = {},
  ): Phaser.GameObjects.GameObject[] {
    const sparkKey = keys.spark ?? 'spark';
    const muzzleKey = keys.muzzle ?? 'muzzle';
    if (!scene.textures.exists(sparkKey)) {
      bake(scene, sparkKey, 12, 12, (g) => {
        g.fillStyle(0xffffff);
        g.fillCircle(6, 6, 5);
      });
    }
    const sparks = scene.add.particles(x, y, sparkKey, {
      lifespan: { min: 280, max: 640 },
      speed: { min: 40 * scale, max: 420 * scale },
      scale: { start: 1.7 * scale, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      color: [0xfff6d0, 0xff8a22, 0xff2a10],
      gravityY: 460 * scale,
      emitting: false,
    });
    sparks.setDepth(18);
    sparks.explode(32);
    scene.time.delayedCall(700, () => sparks.destroy());

    const fire = scene.add.circle(x, y, 26 * scale, 0xff4a12, 0.95).setDepth(17);
    const core = scene.add.circle(x, y, 12 * scale, 0xfff4c8, 1).setDepth(19);
    const flash = scene.add.image(x, y, muzzleKey).setDepth(18).setBlendMode(Phaser.BlendModes.ADD);
    flash.setScale(1.6 * scale);
    scene.tweens.add({
      targets: [fire, core, flash],
      alpha: 0,
      scale: 3.4 * scale,
      duration: 320,
      onComplete: () => {
        fire.destroy();
        core.destroy();
        flash.destroy();
      },
    });

    const bits: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 5; i += 1) {
      const bit = scene.add
        .rectangle(x, y, 10 * scale, 4 * scale, i % 2 === 0 ? 0x3a4a24 : 0x1a1c16)
        .setDepth(16);
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.9, -Math.PI * 0.1);
      const dist = Phaser.Math.Between(50, 150) * scale;
      scene.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist + 36 * scale,
        angle: Phaser.Math.Between(-160, 160),
        alpha: 0,
        duration: 460,
        onComplete: () => bit.destroy(),
      });
      bits.push(bit);
    }
    return [sparks, fire, core, flash, ...bits];
  }

  // Ствол в своих координатах. ox и oy сдвигают рисунок: для текстуры ствола это вырез из кадра машины.
  private static drawBarrel(
    g: Phaser.GameObjects.Graphics,
    paint: PickupPaint,
    ox: number,
    oy: number,
  ): void {
    g.fillStyle(paint.barrel);
    g.fillRoundedRect(86 + ox, 16 + oy, 22, 8, 2);
    g.fillRoundedRect(10 + ox, 18 + oy, 80, 4, 1);
    g.fillStyle(paint.muzzleFace);
    g.fillRect(10 + ox, 18 + oy, 8, 4);
    g.fillStyle(paint.muzzleTip);
    g.fillCircle(12 + ox, 20 + oy, 3);
  }

  private static drawHands(
    g: Phaser.GameObjects.Graphics,
    paint: PickupPaint,
    ox: number,
    oy: number,
  ): void {
    g.fillStyle(paint.skin);
    g.fillRect(92 + ox, 18 + oy, 8, 4);
  }

  static renderGun(g: Phaser.GameObjects.Graphics, paint: PickupPaint = PICKUP_PAINT): void {
    const ox = -PickupTruck.gunCut.x;
    const oy = -PickupTruck.gunCut.y;
    this.drawBarrel(g, paint, ox, oy);
    this.drawHands(g, paint, ox, oy);
  }

  // Веер из дула. Левый край — срез ствола, вперёд — вправо.
  // Крупные лепестки торчат вверх и вниз: пуля остаётся узкой жёлтой чёрточкой посередине.
  static renderFlash(g: Phaser.GameObjects.Graphics): void {
    const y = PICKUP_FLASH_FRAME.h / 2;
    g.fillStyle(0xff4a10, 1);
    g.fillTriangle(0, y, 30, 1, 16, y);
    g.fillTriangle(0, y, 30, PICKUP_FLASH_FRAME.h - 1, 16, y);
    g.fillStyle(0xffaa33, 1);
    g.fillTriangle(0, y, 54, 16, 54, 48);
    g.fillStyle(0xfff3c4, 1);
    g.fillTriangle(0, y, 26, 22, 26, 42);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(7, y, 6);
  }
}
