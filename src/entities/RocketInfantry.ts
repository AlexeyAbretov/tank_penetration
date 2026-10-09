// Ракетчик: доходит до трёх четвертей поля, садится на колено и редко пускает ракету.
// Труба — отдельная картинка поверх тела, чтобы на рубеже лечь на плечо и отскакивать.

import Phaser, { GameObjects } from 'phaser';
import { GAME } from '../gameConfig';
import {
  CORPSE_FRAME,
  LAUNCHER_FRAME,
  ROCKET_FLASH_FRAME,
  ROCKET_LOOK,
  SOLDIER_FRAME,
  type SoldierLook,
} from '../gfx/looks';
import { bake } from '../gfx/textures';
import { RangedEnemy } from './RangedEnemy';
import { Rocket } from './Rocket';
import type { WorldPoint } from './WorldPoint';

export class RocketInfantry extends RangedEnemy {
  static readonly debutWave = 20;
  static readonly walkFps = 7;
  static readonly corpseKey = 'rocketman-corpse';
  // Точка ног → дуло, когда он уже на колене и труба смотрит влево. Для жёлтой метки в просмотре.
  static readonly muzzleOffset = { x: -44, y: -44 };
  // Казённик внутри кадра трубы. Вокруг него труба крутится к танку и отскакивает назад.
  static readonly breech = { x: 48, y: 8 };
  // Нос боеголовки. От казённика эта точка уходит влево.
  static readonly muzzleTip = { x: 0, y: 8 };
  // Где казённик сидит на кадре солдата. На марше — поперёк груди, на колене — ниже, у плеча.
  static readonly carryMount = { x: 48, y: 38 };
  static readonly kneelMount = { x: 50, y: 40 };
  // Отдача сильнее винтовки: труба тяжелее, удар читается дольше.
  static readonly recoilKick = { x: 8, climb: 0.06, ms: 160 };
  static readonly flashPop = { x: 0.85, y: 0.8, ms: 110 };
  // Реже стрелка и пикапа. Три секунды — пауза между пусками.
  static readonly shotInterval = 3000;
  // Медленнее пули, чтобы за ракетой успевал прочитаться дым.
  static readonly shotSpeed = 300;

  readonly coinReward = 3;
  // 960 — три четверти поля шириной 1280. Стрелок встаёт на середине, этот дальше от танка.
  protected readonly holdX = (GAME.width * 3) / 4;
  protected readonly fireDelay = RocketInfantry.shotInterval;
  protected readonly bulletSpeed = RocketInfantry.shotSpeed;
  protected readonly shotDamage = 3;
  protected readonly idleTexture = 'rocketman-kneel';
  protected readonly muzzle = RocketInfantry.muzzleOffset;

  private launcher!: Phaser.GameObjects.Image;
  private readonly recoil = { x: 0, climb: 0 };
  private aim = 0;
  // true после остановки: тело уже сидит, труба лежит на плече и целится.
  private posted = false;

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('rocketman-0')) {
      bake(scene, 'rocketman-0', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawMarch(g, 0, ROCKET_LOOK, false),
      );
      bake(scene, 'rocketman-1', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawMarch(g, 1, ROCKET_LOOK, false),
      );
    }
    if (!scene.textures.exists('rocketman-kneel')) {
      bake(scene, 'rocketman-kneel', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawKneel(g, ROCKET_LOOK),
      );
    }
    if (!scene.textures.exists(this.corpseKey)) {
      bake(scene, this.corpseKey, CORPSE_FRAME.w, CORPSE_FRAME.h, (g) => this.drawCorpse(g, ROCKET_LOOK));
    }
    if (!scene.textures.exists('rocketman-launcher')) {
      bake(scene, 'rocketman-launcher', LAUNCHER_FRAME.w, LAUNCHER_FRAME.h, (g) =>
        this.renderLauncher(g),
      );
    }
    if (!scene.textures.exists('rocketman-flash')) {
      bake(scene, 'rocketman-flash', ROCKET_FLASH_FRAME.w, ROCKET_FLASH_FRAME.h, (g) =>
        this.renderFlash(g),
      );
    }
    if (!scene.anims.exists('rocketman-walk')) {
      scene.anims.create({
        key: 'rocketman-walk',
        frames: [{ key: 'rocketman-0' }, { key: 'rocketman-1' }],
        frameRate: this.walkFps,
        repeat: -1,
      });
    }
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
    fireTarget: WorldPoint,
  ) {
    // Оранжевая полоска: не красный штурмовик, не синий стрелок, не жёлтый пикап.
    super(scene, x, y, hp, 'rocketman-0', 'rocketman-walk', 0xe07020, shots, fireTarget);
    this.launcher = scene.add.image(x, y, 'rocketman-launcher');
    this.launcher.setOrigin(
      RocketInfantry.breech.x / LAUNCHER_FRAME.w,
      RocketInfantry.breech.y / LAUNCHER_FRAME.h,
    );
    this.launcher.setDepth(this.depth);
    this.once('destroy', () => {
      this.scene.tweens.killTweensOf(this.recoil);
      this.launcher.destroy();
    });
    this.syncLauncher();
  }

  override preUpdate(time: number, delta: number): void {
    // Раньше act: первый пуск уже с плеча, а не с груди, на которой труба висела на марше.
    if (!this.posted && !this.reachedWall && this.x <= this.holdX) {
      this.posted = true;
      this.crouch();
    }
    super.preUpdate(time, delta);
    this.syncLauncher();
  }

  protected override corpseTexture(): string | null {
    return RocketInfantry.corpseKey;
  }

  protected override onDie(slain: boolean): void {
    if (!slain || !this.launcher.active) {
      return;
    }
    this.launcher.setVisible(false);
  }

  override hit(damage?: number): boolean {
    const dead = damage === undefined ? super.hit() : super.hit(damage);
    this.launcher.setTint(0xffccaa);
    this.scene.time.delayedCall(70, () => {
      if (this.launcher.active) {
        this.launcher.clearTint();
      }
    });
    return dead;
  }

  protected override spawnShot(x: number, y: number, angle: number): void {
    const rocket = new Rocket(this.scene, x, y, this.shotDamage);
    this.shots.add(rocket);
    rocket.launch(angle, this.bulletSpeed);
  }

  protected override shotPose(): { x: number; y: number; angle: number } {
    this.aim = this.posted
      ? RocketInfantry.barrelAngle(
          this.x,
          this.y,
          this.scaleX,
          this.fireTarget.x,
          this.fireTarget.y,
        )
      : 0;
    return RocketInfantry.muzzleAt(this.x, this.y, this.scaleX, this.aim, this.posted);
  }

  protected override onFire(x: number, y: number, angle: number): void {
    this.kickLauncher();
    const flash = this.scene.add.image(x, y, 'rocketman-flash').setOrigin(0, 0.5).setDepth(16);
    flash.setRotation(angle);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    const pop = RocketInfantry.flashPop;
    flash.setScale(pop.x, pop.y);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: pop.ms,
      ease: 'Quad.In',
      onComplete: () => flash.destroy(),
    });
  }

  // Хитбокс ниже: сидящая фигура не занимает воздух над каской.
  private crouch(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }
    body.setSize(40, 48);
    body.setOffset(12, 24);
  }

  private kickLauncher(): void {
    this.scene.tweens.killTweensOf(this.recoil);
    const kick = RocketInfantry.recoilKick;
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

  private syncLauncher(): void {
    if (!this.launcher.active) {
      return;
    }
    this.aim = this.posted
      ? RocketInfantry.barrelAngle(
          this.x,
          this.y,
          this.scaleX,
          this.fireTarget.x,
          this.fireTarget.y,
        )
      : 0;
    RocketInfantry.poseLauncher(
      this.launcher,
      this.x,
      this.y,
      this.scaleX,
      this.aim,
      this.recoil,
      this.posted,
    );
    this.launcher.setAlpha(this.alpha);
  }

  // Угол картинки трубы. Текстура при нуле уже смотрит влево, поэтому к углу на цель прибавляется разворот.
  static barrelAngle(
    anchorX: number,
    anchorY: number,
    scale: number,
    targetX: number,
    targetY: number,
  ): number {
    const mount = RocketInfantry.mountPoint(anchorX, anchorY, scale, true);
    const at = Phaser.Math.Angle.Between(mount.x, mount.y, targetX, targetY);
    return Phaser.Math.Angle.Wrap(at + Math.PI);
  }

  static muzzleAt(
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    posted: boolean,
  ): { x: number; y: number; angle: number } {
    const mount = RocketInfantry.mountPoint(anchorX, anchorY, scale, posted);
    const tip = RocketInfantry.turned(
      aim,
      RocketInfantry.muzzleTip.x - RocketInfantry.breech.x,
      RocketInfantry.muzzleTip.y - RocketInfantry.breech.y,
      scale,
    );
    return {
      x: mount.x + tip.x,
      y: mount.y + tip.y,
      angle: Phaser.Math.Angle.Wrap(aim - Math.PI),
    };
  }

  private static mountPoint(
    anchorX: number,
    anchorY: number,
    scale: number,
    posted: boolean,
  ): { x: number; y: number } {
    const mount = posted ? RocketInfantry.kneelMount : RocketInfantry.carryMount;
    return {
      x: anchorX + (mount.x - RocketInfantry.placed.originX * SOLDIER_FRAME.w) * scale,
      y: anchorY + (mount.y - RocketInfantry.placed.originY * SOLDIER_FRAME.h) * scale,
    };
  }

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

  static poseLauncher(
    launcher: Phaser.GameObjects.Image,
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number },
    posted: boolean,
  ): void {
    const rotation = aim + recoil.climb;
    const mount = RocketInfantry.mountPoint(anchorX, anchorY, scale, posted);
    const kick = RocketInfantry.turned(rotation, recoil.x, 0, scale);
    launcher.setPosition(mount.x + kick.x, mount.y + kick.y);
    launcher.setScale(scale);
    launcher.setRotation(rotation);
  }

  // То же тело, что у остальных солдат, но рядом лежит труба, а не винтовка.
  static drawCorpse(g: Phaser.GameObjects.Graphics, look: SoldierLook): void {
    super.drawCorpse(g, look, this.drawDroppedTube);
  }

  private static drawDroppedTube(g: GameObjects.Graphics, look: SoldierLook): void {
    g.fillStyle(look.rifle);
    g.fillRoundedRect(10, 64, 34, 8, 3);
    g.fillStyle(look.rifleWood);
    g.fillRoundedRect(18, 66, 16, 4, 1);
    g.fillStyle(look.rifleMetal);
    g.fillTriangle(2, 68, 12, 63, 12, 73);
    g.fillStyle(look.emblem);
    g.fillRect(12, 65, 4, 6);
  }

  // Кадр шага. armed — труба запечена в картинку. В бою она отдельный спрайт, поэтому armed = false.
  static drawMarch(
    g: Phaser.GameObjects.Graphics,
    legPhase: 0 | 1,
    look: SoldierLook,
    armed = false,
  ): void {
    RocketInfantry.drawSoldier(g, legPhase, look, false);
    if (armed) {
      this.paintLauncher(g, look, this.carryMount);
    }
  }

  // Одно колено на земле, корпус ниже, чем у шага. Труба рисуется отдельно и ложится на плечо.
  static drawKneel(g: Phaser.GameObjects.Graphics, look: SoldierLook): void {
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(34, 76, 44, 10);

    g.fillStyle(look.outline);
    g.fillRoundedRect(34, 54, 24, 14, 4);
    g.fillStyle(look.pants);
    g.fillRoundedRect(36, 56, 18, 10, 3);
    g.fillStyle(look.boots);
    g.fillRoundedRect(48, 64, 14, 10, 2);

    g.fillStyle(look.outline);
    g.fillRoundedRect(14, 52, 14, 20, 4);
    g.fillStyle(look.tunic);
    g.fillRoundedRect(16, 54, 10, 14, 3);
    g.fillStyle(look.boots);
    g.fillRoundedRect(8, 66, 16, 9, 2);

    g.fillStyle(look.outline);
    g.fillRoundedRect(20, 32, 32, 26, 7);
    g.fillStyle(look.tunic);
    g.fillRoundedRect(23, 34, 26, 22, 6);
    g.fillStyle(look.belt);
    g.fillRect(26, 42, 16, 4);
    g.fillStyle(look.vest);
    g.fillRect(24, 48, 20, 6);

    g.fillStyle(look.tunic);
    g.fillRoundedRect(42, 38, 10, 14, 3);
    g.fillRoundedRect(16, 38, 12, 10, 3);

    g.fillStyle(look.outline);
    g.fillCircle(34, 26, 10);
    g.fillStyle(look.skin);
    g.fillCircle(34, 26, 8);
    g.fillStyle(look.outline);
    g.fillRoundedRect(22, 12, 24, 16, 5);
    g.fillStyle(look.helmet);
    g.fillRoundedRect(24, 14, 20, 14, 4);
    g.fillStyle(look.helmetLight);
    g.fillRect(26, 16, 10, 3);
    g.fillStyle(look.visor);
    g.fillRect(24, 24, 20, 3);
    g.fillStyle(look.emblem);
    g.fillRect(40, 18, 6, 6);
  }

  static renderLauncher(g: Phaser.GameObjects.Graphics, look: SoldierLook = ROCKET_LOOK, ox = 0, oy = 0): void {
    g.fillStyle(look.rifleMetal);
    g.fillTriangle(ox, 8 + oy, 14 + ox, 3 + oy, 14 + ox, 13 + oy);
    g.fillStyle(look.emblem);
    g.fillRect(10 + ox, 4 + oy, 4, 8);
    g.fillStyle(look.rifle);
    g.fillRoundedRect(12 + ox, 4 + oy, 36, 8, 3);
    g.fillStyle(look.rifleWoodLight);
    g.fillRect(18 + ox, 6 + oy, 16, 2);
    g.fillStyle(look.rifleMetal);
    g.fillRoundedRect(44 + ox, 3 + oy, 12, 10, 2);
    g.fillStyle(look.outline);
    g.fillRect(22 + ox, 1 + oy, 3, 4);
    g.fillStyle(look.rifleWood);
    g.fillRoundedRect(32 + ox, 12 + oy, 6, 7, 1);
  }

  private static paintLauncher(
    g: Phaser.GameObjects.Graphics,
    look: SoldierLook,
    mount: { x: number; y: number },
  ): void {
    this.renderLauncher(g, look, mount.x - this.breech.x, mount.y - this.breech.y);
  }

  // Левый край — срез трубы, вперёд — вправо. В игре картинку поворачивают по углу полёта.
  static renderFlash(g: Phaser.GameObjects.Graphics): void {
    const y = ROCKET_FLASH_FRAME.h / 2;
    g.fillStyle(0xff4a10, 1);
    g.fillTriangle(0, y, 16, 2, 10, y);
    g.fillTriangle(0, y, 16, ROCKET_FLASH_FRAME.h - 2, 10, y);
    g.fillStyle(0xffaa33, 1);
    g.fillTriangle(0, y, 28, 5, 28, ROCKET_FLASH_FRAME.h - 5);
    g.fillStyle(0xfff3c4, 1);
    g.fillCircle(5, y, 3);
  }
}
