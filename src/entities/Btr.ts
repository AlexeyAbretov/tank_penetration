// БТР: босс с 60-й волны. Две высадки по диагонали, нос влево, корпус к скорости не поворачивается.
// Сначала высаживает ракетчиков и штурмовиков, потом стрелков, на рубеже пулемёта бьёт очередью как пикап.
// Диски колёс крутятся на всём пути. На рубеже пулемёта крутится только ствол.
// Пока корпус жив, мотор гудит. Рубеж пулемёта и ЭМИ колёса останавливают, гул оставляют.

import Phaser from 'phaser';
import { enemyHasteOf, GAME } from '../gameConfig';
import { ejectCasing } from '../gfx/casing';
import { bake } from '../gfx/textures';
import { vehicleDeathBlast } from '../gfx/vehicleBlast';
import { wreckSmokeAt } from '../gfx/wreckSmoke';
import { syncBtrEngine } from '../sounds/BtrSounds';
import type { TroopKind } from '../types/SpawnContext';
import type { WorldPoint } from '../types/WorldPoint';
import { RangedEnemy } from './RangedEnemy';

type Axle = {
  key: string;
  cx: number;
  cy: number;
  radius: number;
  // Пиксели метки от центра диска. На каждом колесе свои, без зеркала.
  nick: readonly { x: number; y: number }[];
};

type Wheel = { image: Phaser.GameObjects.Image; cx: number; cy: number; radius: number };

type Drop = { kind: TroopKind; y: number; stop: 0 | 1 };

type TroopDrop = (kind: TroopKind, x: number, y: number) => void;

export class Btr extends RangedEnemy {
  static readonly debutWave = 60;
  static readonly baseHp = 1000;
  static readonly hpPerAppearance = 500;
  static readonly coinsPerAppearance = 25;

  static readonly bodyKey = 'btr';
  static readonly gunKey = 'btr-gun';
  static readonly flashKey = 'btr-flash';
  static readonly corpseKey = 'btr-wreck';
  static readonly imagePath = 'assets/btr.png';
  static readonly gunPath = 'assets/btr-gun.png';
  static readonly wreckPath = 'assets/btr-wreck.png';

  static readonly frame = { w: 256, h: 128 };
  static readonly gunFrame = { w: 112, h: 48 };
  // Дверь между второй и третьей осью. Опора спрайта — её середина: y двери и есть линия высадки.
  static readonly door = { x: 140, y: 59 };
  // Подошва шин на строке 98. Остов сидит ниже: его опора держит ту же землю.
  static readonly hullFit = {
    originX: Btr.door.x / 256,
    originY: Btr.door.y / 128,
    bodyW: 194,
    bodyH: 65,
    bodyX: 38,
    bodyY: 34,
  };
  static readonly wreckFit = { originX: 140 / 256, originY: 64 / 128 };
  // Пролом башни на остове. Дым стоит здесь, пока корпус лежит.
  static readonly wreckFlame = { x: 118, y: 38 };
  // Щека башни. Корень на три пикселя внутрь грани: отдача его не выдёргивает.
  static readonly breech = { x: 103, y: 40 };
  // Правый срез ствола. Вокруг него крутится пушка.
  static readonly gunPivot = { x: 90, y: 23 };
  static readonly muzzleTip = { x: 9, y: 23 };
  // Корень на кадре 12 px. Половина сажает его в щеку и не поднимает выше крыши.
  static readonly gunScale = 0.5;
  // Солдат на поле около 93 px ростом. Корпус 65 px при масштабе 1 ниже его. 1.7 поднимает крышу над каской.
  static readonly scale = 1.7;
  static readonly axles: readonly Axle[] = [
    { key: 'btr-wheel-0', cx: 83, cy: 85, radius: 14, nick: [{ x: 4, y: -1 }, { x: 5, y: -1 }] },
    { key: 'btr-wheel-1', cx: 117, cy: 85, radius: 14, nick: [{ x: -2, y: 4 }, { x: -1, y: 5 }] },
    { key: 'btr-wheel-2', cx: 161, cy: 85, radius: 14, nick: [{ x: 3, y: 3 }, { x: 4, y: 3 }] },
    { key: 'btr-wheel-3', cx: 195, cy: 85, radius: 14, nick: [{ x: -5, y: 0 }, { x: -4, y: 1 }] },
  ];
  // Рубеж стрелка и пикапа.
  static readonly gunX = 640;
  static readonly aimLimit = 0.6;
  static readonly cruise = 76;
  // Очередь пикапа: пять пуль, короткая пауза, затем три секунды.
  static readonly burstCount = 5;
  static readonly burstGap = 150;
  static readonly shotInterval = 3000;
  static readonly shotSpeed = 520;
  static readonly shotDamage = 2;
  static readonly recoilKick = { x: 6, ms: 90 };
  static readonly openDelay = 350;
  // Один влево на один по высоте. Круче первая дверь уходит за правый край поля.
  static readonly dropRun = 1;
  // Ракетчик и стрелок выходят правее своего рубежа на этот зазор и ещё идут к линии.
  static readonly doorGap = 24;

  // Шестеро делят полосу 168…544. Сверху вниз ракетчик и штурмовик чередуются.
  private static readonly firstDrop: readonly Drop[] = [
    { kind: 'rocket', y: 168, stop: 0 },
    { kind: 'assault', y: 243, stop: 0 },
    { kind: 'rocket', y: 318, stop: 0 },
    { kind: 'assault', y: 394, stop: 0 },
    { kind: 'rocket', y: 469, stop: 0 },
    { kind: 'assault', y: 544, stop: 0 },
  ];
  // Стрелки стоят в промежутках между линиями первой высадки. Ход снизу вверх.
  private static readonly secondDrop: readonly Drop[] = [506, 431, 356, 281, 206].map((y) => ({
    kind: 'gunner' as const,
    y,
    stop: 1 as const,
  }));

  override readonly hitRadius = 100 * Btr.scale;
  readonly flameSeat = 'hood' as const;
  coinReward: number;

  protected readonly holdX = Btr.gunX;
  protected readonly fireDelay = Btr.shotInterval;
  protected override readonly burstCount = Btr.burstCount;
  protected override readonly burstGap = Btr.burstGap;
  protected readonly bulletSpeed = Btr.shotSpeed;
  protected readonly shotDamage = Btr.shotDamage;
  protected readonly idleTexture = Btr.bodyKey;
  protected readonly muzzle = { x: 0, y: 0 };

  private readonly gun: Phaser.GameObjects.Image;
  private readonly wheels: Wheel[] = [];
  private readonly deploy?: TroopDrop;
  private readonly recoil = { x: 0 };
  private aim = 0;
  private released: number;
  private prevX = 0;
  private prevY = 0;
  private roll = 0;
  private gunWait = Btr.openDelay;
  private gunLeft = 0;
  private gunArmed = false;
  private smoke?: Phaser.GameObjects.Particles.ParticleEmitter;

  // Волна 60 — первый выход. Дальше каждый десяток.
  static appearanceOn(wave: number): number {
    const boss = Math.floor(wave / 10);
    const first = Math.floor(Btr.debutWave / 10);
    return Math.max(1, boss - first + 1);
  }

  static hpForAppearance(appearance: number): number {
    const extra = Math.max(0, Math.floor(appearance) - 1);
    return this.baseHp + extra * this.hpPerAppearance;
  }

  // Доля одного тела. Сумма по местам 0 .. count−1 равна кассе волны.
  static coinsForBody(appearance: number, index: number, count: number): number {
    const n = Math.max(1, Math.floor(appearance));
    const bodies = Math.max(1, Math.floor(count));
    const purse = this.coinsPerAppearance * n;
    const base = Math.floor(purse / bodies);
    const extra = purse % bodies;
    const slot = Math.max(0, Math.floor(index));
    if (slot >= bodies) {
      return base;
    }
    return base + (slot < extra ? 1 : 0);
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.image(this.bodyKey, this.imagePath);
    scene.load.image(this.gunKey, this.gunPath);
    scene.load.image(this.corpseKey, this.wreckPath);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.flashKey)) {
      bake(scene, this.flashKey, 36, 28, (g) => this.renderFlash(g));
    }
    for (const key of [this.bodyKey, this.corpseKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    for (const key of [this.gunKey, this.flashKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
    this.ensureWheels(scene);
    if (scene.anims.exists('btr-hold')) {
      scene.anims.remove('btr-hold');
    }
    if (scene.textures.exists(this.bodyKey)) {
      scene.anims.create({
        key: 'btr-hold',
        frames: [{ key: this.bodyKey }],
        frameRate: 1,
        repeat: -1,
      });
    }
  }

  private static ensureWheels(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.bodyKey)) {
      return;
    }
    const source = scene.textures.get(this.bodyKey).getSourceImage() as CanvasImageSource;
    for (const axle of this.axles) {
      if (scene.textures.exists(axle.key)) {
        scene.textures.remove(axle.key);
      }
      const size = axle.radius * 2;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(axle.radius, axle.radius, axle.radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        source,
        axle.cx - axle.radius,
        axle.cy - axle.radius,
        size,
        size,
        0,
        0,
        size,
        size,
      );
      // Чуть светлее ступицы. Два пикселя, у каждого колеса свой рисунок.
      ctx.fillStyle = '#6e6844';
      for (const dot of axle.nick) {
        ctx.fillRect(axle.radius + dot.x, axle.radius + dot.y, 1, 1);
      }
      ctx.restore();
      const added = scene.textures.addCanvas(axle.key, canvas);
      if (!added) {
        return;
      }
      added.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  private static plan(): readonly Drop[] {
    return [...Btr.firstDrop, ...Btr.secondDrop];
  }

  // Нижний ракетчик первой колонны. Его дверь держит зазор до рубежа, остальные стоят на той же прямой.
  private static lowestRocket(): Drop {
    let found = Btr.firstDrop[0];
    for (const drop of Btr.firstDrop) {
      if (drop.kind === 'rocket' && (found.kind !== 'rocket' || drop.y > found.y)) {
        found = drop;
      }
    }
    return found;
  }

  // Прямая первой высадки. Выше ракетчика дверь правее, штурмовик ниже выходит ещё левее.
  private static rocketX(y: number): number {
    const rocket = Btr.lowestRocket();
    const anchor = (GAME.width * 3) / 4 + Btr.doorGap;
    return anchor + Btr.dropRun * (rocket.y - y);
  }

  private static columnExit(): { x: number; y: number } {
    const tail = Btr.firstDrop[Btr.firstDrop.length - 1];
    return { x: tail ? Btr.rocketX(tail.y) : 0, y: tail?.y ?? 0 };
  }

  // Подъём к стрелкам продолжает конец первой высадки. Полный шаг 1:1 на узком поле
  // уводит последнего стрелка за рубеж — тогда наклон положе, дверь остаётся на зазоре.
  private static gunnerRun(exit: { x: number; y: number }): number {
    const last = Btr.secondDrop[Btr.secondDrop.length - 1];
    if (!last || exit.y === last.y) {
      return 0;
    }
    const room = exit.x - (Btr.gunX + Btr.doorGap);
    return Math.min(Btr.dropRun, Math.max(0, room / (exit.y - last.y)));
  }

  private static dropX(drop: Drop): number {
    if (drop.stop === 0) {
      return Btr.rocketX(drop.y);
    }
    const exit = Btr.columnExit();
    return exit.x - Btr.gunnerRun(exit) * (exit.y - drop.y);
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
    fireTarget: WorldPoint,
    deploy: TroopDrop | undefined,
    released = 0,
    purse = 1,
    slot = 0,
    count = 1,
  ) {
    super(scene, x, y, hp, Btr.bodyKey, 'btr-hold', 0xc4a15a, shots, fireTarget);
    this.deploy = deploy;
    this.released = Math.max(0, Math.floor(released));
    this.routeMark = this.released;
    this.slot = Math.max(0, Math.floor(slot));
    this.coinReward = Btr.coinsForBody(purse, this.slot, count);
    const fit = Btr.hullFit;
    this.setScale(Btr.scale);
    this.setOrigin(fit.originX, fit.originY);
    // Свежий выезд садится на первую линию, правее начала высадки. Сохранённое место не трогаем.
    const first = Btr.firstDrop[0];
    if (this.released === 0 && first && this.x > Btr.dropX(first)) {
      this.setY(first.y);
    }
    this.prevX = this.x;
    this.prevY = this.y;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(fit.bodyW, fit.bodyH);
    body.setOffset(fit.bodyX, fit.bodyY);
    this.hpBarWidth = Math.round(72 * Btr.scale);
    this.syncBar();

    this.gun = scene.add.image(x, y, Btr.gunKey);
    this.gun.setOrigin(Btr.gunPivot.x / Btr.gunFrame.w, Btr.gunPivot.y / Btr.gunFrame.h);
    for (const axle of Btr.axles) {
      if (!scene.textures.exists(axle.key)) {
        continue;
      }
      const image = scene.add.image(x, y, axle.key);
      image.setOrigin(0.5, 0.5);
      this.wheels.push({ image, cx: axle.cx, cy: axle.cy, radius: axle.radius });
    }
    this.poseGun();
    this.poseWheels();
    this.once('destroy', () => {
      syncBtrEngine(scene, false);
      this.scene.tweens.killTweensOf(this.recoil);
      if (this.gun.active) {
        this.gun.destroy();
      }
      for (const wheel of this.wheels) {
        if (wheel.image.active) {
          wheel.image.destroy();
        }
      }
      this.smoke?.destroy();
    });
  }

  override mechanical(): boolean {
    return true;
  }

  override ionSole(): number {
    return this.shellRadius();
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) {
      this.voice();
      return;
    }
    if (!this.reachedWall) {
      this.roll += this.stepTravel(delta);
    }
    this.poseGun();
    this.poseWheels();
    this.voice();
  }

  // Свой маршрут вместо шага влево до одного рубежа. Темп и возврат после сдвига идут сюда же.
  override march(): void {
    this.marchAt(Btr.cruise);
  }

  override syncPace(): void {
    if (this.reachedWall) {
      return;
    }
    this.steer(16);
  }

  protected override resumeMarch(): void {
    this.steer(16);
  }

  protected override act(delta: number): void {
    this.collectDrop();
    this.steer(delta);
  }

  override hit(damage?: number, wire?: boolean): boolean {
    const dead = damage === undefined ? super.hit() : super.hit(damage, wire);
    if (this.gun.active && this.hp > 0) {
      this.gun.setTint(0xffccaa);
      this.scene.time.delayedCall(70, () => {
        if (this.gun.active && this.hp > 0) {
          this.gun.clearTint();
        }
      });
    }
    return dead;
  }

  protected override corpseTexture(): string | null {
    return Btr.corpseKey;
  }

  protected override prepareSever(): void {
    if (!this.scene.textures.exists(Btr.corpseKey)) {
      return;
    }
    this.setTexture(Btr.corpseKey);
    this.seatWreck();
    this.hideGear();
  }

  protected override severGear(): readonly Phaser.GameObjects.Image[] {
    return [];
  }

  // Остов уже на земле. Столб режет его и набок не валит.
  protected override severGround(): number | null {
    return null;
  }

  override kill(blastAt?: WorldPoint): void {
    const slain = this.hp <= 0 && !this.reachedWall;
    super.kill(blastAt);
    if (!slain || !this.active || !this.visible || this.texture.key !== Btr.corpseKey) {
      return;
    }
    this.seatWreck();
    const at = this.wreckPoint();
    this.smoke = wreckSmokeAt(this.scene, at.x, at.y, this.scaleX);
  }

  protected override onDie(slain: boolean): void {
    this.scene.tweens.killTweensOf(this.recoil);
    this.hideGear();
    if (!slain) {
      return;
    }
    const nose = this.texPoint(52, 62);
    const cab = this.texPoint(150, 52);
    vehicleDeathBlast(this.scene, nose, cab);
  }

  protected override pinDepth(): void {
    const layer = this.depth;
    for (const wheel of this.wheels) {
      if (wheel.image.active) {
        // Чуть выше корпуса, чтобы шина рисунка не закрыла диск. Солдат на линии ниже всё равно поверх.
        wheel.image.setDepth(layer + 0.05);
      }
    }
    if (this.gun?.active) {
      // Та же глубина отдаёт корпус поверх ствола, когда список сцены ставит его позже.
      // Шаг меньше полоски и дисков: солдат на нижней линии всё равно поверх.
      this.gun.setDepth(layer + 0.01);
    }
  }

  protected override shotPose(): { x: number; y: number; angle: number } {
    this.aim = this.aimRotation();
    const mount = this.mountPoint();
    const reach =
      (Btr.gunPivot.x - Btr.muzzleTip.x) * Btr.gunScale * this.scaleX;
    const cos = Math.cos(this.aim);
    const sin = Math.sin(this.aim);
    return {
      x: mount.x - cos * reach,
      y: mount.y - sin * reach,
      angle: Phaser.Math.Angle.Wrap(this.aim + Math.PI),
    };
  }

  protected override onFire(x: number, y: number, angle: number): void {
    this.kickGun();
    const port = this.mountPoint();
    ejectCasing(this.scene, port.x, port.y, angle, this.depth, 1.2 * this.scaleX);
    const flash = this.scene.add.image(x, y, Btr.flashKey);
    flash.setOrigin(0, 0.5);
    flash.setRotation(angle);
    flash.setDepth(this.depth);
    flash.setScale(0.7 * this.scaleX);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 0.45 * this.scaleX,
      scaleY: 0.35 * this.scaleX,
      duration: 90,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy(),
    });
  }

  // Дверь не считает скачок сужения за проезд мимо точек высадки.
  override followWidth(previous: number): void {
    if (this.active && previous > GAME.width && this.x > GAME.width) {
      this.prevX *= GAME.width / previous;
    }
    super.followWidth(previous);
  }

  // Хлопок у среза. Левый край — дуло.
  private static renderFlash(g: Phaser.GameObjects.Graphics): void {
    const y = 14;
    g.fillStyle(0xff7a1e, 0.9);
    g.fillEllipse(16, y, 22, 16);
    g.fillStyle(0xffc24a, 1);
    g.fillEllipse(10, y, 16, 8);
    g.fillStyle(0xfff0b0, 1);
    g.fillCircle(6, y, 4);
  }

  private goal(): { x: number; y: number; shoot: boolean } {
    const plan = Btr.plan();
    if (this.released >= plan.length) {
      const x = Btr.gunX;
      return { x, y: this.y, shoot: this.x <= x + 1.5 };
    }
    const drop = plan[this.released];
    if (!drop) {
      return { x: Btr.gunX, y: this.y, shoot: false };
    }
    return { x: Btr.dropX(drop), y: drop.y, shoot: false };
  }

  // Дверь дошла до точки солдата — выпускает его. На перегоне до первой точки колонны молчит.
  // Длинный кадр, перескочивший две точки, выпускает обеих: иначе вторая линия теряется.
  private collectDrop(): void {
    const x0 = this.prevX;
    const y0 = this.prevY;
    const x1 = this.x;
    const y1 = this.y;
    this.prevX = x1;
    this.prevY = y1;
    if (this.reachedWall) {
      return;
    }
    const plan = Btr.plan();
    for (let n = this.released; n < plan.length; n += 1) {
      const drop = plan[this.released];
      if (!drop || !Btr.doorAt(x0, y0, x1, y1, drop)) {
        return;
      }
      this.release(drop);
    }
  }

  // Точка на отрезке этого кадра или дверь уже стоит на ней. Порог тот же, что у посадки на точку.
  private static doorAt(x0: number, y0: number, x1: number, y1: number, drop: Drop): boolean {
    const tx = Btr.dropX(drop);
    const ty = drop.y;
    if (Math.hypot(x1 - tx, y1 - ty) <= 1.5) {
      return true;
    }
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.04) {
      return false;
    }
    const t = Phaser.Math.Clamp(((tx - x0) * dx + (ty - y0) * dy) / len2, 0, 1);
    const cx = x0 + dx * t;
    const cy = y0 + dy * t;
    return Math.hypot(cx - tx, cy - ty) <= 1.5;
  }

  private release(drop: Drop): void {
    this.deploy?.(drop.kind, this.x, drop.y);
    this.released += 1;
    this.routeMark = this.released;
  }

  private steer(delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body?.enable || this.reachedWall || this.held()) {
      return;
    }
    const haste = enemyHasteOf(this.scene.registry);
    const speed = Btr.cruise * haste;
    const goal = this.goal();
    const step = Math.max(delta, 1) / 1000;
    if (goal.shoot) {
      body.setVelocity(0, 0);
      if (!this.gunArmed) {
        this.gunArmed = true;
        this.gunWait = Btr.openDelay;
      }
      this.tickGun(delta);
      return;
    }
    const dx = goal.x - this.x;
    const dy = goal.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) {
      body.setVelocity(0, 0);
      return;
    }
    // Прямо к точке двери. Первая высадка — диагональ один к одному, подъём к стрелкам — та же прямая.
    if (dist <= speed * step) {
      body.setVelocity(dx / step, dy / step);
      return;
    }
    body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
  }

  // Мотор гудит, пока корпус жив. Остов молчит. Рубеж и ЭМИ гул не снимают.
  private voice(): void {
    syncBtrEngine(this.scene, this.active && !this.reachedWall);
  }

  // Путь этого кадра, включая диагональ высадки. Скорость уже выставлена шагом. Под ЭМИ тело стоит.
  private stepTravel(delta: number): number {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body?.enable || this.held()) {
      return 0;
    }
    return Math.hypot(body.velocity.x, body.velocity.y) * (delta / 1000);
  }

  private tickGun(delta: number): void {
    this.gunWait -= delta * enemyHasteOf(this.scene.registry);
    if (this.gunWait > 0) {
      return;
    }
    if (this.gunLeft <= 0) {
      this.gunLeft = Btr.burstCount;
    }
    this.gunLeft -= 1;
    this.gunWait = this.gunLeft > 0 ? Btr.burstGap : Btr.shotInterval;
    const shot = this.shotPose();
    this.spawnShot(shot.x, shot.y, shot.angle);
    this.onFire(shot.x, shot.y, shot.angle);
  }

  private aimRotation(): number {
    if (!this.goal().shoot) {
      return 0;
    }
    const mount = this.mountPoint();
    const at = Phaser.Math.Angle.Between(mount.x, mount.y, this.fireTarget.x, this.fireTarget.y);
    return Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(at - Math.PI), -Btr.aimLimit, Btr.aimLimit);
  }

  private mountPoint(): { x: number; y: number } {
    return this.texPoint(Btr.breech.x, Btr.breech.y);
  }

  private texPoint(px: number, py: number): { x: number; y: number } {
    const frame = Btr.frame;
    return {
      x: this.x + (px - this.originX * frame.w) * this.scaleX,
      y: this.y + (py - this.originY * frame.h) * this.scaleY,
    };
  }

  private kickGun(): void {
    this.scene.tweens.killTweensOf(this.recoil);
    this.recoil.x = Btr.recoilKick.x;
    this.scene.tweens.add({
      targets: this.recoil,
      x: 0,
      duration: Btr.recoilKick.ms,
      ease: 'Quad.Out',
    });
  }

  private poseGun(): void {
    if (!this.gun.active) {
      return;
    }
    const alive = !this.reachedWall;
    this.gun.setVisible(alive);
    if (!alive) {
      return;
    }
    this.aim = this.aimRotation();
    const mount = this.mountPoint();
    const kick = this.recoil.x * Btr.gunScale * this.scaleX;
    const cos = Math.cos(this.aim);
    const sin = Math.sin(this.aim);
    this.gun.setPosition(mount.x + cos * kick, mount.y + sin * kick);
    this.gun.setRotation(this.aim);
    this.gun.setScale(this.scaleX * Btr.gunScale);
    this.gun.setAlpha(this.alpha);
    if (this.tintTopLeft !== 0xffffff) {
      this.gun.setTint(this.tintTopLeft);
    } else {
      this.gun.clearTint();
    }
  }

  private poseWheels(): void {
    const alive = !this.reachedWall;
    const tinted = this.tintTopLeft !== 0xffffff;
    for (const wheel of this.wheels) {
      const image = wheel.image;
      if (!image.active) {
        continue;
      }
      image.setVisible(alive);
      if (!alive) {
        continue;
      }
      const at = this.texPoint(wheel.cx, wheel.cy);
      image.setPosition(at.x, at.y);
      image.setScale(this.scaleX);
      // Нос влево: низ колеса идёт к корме. Радиус в пикселях поля, иначе крупный диск крутится слишком часто.
      image.setRotation(-this.roll / (wheel.radius * this.scaleX));
      image.setAlpha(this.alpha);
      if (tinted) {
        image.setTint(this.tintTopLeft);
      } else {
        image.clearTint();
      }
    }
  }

  private hideGear(): void {
    if (this.gun.active) {
      this.gun.setVisible(false);
    }
    for (const wheel of this.wheels) {
      if (wheel.image.active) {
        wheel.image.setVisible(false);
      }
    }
  }

  private seatWreck(): void {
    const fit = Btr.wreckFit;
    this.setOrigin(fit.originX, fit.originY);
  }

  private wreckPoint(): { x: number; y: number } {
    const frame = Btr.frame;
    const fit = Btr.wreckFit;
    const flame = Btr.wreckFlame;
    return {
      x: this.x + (flame.x - fit.originX * frame.w) * this.scaleX,
      y: this.y + (flame.y - fit.originY * frame.h) * this.scaleY,
    };
  }
}
