// Ударный вертолёт. Летает по дальней четверти поля: завис, отстрелялся, ушёл в другую точку.
// Под полозьями на траве тёмное пятно. Зазор до корпуса показывает, что машина в воздухе.
// Несущий и хвостовой винты крутятся. Последняя клетка листа пустая.
// Ракеты и пулемёт не звучат вместе. На одной точке два полных залпа одного оружия.
// Между залпами 2 с. После последнего ещё 0,5 с, потом перелёт.
// Сбить его могут снаряд танка, пулемёт на башне, ионная пушка и атомный взрыв.
// При гибели падает в точку тени и остаётся сгоревшим остовом с огнём и дымом.
// Столб режет корпус в воздухе: половины падают в точку тени и ложатся разрезанным остовом под наклоном.
// Ракеты те же, что у багги: их сбивает лазер.

import Phaser from 'phaser';
import { enemyHasteOf, GAME } from '../gameConfig';
import { bisectImage } from '../gfx/bisect';
import { ejectCasing } from '../gfx/casing';
import { placeCampfires } from '../gfx/flame';
import { bake } from '../gfx/textures';
import { vehicleDeathBlast } from '../gfx/vehicleBlast';
import { wreckSmokeAt } from '../gfx/wreckSmoke';
import { BuggyRocket } from './BuggyRocket';
import { EnemyShot } from './EnemyShot';
import { Infantry } from './Infantry';
import type { WorldPoint } from '../types/WorldPoint';

type Arm = 'rocket' | 'gun';

export class Helicopter extends Infantry {
  static readonly debutWave = 40;
  static readonly coinReward = 3;
  readonly coinReward = Helicopter.coinReward;

  static readonly frame = { w: 192, h: 96 };
  static readonly placed = {
    scale: 1,
    originX: 0.5,
    originY: 0.62,
    bodyW: 150,
    bodyH: 48,
    bodyX: 22,
    bodyY: 36,
  };
  // Шар под носом. Вокруг него крутится отдельный пулемёт.
  static readonly chin = { x: 28, y: 80 };
  static readonly gunFrame = { w: 64, h: 32 };
  // Круглое крепление справа на картинке ствола. Дуло слева.
  static readonly gunPivot = { x: 53, y: 15 };
  static readonly muzzle = { x: 6, y: 15 };
  static readonly casingPort = { x: 40, y: 11 };
  // Две трубки блока. Свой изгиб, чтобы ракеты не легли на одну дугу.
  static readonly tubes = [
    { nose: { x: 62, y: 68 }, back: { x: 117, y: 72 }, spread: -0.28 },
    { nose: { x: 64, y: 76 }, back: { x: 119, y: 78 }, spread: 0.22 },
  ] as const;
  // Кабина и хвост. Та же вспышка гибели, что у пикапа и багги.
  static readonly blast = [
    { x: 70, y: 52 },
    { x: 150, y: 46 },
  ] as const;

  static readonly bodyKey = 'helicopter';
  static readonly gunKey = 'helicopter-gun';
  static readonly flameKey = 'helicopter-flame';
  static readonly flashKey = 'helicopter-flash';
  static readonly shadowKey = 'helicopter-shadow';
  // Овал уже корпуса. drop — от точки спрайта до центра пятна: ниже полозьев остаётся трава.
  static readonly shadow = { w: 112, h: 14, drop: 60 };
  static readonly imagePath = 'assets/helicopter-spin.png';
  // Лист 3×2. Пять кадров с одним винтом, последняя клетка пустая.
  static readonly spinEnd = 4;
  static readonly spinRate = 12;
  static readonly gunPath = 'assets/helicopter-gun.png';
  static readonly corpseKey = 'helicopter-wreck';
  static readonly wreckPath = 'assets/helicopter-wreck.png';
  // Низ рисунка садится на низ севшего корпуса. Огонь на кабине.
  // Живой рисунок занимает 91 px по высоте, остов в том же кадре — 83.
  // Без увеличения остов оказывается выше тени, там, где корпус был до падения.
  static readonly wreckFit = { originX: 97 / 192, originY: 91 / 96, scale: 91 / 83 };
  static readonly wreckFlame = { x: 78, y: 52 };
  // Падение в bisect длится столько же: смена на остов совпадает с касанием земли.
  static readonly fallMs = 620;
  // Тот же срок, что труп пехоты.
  static readonly wreckMs = 5000;

  // Четыре на волне дебюта. Дальше +1 каждые 10 волн.
  static readonly rocketMin = 4;
  static readonly rocketMax = 8;
  static readonly roundMin = 4;
  static readonly roundMax = 10;
  static readonly loadEvery = 10;
  static readonly rocketGap = 400;
  static readonly roundGap = 150;
  static readonly rocketSpeed = 340;
  static readonly roundSpeed = 640;
  static readonly rocketDamage = 3;
  static readonly roundDamage = 2;
  // Сколько раз подряд выходит весь боекомплект, прежде чем вертолёт сменит точку.
  static readonly salvos = 2;
  // Пауза после последнего выстрела залпа, до первого выстрела следующего.
  static readonly salvoPause = 2000;
  // После последнего залпа вертолёт ещё стоит, потом берёт новую точку.
  static readonly leavePause = 2000;
  static readonly moveSpeed = 190;

  readonly reachesBase = false;
  readonly contactDamage = 0;
  override readonly hitRadius = 78;

  private gun?: Phaser.GameObjects.Image;
  private shadow?: Phaser.GameObjects.Image;
  private wreckFlameSprite?: Phaser.GameObjects.Sprite;
  private smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
  private phase: 'fly' | 'hover' = 'fly';
  private arm: Arm = 'rocket';
  private destX = 0;
  private destY = 0;
  private elapsed = 0;
  private nextShot = 0;
  private shotsLeft = 0;
  private salvosLeft = 0;
  private departAt = -1;
  private rocketCount = Helicopter.rocketMin;
  private roundCount = Helicopter.roundMin;
  private tubeCursor = 0;
  private aim = 0;
  // Общая группа пуль и точка танка. У предка их нет: вертолёт не стоит на рубеже.
  private readonly shots: Phaser.Physics.Arcade.Group;
  private readonly fireTarget: WorldPoint;

  static salvoFor(wave: number): number {
    return Helicopter.loadFor(wave, Helicopter.rocketMin, Helicopter.rocketMax);
  }

  static roundsFor(wave: number): number {
    return Helicopter.loadFor(wave, Helicopter.roundMin, Helicopter.roundMax);
  }

  // Снаряд танка, включая осколки его разрыва, пуля пулемёта, столб ионной пушки и атомный взрыв.
  // Артиллерия, мины, огонь, залп и авиабомба проходят мимо.
  override takes(strike: 'shell' | 'mg' | 'ion' | 'nuclear' | 'other'): boolean {
    return strike === 'shell' || strike === 'mg' || strike === 'ion' || strike === 'nuclear';
  }

  // Подошва столба берёт весь круг корпуса, не одну точку в середине.
  override ionSole(): number {
    return this.shellRadius();
  }

  override hitCenter(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.spritesheet(Helicopter.bodyKey, Helicopter.imagePath, {
      frameWidth: Helicopter.frame.w,
      frameHeight: Helicopter.frame.h,
    });
    scene.load.image(Helicopter.gunKey, Helicopter.gunPath);
    scene.load.image(Helicopter.corpseKey, Helicopter.wreckPath);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(Helicopter.flameKey)) {
      bake(scene, Helicopter.flameKey, 28, 16, (g) => Helicopter.renderFlame(g));
    }
    if (!scene.textures.exists(Helicopter.shadowKey)) {
      const shade = Helicopter.shadow;
      bake(scene, Helicopter.shadowKey, shade.w, shade.h, (g) => Helicopter.renderShadow(g));
    }
    if (!scene.textures.exists(Helicopter.flashKey)) {
      bake(scene, Helicopter.flashKey, 18, 10, (g) => Helicopter.renderFlash(g));
    }
    for (const key of [Helicopter.bodyKey, Helicopter.flameKey, Helicopter.shadowKey, Helicopter.corpseKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    // Ствол крутится на любой угол. Ближний фильтр на повороте рвёт металл.
    for (const key of [Helicopter.gunKey, Helicopter.flashKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
    if (scene.anims.exists('heli-hover')) {
      scene.anims.remove('heli-hover');
    }
    if (scene.textures.exists(Helicopter.bodyKey)) {
      scene.anims.create({
        key: 'heli-hover',
        frames: scene.anims.generateFrameNumbers(Helicopter.bodyKey, {
          start: 0,
          end: Helicopter.spinEnd,
        }),
        frameRate: Helicopter.spinRate,
        repeat: -1,
      });
    }
  }

  override setDamageWave(wave: number): void {
    super.setDamageWave(wave);
    this.rocketCount = Helicopter.salvoFor(wave);
    this.roundCount = Helicopter.roundsFor(wave);
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
    fireTarget: WorldPoint,
  ) {
    super(scene, x, y, hp, Helicopter.bodyKey, 'heli-hover', 0x3d8c78);
    this.shots = shots;
    this.fireTarget = fireTarget;
    const placed = Helicopter.placed;
    this.setScale(placed.scale);
    this.setOrigin(placed.originX, placed.originY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(placed.bodyW, placed.bodyH);
    body.setOffset(placed.bodyX, placed.bodyY);
    this.hpBarWidth = 54;
    this.syncBar();
    if (scene.textures.exists(Helicopter.shadowKey)) {
      this.shadow = scene.add.image(x, y, Helicopter.shadowKey).setOrigin(0.5, 0.5);
      this.placeShadow();
    }
    if (scene.textures.exists(Helicopter.gunKey)) {
      this.gun = scene.add.image(x, y, Helicopter.gunKey);
      this.gun.setOrigin(
        Helicopter.gunPivot.x / Helicopter.gunFrame.w,
        Helicopter.gunPivot.y / Helicopter.gunFrame.h,
      );
    }
    this.once('destroy', () => {
      this.gun?.destroy();
      this.shadow?.destroy();
      this.clearBurn();
    });
  }

  override march(): void {
    this.pickDest();
    this.phase = 'fly';
    this.steer();
  }

  // Темп меняет скорость перелёта сразу. На зависании тело и так стоит.
  override syncPace(): void {
    if (this.reachedWall || this.phase !== 'fly') {
      return;
    }
    this.steer();
  }

  override hit(damage?: number, wire?: boolean): boolean {
    const dead = damage === undefined ? super.hit() : super.hit(damage, wire);
    const gun = this.gun;
    if (!gun?.active) {
      return dead;
    }
    gun.setTint(0xffccaa);
    this.scene.time.delayedCall(70, () => {
      if (gun.active) {
        gun.clearTint();
      }
    });
    return dead;
  }

  override mechanical(): boolean {
    return true;
  }

  protected override act(delta: number): void {
    this.aimGun();
    const step = delta * enemyHasteOf(this.scene.registry);
    if (this.phase === 'fly') {
      this.fly(delta);
      return;
    }
    this.body?.stop();
    this.tickHover(step);
  }

  // Столб отвесный и режет широкий корпус на узкие половины.
  // Общая укладка ставит узкий кусок торчком. Вертолёт сам кладёт их на тень под наклоном.
  protected override severGround(): number | null {
    return null;
  }

  // Живые половины падают на тень плашмя. Скрытый остов повторяет ту же позу и сменяет их.
  protected override rideSever(
    angle: number,
    halves: readonly [Phaser.GameObjects.Image, Phaser.GameObjects.Image],
  ): void {
    if (!this.scene.textures.exists(Helicopter.corpseKey)) {
      return;
    }
    const scene = this.scene;
    const ground = this.y + Helicopter.shadow.drop;
    const stand = scene.add
      .image(this.x, this.y, Helicopter.corpseKey)
      .setOrigin(this.originX, this.originY)
      .setScale(Helicopter.wreckFit.scale)
      .setDepth(this.depth)
      .setVisible(false);
    const pieces = bisectImage(scene, stand, angle, Helicopter.fallMs + Helicopter.wreckMs, null);
    stand.destroy();
    if (!pieces) {
      return;
    }
    const poses = Helicopter.cutPoses(this.x, ground, angle);
    halves.forEach((half, index) => Helicopter.settle(scene, half, poses[index]));
    pieces.forEach((piece, index) => {
      piece.setVisible(false);
      Helicopter.settle(scene, piece, poses[index]);
    });
    scene.time.delayedCall(Helicopter.fallMs, () => {
      for (const half of halves) {
        if (half.active) {
          half.destroy();
        }
      }
      for (const piece of pieces) {
        if (!piece.active) {
          continue;
        }
        const pose = poses[pieces.indexOf(piece)];
        piece.setPosition(pose.x, pose.y);
        piece.setRotation(pose.rotation);
        piece.setVisible(true);
        const at = Helicopter.piecePoint(piece);
        Helicopter.burn(scene, at.x, at.y, piece.depth + 0.4, piece);
      }
    });
  }

  // Две половины рядом с точкой тени. Наклон около 30°, не стоймя.
  private static cutPoses(
    x: number,
    ground: number,
    angle: number,
  ): readonly [{ x: number; y: number; rotation: number }, { x: number; y: number; rotation: number }] {
    const across = Math.abs(Math.sin(angle)) > 0.4 ? -Math.sin(angle) : 1;
    const lean = 0.5;
    return [
      { x: x + across * 36, y: ground, rotation: -lean },
      { x: x - across * 36, y: ground, rotation: lean },
    ];
  }

  private static settle(
    scene: Phaser.Scene,
    half: Phaser.GameObjects.Image,
    pose: { x: number; y: number; rotation: number },
  ): void {
    scene.tweens.killTweensOf(half);
    scene.tweens.add({
      targets: half,
      x: pose.x,
      y: pose.y,
      rotation: pose.rotation,
      duration: Helicopter.fallMs,
      ease: 'Cubic.In',
    });
  }

  // Середина видимых пикселей половины. Рамка кадра шире рисунка, её низ — пустое место под обломком.
  private static piecePoint(piece: Phaser.GameObjects.Image): { x: number; y: number } {
    const frame = piece.frame;
    const source = piece.texture.getSourceImage() as CanvasImageSource & { width?: number };
    const canvas = document.createElement('canvas');
    canvas.width = frame.cutWidth;
    canvas.height = frame.cutHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!source?.width || !ctx) {
      return { x: piece.x, y: piece.y };
    }
    ctx.drawImage(
      source,
      frame.cutX,
      frame.cutY,
      frame.cutWidth,
      frame.cutHeight,
      0,
      0,
      frame.cutWidth,
      frame.cutHeight,
    );
    const pixels = ctx.getImageData(0, 0, frame.cutWidth, frame.cutHeight).data;
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let y = 0; y < frame.cutHeight; y += 1) {
      for (let x = 0; x < frame.cutWidth; x += 1) {
        if (pixels[(y * frame.cutWidth + x) * 4 + 3] === 0) {
          continue;
        }
        sumX += x;
        sumY += y;
        count += 1;
      }
    }
    if (count === 0) {
      return { x: piece.x, y: piece.y };
    }
    const ox = piece.originX * frame.width;
    const oy = piece.originY * frame.height;
    const lx = (sumX / count - ox) * piece.scaleX;
    const ly = (sumY / count - oy) * piece.scaleY;
    const cos = Math.cos(piece.rotation);
    const sin = Math.sin(piece.rotation);
    return {
      x: piece.x + lx * cos - ly * sin,
      y: piece.y + lx * sin + ly * cos,
    };
  }

  protected override onDie(slain: boolean): void {
    this.gun?.destroy();
    this.gun = undefined;
    this.shadow?.destroy();
    this.shadow = undefined;
    if (!slain) {
      return;
    }
    const [front, rear] = Helicopter.blast;
    vehicleDeathBlast(this.scene, this.framePoint(front.x, front.y), this.framePoint(rear.x, rear.y));
  }

  // Целый корпус долетает до тени и только там становится остовом.
  protected override vanish(): void {
    if (this.hp > 0) {
      super.vanish();
      return;
    }
    const ground = this.y + Helicopter.shadow.drop;
    const x = this.x;
    this.scene.tweens.add({
      targets: this,
      y: ground,
      rotation: -0.4,
      duration: Helicopter.fallMs,
      ease: 'Cubic.In',
      onComplete: () => {
        if (!this.active || !this.scene.textures.exists(Helicopter.corpseKey)) {
          return;
        }
        this.setTexture(Helicopter.corpseKey);
        this.setRotation(0);
        const fit = Helicopter.wreckFit;
        const frameH = Helicopter.frame.h;
        // Низ живого рисунка в момент касания тени. Остов той же высоты ставится на эту линию.
        const landedBottom = ground + (94 - Helicopter.placed.originY * frameH) * this.scaleY;
        const landedCenter = x + (97 - Helicopter.placed.originX * Helicopter.frame.w) * this.scaleX;
        this.setScale(fit.scale);
        this.setOrigin(fit.originX, fit.originY);
        this.setPosition(landedCenter, landedBottom);
        const at = this.wreckPoint();
        const burn = Helicopter.burn(this.scene, at.x, at.y, this.depth + 0.4);
        this.wreckFlameSprite = burn.flame;
        this.smoke = burn.smoke;
      },
    });
    this.scene.time.delayedCall(Helicopter.fallMs + Helicopter.wreckMs, () => {
      this.clearBurn();
      if (this.active) {
        this.destroy();
      }
    });
  }

  private wreckPoint(): { x: number; y: number } {
    const frame = this.frame;
    const ox = this.originX * frame.width;
    const oy = this.originY * frame.height;
    return {
      x: this.x + (Helicopter.wreckFlame.x - ox) * this.scaleX,
      y: this.y + (Helicopter.wreckFlame.y - oy) * this.scaleY,
    };
  }

  // host — половина остова: огонь гаснет вместе с ней.
  private static burn(
    scene: Phaser.Scene,
    x: number,
    y: number,
    depth: number,
    host?: Phaser.GameObjects.Image,
  ): { flame?: Phaser.GameObjects.Sprite; smoke: Phaser.GameObjects.Particles.ParticleEmitter } {
    const [flame] = placeCampfires(scene, [{ x, y }]);
    if (flame) {
      flame.setScale(0.42);
      flame.setDepth(depth);
    }
    const smoke = wreckSmokeAt(scene, x, y - 8, 0.8);
    smoke.setDepth(depth);
    if (host) {
      host.once('destroy', () => {
        flame?.destroy();
        smoke.destroy();
      });
    }
    return { flame, smoke };
  }

  private clearBurn(): void {
    this.wreckFlameSprite?.destroy();
    this.wreckFlameSprite = undefined;
    this.smoke?.destroy();
    this.smoke = undefined;
  }

  protected override pinDepth(): void {
    if (this.gun?.active) {
      this.gun.setDepth(this.depth);
    }
    this.placeShadow();
  }

  // Пятно чуть ниже живых на своей траве, поэтому солдат наступает на него, а не под него.
  private placeShadow(): void {
    const shade = this.shadow;
    if (!shade?.active) {
      return;
    }
    shade.setPosition(this.x, this.y + Helicopter.shadow.drop);
    shade.setAlpha(this.alpha);
    shade.setDepth(this.depth - 0.15);
  }

  private fly(delta: number): void {
    if (this.arrived(delta)) {
      this.body?.stop();
      this.beginHover();
      return;
    }
    this.steer();
  }

  private beginHover(): void {
    this.phase = 'hover';
    this.elapsed = 0;
    this.nextShot = 0;
    this.salvosLeft = Helicopter.salvos;
    this.shotsLeft = this.salvoSize();
    this.departAt = -1;
  }

  // Между залпами тишина. После последнего залпа короткая пауза, и только потом новая точка.
  private tickHover(step: number): void {
    this.elapsed += step;
    if (this.shotsLeft > 0 && this.elapsed >= this.nextShot) {
      this.fireOne();
      this.shotsLeft -= 1;
      if (this.shotsLeft > 0) {
        this.nextShot += this.arm === 'rocket' ? Helicopter.rocketGap : Helicopter.roundGap;
      } else {
        this.salvosLeft -= 1;
        if (this.salvosLeft > 0) {
          this.shotsLeft = this.salvoSize();
          this.nextShot = this.elapsed + Helicopter.salvoPause;
        } else {
          this.departAt = this.elapsed + Helicopter.leavePause;
        }
      }
    }
    if (this.shotsLeft > 0 || this.salvosLeft > 0 || this.elapsed < this.departAt) {
      return;
    }
    this.arm = this.arm === 'rocket' ? 'gun' : 'rocket';
    this.pickDest();
    this.phase = 'fly';
    this.steer();
  }

  private salvoSize(): number {
    return this.arm === 'rocket' ? this.rocketCount : this.roundCount;
  }

  private fireOne(): void {
    if (this.arm === 'rocket') {
      this.fireRocket();
      return;
    }
    this.fireGun();
  }

  private fireRocket(): void {
    const tube = Helicopter.tubes[this.tubeCursor % Helicopter.tubes.length];
    this.tubeCursor += 1;
    const nose = this.framePoint(tube.nose.x, tube.nose.y);
    const back = this.framePoint(tube.back.x, tube.back.y);
    const along = Math.atan2(nose.y - back.y, nose.x - back.x);
    const rocket = new BuggyRocket(
      this.scene,
      nose.x,
      nose.y,
      Helicopter.rocketDamage + this.extraDamage(),
      this.fireTarget,
      tube.spread,
    );
    this.shots.add(rocket);
    rocket.launch(along + tube.spread, Helicopter.rocketSpeed);
    this.puff(back.x, back.y, along);
  }

  private fireGun(): void {
    const shot = this.muzzleAt();
    const bullet = new EnemyShot(
      this.scene,
      shot.x,
      shot.y,
      Helicopter.roundDamage + this.extraDamage(),
    );
    this.shots.add(bullet);
    bullet.launch(shot.angle, Helicopter.roundSpeed);
    const port = this.portAt();
    ejectCasing(this.scene, port.x, port.y, shot.angle, this.depth, this.scaleX);
    this.flashAt(shot.x, shot.y, shot.angle);
  }

  private puff(x: number, y: number, angle: number): void {
    if (!this.scene.textures.exists(Helicopter.flameKey)) {
      return;
    }
    const flame = this.scene.add.image(x, y, Helicopter.flameKey);
    flame.setOrigin(1, 0.5);
    flame.setRotation(angle);
    flame.setBlendMode(Phaser.BlendModes.ADD);
    flame.setDepth(this.depth + 1);
    this.scene.tweens.add({
      targets: flame,
      alpha: 0,
      scale: 1.4,
      duration: 160,
      onComplete: () => flame.destroy(),
    });
  }

  private flashAt(x: number, y: number, angle: number): void {
    if (!this.scene.textures.exists(Helicopter.flashKey)) {
      return;
    }
    const flash = this.scene.add.image(x, y, Helicopter.flashKey).setOrigin(0, 0.5).setDepth(this.depth + 1);
    flash.setRotation(angle);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 50,
      onComplete: () => flash.destroy(),
    });
  }

  private aimGun(): void {
    const gun = this.gun;
    if (!gun?.active) {
      return;
    }
    const mount = this.framePoint(Helicopter.chin.x, Helicopter.chin.y);
    const at = Phaser.Math.Angle.Between(mount.x, mount.y, this.fireTarget.x, this.fireTarget.y);
    // Картинка уже смотрит влево. Угол на цель смотрит вправо, поэтому к нему прибавляется пол-оборота.
    this.aim = Phaser.Math.Angle.Wrap(at + Math.PI);
    gun.setPosition(mount.x, mount.y);
    gun.setRotation(this.aim);
    gun.setScale(this.scaleX);
    gun.setAlpha(this.alpha);
  }

  private muzzleAt(): { x: number; y: number; angle: number } {
    const point = this.gunPoint(Helicopter.muzzle.x, Helicopter.muzzle.y);
    return {
      x: point.x,
      y: point.y,
      angle: Phaser.Math.Angle.Wrap(this.aim - Math.PI),
    };
  }

  private portAt(): { x: number; y: number } {
    return this.gunPoint(Helicopter.casingPort.x, Helicopter.casingPort.y);
  }

  private gunPoint(px: number, py: number): { x: number; y: number } {
    const mount = this.framePoint(Helicopter.chin.x, Helicopter.chin.y);
    const localX = (px - Helicopter.gunPivot.x) * this.scaleX;
    const localY = (py - Helicopter.gunPivot.y) * this.scaleY;
    const cos = Math.cos(this.aim);
    const sin = Math.sin(this.aim);
    return {
      x: mount.x + localX * cos - localY * sin,
      y: mount.y + localX * sin + localY * cos,
    };
  }

  private framePoint(px: number, py: number): { x: number; y: number } {
    const ox = this.originX * Helicopter.frame.w;
    const oy = this.originY * Helicopter.frame.h;
    return {
      x: this.x + (px - ox) * this.scaleX,
      y: this.y + (py - oy) * this.scaleY,
    };
  }

  private steer(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body?.enable) {
      return;
    }
    const haste = enemyHasteOf(this.scene.registry);
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.destX, this.destY);
    const speed = this.cruise() * haste;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  private arrived(delta: number): boolean {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.destX, this.destY);
    const step = this.cruise() * enemyHasteOf(this.scene.registry) * (delta / 1000);
    return dist <= Math.max(14, step + 2);
  }

  private cruise(): number {
    return Helicopter.moveSpeed + this.paceRank * 2;
  }

  // Левее трёх четвертей ширины не садится: это его максимальная дальность.
  private pickDest(): void {
    const box = this.roam();
    for (let i = 0; i < 8; i += 1) {
      const x = Phaser.Math.Between(box.left, box.right);
      const y = Phaser.Math.Between(box.top, box.bottom);
      if (Phaser.Math.Distance.Between(this.x, this.y, x, y) >= 120) {
        this.destX = x;
        this.destY = y;
        return;
      }
    }
    const midX = (box.left + box.right) / 2;
    const midY = (box.top + box.bottom) / 2;
    this.destX = this.x < midX ? box.right : box.left;
    this.destY = this.y < midY ? box.bottom : box.top;
  }

  private roam(): { left: number; right: number; top: number; bottom: number } {
    const left = Math.round((GAME.width * 3) / 4);
    const right = Math.max(left + 40, GAME.width - 100);
    return { left, right, top: 140, bottom: 540 };
  }

  private static loadFor(wave: number, min: number, max: number): number {
    const steps = Math.floor(Math.max(0, wave - Helicopter.debutWave) / Helicopter.loadEvery);
    return Math.min(max, min + steps);
  }

  private static renderShadow(g: Phaser.GameObjects.Graphics): void {
    const shade = Helicopter.shadow;
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(shade.w / 2, shade.h / 2, shade.w - 2, shade.h - 2);
  }

  private static renderFlame(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xff6a18, 1);
    g.fillTriangle(2, 8, 26, 2, 26, 14);
    g.fillStyle(0xffee66, 1);
    g.fillTriangle(10, 8, 26, 5, 26, 11);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(22, 8, 2);
  }

  private static renderFlash(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xfff2c0, 1);
    g.fillCircle(4, 5, 3);
    g.fillStyle(0xff8a22, 0.9);
    g.fillEllipse(10, 5, 12, 6);
  }
}
