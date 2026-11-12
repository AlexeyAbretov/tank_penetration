// Летающая дрономатка. Босс дальней четверти поля: зависает и выпускает залп ударных дронов.
// Здоровье снимают снаряд танка, пулемёт и атомный взрыв. ЭМИ только держит её на месте.
// Пока корпус жив и винты крутятся, они шумят. Под ЭМИ и после гибели шум молчит.

import Phaser from 'phaser';
import { enemyHasteOf, GAME } from '../gameConfig';
import { bake } from '../gfx/textures';
import { vehicleDeathBlast } from '../gfx/vehicleBlast';
import { wreckSmokeAt } from '../gfx/wreckSmoke';
import { syncDroneRotors } from '../sounds/DroneCarrierSounds';
import type { WorldPoint } from '../types/WorldPoint';
import { Infantry } from './Infantry';
import { StrikeDrone } from './StrikeDrone';

export class DroneCarrier extends Infantry {
  static readonly debutWave = 50;
  // На одной босс-волне больше этого числа не выходит.
  static readonly maxOnField = 2;
  static readonly baseHp = 800;
  static readonly hpPerAppearance = 400;
  // Та же касса, что у суперсолдата: 25 монет за номер босс-волны.
  static readonly coinsPerAppearance = 25;

  static readonly droneMin = 8;
  static readonly droneMax = 16;
  static readonly loadEvery = 10;
  // Пауза до следующего дрона. Разброс не даёт им сесть на одну линию нос к носу.
  static readonly droneGapMin = 500;
  static readonly droneGapMax = 900;
  static readonly leavePause = 500;
  static readonly moveSpeed = 170;
  static readonly droneDamage = 4;

  static readonly frame = { w: 256, h: 128 };
  static readonly spinEnd = 3;
  static readonly spinRate = 12;
  static readonly bodyKey = 'drone-carrier';
  static readonly imagePath = 'assets/drone-carrier.png';
  static readonly corpseKey = 'drone-carrier-wreck';
  static readonly wreckPath = 'assets/drone-carrier-wreck.png';
  static readonly animKey = 'carrier-hover';
  static readonly shadowKey = 'drone-carrier-shadow';
  static readonly shadow = { w: 150, h: 14, drop: 48 };
  static readonly placed = {
    scale: 1,
    originX: 0.5,
    originY: 0.62,
    bodyW: 176,
    bodyH: 50,
    bodyX: 36,
    bodyY: 48,
  };
  static readonly blast = [
    { x: 70, y: 70 },
    { x: 190, y: 64 },
  ] as const;
  static readonly fallMs = 620;
  static readonly wreckMs = 5000;
  private static nextRotor = 1;

  readonly reachesBase = false;
  readonly contactDamage = 0;
  override readonly hitRadius = 96;
  coinReward: number;

  private shadow?: Phaser.GameObjects.Image;
  private smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
  private phase: 'fly' | 'hover' = 'fly';
  private destX = 0;
  private destY = 0;
  private elapsed = 0;
  private nextShot = 0;
  private shotsLeft = 0;
  private departAt = -1;
  private droneCount = DroneCarrier.droneMin;
  private readonly rotorId = DroneCarrier.nextRotor++;
  private readonly shots: Phaser.Physics.Arcade.Group;
  private readonly fireTarget: WorldPoint;

  // Волна 50 — первое появление. Дальше каждый свой выход на босс-волне.
  static appearanceOn(wave: number): number {
    const boss = Math.floor(wave / 10);
    const first = Math.floor(DroneCarrier.debutWave / 10);
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

  // На волне дебюта восемь. Дальше +1 каждые 10 волн, не больше шестнадцати.
  static salvoFor(wave: number): number {
    const steps = Math.floor(Math.max(0, wave - DroneCarrier.debutWave) / DroneCarrier.loadEvery);
    return Math.min(this.droneMax, this.droneMin + steps);
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.spritesheet(DroneCarrier.bodyKey, DroneCarrier.imagePath, {
      frameWidth: DroneCarrier.frame.w,
      frameHeight: DroneCarrier.frame.h,
    });
    scene.load.image(DroneCarrier.corpseKey, DroneCarrier.wreckPath);
    StrikeDrone.preload(scene);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(DroneCarrier.shadowKey)) {
      const shade = DroneCarrier.shadow;
      bake(scene, DroneCarrier.shadowKey, shade.w, shade.h, (g) => {
        g.fillStyle(0x000000, 0.4);
        g.fillEllipse(shade.w / 2, shade.h / 2, shade.w - 2, shade.h - 2);
      });
    }
    for (const key of [DroneCarrier.bodyKey, DroneCarrier.shadowKey, DroneCarrier.corpseKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    StrikeDrone.ensureTextures(scene);
    if (scene.anims.exists(DroneCarrier.animKey)) {
      scene.anims.remove(DroneCarrier.animKey);
    }
    if (scene.textures.exists(DroneCarrier.bodyKey)) {
      scene.anims.create({
        key: DroneCarrier.animKey,
        frames: scene.anims.generateFrameNumbers(DroneCarrier.bodyKey, {
          start: 0,
          end: DroneCarrier.spinEnd,
        }),
        frameRate: DroneCarrier.spinRate,
        repeat: -1,
      });
    }
  }

  // Снаряд танка, пуля пулемёта и атомный взрыв. Остальное проходит мимо.
  override takes(strike: 'shell' | 'mg' | 'ion' | 'nuclear' | 'other'): boolean {
    return strike === 'shell' || strike === 'mg' || strike === 'nuclear';
  }

  override hitCenter(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  override mechanical(): boolean {
    return true;
  }

  override setDamageWave(wave: number): void {
    super.setDamageWave(wave);
    this.droneCount = DroneCarrier.salvoFor(wave);
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
    fireTarget: WorldPoint,
    purse: number,
    slot: number,
    count: number,
  ) {
    super(scene, x, y, hp, DroneCarrier.bodyKey, DroneCarrier.animKey, 0x6a8f3a);
    this.shots = shots;
    this.fireTarget = fireTarget;
    this.slot = slot;
    this.coinReward = DroneCarrier.coinsForBody(purse, slot, count);
    const placed = DroneCarrier.placed;
    this.setScale(placed.scale);
    this.setOrigin(placed.originX, placed.originY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(placed.bodyW, placed.bodyH);
    body.setOffset(placed.bodyX, placed.bodyY);
    this.hpBarWidth = 64;
    this.syncBar();
    if (scene.textures.exists(DroneCarrier.shadowKey)) {
      this.shadow = scene.add.image(x, y, DroneCarrier.shadowKey).setOrigin(0.5, 0.5);
      this.placeShadow();
    }
    this.once('destroy', () => {
      this.shadow?.destroy();
      this.smoke?.destroy();
      syncDroneRotors(scene, this.rotorId, false);
    });
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.voice();
  }

  // ЭМИ глушит винты в кадре боя, до следующего preUpdate. Шум обрывается сразу.
  override hold(ms: number): void {
    super.hold(ms);
    this.voice();
  }

  override march(): void {
    this.pickDest();
    this.phase = 'fly';
    this.steer();
  }

  override syncPace(): void {
    if (this.reachedWall || this.phase !== 'fly') {
      return;
    }
    this.steer();
  }

  // Глушение гасит скорость. После срока винт снова крутится, и перелёт продолжается.
  protected override resumeMarch(): void {
    if (this.anims.isPaused) {
      this.anims.resume();
    }
    if (this.phase === 'fly') {
      this.steer();
    }
  }

  protected override act(delta: number): void {
    const step = delta * enemyHasteOf(this.scene.registry);
    if (this.phase === 'fly') {
      this.fly(delta);
      return;
    }
    this.body?.stop();
    this.tickHover(step);
  }

  protected override onDie(slain: boolean): void {
    this.voice();
    this.shadow?.destroy();
    this.shadow = undefined;
    if (!slain) {
      return;
    }
    const [front, rear] = DroneCarrier.blast;
    vehicleDeathBlast(this.scene, this.framePoint(front.x, front.y), this.framePoint(rear.x, rear.y));
  }

  protected override corpseTexture(): string | null {
    return null;
  }

  // Корпус долетает до тени и там становится остовом. Дым на рисунке уже есть, столб добавляет движение.
  protected override vanish(): void {
    if (this.hp > 0) {
      super.vanish();
      return;
    }
    const ground = this.y + DroneCarrier.shadow.drop;
    this.scene.tweens.add({
      targets: this,
      y: ground,
      rotation: -0.35,
      duration: DroneCarrier.fallMs,
      ease: 'Cubic.In',
      onComplete: () => {
        if (!this.active || !this.scene.textures.exists(DroneCarrier.corpseKey)) {
          return;
        }
        this.setTexture(DroneCarrier.corpseKey);
        this.setRotation(0);
        this.smoke = wreckSmokeAt(this.scene, this.x, this.y - 18, 0.8);
        this.smoke.setDepth(this.depth + 0.4);
      },
    });
    this.scene.time.delayedCall(DroneCarrier.fallMs + DroneCarrier.wreckMs, () => {
      this.smoke?.destroy();
      this.smoke = undefined;
      if (this.active) {
        this.destroy();
      }
    });
  }

  protected override pinDepth(): void {
    this.placeShadow();
  }

  private placeShadow(): void {
    const shade = this.shadow;
    if (!shade?.active) {
      return;
    }
    shade.setPosition(this.x, this.y + DroneCarrier.shadow.drop);
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
    this.shotsLeft = this.droneCount;
    this.departAt = -1;
  }

  // Один залп на зависании. После последнего дрона короткая пауза и новая точка.
  private tickHover(step: number): void {
    this.elapsed += step;
    if (this.shotsLeft > 0 && this.elapsed >= this.nextShot) {
      this.fireDrone();
      this.shotsLeft -= 1;
      if (this.shotsLeft > 0) {
        this.nextShot += Phaser.Math.Between(DroneCarrier.droneGapMin, DroneCarrier.droneGapMax);
      } else {
        this.departAt = this.elapsed + DroneCarrier.leavePause;
      }
    }
    if (this.shotsLeft > 0 || this.elapsed < this.departAt) {
      return;
    }
    this.pickDest();
    this.phase = 'fly';
    this.steer();
  }

  private fireDrone(): void {
    const index = this.droneCount - this.shotsLeft;
    const up = this.launchUp(index);
    const drone = new StrikeDrone(this.scene, this.x, this.y, DroneCarrier.droneDamage, this.fireTarget);
    this.shots.add(drone);
    const span = (up ? this.originY : 1 - this.originY) * this.displayHeight;
    drone.flyOut(up, span + StrikeDrone.frame.h / 2 + 6);
  }

  // Чётный вверх, нечётный вниз. У края поля сторона та, где есть место вылететь.
  private launchUp(index: number): boolean {
    const pad = 24;
    let up = index % 2 === 0;
    const roomUp = this.y - this.originY * this.displayHeight - pad;
    const roomDown = GAME.bannerY - pad - (this.y + (1 - this.originY) * this.displayHeight);
    if (up && roomUp < StrikeDrone.frame.h) {
      up = false;
    }
    if (!up && roomDown < StrikeDrone.frame.h) {
      up = true;
    }
    return up;
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
    return DroneCarrier.moveSpeed + this.paceRank * 2;
  }

  // Левее трёх четвертей ширины не садится.
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

  // Шум, пока этот корпус жив и не под ЭМИ. Остов и падение уже молчат.
  private voice(): void {
    const spinning = this.active && !this.reachedWall && !this.held();
    syncDroneRotors(this.scene, this.rotorId, spinning);
  }

  private framePoint(px: number, py: number): { x: number; y: number } {
    const frame = this.frame;
    const ox = this.originX * frame.width;
    const oy = this.originY * frame.height;
    return {
      x: this.x + (px - ox) * this.scaleX,
      y: this.y + (py - oy) * this.scaleY,
    };
  }
}
