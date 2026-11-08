// Тяжёлый танк: босс чётных десятков и сосед суперсолдата, когда боссов уже несколько.
// Едет по линии танка игрока к середине поля, встаёт и бьёт прямой наводкой. До проволоки не доходит.
// Гусеница прокручивается на ходу, каждый каток крутится целиком, и остаются две колеи на всю длину ленты, каждую толщиной с неё. После загрузки след дорисовывается от правого края поля: путь туда известен. При гибели колеи гаснут. Ствол отдельный: отдача сдвигает его в башню.
// Корпус дрожит от мотора. С кормы идёт чёрный дым на юго-восток.
// При гибели живой корпус сменяется сгоревшим остовом. Дым идёт из пролома башни.

import Phaser, { Scene } from 'phaser';
import { GAME, enemyHasteOf } from '../gameConfig';
import { ejectCasing } from '../gfx/casing';
import { exhaustAt, idleShift } from '../gfx/engine';
import { bake } from '../gfx/textures';
import { vehicleDeathBlast } from '../gfx/vehicleBlast';
import { wreckSmokeAt } from '../gfx/wreckSmoke';
import { playArtilleryShot } from '../sounds/BoomSounds';
import { HeavyShell } from './HeavyShell';
import { RangedEnemy } from './RangedEnemy';
import type { WorldPoint } from '../types/WorldPoint';

type Axle = { key: string; cx: number; cy: number; radius: number };

type Roller = { image: Phaser.GameObjects.Image; cx: number; cy: number; radius: number };

export class HeavyTank extends RangedEnemy {
  static readonly textureKey = 'heavy-tank';
  static readonly gunKey = 'heavy-tank-gun';
  static readonly flashKey = 'heavy-tank-shot';
  static readonly trackKey = 'heavy-tank-track';
  static readonly corpseKey = 'heavy-tank-wreck';
  static readonly imagePath = 'assets/heavy-tank.png';
  static readonly gunPath = 'assets/heavy-tank-gun.png';
  static readonly flashPath = 'assets/heavy-tank-shot.png';
  static readonly wreckPath = 'assets/heavy-tank-wreck.png';

  static readonly frame = { w: 256, h: 128 };
  static readonly gunFrame = { w: 256, h: 128 };
  static readonly flashFrame = { w: 256, h: 128 };
  // Подошва на строке 111, середина корпуса по непрозрачным пикселям.
  static readonly placed = {
    scale: 1,
    originX: 143 / 256,
    originY: 112 / 128,
    bodyW: 188,
    bodyH: 78,
    bodyX: 50,
    bodyY: 32,
  };
  // Остов на том же холсте, но рисунок сдвинут относительно живого корпуса.
  // Живой якорь (143, 112) приходится на пиксель остова (146, 111): гусеница остаётся на той же земле.
  static readonly wreckFit = { originX: 146 / 256, originY: 111 / 128 };
  // Пролом крыши башни. Столб дыма стоит здесь, пока остов лежит.
  static readonly wreckFlame = { x: 148, y: 40 };
  // Тот же срок, что труп пехоты.
  static readonly wreckMs = 5000;
  // Левая грань башни, строки 34–53: посадочное место высотой 20 px. Ось по его середине.
  static readonly breech = { x: 107, y: 44 };
  // Казённик на кадре занимает 108 px по высоте. 0.17 сажает его в срез, не выше и не ниже грани.
  static readonly gunScale = 0.17;
  static readonly gunOrigin = { x: 1, y: 65 / 128 };
  // Задняя крыша башни на кадре корпуса. Гильза выходит отсюда, не из ствола.
  static readonly casingPort = { x: 192, y: 34 };
  // Крупнее гильзы танка игрока (масштаб 2, тяжесть 2): болванка толще, дуга ленивее.
  static readonly shellCasing = { scale: 2.5, heft: 3 };
  // Верх кормы. Танк смотрит влево, поэтому дым отсюда уходит вправо и вниз.
  static readonly exhaustPort = { x: 228, y: 58 };
  // Нижняя ветвь гусеницы. Её копия едет по кругу, пока корпус в движении.
  static readonly trackBand = { x: 55, y: 98, w: 170, h: 13 };
  // Пикселей прокрутки в секунду. Знак такой, чтобы трак шёл к корме.
  static readonly trackRoll = 48;
  // Ступицы на кадре. Крайние — ленивец и ведущее: нижняя лента их не достаёт, поэтому стояли.
  // Радиус берёт весь диск, не только низ, который раньше ехал вместе с лентой.
  // Ведущее сидит под кормовой плитой: круг выше неё забирает броню.
  static readonly axles: readonly Axle[] = [
    { key: 'heavy-tank-roller-0', cx: 60, cy: 96, radius: 13 },
    { key: 'heavy-tank-roller-1', cx: 80, cy: 97, radius: 11 },
    { key: 'heavy-tank-roller-2', cx: 108, cy: 97, radius: 11 },
    { key: 'heavy-tank-roller-3', cx: 136, cy: 97, radius: 11 },
    { key: 'heavy-tank-roller-4', cx: 164, cy: 97, radius: 11 },
    { key: 'heavy-tank-roller-5', cx: 192, cy: 97, radius: 11 },
    { key: 'heavy-tank-roller-6', cx: 217, cy: 94, radius: 10 },
  ];
  // Середины колей: верх катков и подошва. Между ними высота хода, не две полоски вплотную.
  // Толщина отпечатка — высота нижней ветви. Уже ленты след читается ниткой.
  static readonly rutKey = 'heavy-tank-rut';
  static readonly rutTop = 70;
  // Повтор башмаков. Полоса длиннее этого куска и кладёт его встык.
  static readonly rutStep = 16;
  // След живого хода. После гибели он гаснет и не остаётся следующим волнам.
  static readonly rutFadeMs = 500;
  // Правый край ядра у среза ствола. Середина ядра на оси орудия, не на кончике звезды.
  static readonly flashOrigin = { x: 217 / 256, y: 64 / 128 };
  static readonly flashScale = 0.5;
  // Сначала кадр стоит ярко, потом гаснет. Между выстрелами 4 с, так что вспышки не слипаются.
  static readonly flashHoldMs = 280;
  static readonly flashFadeMs = 320;

  static readonly baseHp = 2000;
  static readonly hpPerAppearance = 500;
  static readonly shotDamage = 50;
  static readonly damagePerAppearance = 1;
  // Та же касса, что у суперсолдата: 25 монет за номер босс-волны.
  static readonly coinsPerAppearance = 25;
  static readonly fireDelay = 4000;
  static readonly shellSpeed = 360;
  // Рубеж стрелка. Отсюда ствол ещё целиком в кадре и не упирается в игрока.
  static readonly holdX = 640;
  static readonly aimLimit = 0.4;
  static readonly recoilKick = { x: 10, ms: 90 };

  readonly coinReward: number;
  readonly reachesBase = false;
  readonly contactDamage = 0;
  override readonly hitRadius = 108;
  readonly flameSeat = 'hood' as const;

  protected readonly holdX = HeavyTank.holdX;
  protected readonly fireDelay = HeavyTank.fireDelay;
  protected readonly bulletSpeed = HeavyTank.shellSpeed;
  protected readonly shotDamage = HeavyTank.shotDamage;
  protected readonly idleTexture = HeavyTank.textureKey;
  protected readonly muzzle = { x: 0, y: 0 };

  private readonly shellDamage: number;
  private readonly gun: Phaser.GameObjects.Image;
  private readonly track: Phaser.GameObjects.TileSprite;
  private readonly rollers: Roller[] = [];
  private readonly recoil = { x: 0 };
  private aim = 0;
  // false, пока корпус ещё едет к середине поля.
  private planted = false;
  private cannonCooldown = HeavyTank.fireDelay;
  private engine?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Чужой такт, чтобы дрожь не совпала с танком игрока.
  private engineMs = 1600;
  private readonly rumble = { x: 0, y: 0 };
  private readonly nextRumble = { x: 0, y: 0 };
  private readonly exhaustPoint = { x: 0, y: 0 };
  // Правый край колеи в мире. Танк едет влево, поэтому этот край больше не двигается.
  private rutRear = Number.NaN;
  private rutRibbon: Phaser.GameObjects.TileSprite[] = [];

  // 20-я волна — первый выход. 30-я танка не выпускает. 40-я — второй, 50-я — третий.
  static appearanceOn(wave: number): number {
    const boss = Math.max(0, Math.floor(wave / 10));
    if (boss <= 2 || boss === 3) {
      return 1;
    }
    return boss - 2;
  }

  static hpForAppearance(appearance: number): number {
    const extra = Math.max(0, Math.floor(appearance) - 1);
    return this.baseHp + extra * this.hpPerAppearance;
  }

  static damageForAppearance(appearance: number): number {
    const extra = Math.max(0, Math.floor(appearance) - 1);
    return this.shotDamage + extra * this.damagePerAppearance;
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

  static preload(scene: Scene): void {
    scene.load.image(this.textureKey, this.imagePath);
    scene.load.image(this.gunKey, this.gunPath);
    scene.load.image(this.flashKey, this.flashPath);
    scene.load.image(this.corpseKey, this.wreckPath);
    scene.load.image(HeavyShell.textureKey, HeavyShell.imagePath);
    HeavyShell.preload(scene);
  }

  static ensureTextures(scene: Scene): void {
    for (const key of [this.textureKey, this.corpseKey, this.gunKey, this.flashKey, HeavyShell.textureKey]) {
      if (!scene.textures.exists(key)) {
        continue;
      }
      const filter =
        key === this.textureKey || key === this.corpseKey
          ? Phaser.Textures.FilterMode.NEAREST
          : Phaser.Textures.FilterMode.LINEAR;
      scene.textures.get(key).setFilter(filter);
    }
    this.ensureTrack(scene);
    this.ensureRollers(scene);
    if (scene.anims.exists('heavy-tank-hold')) {
      scene.anims.remove('heavy-tank-hold');
    }
    if (scene.textures.exists(this.textureKey)) {
      scene.anims.create({
        key: 'heavy-tank-hold',
        frames: [{ key: this.textureKey }],
        frameRate: 1,
        repeat: -1,
      });
    }
    HeavyShell.ensureTextures(scene);
  }

  // Нижняя гусеница дважды в одной текстуре, чтобы прокрутка не показывала шов.
  private static ensureTrack(scene: Scene): void {
    if (scene.textures.exists(this.trackKey) || !scene.textures.exists(this.textureKey)) {
      return;
    }
    const source = scene.textures.get(this.textureKey).getSourceImage() as CanvasImageSource;
    const band = this.trackBand;
    const canvas = scene.textures.createCanvas(this.trackKey, band.w * 2, band.h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    ctx.drawImage(source, band.x, band.y, band.w, band.h, 0, 0, band.w, band.h);
    ctx.drawImage(source, band.x, band.y, band.w, band.h, band.w, 0, band.w, band.h);
    canvas.refresh();
  }

  // Круг катка с исходного кадра. Лента под ним остаётся на корпусе и едет отдельно.
  private static ensureRollers(scene: Scene): void {
    if (
      this.axles.every((axle) => scene.textures.exists(axle.key)) ||
      !scene.textures.exists(this.textureKey)
    ) {
      return;
    }
    const source = scene.textures.get(this.textureKey).getSourceImage() as CanvasImageSource;
    for (const axle of this.axles) {
      if (scene.textures.exists(axle.key)) {
        continue;
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
      ctx.restore();
      const added = scene.textures.addCanvas(axle.key, canvas);
      if (!added) {
        return;
      }
      added.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
    fireTarget: WorldPoint,
    // showing — какой по счёту выход танка. purse — номер босс-волны для кассы.
    showing = 1,
    purse = 1,
    slot = 0,
    count = 1,
  ) {
    super(scene, x, y, hp, HeavyTank.textureKey, 'heavy-tank-hold', 0xff3348, shots, fireTarget);
    // Волна ставит случайную полосу. Этот босс всегда напротив танка: точка прицела уже его линия.
    this.setY(HeavyTank.laneY(fireTarget.y));
    this.slot = Math.max(0, Math.floor(slot));
    this.coinReward = HeavyTank.coinsForBody(purse, this.slot, count);
    this.shellDamage = HeavyTank.damageForAppearance(showing);
    const fit = HeavyTank.placed;
    this.setScale(fit.scale);
    this.setOrigin(fit.originX, fit.originY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(fit.bodyW, fit.bodyH);
    body.setOffset(fit.bodyX, fit.bodyY);
    this.hpBarWidth = 78;
    this.syncBar();

    this.gun = scene.add.image(x, y, HeavyTank.gunKey);
    this.gun.setOrigin(HeavyTank.gunOrigin.x, HeavyTank.gunOrigin.y);
    this.track = scene.add.tileSprite(
      x,
      y,
      HeavyTank.trackBand.w,
      HeavyTank.trackBand.h,
      HeavyTank.trackKey,
    );
    this.track.setOrigin(0, 0);
    for (const axle of HeavyTank.axles) {
      if (!scene.textures.exists(axle.key)) {
        continue;
      }
      const image = scene.add.image(x, y, axle.key);
      image.setOrigin(0.5, 0.5);
      this.rollers.push({ image, cx: axle.cx, cy: axle.cy, radius: axle.radius });
    }
    this.poseGun();
    this.poseTrack(0);
    this.poseRollers(0);
    const rumble = () => this.applyRumble();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, rumble);
    this.once('destroy', () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, rumble);
      this.gun.destroy();
      this.track.destroy();
      this.releaseRuts();
      for (const roller of this.rollers) {
        if (roller.image.active) {
          roller.image.destroy();
        }
      }
      this.engine?.destroy();
    });
  }

  override ionSole(): number {
    return this.shellRadius();
  }

  // Предок стреляет через 350 мс после остановки. Здесь первый выстрел в тот же кадр, дальше раз в 4 с.
  protected override act(delta: number): void {
    if (this.planted && this.x > this.holdX) {
      this.planted = false;
      this.resumeMarch();
    }
    if (!this.planted && this.x <= this.holdX) {
      this.planted = true;
      this.body?.stop();
      this.anims.stop();
      this.setTexture(this.idleTexture);
      this.cannonCooldown = 0;
    }
    if (!this.planted) {
      return;
    }
    this.cannonCooldown -= delta * enemyHasteOf(this.scene.registry);
    if (this.cannonCooldown > 0) {
      return;
    }
    this.cannonCooldown = HeavyTank.fireDelay;
    const shot = this.shotPose();
    this.spawnShot(shot.x, shot.y, shot.angle);
    this.onFire(shot.x, shot.y, shot.angle);
  }

  override march(): void {
    const speed = 32 + Phaser.Math.Between(0, 8);
    this.marchAt(speed);
  }

  // Прибавка каждых десяти волн этому снаряду не нужна: номер выхода уже в shellDamage.
  protected override shotHit(): number {
    return this.shellDamage;
  }

  protected override spawnShot(x: number, y: number, angle: number): void {
    const shell = new HeavyShell(this.scene, x, y, this.shotHit());
    this.shots.add(shell);
    shell.launch(angle, this.bulletSpeed);
  }

  protected override onFire(x: number, y: number, angle: number): void {
    this.kickGun();
    playArtilleryShot(this.scene);
    this.dropCasing(angle);
    const flash = this.scene.add.image(x, y, HeavyTank.flashKey);
    flash.setOrigin(HeavyTank.flashOrigin.x, HeavyTank.flashOrigin.y);
    flash.setRotation(Phaser.Math.Angle.Wrap(angle - Math.PI));
    // Выше корпуса и выше летящего снаряда: глубина танка около 12, снаряд на 14.
    flash.setDepth(20);
    const pop = HeavyTank.flashScale;
    flash.setScale(pop);
    // scale одним числом в твине обнуляет картинку. Гаснут оси по отдельности, как у пикапа.
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: pop * 0.92,
      scaleY: pop * 0.92,
      delay: HeavyTank.flashHoldMs,
      duration: HeavyTank.flashFadeMs,
      ease: 'Linear',
      onComplete: () => flash.destroy(),
    });
  }

  override preUpdate(time: number, delta: number): void {
    // Тряска прошлого кадра не должна уехать в тело: физика читает координату после preUpdate.
    this.x -= this.rumble.x;
    this.y -= this.rumble.y;
    this.rumble.x = 0;
    this.rumble.y = 0;
    super.preUpdate(time, delta);
    if (!this.active) {
      return;
    }
    this.poseGun();
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    const rolling = !!body?.enable && body.velocity.x < -1 && !this.reachedWall;
    const haste = rolling ? enemyHasteOf(this.scene.registry) : 0;
    const step = rolling ? (HeavyTank.trackRoll * delta * haste) / 1000 : 0;
    this.poseTrack(step);
    this.poseRollers(step);
    // Стоящий после загрузки тоже кладёт колею: он уже проехал путь от правого края.
    if (!this.reachedWall) {
      this.layRut();
    }
    if (this.reachedWall) {
      this.stopEngine();
      return;
    }
    this.engineMs += delta;
    const shift = idleShift(this.engineMs);
    this.nextRumble.x = shift.x;
    this.nextRumble.y = shift.y;
    this.poseExhaust();
  }

  override hit(damage?: number, wire?: boolean): boolean {
    const dead = damage === undefined ? super.hit() : super.hit(damage, wire);
    if (this.gun.active) {
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
    return HeavyTank.corpseKey;
  }

  // Столб режет сгоревший корпус. Живой ствол отдельно не режем: на остове он уже сломан.
  protected override prepareSever(): void {
    if (!this.scene.textures.exists(HeavyTank.corpseKey)) {
      return;
    }
    this.setTexture(HeavyTank.corpseKey);
    this.seatWreck();
  }

  protected override severGear(): readonly Phaser.GameObjects.Image[] {
    return [];
  }

  // Остов уже стоит на гусенице. Столб только разводит половины, корпус набок не валится.
  protected override severGround(): number | null {
    return null;
  }

  // Лежащая картинка сдвинута относительно живого кадра. Опора после смены текстуры сажает гусеницу на землю.
  override kill(blastAt?: WorldPoint): void {
    const wasAlive = !this.reachedWall;
    super.kill(blastAt);
    if (wasAlive && this.active && this.texture.key === HeavyTank.corpseKey) {
      this.seatWreck();
    }
  }

  protected override onDie(slain: boolean): void {
    this.scene.tweens.killTweensOf(this.recoil);
    this.stopEngine();
    if (this.gun.active) {
      this.gun.setVisible(false);
    }
    if (this.track.active) {
      this.track.setVisible(false);
    }
    if (slain) {
      this.fadeRuts();
    }
    for (const roller of this.rollers) {
      if (roller.image.active) {
        roller.image.setVisible(false);
      }
    }
    if (!slain) {
      return;
    }
    const nose = this.x - 50;
    const rear = this.x + 36;
    const chest = this.y - 36;
    vehicleDeathBlast(this.scene, { x: nose, y: chest }, { x: rear, y: chest - 8 });
    const at = this.wreckPoint();
    const smoke = wreckSmokeAt(this.scene, at.x, at.y, this.scaleX);
    this.scene.time.delayedCall(HeavyTank.wreckMs, () => {
      if (smoke.scene) {
        smoke.destroy();
      }
    });
  }

  private seatWreck(): void {
    const fit = HeavyTank.wreckFit;
    this.setOrigin(fit.originX, fit.originY);
  }

  // Пролом башни в мире. Считает по опоре остова, а не по якорю ещё живого корпуса.
  private wreckPoint(): { x: number; y: number } {
    const frame = HeavyTank.frame;
    const fit = HeavyTank.wreckFit;
    const flame = HeavyTank.wreckFlame;
    return {
      x: this.x + (flame.x - fit.originX * frame.w) * this.scaleX,
      y: this.y + (flame.y - fit.originY * frame.h) * this.scaleY,
    };
  }

  protected override pinDepth(): void {
    if (this.track?.active) {
      this.track.setDepth(this.depth + 0.2);
    }
    for (const roller of this.rollers) {
      if (roller.image.active) {
        roller.image.setDepth(this.depth + 0.35);
      }
    }
    if (this.gun?.active) {
      this.gun.setDepth(this.depth + 1);
    }
  }

  // Зад башни. Угол полёта снаряда: гильза сама идёт вверх и к корме.
  private dropCasing(angle: number): void {
    const fit = HeavyTank.placed;
    const port = HeavyTank.casingPort;
    const brass = HeavyTank.shellCasing;
    ejectCasing(
      this.scene,
      this.x + (port.x - fit.originX * HeavyTank.frame.w) * this.scaleX,
      this.y + (port.y - fit.originY * HeavyTank.frame.h) * this.scaleY,
      angle,
      this.depth + 1,
      brass.scale,
      brass.heft,
    );
  }

  private kickGun(): void {
    this.scene.tweens.killTweensOf(this.recoil);
    this.recoil.x = HeavyTank.recoilKick.x;
    this.scene.tweens.add({
      targets: this.recoil,
      x: 0,
      duration: HeavyTank.recoilKick.ms,
      ease: 'Quad.Out',
    });
  }

  private poseGun(): void {
    if (!this.gun.active) {
      return;
    }
    this.gun.setVisible(!this.reachedWall);
    if (this.reachedWall) {
      return;
    }
    this.aim = this.aimRotation();
    const mount = this.mountPoint();
    const kick = this.recoil.x * this.scaleX;
    const cos = Math.cos(this.aim);
    const sin = Math.sin(this.aim);
    this.gun.setPosition(mount.x + cos * kick, mount.y + sin * kick);
    this.gun.setRotation(this.aim);
    this.gun.setScale(this.scaleX * HeavyTank.gunScale);
    this.gun.setAlpha(this.alpha);
  }

  protected override shotPose(): { x: number; y: number; angle: number } {
    this.aim = this.aimRotation();
    const mount = this.mountPoint();
    const reach = HeavyTank.gunFrame.w * HeavyTank.gunScale * this.scaleX;
    const cos = Math.cos(this.aim);
    const sin = Math.sin(this.aim);
    // Ствол смотрит влево от казённика. Угол полёта — продолжение этой оси.
    return {
      x: mount.x - cos * reach,
      y: mount.y - sin * reach,
      angle: Phaser.Math.Angle.Wrap(this.aim + Math.PI),
    };
  }

  // Поворот картинки ствола. Ноль — строго влево. Чуть выше или ниже, если танк не на линии базы.
  private aimRotation(): number {
    const mount = this.mountPoint();
    const at = Phaser.Math.Angle.Between(mount.x, mount.y, this.fireTarget.x, this.fireTarget.y);
    return Phaser.Math.Clamp(
      Phaser.Math.Angle.Wrap(at - Math.PI),
      -HeavyTank.aimLimit,
      HeavyTank.aimLimit,
    );
  }

  // Ноги ниже среза ствола. Так пушка лежит на точке прицела, а гусеница — на той же земле, что у танка игрока.
  private static laneY(aimY: number): number {
    const fit = HeavyTank.placed;
    return aimY - (HeavyTank.breech.y - fit.originY * HeavyTank.frame.h);
  }

  private mountPoint(): { x: number; y: number } {
    const fit = HeavyTank.placed;
    return {
      x: this.x + (HeavyTank.breech.x - fit.originX * HeavyTank.frame.w) * this.scaleX,
      y: this.y + (HeavyTank.breech.y - fit.originY * HeavyTank.frame.h) * this.scaleY,
    };
  }

  // Сдвиг после физики, иначе корпус уползает на пиксель за кадр. Ствол и дым едут тем же сдвигом.
  private applyRumble(): void {
    const dx = this.nextRumble.x;
    const dy = this.nextRumble.y;
    this.nextRumble.x = 0;
    this.nextRumble.y = 0;
    if (!this.active || (dx === 0 && dy === 0)) {
      return;
    }
    this.x += dx;
    this.y += dy;
    this.rumble.x = dx;
    this.rumble.y = dy;
    if (this.gun.active) {
      this.gun.x += dx;
      this.gun.y += dy;
    }
    if (this.track.active) {
      this.track.x += dx;
      this.track.y += dy;
    }
    for (const roller of this.rollers) {
      if (roller.image.active) {
        roller.image.x += dx;
        roller.image.y += dy;
      }
    }
    this.engine?.setPosition(this.exhaustPoint.x + dx, this.exhaustPoint.y + dy);
  }

  private poseExhaust(): void {
    const fit = HeavyTank.placed;
    const port = HeavyTank.exhaustPort;
    this.exhaustPoint.x = this.x + (port.x - fit.originX * HeavyTank.frame.w) * this.scaleX;
    this.exhaustPoint.y = this.y + (port.y - fit.originY * HeavyTank.frame.h) * this.scaleY;
    if (!this.engine) {
      this.engine = exhaustAt(this.scene, this.exhaustPoint.x, this.exhaustPoint.y, 1.15, 'southeast', true);
      return;
    }
    this.engine.setPosition(this.exhaustPoint.x, this.exhaustPoint.y);
  }

  private stopEngine(): void {
    this.nextRumble.x = 0;
    this.nextRumble.y = 0;
    this.engine?.destroy();
    this.engine = undefined;
  }

  private poseTrack(step: number): void {
    if (!this.track.active) {
      return;
    }
    this.track.setVisible(!this.reachedWall);
    if (this.reachedWall) {
      return;
    }
    const fit = HeavyTank.placed;
    const band = HeavyTank.trackBand;
    this.track.setPosition(
      this.x + (band.x - fit.originX * HeavyTank.frame.w) * this.scaleX,
      this.y + (band.y - fit.originY * HeavyTank.frame.h) * this.scaleY,
    );
    this.track.setScale(this.scaleX, this.scaleY);
    this.track.tilePositionX -= step;
    this.track.setAlpha(this.alpha);
  }

  // Низ катка идёт к корме, как лента. Круг выше ленты, поэтому крутится весь диск, и крайние тоже.
  private poseRollers(step: number): void {
    const fit = HeavyTank.placed;
    const frame = HeavyTank.frame;
    const tinted = this.tintTopLeft !== 0xffffff;
    for (const roller of this.rollers) {
      const image = roller.image;
      if (!image.active) {
        continue;
      }
      image.setVisible(!this.reachedWall);
      if (this.reachedWall) {
        continue;
      }
      image.setPosition(
        this.x + (roller.cx - fit.originX * frame.w) * this.scaleX,
        this.y + (roller.cy - fit.originY * frame.h) * this.scaleY,
      );
      image.setScale(this.scaleX, this.scaleY);
      image.setDepth(this.depth + 0.35);
      image.setAlpha(this.alpha);
      if (tinted) {
        image.setTint(this.tintTopLeft);
      } else {
        image.clearTint();
      }
      if (step !== 0) {
        image.rotation -= step / roller.radius;
      }
    }
  }

  // След хода гаснет в момент гибели. Дальше полосы живут своим твином и к корпусу уже не привязаны.
  private fadeRuts(): void {
    const ribbons = this.rutRibbon;
    this.rutRibbon = [];
    for (const ribbon of ribbons) {
      if (!ribbon.active) {
        continue;
      }
      this.scene.tweens.add({
        targets: ribbon,
        alpha: 0,
        duration: HeavyTank.rutFadeMs,
        onComplete: () => {
          if (ribbon.scene) {
            ribbon.destroy();
          }
        },
      });
    }
  }

  // Колеи, которые гибель ещё не отдала гаснуть. Иначе они остаются после снятия корпуса.
  private releaseRuts(): void {
    for (const ribbon of this.rutRibbon) {
      if (!ribbon.active) {
        continue;
      }
      this.scene.tweens.killTweensOf(ribbon);
      ribbon.destroy();
    }
    this.rutRibbon = [];
  }

  // Обе колеи на всю длину ленты. Полоса растёт только влево, уже проеханное не разрывается.
  // Правый край фиксируется один раз: на ходу это корма ленты, после загрузки — край поля, если танк уже левее.
  private layRut(): void {
    HeavyTank.ensureRut(this.scene);
    const front = this.trackFront();
    const span = HeavyTank.trackBand.w * this.scaleX;
    const lanes = this.rutLanes();
    if (this.rutRibbon.length === 0) {
      this.rutRear = Math.max(front + span, this.pathRear());
      this.rutRibbon = lanes.map((y) => this.rutRibbonAt(front, y, span));
    }
    const width = Math.max(span, this.rutRear - front);
    this.rutRibbon.forEach((ribbon, i) => {
      ribbon.setPosition(front, lanes[i] ?? ribbon.y);
      ribbon.setSize(width, HeavyTank.trackBand.h);
      // Левый край едет с передним краем ленты, рисунок на уже проеханной земле стоит.
      ribbon.tilePositionX = front;
    });
  }

  private rutLanes(): number[] {
    const sole = this.trackSole();
    const top = this.trackRow(HeavyTank.rutTop);
    return [top, sole];
  }

  private rutRibbonAt(x: number, y: number, width: number): Phaser.GameObjects.TileSprite {
    const ribbon = this.scene.add.tileSprite(x, y, width, HeavyTank.trackBand.h, HeavyTank.rutKey);
    ribbon.setOrigin(0, 0.5);
    ribbon.setDepth(3);
    return ribbon;
  }

  // Танк въезжает с правого края и едет только влево. После загрузки этот край — корма уже проеханного следа.
  private pathRear(): number {
    return GAME.width;
  }

  // Левый край ленты: танк смотрит влево, это начало гусеницы.
  private trackFront(): number {
    const fit = HeavyTank.placed;
    const band = HeavyTank.trackBand;
    return this.x + (band.x - fit.originX * HeavyTank.frame.w) * this.scaleX;
  }

  private trackSole(): number {
    const band = HeavyTank.trackBand;
    return this.trackRow(band.y + band.h);
  }

  private trackRow(textureY: number): number {
    const fit = HeavyTank.placed;
    return this.y + (textureY - fit.originY * HeavyTank.frame.h) * this.scaleY;
  }

  // Один отпечаток трака той же толщины, что лента: грунт по краям, вдавленные башмаки внутри.
  private static ensureRut(scene: Scene): void {
    if (scene.textures.exists(this.rutKey)) {
      return;
    }
    const h = this.trackBand.h;
    bake(scene, this.rutKey, this.rutStep, h, (g) => {
      const w = this.rutStep;
      g.fillStyle(0x3a2818, 0.92);
      g.fillRect(0, 0, w, h);
      g.fillStyle(0x24180f, 0.95);
      for (let x = 0; x < w; x += 8) {
        g.fillRect(x, 2, 5, h - 4);
      }
      g.fillStyle(0x8d7356, 0.7);
      g.fillRect(0, 0, w, 1);
      g.fillRect(0, h - 1, w, 1);
      g.fillStyle(0xc4a882, 0.65);
      g.fillRect(2, 0, 2, 1);
      g.fillRect(11, h - 1, 2, 1);
    });
  }
}
