// Ударный дрон дрономатки. Летит в танк и рвётся разрывом артиллерии.
// Пушка танка, лазер, пулемёт, атомный взрыв, завеса и ЭМИ его сбивают. Броня может отвернуть, как патрон.

import Phaser from 'phaser';
import { enemyHasteOf, GAME } from '../gameConfig';
import { airBurstAt } from '../gfx/airBurst';
import { playBoom } from '../sounds/BoomSounds';
import type { WorldPoint } from '../types/WorldPoint';
import { EnemyShot } from './EnemyShot';

export class StrikeDrone extends EnemyShot {
  static readonly textureKey = 'strike-drone';
  static readonly imagePath = 'assets/strike-drone.png';
  static readonly frame = { w: 64, h: 48 };
  static readonly frames = 4;
  // Кадры в секунду. Винты мелкие: чаще этого крест не читается.
  static readonly spinRate = 12;
  static readonly speed = 340;
  // Радиан в секунду. После вылета нос уже на танке, курс только подправляется у края поля.
  static readonly turnRate = 8;
  // Круг, который задевает пуля пулемёта.
  static readonly reach = 18;

  private readonly target: WorldPoint;
  private launchedAt = 0;
  private guided = false;
  // Пока дрон не вышел из рисунка матки, тело скользит вверх или вниз, нос смотрит на танк.
  private exiting = false;
  private exitDy = 0;
  private bornY = 0;
  private exitRun = 0;
  private spinAcc = 0;
  // Куда летит дрон. Поворот спрайта — только тангаж: винты остаются сверху.
  private heading = 0;

  static preload(scene: Phaser.Scene): void {
    scene.load.spritesheet(StrikeDrone.textureKey, StrikeDrone.imagePath, {
      frameWidth: StrikeDrone.frame.w,
      frameHeight: StrikeDrone.frame.h,
    });
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(StrikeDrone.textureKey)) {
      return;
    }
    scene.textures.get(StrikeDrone.textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // sound: общий разрыв. Пачка дронов под ЭМИ играет его один раз, картинку — на каждом.
  static burstAt(scene: Phaser.Scene, x: number, y: number, sound = true): void {
    if (sound) {
      playBoom(scene);
    }
    airBurstAt(scene, x, y);
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    damage: number,
    target: WorldPoint,
  ) {
    super(scene, x, y, damage, StrikeDrone.textureKey);
    this.target = target;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(36, 18);
    body.setOffset((StrikeDrone.frame.w - 36) / 2, (StrikeDrone.frame.h - 18) / 2);
    const step = (_time: number, delta: number) => {
      if (!this.active) {
        return;
      }
      this.spin(delta);
      this.guide(delta);
    };
    scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, step);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, step);
    });
  }

  // Хлопок винтовки дрону не нужен. Разрыв звучит в момент взрыва.
  protected override reportShot(): void {}

  // Старт в центре матки. Тело уходит вверх или вниз боком, нос с первого кадра смотрит на танк.
  // run — сколько пикселей пролететь, чтобы выйти из рисунка.
  flyOut(up: boolean, run: number): void {
    this.exiting = true;
    this.exitDy = up ? -1 : 1;
    this.bornY = this.y;
    this.exitRun = run;
    const aim = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    this.launch(aim, StrikeDrone.speed);
  }

  override launch(angle: number, speed: number): this {
    this.launchedAt = this.scene.time.now;
    this.guided = true;
    this.heading = angle;
    const launched = super.launch(angle, speed);
    this.face();
    return launched;
  }

  // Рикошет меняет курс. Картинка снова ложится винтами вверх, нос по новому углу.
  override bounce(angle: number): void {
    this.heading = angle;
    super.bounce(angle);
    this.face();
  }

  // На вылете скорость строго вверх или вниз. Нос при этом держит heading на танк.
  protected override flightAngle(): number {
    if (this.exiting) {
      return this.exitDy < 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    return this.heading;
  }

  flownMs(now: number): number {
    return Math.max(0, now - this.launchedAt);
  }

  private spin(delta: number): void {
    if (this.scene.time.paused || this.scene.registry.get('combat') === false) {
      return;
    }
    this.spinAcc += delta * enemyHasteOf(this.scene.registry);
    const frameMs = 1000 / StrikeDrone.spinRate;
    const frame = Math.floor(this.spinAcc / frameMs) % StrikeDrone.frames;
    if (this.frame.name !== String(frame)) {
      this.setFrame(frame);
    }
  }

  // Отскок уже сменил курс. Дальше дрон летит прямо.
  private guide(delta: number): void {
    if (!this.guided || this.hasBounced()) {
      return;
    }
    if (this.scene.time.paused || this.scene.registry.get('combat') === false) {
      return;
    }
    const haste = enemyHasteOf(this.scene.registry);
    const maxTurn = StrikeDrone.turnRate * haste * (delta / 1000);
    this.releaseExit();
    if (this.exiting) {
      this.heading = this.desiredAngle();
    } else {
      const desired = this.desiredAngle();
      const step = Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(desired - this.heading), -maxTurn, maxTurn);
      this.heading = this.keepInside(this.heading + step);
    }
    this.face();
    this.syncPace();
  }

  // Лист нарисован носом вправо и винтами вверх. Влево смотрим зеркалом, не переворотом на 180°.
  private face(): void {
    const left = Math.cos(this.heading) < 0;
    this.setFlipX(left);
    const tilt = left ? Phaser.Math.Angle.Wrap(this.heading - Math.PI) : this.heading;
    this.setRotation(tilt);
  }

  // Вылет кончился: дрон ушёл от матки на заданный путь или упёрся в край поля.
  private releaseExit(): void {
    if (!this.exiting) {
      return;
    }
    const pad = 20;
    const gone = Math.abs(this.y - this.bornY) >= this.exitRun;
    const blocked = this.exitDy < 0 ? this.y <= pad : this.y >= GAME.bannerY - pad;
    if (gone || blocked) {
      this.exiting = false;
    }
  }

  // Прямая на танк. На вылете по ней смотрит только нос, само тело идёт боком.
  private desiredAngle(): number {
    return Math.atan2(this.target.y - this.y, this.target.x - this.x);
  }

  // У края поля эта ось курса гаснет, дрон скользит вдоль рамки.
  private keepInside(angle: number): number {
    const pad = 16;
    const look = 28;
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);
    if (this.y + dy * look < pad && dy < 0) {
      dy = 0;
    }
    if (this.y + dy * look > GAME.bannerY - pad && dy > 0) {
      dy = 0;
    }
    if (this.x + dx * look < pad && dx < 0) {
      dx = 0;
    }
    if (this.x + dx * look > GAME.width - pad && dx > 0) {
      dx = 0;
    }
    if (dx * dx + dy * dy < 1e-4) {
      dx = this.target.x - this.x;
      dy = 0;
    }
    return Math.atan2(dy, dx);
  }
}
