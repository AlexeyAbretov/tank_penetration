// Ракетчик: тот же бег, что у штурмовика, но форма зелёная и в руках РПГ.
// На марше труба нарисована в кадре. На рубеже он встаёт: труба — отдельная картинка,
// чтобы при пуске отъезжать, а кисти оставались на рукояти.

import Phaser, { Scene } from 'phaser';
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
import type { WorldPoint } from '../types/WorldPoint';

export class RocketInfantry extends RangedEnemy {
  static readonly debutWave = 20;
  // Тот же цикл, что у штурмовика: контакт, подъём, пронос и то же другой ногой.
  static readonly walkFps = 9;
  static readonly corpseKey = 'rocketman-corpse';
  static readonly aimKey = 'rocketman-aim';
  static readonly launcherKey = 'rocketman-launcher';
  static readonly handsKey = 'rocketman-hands';
  // Середина среза относительно точки ног, труба строго влево. Жёлтая метка и ракета в просмотре.
  static get muzzleOffset(): { x: number; y: number } {
    const point = RocketInfantry.muzzleAt(0, 0, RocketInfantry.placed.scale, 0);
    return { x: point.x, y: point.y };
  }
  // Левый верх трубы внутри кадра солдата 64×80. На стойке картинка садится на x = 0, y = 26.
  static readonly launcherCut = { x: 0, y: 26 };
  // Раструб: ось, вокруг которой труба целится в танк. Откат сдвигает срез к этой точке.
  static readonly breech = { x: 50, y: 31 };
  // Нос боеголовки в кадре солдата. От раструба эта точка уходит влево и крутится вместе с трубой.
  static readonly muzzleTip = { x: 0, y: 31 };
  // Отдача сильнее винтовки: труба тяжелее, удар читается дольше.
  static readonly recoilKick = { x: 8, climb: 0.06, ms: 160 };
  static readonly flashPop = { x: 0.85, y: 0.8, ms: 110 };
  // На сколько пикселей текстуры огонь уходит вперёд от носика, чтобы не сесть на боеголовку.
  static readonly flashLead = 2;
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
  // Стойка пуска: тело без трубы. Пока идёт, в кадрах шага труба уже нарисована.
  protected readonly idleTexture = RocketInfantry.aimKey;
  protected readonly muzzle = RocketInfantry.muzzleOffset;

  private launcher!: Phaser.GameObjects.Image;
  private hands?: Phaser.GameObjects.Image;
  private readonly recoil = { x: 0, climb: 0 };
  private aim = 0;

  // Шесть кадров бега с трубой, стойка без неё, сама труба и кисти поверх. Труп — последняя картинка.
  // Пути в public/. Строки буквальные: singlefile-сборка подменяет их на data:.
  static readonly images = {
    'rocketman-0': 'assets/rocketman-0.png',
    'rocketman-1': 'assets/rocketman-1.png',
    'rocketman-2': 'assets/rocketman-2.png',
    'rocketman-3': 'assets/rocketman-3.png',
    'rocketman-4': 'assets/rocketman-4.png',
    'rocketman-5': 'assets/rocketman-5.png',
    [RocketInfantry.aimKey]: 'assets/rocketman-aim.png',
    [RocketInfantry.launcherKey]: 'assets/rocketman-launcher.png',
    [RocketInfantry.handsKey]: 'assets/rocketman-hands.png',
    [RocketInfantry.corpseKey]: 'assets/rocketman-corpse.png',
  } as const;

  static readonly frameKeys = (
    ['rocketman-0', 'rocketman-1', 'rocketman-2', 'rocketman-3', 'rocketman-4', 'rocketman-5'] as const
  );

  static preload(scene: Phaser.Scene): void {
    for (const [key, path] of Object.entries(this.images)) {
      scene.load.image(key, path);
    }
  }

  // Картинки из assets/. Фигурный рисунок остаётся, если файл не загрузили.
  static ensureTextures(scene: Scene): void {
    if (!scene.textures.exists('rocketman-0')) {
      bake(scene, 'rocketman-0', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 0, ROCKET_LOOK, false),
      );
      bake(scene, 'rocketman-1', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 1, ROCKET_LOOK, false),
      );
    }
    if (!scene.textures.exists(this.aimKey)) {
      bake(scene, this.aimKey, SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 0, ROCKET_LOOK, false),
      );
    }
    if (!scene.textures.exists(this.corpseKey)) {
      bake(scene, this.corpseKey, CORPSE_FRAME.w, CORPSE_FRAME.h, (g) =>
        this.drawCorpse(g, ROCKET_LOOK),
      );
    }
    if (!scene.textures.exists(this.launcherKey)) {
      bake(scene, this.launcherKey, LAUNCHER_FRAME.w, LAUNCHER_FRAME.h, (g) => this.renderLauncher(g));
    }
    if (!scene.textures.exists('rocketman-flash')) {
      bake(scene, 'rocketman-flash', ROCKET_FLASH_FRAME.w, ROCKET_FLASH_FRAME.h, (g) =>
        this.renderFlash(g),
      );
    }
    const frames = this.frameKeys.filter((key) => scene.textures.exists(key));
    for (const key of [...frames, this.aimKey, this.launcherKey, this.handsKey, this.corpseKey, 'rocketman-flash']) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
    if (scene.anims.exists('rocketman-walk')) {
      scene.anims.remove('rocketman-walk');
    }
    scene.anims.create({
      key: 'rocketman-walk',
      frames: frames.map((key) => ({ key })),
      frameRate: this.walkFps,
      repeat: -1,
    });
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
    super(scene, x, y, hp, RocketInfantry.frameKeys[0], 'rocketman-walk', 0xe07020, shots, fireTarget);
    this.launcher = scene.add.image(x, y, RocketInfantry.launcherKey);
    this.launcher.setOrigin(
      (RocketInfantry.breech.x - RocketInfantry.launcherCut.x) / LAUNCHER_FRAME.w,
      (RocketInfantry.breech.y - RocketInfantry.launcherCut.y) / LAUNCHER_FRAME.h,
    );
    this.launcher.setDepth(this.depth);
    if (scene.textures.exists(RocketInfantry.handsKey)) {
      this.hands = scene.add.image(x, y, RocketInfantry.handsKey);
      this.hands.setOrigin(this.originX, this.originY);
      this.hands.setDepth(this.depth);
    }
    this.once('destroy', () => {
      this.scene.tweens.killTweensOf(this.recoil);
      this.launcher.destroy();
      this.hands?.destroy();
    });
    this.syncLauncher();
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.syncLauncher();
  }

  protected override corpseTexture(): string | null {
    return RocketInfantry.corpseKey;
  }

  // Труба и кисти — отдельные спрайты. На трупе ствол уже лежит рядом с телом.
  protected override onDie(slain: boolean): void {
    if (!slain) {
      return;
    }
    if (this.launcher.active) {
      this.launcher.setVisible(false);
    }
    if (this.hands?.active) {
      this.hands.setVisible(false);
    }
  }

  override hit(damage?: number): boolean {
    const dead = damage === undefined ? super.hit() : super.hit(damage);
    this.launcher.setTint(0xffccaa);
    this.hands?.setTint(0xffccaa);
    this.scene.time.delayedCall(70, () => {
      if (this.launcher.active) {
        this.launcher.clearTint();
      }
      if (this.hands?.active) {
        this.hands.clearTint();
      }
    });
    return dead;
  }

  protected override spawnShot(x: number, y: number, angle: number): void {
    const rocket = new Rocket(this.scene, x, y, this.shotDamage);
    this.shots.add(rocket);
    rocket.launch(angle, this.bulletSpeed);
  }

  // Ракета выходит из носика и летит в танк. Отдача уже в позе: срез не уезжает от ракеты.
  protected override shotPose(): { x: number; y: number; angle: number } {
    this.aim = RocketInfantry.barrelAngle(
      this.x,
      this.y,
      this.scaleX,
      this.fireTarget.x,
      this.fireTarget.y,
    );
    this.kickLauncher();
    return RocketInfantry.muzzleAt(this.x, this.y, this.scaleX, this.aim, this.recoil);
  }

  protected override onFire(x: number, y: number, angle: number): void {
    const at = RocketInfantry.flashOrigin(x, y, angle, this.scaleX);
    const flash = this.scene.add.image(at.x, at.y, 'rocketman-flash').setOrigin(0, 0.5).setDepth(16);
    flash.setRotation(angle);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    const pop = RocketInfantry.flashPop;
    flash.setScale(this.scaleX * pop.x, this.scaleY * pop.y);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: pop.ms,
      ease: 'Quad.In',
      onComplete: () => flash.destroy(),
    });
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
    // На бегу труба нарисована в кадре. Отдельная картинка нужна только в стойке, иначе труб две.
    const planted = !this.reachedWall && this.texture.key === this.idleTexture;
    this.launcher.setVisible(planted);
    if (this.hands?.active) {
      this.hands.setVisible(planted);
      this.hands.setPosition(this.x, this.y);
      this.hands.setScale(this.scaleX, this.scaleY);
      this.hands.setAlpha(this.alpha);
    }
    if (!planted) {
      return;
    }
    this.aim = RocketInfantry.barrelAngle(
      this.x,
      this.y,
      this.scaleX,
      this.fireTarget.x,
      this.fireTarget.y,
    );
    RocketInfantry.poseLauncher(this.launcher, this.x, this.y, this.scaleX, this.aim, this.recoil);
    this.launcher.setAlpha(this.alpha);
  }

  // Угол картинки трубы, чтобы носик смотрел в корпус танка.
  // Сама текстура при нуле уже смотрит влево, поэтому к углу на цель прибавляется разворот.
  static barrelAngle(
    anchorX: number,
    anchorY: number,
    scale: number,
    targetX: number,
    targetY: number,
  ): number {
    const mount = RocketInfantry.mountPoint(anchorX, anchorY, scale);
    const at = Phaser.Math.Angle.Between(mount.x, mount.y, targetX, targetY);
    return Phaser.Math.Angle.Wrap(at + Math.PI);
  }

  // Носик и направление ракеты к цели. aim — поворот без подъёма.
  // Откат сдвигает срез назад вдоль пуска и не опускает его относительно трубы.
  static muzzleAt(
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number } = { x: 0, climb: 0 },
  ): { x: number; y: number; angle: number } {
    const point = RocketInfantry.muzzlePoint(anchorX, anchorY, scale, aim, recoil);
    return {
      x: point.x,
      y: point.y,
      angle: Phaser.Math.Angle.Wrap(aim - Math.PI),
    };
  }

  private static muzzlePoint(
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number },
  ): { x: number; y: number } {
    const mount = RocketInfantry.mountPoint(anchorX, anchorY, scale);
    const tip = RocketInfantry.turned(
      aim,
      RocketInfantry.muzzleTip.x - RocketInfantry.breech.x + recoil.x,
      RocketInfantry.muzzleTip.y - RocketInfantry.breech.y,
      scale,
    );
    return { x: mount.x + tip.x, y: mount.y + tip.y };
  }

  private static mountPoint(anchorX: number, anchorY: number, scale: number): { x: number; y: number } {
    return {
      x: anchorX + (RocketInfantry.breech.x - RocketInfantry.placed.originX * SOLDIER_FRAME.w) * scale,
      y: anchorY + (RocketInfantry.breech.y - RocketInfantry.placed.originY * SOLDIER_FRAME.h) * scale,
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

  // Раструб у плеча, носик на линии пуска. Подъём крутит раструб вокруг носика, чтобы ракета осталась в середине трубы.
  static poseLauncher(
    launcher: Phaser.GameObjects.Image,
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number },
  ): void {
    const rotation = aim + recoil.climb;
    const muzzle = RocketInfantry.muzzlePoint(anchorX, anchorY, scale, aim, recoil);
    const tip = RocketInfantry.turned(
      rotation,
      RocketInfantry.muzzleTip.x - RocketInfantry.breech.x,
      RocketInfantry.muzzleTip.y - RocketInfantry.breech.y,
      scale,
    );
    launcher.setPosition(muzzle.x - tip.x, muzzle.y - tip.y);
    launcher.setScale(scale);
    launcher.setRotation(rotation);
  }

  // Точка ядра вспышки: впереди носика по направлению пуска.
  static flashOrigin(x: number, y: number, angle: number, scale: number): { x: number; y: number } {
    const ahead = RocketInfantry.flashLead * scale;
    return {
      x: x + Math.cos(angle) * ahead,
      y: y + Math.sin(angle) * ahead,
    };
  }

  // Запасное тело, если картинку не загрузили. Рядом лежит труба, а не винтовка.
  static drawCorpse(g: Phaser.GameObjects.Graphics, look: SoldierLook): void {
    super.drawCorpse(g, look, this.drawDroppedTube);
  }

  private static drawDroppedTube(g: Phaser.GameObjects.Graphics, look: SoldierLook): void {
    g.fillStyle(look.rifle);
    g.fillRoundedRect(10, 64, 34, 8, 3);
    g.fillStyle(look.rifleWood);
    g.fillRoundedRect(18, 66, 16, 4, 1);
    g.fillStyle(look.rifleMetal);
    g.fillTriangle(2, 68, 12, 63, 12, 73);
    g.fillStyle(look.emblem);
    g.fillRect(12, 65, 4, 6);
  }

  static renderLauncher(g: Phaser.GameObjects.Graphics, look: SoldierLook = ROCKET_LOOK): void {
    g.fillStyle(look.rifleMetal);
    g.fillTriangle(0, 8, 14, 3, 14, 13);
    g.fillStyle(look.emblem);
    g.fillRect(10, 4, 4, 8);
    g.fillStyle(look.rifle);
    g.fillRoundedRect(12, 4, 28, 8, 3);
    g.fillStyle(look.rifleWoodLight);
    g.fillRect(16, 6, 12, 2);
    g.fillStyle(look.rifleMetal);
    g.fillRoundedRect(36, 3, 12, 10, 2);
    g.fillStyle(look.outline);
    g.fillRect(20, 1, 3, 4);
    g.fillStyle(look.rifleWood);
    g.fillRoundedRect(28, 12, 6, 3, 1);
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
