// Пикап: крупная машина. Едет быстрее солдат и встаёт на том же рубеже.
// Очередь из пяти пуль, потом три секунды тишины.
// Урон пули меньше, чем у стрелка, но здоровье выше и награда больше.

import Phaser from 'phaser';
import {
  PICKUP_FLASH_FRAME,
  PICKUP_FRAME,
  PICKUP_GUN_FRAME,
  PICKUP_PAINT,
  type PickupPaint,
} from '../gfx/looks';
import { bake } from '../gfx/textures';
import type { WorldPoint } from '../types/WorldPoint';
import { RangedEnemy } from './RangedEnemy';

type ApartPixel = { x: number; y: number };

type ApartCut = {
  frontKey: string;
  rearKey: string;
  layKey: string;
  wheelKeys: string[];
  keys: string[];
  frontHull: ApartPixel[];
  rearHull: ApartPixel[];
};

type PixelPad = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: ImageData;
};

export class PickupTruck extends RangedEnemy {
  static readonly debutWave = 10;
  // Крест через центр повторяется каждые 180°. Шесть кадров делят эту половину оборота.
  static readonly wheelFrames = 6;
  static readonly corpseKey = 'pickup-wreck';
  // 12 кадров/с: полный оборот креста примерно за полсекунды, рядом со скоростью машины.
  static readonly driveFps = 12;
  // Картинки из assets/. Холст 135×69, низ шин на последней строке.
  static readonly frame = { w: 135, h: 69 };
  static readonly placed = {
    // 135 × 1.4 ≈ та же ширина, что была у фигурного кадра 160 × 1.18.
    scale: 1.4,
    originX: 0.5,
    originY: 1,
    bodyW: 126,
    bodyH: 62,
    bodyX: 4,
    bodyY: 6,
  };
  // Родителю поле нужно, выстрел его не читает: дуло считает shotPose.
  static readonly muzzleOffset = { x: -80, y: -40 };
  // Пять пуль подряд, затем пауза. Пауза между патронами чуть длиннее отдачи,
  // чтобы вспышка успевала погаснуть и очередь не слипалась в одну.
  static readonly burstCount = 5;
  static readonly burstGap = 150;
  static readonly shotInterval = 3000;
  static readonly shotSpeed = 520;
  // Откат: пиксели текстуры назад и подъём дула. Потом ствол возвращается за ms.
  // Ствол на картинке короткий, длинный откат уводил бы казённик в солдата.
  static readonly recoilKick = { x: 4, climb: 0.05, ms: 110 };
  // Хлопок у дула. Доли меньше единицы: картинка вспышки сама по себе шире пули.
  // Короткий: очередь частая, долгая вспышка висит на стволе как наклейка.
  static readonly flashPop = { x: 0.4, y: 0.45, ms: 90 };
  // Запасной фигурный ствол вырезан из старого кадра 160×80.
  static readonly gunCut = { x: 7, y: 14 };
  // Ось на кистях, не на коробке. Иначе при наклоне руки уезжают на голову или ниже плеч.
  // Ствол при этом крутится вокруг хвата. Канал чуть выше центра кистей.
  static readonly breech = { x: 115, y: 15 };
  // Левый край ствола. От казённика эта точка уходит влево и крутится вместе со стволом.
  static readonly muzzleTip = { x: 54, y: 14 };
  // Пламя на капоте обломков. Отсюда поднимается дым.
  static readonly flame = { x: 26, y: 30 };
  // Шов за кабиной. Куски — кадр сгоревшей машины, не живой ход.
  // Шины спущены и сидят ниже арки. Пулемёт — отдельная полоска под днищем.
  private static readonly apart = {
    splitX: 77,
    hingeY: 48,
    wheels: [
      { x0: 14, y0: 59, x1: 36, y1: 67 },
      { x0: 88, y0: 59, x1: 118, y1: 68 },
    ],
    gun: { x0: 38, x1: 87, y0: 60, y1: 68, topX: 57 },
    frontTilt: -0.48,
    rearTilt: 0.48,
    frontShift: -14,
    rearShift: 16,
    tiltMs: 560,
    wheelRoll: 86,
    wheelHop: 18,
    wheelMs: 720,
    wheelDelay: 40,
  };
  private static apartSeq = 0;
  // Струя огнемёта сажает огонь на капот, а не на задний борт.
  readonly flameSeat = 'hood' as const;

  static readonly coinReward = 3;
  readonly coinReward = PickupTruck.coinReward;
  private smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Половинки и колёса после разрыва. Живут, пока спрайт машины не снимут с поля.
  private readonly debris: Phaser.GameObjects.GameObject[] = [];
  private readonly debrisKeys: string[] = [];
  // Зона попадания шире солдатской (46): снаряд задевает машину с большего расстояния.
  // override: у родителя Infantry это поле уже есть, здесь мы задаём своё значение.
  override readonly hitRadius: number = 86;
  protected readonly holdX = 640;
  protected readonly fireDelay = PickupTruck.shotInterval;
  protected override readonly burstCount = PickupTruck.burstCount;
  protected override readonly burstGap = PickupTruck.burstGap;
  protected readonly bulletSpeed = PickupTruck.shotSpeed;
  // Слабее винтовки стрелка, но выстрелов много. Прибавку волны добавляет предок.
  protected readonly shotDamage = 2;
  // На рубеже кузов без пулемёта. Пока едет, ствол уже нарисован в кадрах колёс.
  protected readonly idleTexture = 'pickup-aim';
  protected readonly muzzle = PickupTruck.muzzleOffset;

  static readonly aimKey = 'pickup-aim';
  static readonly gunKey = 'pickup-gun';
  static readonly flashKey = 'pickup-flash';

  // Шесть кадров хода со стволом, стойка без него, сам ствол и обломки.
  // Вспышка не из файла: её рисует renderFlash.
  // Пути буквальные: singlefile-сборка подменяет их на data:.
  static readonly images = {
    'pickup-0': 'assets/pickup-0.png',
    'pickup-1': 'assets/pickup-1.png',
    'pickup-2': 'assets/pickup-2.png',
    'pickup-3': 'assets/pickup-3.png',
    'pickup-4': 'assets/pickup-4.png',
    'pickup-5': 'assets/pickup-5.png',
    [PickupTruck.aimKey]: 'assets/pickup-aim.png',
    [PickupTruck.gunKey]: 'assets/pickup-gun.png',
    [PickupTruck.corpseKey]: 'assets/pickup-wreck.png',
  } as const;

  static readonly frameKeys = (
    ['pickup-0', 'pickup-1', 'pickup-2', 'pickup-3', 'pickup-4', 'pickup-5'] as const
  );

  // Ствол — отдельная картинка поверх кузова: так же, как в рисунке, металл перекрывает руку и станок.
  private gun!: Phaser.GameObjects.Image;
  // x — пиксели текстуры назад вдоль ствола. climb — добавка к прицелу, подъём дула в радианах.
  private readonly recoil = { x: 0, climb: 0 };
  // Поворот картинки ствола к танку, без отдачи. Ноль — строго влево.
  private aim = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
    fireTarget: WorldPoint,
  ) {
    // hp + 1: машина чуть живучее пехоты той же волны.
    // Жёлтая полоска HP, текстуры pickup-0 … pickup-5, анимация pickup-drive.
    super(scene, x, y, hp + 1, 'pickup-0', 'pickup-drive', 0xe0a020, shots, fireTarget);
    const placed = PickupTruck.placed;
    // Машина нарисована крупнее солдата, дополнительный масштаб небольшой.
    this.setScale(placed.scale);
    // Точка опоры ближе к низу кузова, чтобы колёса стояли на «земле» дорожки.
    this.setOrigin(placed.originX, placed.originY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Хитбокс шире и ниже, чем у солдата: это корпус машины, не человек.
    body.setSize(placed.bodyW, placed.bodyH);
    body.setOffset(placed.bodyX, placed.bodyY);

    this.gun = scene.add.image(x, y, PickupTruck.gunKey);
    // Картинка ствола — тот же холст, что у машины: казённик в своих пикселях.
    this.gun.setOrigin(
      PickupTruck.breech.x / PickupTruck.frame.w,
      PickupTruck.breech.y / PickupTruck.frame.h,
    );
    // Та же глубина, что у кузова. Картинку добавляем позже, поэтому при равной глубине ствол сверху.
    this.gun.setDepth(this.depth);
    this.once('destroy', () => {
      this.scene.tweens.killTweensOf(this.recoil);
      this.gun.destroy();
      this.smoke?.destroy();
      this.clearDebris();
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

  // Мина, артиллерия и залп передают центр разрыва. От них кузов расходится по шву,
  // колёса выкатываются. Пуля и огонь этот центр не передают: остаётся целый остов.
  override kill(blastAt?: WorldPoint): void {
    if (this.reachedWall || this.hp > 0 || !blastAt) {
      super.kill(blastAt);
      return;
    }
    const cut = PickupTruck.cutApart(this.scene);
    super.kill();
    if (!cut) {
      return;
    }
    this.setVisible(false);
    this.spawnApart(cut);
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
    this.aim = PickupTruck.barrelAngle(
      this.x,
      this.y,
      this.scaleX,
      this.fireTarget.x,
      this.fireTarget.y,
    );
    return PickupTruck.muzzleAt(this.x, this.y, this.scaleX, this.aim);
  }

  // Вспышка остаётся в точке дула, ствол в этот момент отскакивает назад.
  protected override onFire(x: number, y: number, angle: number): void {
    this.kickGun();
    const flash = this.scene.add.image(x, y, PickupTruck.flashKey).setOrigin(0, 0.5).setDepth(16);
    flash.setRotation(angle);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    // Шире пули, но меньше кузова. Вдоль выстрела не сжимаем: иначе вспышка снова становится чёрточкой.
    const pop = PickupTruck.flashPop;
    flash.setScale(pop.x, pop.y);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: pop.x * 0.72,
      scaleY: pop.y * 0.55,
      duration: pop.ms,
      ease: 'Cubic.Out',
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

  protected override pinDepth(): void {
    if (this.gun?.active) {
      this.gun.setDepth(this.depth);
    }
  }

  private syncGun(): void {
    if (!this.gun.active) {
      return;
    }
    // На ходу ствол нарисован в кадре. Отдельная картинка нужна только на рубеже, иначе стволов два.
    const planted = !this.reachedWall && this.texture.key === this.idleTexture;
    this.gun.setVisible(planted);
    if (!planted) {
      return;
    }
    this.aim = PickupTruck.barrelAngle(
      this.x,
      this.y,
      this.scaleX,
      this.fireTarget.x,
      this.fireTarget.y,
    );
    PickupTruck.poseGun(this.gun, this.x, this.y, this.scaleX, this.aim, this.recoil);
    this.gun.setAlpha(this.alpha);
  }

  // Угол картинки ствола, чтобы наконечник смотрел в корпус танка.
  // Сама текстура при нуле уже смотрит влево, поэтому к углу на цель прибавляется разворот.
  static barrelAngle(
    anchorX: number,
    anchorY: number,
    scale: number,
    targetX: number,
    targetY: number,
  ): number {
    const mount = PickupTruck.mountPoint(anchorX, anchorY, scale);
    const at = Phaser.Math.Angle.Between(mount.x, mount.y, targetX, targetY);
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
      x: anchorX + (PickupTruck.breech.x - PickupTruck.placed.originX * PickupTruck.frame.w) * scale,
      y: anchorY + (PickupTruck.breech.y - PickupTruck.placed.originY * PickupTruck.frame.h) * scale,
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
  // База 82 + 2 за ранг + случайные 0..8. На первом ранге те же 84..92, шаг как у пехоты.
  override march(): void {
    const speed = 82 + this.paceWave * 2 + Phaser.Math.Between(0, 8);
    this.marchAt(speed);
  }

  static preload(scene: Phaser.Scene): void {
    for (const [key, path] of Object.entries(this.images)) {
      scene.load.image(key, path);
    }
  }

  // Кадры колёс. Анимация pickup-drive проигрывает их по порядку и замыкает круг.
  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('pickup-0')) {
      for (let phase = 0; phase < PickupTruck.wheelFrames; phase += 1) {
        // Без ствола: в бою его рисует отдельный спрайт и двигает при отдаче.
        bake(scene, `pickup-${phase}`, PICKUP_FRAME.w, PICKUP_FRAME.h, (g) =>
          this.render(g, phase, PICKUP_PAINT),
        );
      }
    }
    if (!scene.textures.exists(this.aimKey)) {
      bake(scene, this.aimKey, PICKUP_FRAME.w, PICKUP_FRAME.h, (g) =>
        this.render(g, 0, PICKUP_PAINT),
      );
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
    const frames = this.frameKeys.filter((key) => scene.textures.exists(key));
    for (const key of [...frames, this.aimKey, this.corpseKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    // Ствол крутится на любой угол. Ближний фильтр на повороте рвёт металл, поэтому здесь сглаживание.
    for (const key of [this.gunKey, this.flashKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
    if (scene.anims.exists('pickup-drive')) {
      scene.anims.remove('pickup-drive');
    }
    if (frames.length > 0) {
      scene.anims.create({
        key: 'pickup-drive',
        frames: frames.map((key) => ({ key })),
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

    // Голова выше ствола. Ствол и кисти — отдельная картинка, их двигает отдача.
    g.fillStyle(paint.skin);
    g.fillCircle(120, 13, 5);
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
    const flame = PickupTruck.flame;
    return {
      x: (flame.x - PickupTruck.placed.originX * PickupTruck.frame.w) * scale,
      y: (flame.y - PickupTruck.placed.originY * PickupTruck.frame.h) * scale,
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
    const at = (px: number, py: number) => ({
      x: this.x + (px - PickupTruck.placed.originX * PickupTruck.frame.w) * scale,
      y: this.y + (py - PickupTruck.placed.originY * PickupTruck.frame.h) * scale,
    });
    // Два клуба: капот и кабина. Картинки взрыва нет, клубы рисует burstAt.
    const nose = at(40, 34);
    PickupTruck.burstAt(this.scene, nose.x, nose.y);
    this.scene.time.delayedCall(90, () => {
      const cab = at(78, 36);
      PickupTruck.burstAt(this.scene, cab.x, cab.y);
    });
  }

  // Один клуб взрыва. scale увеличивает радиус, скорость и осколки.
  static burstAt(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
    const sparkKey = 'spark';
    const muzzleKey = 'muzzle';
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
    }
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

  // Хлопок у среза. Левый край — дуло, огонь вправо.
  // Овалы разной длины и не на одной оси: ровный клин читается как трапеция.
  // Край полупрозрачный, в режиме ADD он тает, а не режет кадр.
  static renderFlash(g: Phaser.GameObjects.Graphics): void {
    const y = PICKUP_FLASH_FRAME.h / 2;

    g.fillStyle(0xc41808, 0.34);
    g.fillEllipse(18, y + 1, 34, 44);
    g.fillStyle(0xe0240c, 0.42);
    g.fillEllipse(14, y - 9, 22, 18);
    g.fillEllipse(16, y + 12, 26, 16);

    g.fillStyle(0xff3c10, 0.92);
    g.fillCircle(11, y - 10, 8);
    g.fillCircle(13, y + 11, 10);
    g.fillCircle(24, y - 1, 6);

    g.fillStyle(0xff7a1e, 1);
    g.fillEllipse(20, y + 3, 20, 12);
    g.fillEllipse(28, y - 4, 14, 8);

    g.fillStyle(0xffc24a, 1);
    g.fillEllipse(16, y, 26, 9);
    g.fillEllipse(30, y + 1, 14, 5);

    g.fillStyle(0xfff0b0, 1);
    g.fillEllipse(8, y - 1, 13, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(5, y, 3.5);
    g.fillCircle(11, y - 2, 2);
  }

  // Половинки крутятся вокруг шва. Как только угол упирается в землю, кузов поднимается,
  // чтобы не уйти под линию колёс. Дым остаётся на капоте и едет вместе с носом.
  // Пулемёт уже лежит на земле в кадре остова: его не крутим.
  private spawnApart(cut: ApartCut): void {
    const scene = this.scene;
    const scale = this.scaleX;
    const groundY = this.y;
    const spec = PickupTruck.apart;
    const hinge = this.texPoint(spec.splitX, spec.hingeY);
    const depth = this.depth;

    const front = scene.add.container(hinge.x, hinge.y).setDepth(depth + 0.04);
    const frontImg = scene.add.image(0, 0, cut.frontKey);
    frontImg.setOrigin(1, spec.hingeY / PickupTruck.frame.h);
    frontImg.setScale(scale);
    front.add(frontImg);

    const rear = scene.add.container(hinge.x, hinge.y).setDepth(depth + 0.05);
    const rearImg = scene.add.image(0, 0, cut.rearKey);
    rearImg.setOrigin(spec.splitX / PickupTruck.frame.w, spec.hingeY / PickupTruck.frame.h);
    rearImg.setScale(scale);
    rear.add(rearImg);

    const lay = scene.add.image(this.x, this.y, cut.layKey);
    lay.setOrigin(PickupTruck.placed.originX, PickupTruck.placed.originY);
    lay.setScale(scale);
    lay.setDepth(depth + 0.02);

    const toLocal = (points: readonly ApartPixel[]) => points.map((point) => ({
      x: (point.x - spec.splitX) * scale,
      y: (point.y - spec.hingeY) * scale,
    }));
    const frontHull = toLocal(cut.frontHull);
    const rearHull = toLocal(cut.rearHull);

    const wheels: Phaser.GameObjects.Image[] = [];
    spec.wheels.forEach((wheel, index) => {
      const wheelKey = cut.wheelKeys[index];
      if (!wheelKey) {
        return;
      }
      const at = this.texPoint((wheel.x0 + wheel.x1) / 2, (wheel.y0 + wheel.y1) / 2);
      const img = scene.add.image(at.x, at.y, wheelKey);
      img.setOrigin(0.5, 0.5);
      img.setScale(scale);
      img.setDepth(depth + 0.08);
      wheels.push(img);
    });

    this.debris.push(frontImg, rearImg, lay, ...wheels, front, rear);
    this.debrisKeys.push(...cut.keys);

    const frontBaseY = front.y;
    scene.tweens.add({
      targets: front,
      x: front.x + spec.frontShift,
      rotation: spec.frontTilt,
      duration: spec.tiltMs,
      ease: 'Cubic.Out',
      onUpdate: () => {
        this.seat(front, frontHull, frontBaseY, groundY);
        this.followSmoke(front);
      },
    });
    const rearBaseY = rear.y;
    scene.tweens.add({
      targets: rear,
      x: rear.x + spec.rearShift,
      rotation: spec.rearTilt,
      duration: spec.tiltMs,
      ease: 'Cubic.Out',
      onUpdate: () => {
        this.seat(rear, rearHull, rearBaseY, groundY);
      },
    });

    wheels.forEach((wheel, index) => {
      const sign = index === 0 ? -1 : 1;
      const homeY = wheel.y;
      const tire = spec.wheels[index];
      if (!tire) {
        return;
      }
      const radius = ((tire.x1 - tire.x0) / 2) * scale;
      wheel.y = homeY - spec.wheelHop;
      scene.tweens.add({
        targets: wheel,
        x: wheel.x + sign * spec.wheelRoll,
        rotation: sign * (spec.wheelRoll / radius),
        duration: spec.wheelMs,
        delay: spec.wheelDelay,
        ease: 'Quad.Out',
      });
      scene.tweens.add({
        targets: wheel,
        y: homeY,
        duration: spec.wheelMs,
        delay: spec.wheelDelay,
        ease: 'Bounce.Out',
      });
    });
  }

  private texPoint(tx: number, ty: number): { x: number; y: number } {
    const scale = this.scaleX;
    return {
      x: this.x + (tx - PickupTruck.placed.originX * PickupTruck.frame.w) * scale,
      y: this.y + (ty - PickupTruck.placed.originY * PickupTruck.frame.h) * scale,
    };
  }

  // baseY — высота до наклона. Ниже земли не опускаем: упёршийся край поднимает всю половину.
  private seat(
    piece: Phaser.GameObjects.Container,
    hull: readonly { x: number; y: number }[],
    baseY: number,
    groundY: number,
  ): void {
    piece.y = baseY;
    if (hull.length === 0) {
      return;
    }
    const cos = Math.cos(piece.rotation);
    const sin = Math.sin(piece.rotation);
    let low = -Infinity;
    for (const point of hull) {
      const y = piece.y + point.x * sin + point.y * cos;
      if (y > low) {
        low = y;
      }
    }
    if (low > groundY) {
      piece.y -= low - groundY;
    }
  }

  private followSmoke(front: Phaser.GameObjects.Container): void {
    const smoke = this.smoke;
    if (!smoke?.active) {
      return;
    }
    const scale = this.scaleX;
    const spec = PickupTruck.apart;
    const localX = (PickupTruck.flame.x - spec.splitX) * scale;
    const localY = (PickupTruck.flame.y - spec.hingeY) * scale;
    const cos = Math.cos(front.rotation);
    const sin = Math.sin(front.rotation);
    smoke.setPosition(
      front.x + localX * cos - localY * sin,
      front.y + localX * sin + localY * cos,
    );
  }

  private clearDebris(): void {
    const pending = [...this.debris];
    this.debris.length = 0;
    const boxes: Phaser.GameObjects.Container[] = [];
    for (const piece of pending) {
      this.scene.tweens.killTweensOf(piece);
      if (piece instanceof Phaser.GameObjects.Container) {
        boxes.push(piece);
        continue;
      }
      if (piece.active) {
        piece.destroy();
      }
    }
    for (const box of boxes) {
      if (box.active) {
        box.destroy();
      }
    }
    for (const key of this.debrisKeys) {
      if (this.scene.textures.exists(key)) {
        this.scene.textures.remove(key);
      }
    }
    this.debrisKeys.length = 0;
  }

  // Режет сгоревший кадр: нос, корма, две спущенные шины и пулемёт под днищем.
  // Чужой размер кадра — запасной рисунок. Тогда null, и на поле остаётся целый остов.
  private static cutApart(scene: Phaser.Scene): ApartCut | null {
    const key = PickupTruck.corpseKey;
    if (!scene.textures.exists(key)) {
      return null;
    }
    const source = scene.textures.get(key).getSourceImage();
    if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) {
      return null;
    }
    const w = PickupTruck.frame.w;
    const h = PickupTruck.frame.h;
    if (source.width !== w || source.height !== h) {
      return null;
    }
    const full = document.createElement('canvas');
    full.width = w;
    full.height = h;
    const fullCtx = full.getContext('2d', { willReadFrequently: true });
    if (!fullCtx) {
      return null;
    }
    fullCtx.imageSmoothingEnabled = false;
    fullCtx.drawImage(source, 0, 0);
    const src = fullCtx.getImageData(0, 0, w, h).data;
    const spec = PickupTruck.apart;
    const front = PickupTruck.blank(spec.splitX, h);
    const rear = PickupTruck.blank(w, h);
    const lay = PickupTruck.blank(w, h);
    if (!front || !rear || !lay) {
      return null;
    }
    const pads: PixelPad[] = [];
    for (const wheel of spec.wheels) {
      const pad = PickupTruck.blank(wheel.x1 - wheel.x0 + 1, wheel.y1 - wheel.y0 + 1);
      if (!pad) {
        return null;
      }
      pads.push(pad);
    }

    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const from = (y * w + x) * 4;
        if (src[from + 3] === 0) {
          continue;
        }
        const wheel = PickupTruck.wheelSlot(x, y);
        if (wheel >= 0) {
          const pad = pads[wheel];
          const wheelSpec = spec.wheels[wheel];
          if (!pad || !wheelSpec) {
            continue;
          }
          const wx = x - wheelSpec.x0;
          const wy = y - wheelSpec.y0;
          PickupTruck.stamp(src, from, pad.image.data, (wy * pad.canvas.width + wx) * 4);
          continue;
        }
        if (PickupTruck.isLaidGun(x, y)) {
          PickupTruck.stamp(src, from, lay.image.data, from);
          continue;
        }
        if (x >= spec.splitX) {
          PickupTruck.stamp(src, from, rear.image.data, from);
          mask[y * w + x] = 2;
        } else {
          PickupTruck.stamp(src, from, front.image.data, (y * spec.splitX + x) * 4);
          mask[y * w + x] = 1;
        }
      }
    }

    const frontEdge: ApartPixel[] = [];
    const rearEdge: ApartPixel[] = [];
    const kindAt = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= h) {
        return 0;
      }
      return mask[y * w + x] ?? 0;
    };
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const kind = mask[y * w + x] ?? 0;
        if (kind !== 1 && kind !== 2) {
          continue;
        }
        const edge = kindAt(x - 1, y) !== kind
          || kindAt(x + 1, y) !== kind
          || kindAt(x, y - 1) !== kind
          || kindAt(x, y + 1) !== kind;
        if (!edge) {
          continue;
        }
        (kind === 1 ? frontEdge : rearEdge).push({ x, y });
      }
    }

    front.ctx.putImageData(front.image, 0, 0);
    rear.ctx.putImageData(rear.image, 0, 0);
    lay.ctx.putImageData(lay.image, 0, 0);
    for (const pad of pads) {
      pad.ctx.putImageData(pad.image, 0, 0);
    }

    PickupTruck.apartSeq += 1;
    const seq = PickupTruck.apartSeq;
    const frontKey = `pickup-apart-${seq}-front`;
    const rearKey = `pickup-apart-${seq}-rear`;
    const layKey = `pickup-apart-${seq}-gun`;
    const wheelKeys = pads.map((_, index) => `pickup-apart-${seq}-wheel-${index}`);
    const keys = [frontKey, rearKey, layKey, ...wheelKeys];
    const canvases = [front.canvas, rear.canvas, lay.canvas, ...pads.map((pad) => pad.canvas)];
    for (let i = 0; i < keys.length; i += 1) {
      const name = keys[i];
      const canvas = canvases[i];
      if (!name || !canvas || !PickupTruck.publish(scene, name, canvas)) {
        for (const made of keys) {
          if (scene.textures.exists(made)) {
            scene.textures.remove(made);
          }
        }
        return null;
      }
    }

    return {
      frontKey,
      rearKey,
      layKey,
      wheelKeys,
      keys,
      frontHull: PickupTruck.hull(frontEdge),
      rearHull: PickupTruck.hull(rearEdge),
    };
  }

  private static wheelSlot(x: number, y: number): number {
    const wheels = PickupTruck.apart.wheels;
    for (let i = 0; i < wheels.length; i += 1) {
      const wheel = wheels[i];
      if (!wheel) {
        continue;
      }
      if (x >= wheel.x0 && x <= wheel.x1 && y >= wheel.y0 && y <= wheel.y1) {
        return i;
      }
    }
    return -1;
  }

  // Верхняя кромка y0 слева ещё днище. Ствол начинается правее topX.
  private static isLaidGun(x: number, y: number): boolean {
    const gun = PickupTruck.apart.gun;
    if (x < gun.x0 || x > gun.x1 || y < gun.y0 || y > gun.y1) {
      return false;
    }
    return y > gun.y0 || x >= gun.topX;
  }

  private static blank(width: number, height: number): PixelPad | null {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return null;
    }
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx, image: ctx.getImageData(0, 0, width, height) };
  }

  private static stamp(
    src: Uint8ClampedArray,
    from: number,
    dst: Uint8ClampedArray,
    to: number,
  ): void {
    dst[to] = src[from] ?? 0;
    dst[to + 1] = src[from + 1] ?? 0;
    dst[to + 2] = src[from + 2] ?? 0;
    dst[to + 3] = src[from + 3] ?? 0;
  }

  private static publish(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): boolean {
    const added = scene.textures.addCanvas(key, canvas);
    if (!added) {
      return false;
    }
    added.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return true;
  }

  // Оболочка куска. По ней половина понимает, какой край уже на земле.
  private static hull(points: readonly ApartPixel[]): ApartPixel[] {
    if (points.length < 3) {
      return points.map((point) => ({ x: point.x, y: point.y }));
    }
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const unique: ApartPixel[] = [];
    for (const point of sorted) {
      const prev = unique[unique.length - 1];
      if (prev && prev.x === point.x && prev.y === point.y) {
        continue;
      }
      unique.push(point);
    }
    if (unique.length < 3) {
      return unique;
    }
    const cross = (o: ApartPixel, a: ApartPixel, b: ApartPixel) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const chain = (from: readonly ApartPixel[]) => {
      const edge: ApartPixel[] = [];
      for (const point of from) {
        while (edge.length >= 2) {
          const a = edge[edge.length - 2];
          const b = edge[edge.length - 1];
          if (!a || !b || cross(a, b, point) > 0) {
            break;
          }
          edge.pop();
        }
        edge.push(point);
      }
      return edge;
    };
    const lower = chain(unique);
    const upper = chain([...unique].reverse());
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }
}
