// Багги с блоком ракет. Выезжает справа и встаёт у дальнего от танка края.
// Залп растёт с номером волны, как урон остальных врагов: +1 каждые 10 волн, потолок 8.
// Ракеты выходят по очереди из разных трубок и сходятся к танку разными дугами.
// Огонь пуска — сзади своей трубки. Колёса крутятся, пока машина едет: метка на ступице это показывает.
// Сгоревший корпус остаётся на поле. Взрыв разнимает его пополам, ионный столб режет вдоль луча.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { bake } from '../gfx/textures';
import { vehicleDeathBlast } from '../gfx/vehicleBlast';
import { wreckSmokeAt } from '../gfx/wreckSmoke';
import { RangedEnemy } from './RangedEnemy';
import { BuggyRocket } from './BuggyRocket';
import type { WorldPoint } from '../types/WorldPoint';

type Axle = { key: string; cx: number; cy: number };

type Wheel = { image: Phaser.GameObjects.Image; cx: number; cy: number };

type ApartPixel = { x: number; y: number };

type PixelPad = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: ImageData;
};

type ApartCut = {
  frontKey: string;
  rearKey: string;
  wheelKeys: string[];
  keys: string[];
  frontHull: ApartPixel[];
  rearHull: ApartPixel[];
};

export class RocketBuggy extends RangedEnemy {
  static readonly debutWave = 30;

  // Корпус толще штурмовика этой волны на волну дебюта.
  // Иначе первая живая машина, на 31-й, выходила бы с рангом 2.
  static hpForWave(wave: number): number {
    return this.waveHp(wave) + this.debutWave;
  }
  static readonly coinReward = 3;
  readonly coinReward = RocketBuggy.coinReward;
  // Холст картинки. Низ шин почти на последней строке.
  static readonly frame = { w: 160, h: 90 };
  static readonly placed = {
    scale: 1,
    originX: 0.5,
    originY: 1,
    bodyW: 140,
    bodyH: 66,
    bodyX: 16,
    bodyY: 22,
  };
  // Ось блока на кадре: носики слева и выше, казённик правее и ниже. Огонь пуска идёт вдоль неё, не по изгибу ракеты.
  static readonly pod = {
    nose: { x: 127, y: 29 },
    back: { x: 144, y: 35 },
  };
  // Носик слева, казённик правее. Сверху вниз: каждая следующая ракета берёт свой изгиб.
  // spread в радианах: минус выше линии на танк, плюс ниже. Лишние ракеты залпа идут по трубкам по кругу.
  static readonly tubes = [
    { nose: { x: 125, y: 25 }, back: { x: 146, y: 30 }, spread: -0.42 },
    { nose: { x: 126, y: 30 }, back: { x: 145, y: 34 }, spread: -0.14 },
    { nose: { x: 127, y: 34 }, back: { x: 144, y: 37 }, spread: 0.14 },
    { nose: { x: 128, y: 37 }, back: { x: 143, y: 40 }, spread: 0.42 },
  ] as const;
  // Центр шины на кадре. Круг забирает покрышку вместе с диском, иначе диск крутится внутри шины на кузове.
  static readonly wheelRadius = 18;
  static readonly axles: readonly Axle[] = [
    { key: 'buggy-wheel-0', cx: 42, cy: 71 },
    { key: 'buggy-wheel-1', cx: 133, cy: 71 },
  ];
  static readonly bodyKey = 'buggy-body';
  static readonly corpseKey = 'buggy-wreck';
  static readonly flameKey = 'buggy-flame';
  static readonly imagePath = 'assets/buggy-0.png';
  static readonly wreckPath = 'assets/buggy-wreck.png';
  // Две ракеты, пока номер волны меньше 10. Дальше +1 за каждые 10, не больше восьми.
  static readonly rocketMin = 2;
  static readonly rocketEvery = 10;
  static readonly rocketMax = 8;
  // Пауза после последней ракеты залпа. Между ракетами хватает, чтобы каждая вышла отдельно.
  static readonly shotInterval = 3000;
  static readonly burstGap = 400;
  // Чуть быстрее ракеты ракетчика: залп из нескольких не должен висеть на полполя.
  static readonly shotSpeed = 340;
  static readonly flashPop = { scale: 1.5, ms: 160 };
  // Капот и кабина на кадре. Та же вспышка, что у пикапа: два клуба на корпусе, не у колёс.
  static readonly blast = [
    { x: 42, y: 41 },
    { x: 95, y: 44 },
  ] as const;
  // Пламя на капоте остова. Отсюда поднимается дым, и он остаётся на носовой половине.
  static readonly hoodFlame = { x: 43, y: 43 };
  // Шов за кабиной: блок ракет остаётся на корме. Шины на остове круглые, как у живой машины.
  private static readonly apart = {
    splitX: 108,
    hingeY: 50,
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

  override readonly hitRadius = 72;
  // Струя огнемёта сажает огонь на капот, а не на блок ракет.
  readonly flameSeat = 'hood' as const;

  override ionSole(): number {
    return this.shellRadius();
  }

  // Корма на несколько пикселей внутри текущего правого края. Нос смотрит влево, к танку.
  // Край читается каждый кадр: сузившееся окно не оставляет машину за кадром.
  protected get holdX(): number {
    return GAME.width - RocketBuggy.frame.w * (1 - RocketBuggy.placed.originX) * RocketBuggy.placed.scale - 6;
  }
  protected readonly fireDelay = RocketBuggy.shotInterval;
  protected override readonly burstGap = RocketBuggy.burstGap;
  protected readonly bulletSpeed = RocketBuggy.shotSpeed;
  protected readonly shotDamage = 2;
  protected readonly idleTexture = RocketBuggy.bodyKey;
  // Дуло считает shotPose по трубкам. Это поле родитель требует, выстрел его не читает.
  protected readonly muzzle = { x: 0, y: 0 };

  private readonly wheels: Wheel[] = [];
  // Какая трубка стреляет следующей. Залп длиннее четырёх труб идёт по ним по второму кругу.
  private tubeCursor = 0;
  private firedTube: (typeof RocketBuggy.tubes)[number] = RocketBuggy.tubes[0];
  private smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Столб снял спрайт, а дым остался на половине капота и гаснет вместе с ней.
  private smokeFollows = false;
  private readonly debris: Phaser.GameObjects.GameObject[] = [];
  private readonly debrisKeys: string[] = [];

  static salvoFor(wave: number): number {
    const extra = Math.floor(Math.max(0, wave) / RocketBuggy.rocketEvery);
    return Math.min(RocketBuggy.rocketMax, RocketBuggy.rocketMin + extra);
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.image('buggy-0', RocketBuggy.imagePath);
    scene.load.image(RocketBuggy.corpseKey, RocketBuggy.wreckPath);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    RocketBuggy.splitWheels(scene);
    if (!scene.textures.exists(RocketBuggy.flameKey)) {
      bake(scene, RocketBuggy.flameKey, 28, 16, (g) => RocketBuggy.renderFlame(g));
    }
    for (const key of [RocketBuggy.bodyKey, RocketBuggy.corpseKey, ...RocketBuggy.axles.map((axle) => axle.key), RocketBuggy.flameKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    if (scene.anims.exists('buggy-drive')) {
      scene.anims.remove('buggy-drive');
    }
    if (scene.textures.exists(RocketBuggy.bodyKey)) {
      scene.anims.create({
        key: 'buggy-drive',
        frames: [{ key: RocketBuggy.bodyKey }],
        frameRate: 1,
        repeat: -1,
      });
    }
  }

  // Длина залпа на всю жизнь этого тела. Фабрика зовёт и при выходе, и при загрузке.
  override setDamageWave(wave: number): void {
    super.setDamageWave(wave);
    this.burstCount = RocketBuggy.salvoFor(wave);
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
    fireTarget: WorldPoint,
  ) {
    super(scene, x, y, hp, RocketBuggy.bodyKey, 'buggy-drive', 0xd06028, shots, fireTarget);
    const placed = RocketBuggy.placed;
    this.setScale(placed.scale);
    this.setOrigin(placed.originX, placed.originY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(placed.bodyW, placed.bodyH);
    body.setOffset(placed.bodyX, placed.bodyY);
    this.hpBarWidth = 54;
    for (const axle of RocketBuggy.axles) {
      if (!scene.textures.exists(axle.key)) {
        continue;
      }
      const image = scene.add.image(x, y, axle.key);
      image.setOrigin(0.5, 0.5);
      this.wheels.push({ image, cx: axle.cx, cy: axle.cy });
    }
    this.once('destroy', () => {
      this.dropWheels();
      if (!this.smokeFollows) {
        this.smoke?.destroy();
      }
      this.clearDebris();
    });
    this.poseWheels(0);
  }

  override mechanical(): boolean {
    return true;
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.poseWheels(delta);
  }

  override march(): void {
    const speed = 82 + this.paceRank * 2 + Phaser.Math.Between(0, 8);
    this.marchAt(speed);
  }

  // Носик очередной трубки. Угол — ось блока плюс свой изгиб, поэтому ракеты не ложатся на одну линию.
  protected override shotPose(): { x: number; y: number; angle: number } {
    const tube = RocketBuggy.tubes[this.tubeCursor % RocketBuggy.tubes.length];
    this.tubeCursor += 1;
    this.firedTube = tube;
    const nose = this.framePoint(tube.nose.x, tube.nose.y);
    const back = this.framePoint(tube.back.x, tube.back.y);
    const along = Math.atan2(nose.y - back.y, nose.x - back.x);
    return {
      x: nose.x,
      y: nose.y,
      angle: along + tube.spread,
    };
  }

  protected override spawnShot(x: number, y: number, angle: number): void {
    const rocket = new BuggyRocket(this.scene, x, y, this.shotHit(), this.fireTarget, this.firedTube.spread);
    this.shots.add(rocket);
    rocket.launch(angle, this.bulletSpeed);
  }

  // Язык растёт из казённика этой трубки назад вдоль блока. Изгиб ракеты огонь не поворачивает.
  protected override onFire(_x: number, _y: number, _angle: number): void {
    const back = this.framePoint(this.firedTube.back.x, this.firedTube.back.y);
    const nose = this.framePoint(RocketBuggy.pod.nose.x, RocketBuggy.pod.nose.y);
    const tail = this.framePoint(RocketBuggy.pod.back.x, RocketBuggy.pod.back.y);
    const along = Math.atan2(nose.y - tail.y, nose.x - tail.x);
    const flame = this.scene.add.image(back.x, back.y, RocketBuggy.flameKey);
    flame.setOrigin(1, 0.5);
    flame.setRotation(along);
    flame.setBlendMode(Phaser.BlendModes.ADD);
    flame.setDepth(this.depth + 1);
    this.scene.tweens.add({
      targets: flame,
      alpha: 0,
      scale: RocketBuggy.flashPop.scale,
      duration: RocketBuggy.flashPop.ms,
      onComplete: () => flame.destroy(),
    });
  }

  // Столб режет сгоревший кадр. Живые колёса на нём уже нарисованы, отдельные круги не режем.
  protected override prepareSever(): void {
    this.setTexture(RocketBuggy.corpseKey);
    this.setOrigin(RocketBuggy.placed.originX, RocketBuggy.placed.originY);
  }

  protected override severGear(): readonly Phaser.GameObjects.Image[] {
    return [];
  }

  // Остов уже лежит на колёсах. Столб только режет его, набок машина не валится.
  protected override severGround(): number | null {
    return null;
  }

  // Дым из щели капота едет с той половиной, на которой щель осталась.
  protected override rideSever(
    angle: number,
    halves: readonly [Phaser.GameObjects.Image, Phaser.GameObjects.Image],
  ): void {
    const smoke = this.smoke;
    const hood = halves[this.hoodSide(angle) >= 0 ? 0 : 1];
    if (!smoke || !hood) {
      return;
    }
    this.smokeFollows = true;
    const scene = this.scene;
    const place = () => {
      if (!smoke.scene || !hood.active) {
        return;
      }
      const ox = hood.originX * RocketBuggy.frame.w;
      const oy = hood.originY * RocketBuggy.frame.h;
      const flame = RocketBuggy.hoodFlame;
      const lx = (flame.x - ox) * hood.scaleX;
      const ly = (flame.y - oy) * hood.scaleY;
      const cos = Math.cos(hood.rotation);
      const sin = Math.sin(hood.rotation);
      smoke.setPosition(hood.x + lx * cos - ly * sin, hood.y + lx * sin + ly * cos);
    };
    const follow = () => {
      if (!smoke.scene || !hood.active) {
        scene.events.off(Phaser.Scenes.Events.UPDATE, follow);
        return;
      }
      place();
    };
    place();
    scene.events.on(Phaser.Scenes.Events.UPDATE, follow);
    hood.once('destroy', () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, follow);
      if (smoke.scene) {
        smoke.destroy();
      }
    });
  }

  private hoodSide(angle: number): number {
    const ox = this.originX * RocketBuggy.frame.w;
    const oy = this.originY * RocketBuggy.frame.h;
    const flame = RocketBuggy.hoodFlame;
    const lx = (flame.x - ox) * this.scaleX;
    const ly = (flame.y - oy) * this.scaleY;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const wx = lx * cos - ly * sin;
    const wy = lx * sin + ly * cos;
    return wx * -Math.sin(angle) + wy * Math.cos(angle);
  }

  protected override corpseTexture(): string | null {
    return RocketBuggy.corpseKey;
  }

  // Вспышка и дым в момент гибели. Живые круги колёс снимаются: на остове шины уже нарисованы.
  protected override onDie(slain: boolean): void {
    this.dropWheels();
    if (!slain) {
      return;
    }
    const [front, rear] = RocketBuggy.blast;
    vehicleDeathBlast(this.scene, this.framePoint(front.x, front.y), this.framePoint(rear.x, rear.y));
    const at = this.framePoint(RocketBuggy.hoodFlame.x, RocketBuggy.hoodFlame.y);
    this.smoke = wreckSmokeAt(this.scene, at.x, at.y, this.scaleX);
  }

  // Мина, артиллерия, залп и авиабомба передают центр разрыва. От них кузов расходится по шву,
  // колёса выкатываются. Столб ионной пушки режет тот же сгоревший кадр вдоль луча.
  // Пуля и огонь этот центр не передают: остаётся целый остов.
  override kill(blastAt?: WorldPoint): void {
    if (this.reachedWall || this.hp > 0 || !blastAt) {
      super.kill(blastAt);
      return;
    }
    const cut = RocketBuggy.cutApart(this.scene);
    super.kill();
    if (!cut) {
      return;
    }
    this.setVisible(false);
    this.spawnApart(cut);
  }

  // Едет влево: верх покрышки уходит влево, это отрицательный угол при vx < 0.
  private poseWheels(delta: number): void {
    const scale = this.scaleX;
    const live =
      !this.reachedWall && !this.scene.time.paused && this.scene.registry.get('combat') !== false;
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    const vx = live && body?.enable ? body.velocity.x : 0;
    for (const wheel of this.wheels) {
      if (!wheel.image.active) {
        continue;
      }
      const at = this.framePoint(wheel.cx, wheel.cy);
      wheel.image.setPosition(at.x, at.y);
      wheel.image.setScale(scale);
      wheel.image.setDepth(this.depth);
      if (Math.abs(vx) > 1) {
        wheel.image.rotation += (vx / (RocketBuggy.wheelRadius * scale)) * (delta / 1000);
      }
    }
  }

  private framePoint(px: number, py: number): { x: number; y: number } {
    const frame = RocketBuggy.frame;
    return {
      x: this.x + (px - this.originX * frame.w) * this.scaleX,
      y: this.y + (py - this.originY * frame.h) * this.scaleY,
    };
  }

  // Кузов без шин и два круга: покрышка и диск одной картинкой. Метка на диске уезжает вместе с кругом.
  private static splitWheels(scene: Phaser.Scene): void {
    if (scene.textures.exists(RocketBuggy.bodyKey) || !scene.textures.exists('buggy-0')) {
      return;
    }
    const source = scene.textures.get('buggy-0').getSourceImage() as CanvasImageSource;
    const { w, h } = RocketBuggy.frame;
    const body = document.createElement('canvas');
    body.width = w;
    body.height = h;
    const ctx = body.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.drawImage(source, 0, 0);
    const radius = RocketBuggy.wheelRadius;
    const size = radius * 2;
    for (const axle of RocketBuggy.axles) {
      const wheel = document.createElement('canvas');
      wheel.width = size;
      wheel.height = size;
      const wheelCtx = wheel.getContext('2d');
      if (!wheelCtx) {
        return;
      }
      wheelCtx.save();
      wheelCtx.beginPath();
      wheelCtx.arc(radius, radius, radius, 0, Math.PI * 2);
      wheelCtx.clip();
      wheelCtx.drawImage(source, axle.cx - radius, axle.cy - radius, size, size, 0, 0, size, size);
      wheelCtx.restore();
      if (!RocketBuggy.publish(scene, axle.key, wheel)) {
        return;
      }
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(axle.cx, axle.cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    RocketBuggy.publish(scene, RocketBuggy.bodyKey, body);
  }

  private static publish(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): boolean {
    if (scene.textures.exists(key)) {
      return true;
    }
    const added = scene.textures.addCanvas(key, canvas);
    if (!added) {
      return false;
    }
    added.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return true;
  }

  // Правый край — срез трубы, языки растут влево. Поворот кладёт их назад вдоль блока.
  private static renderFlame(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xff6a18, 1);
    g.fillTriangle(2, 8, 26, 2, 26, 14);
    g.fillStyle(0xffee66, 1);
    g.fillTriangle(10, 8, 26, 5, 26, 11);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(22, 8, 2);
  }

  private dropWheels(): void {
    for (const wheel of this.wheels) {
      if (wheel.image.active) {
        wheel.image.destroy();
      }
    }
  }

  // Половинки крутятся вокруг шва и упираются в землю. Колёса выкатываются в стороны.
  // Дым остаётся на капоте и едет вместе с носом.
  private spawnApart(cut: ApartCut): void {
    const scene = this.scene;
    const scale = this.scaleX;
    const groundY = this.y;
    const spec = RocketBuggy.apart;
    const hinge = this.framePoint(spec.splitX, spec.hingeY);
    const depth = this.depth;

    const front = scene.add.container(hinge.x, hinge.y).setDepth(depth + 0.04);
    const frontImg = scene.add.image(0, 0, cut.frontKey);
    frontImg.setOrigin(1, spec.hingeY / RocketBuggy.frame.h);
    frontImg.setScale(scale);
    front.add(frontImg);

    const rear = scene.add.container(hinge.x, hinge.y).setDepth(depth + 0.05);
    const rearImg = scene.add.image(0, 0, cut.rearKey);
    rearImg.setOrigin(spec.splitX / RocketBuggy.frame.w, spec.hingeY / RocketBuggy.frame.h);
    rearImg.setScale(scale);
    rear.add(rearImg);

    const toLocal = (points: readonly ApartPixel[]) => points.map((point) => ({
      x: (point.x - spec.splitX) * scale,
      y: (point.y - spec.hingeY) * scale,
    }));
    const frontHull = toLocal(cut.frontHull);
    const rearHull = toLocal(cut.rearHull);

    const wheels: Phaser.GameObjects.Image[] = [];
    RocketBuggy.axles.forEach((axle, index) => {
      const wheelKey = cut.wheelKeys[index];
      if (!wheelKey) {
        return;
      }
      const at = this.framePoint(axle.cx, axle.cy);
      const img = scene.add.image(at.x, at.y, wheelKey);
      img.setOrigin(0.5, 0.5);
      img.setScale(scale);
      img.setDepth(depth + 0.08);
      wheels.push(img);
    });

    this.debris.push(frontImg, rearImg, ...wheels, front, rear);
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
      const radius = RocketBuggy.wheelRadius * scale;
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
    const spec = RocketBuggy.apart;
    const flame = RocketBuggy.hoodFlame;
    const localX = (flame.x - spec.splitX) * scale;
    const localY = (flame.y - spec.hingeY) * scale;
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

  // Режет сгоревший кадр: нос, корма и две шины. Чужой размер кадра оставляет целый остов.
  private static cutApart(scene: Phaser.Scene): ApartCut | null {
    const key = RocketBuggy.corpseKey;
    if (!scene.textures.exists(key)) {
      return null;
    }
    const source = scene.textures.get(key).getSourceImage();
    if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) {
      return null;
    }
    const w = RocketBuggy.frame.w;
    const h = RocketBuggy.frame.h;
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
    const spec = RocketBuggy.apart;
    const front = RocketBuggy.blank(spec.splitX, h);
    const rear = RocketBuggy.blank(w, h);
    if (!front || !rear) {
      return null;
    }
    const pads: PixelPad[] = [];
    const span = RocketBuggy.wheelRadius * 2 + 1;
    for (let i = 0; i < RocketBuggy.axles.length; i += 1) {
      const pad = RocketBuggy.blank(span, span);
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
        const wheel = RocketBuggy.wheelSlot(x, y);
        if (wheel >= 0) {
          const pad = pads[wheel];
          const axle = RocketBuggy.axles[wheel];
          if (!pad || !axle) {
            continue;
          }
          const wx = x - (axle.cx - RocketBuggy.wheelRadius);
          const wy = y - (axle.cy - RocketBuggy.wheelRadius);
          RocketBuggy.stamp(src, from, pad.image.data, (wy * pad.canvas.width + wx) * 4);
          continue;
        }
        if (x >= spec.splitX) {
          RocketBuggy.stamp(src, from, rear.image.data, from);
          mask[y * w + x] = 2;
        } else {
          RocketBuggy.stamp(src, from, front.image.data, (y * spec.splitX + x) * 4);
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
    for (const pad of pads) {
      pad.ctx.putImageData(pad.image, 0, 0);
    }

    RocketBuggy.apartSeq += 1;
    const seq = RocketBuggy.apartSeq;
    const frontKey = `buggy-apart-${seq}-front`;
    const rearKey = `buggy-apart-${seq}-rear`;
    const wheelKeys = pads.map((_, index) => `buggy-apart-${seq}-wheel-${index}`);
    const keys = [frontKey, rearKey, ...wheelKeys];
    const canvases = [front.canvas, rear.canvas, ...pads.map((pad) => pad.canvas)];
    for (let i = 0; i < keys.length; i += 1) {
      const name = keys[i];
      const canvas = canvases[i];
      if (!name || !canvas || !RocketBuggy.publish(scene, name, canvas)) {
        for (const made of keys) {
          if (made && scene.textures.exists(made)) {
            scene.textures.remove(made);
          }
        }
        return null;
      }
    }

    return {
      frontKey,
      rearKey,
      wheelKeys,
      keys,
      frontHull: RocketBuggy.hull(frontEdge),
      rearHull: RocketBuggy.hull(rearEdge),
    };
  }

  private static wheelSlot(x: number, y: number): number {
    const radius = RocketBuggy.wheelRadius;
    for (let i = 0; i < RocketBuggy.axles.length; i += 1) {
      const axle = RocketBuggy.axles[i];
      if (!axle) {
        continue;
      }
      if (Math.hypot(x - axle.cx, y - axle.cy) <= radius) {
        return i;
      }
    }
    return -1;
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
