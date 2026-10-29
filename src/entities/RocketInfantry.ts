// Ракетчик: на марше труба уже в кадре шага.
// На рубеже садится на колено без рук, а руки с РПГ — одна картинка.
// Она крутится вокруг плеча и отъезжает при пуске.

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
import { Infantry } from './Infantry';
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
  // Шесть кадров шага, 52×60. Подошва на строке 58, опора сразу под ней.
  static readonly frame = { w: 52, h: 60 };
  static readonly fit = {
    originX: 24 / 52,
    originY: 59 / 60,
    bodyW: 18,
    bodyH: 40,
    bodyX: 15,
    bodyY: 18,
  };
  // Стойка на колене без рук, 40×61. Подошва на строке 59.
  static readonly aimFrame = { w: 40, h: 61 };
  static readonly aimFit = {
    originX: 20 / 40,
    originY: 60 / 61,
    bodyW: 32,
    bodyH: 44,
    bodyX: 4,
    bodyY: 16,
  };
  // Лежащее тело длиннее роста. 87 px длины к 57 px роста стоящего кадра.
  static readonly corpseFrame = { w: 89, h: 47 };
  static readonly corpseFit = {
    originX: 0.5,
    originY: 1,
    scale: Infantry.placed.scale * (57 / 87),
  };
  // Середина среза относительно точки ног, труба строго влево.
  static get muzzleOffset(): { x: number; y: number } {
    const point = RocketInfantry.muzzleAt(0, 0, RocketInfantry.placed.scale, 0);
    return { x: point.x, y: point.y };
  }
  // Плечо на кадре стойки. Солдат смотрит влево, спина правее подбородка.
  // 27 — на 4 пикселя ближе к спине, чем первая посадка: труба не закрывала лицо.
  // 21 — на 4 пикселя ниже: кисть закрывает обрубок плеча.
  static readonly breech = { x: 30, y: 21 };
  // Вырез рук нарисован в том же масштабе, что тело. 1 не меняет толщину рукава.
  static readonly armsFit = 1;
  // Нос в пикселях стойки. Сдвиг (1, 7) − (31, 12) картинки рук.
  static readonly muzzleTip = {
    x: 30 + (1 - 31) * RocketInfantry.armsFit,
    y: 21 + (7 - 12) * RocketInfantry.armsFit,
  };
  // Плечо внутри картинки рук: верх рукава, под трубой.
  static readonly armsPivot = { x: 31, y: 12 };
  // От носа до среза раструба, в пикселях картинки рук. Струя выходит отсюда назад.
  static readonly tubeSpan = 47;
  // Отдача сильнее винтовки: труба тяжелее, удар читается дольше.
  static readonly recoilKick = { x: 8, climb: 0.06, ms: 160 };
  // Струя за раструбом: чуть шире трубы, держится дольше вспышки винтовки.
  static readonly flashPop = { x: 1, y: 0.9, ms: 180 };
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

  // Руки с трубой поверх тела. Крутятся вокруг плеча.
  private launcher!: Phaser.GameObjects.Image;
  private readonly recoil = { x: 0, climb: 0 };
  private aim = 0;

  // Шесть кадров бега с трубой, стойка без рук, руки с трубой поверх. Труп — последняя картинка.
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
    for (const key of [...frames, this.aimKey, this.corpseKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    // Руки крутятся на любой угол. Ближний фильтр на повороте рвёт трубу, поэтому здесь сглаживание.
    for (const key of [this.launcherKey, 'rocketman-flash']) {
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
      RocketInfantry.armsPivot.x / LAUNCHER_FRAME.w,
      RocketInfantry.armsPivot.y / LAUNCHER_FRAME.h,
    );
    this.launcher.setDepth(this.depth);
    const fit = RocketInfantry.fit;
    this.setOrigin(fit.originX, fit.originY);
    this.applyFit(fit);
    this.once('destroy', () => {
      this.scene.tweens.killTweensOf(this.recoil);
      this.launcher.destroy();
    });
    this.syncLauncher();
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.texture.key === RocketInfantry.aimKey) {
      this.setOrigin(RocketInfantry.aimFit.originX, RocketInfantry.aimFit.originY);
      this.applyFit(RocketInfantry.aimFit);
    } else if (this.texture.key === RocketInfantry.corpseKey) {
      this.setOrigin(RocketInfantry.corpseFit.originX, RocketInfantry.corpseFit.originY);
    } else {
      this.setOrigin(RocketInfantry.fit.originX, RocketInfantry.fit.originY);
      this.applyFit(RocketInfantry.fit);
    }
    this.syncLauncher();
  }

  private applyFit(fit: { bodyW: number; bodyH: number; bodyX: number; bodyY: number }): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body?.enable) {
      return;
    }
    body.setSize(fit.bodyW, fit.bodyH);
    body.setOffset(fit.bodyX, fit.bodyY);
  }

  protected override corpseTexture(): string | null {
    return RocketInfantry.corpseKey;
  }

  // Лежащая картинка длиннее шага. Опора стоящего кадра поднимает её над землёй.
  override kill(): void {
    const wasAlive = !this.reachedWall;
    super.kill();
    if (wasAlive && this.texture.key === RocketInfantry.corpseKey) {
      this.setOrigin(RocketInfantry.corpseFit.originX, RocketInfantry.corpseFit.originY);
      this.setScale(RocketInfantry.corpseFit.scale);
    }
  }

  // Руки с трубой — отдельный спрайт. На трупе гранатомёт уже лежит рядом с телом.
  protected override onDie(slain: boolean): void {
    if (!slain) {
      return;
    }
    if (this.launcher.active) {
      this.launcher.setVisible(false);
    }
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
    RocketInfantry.playBackblast(this.scene, x, y, angle, this.scaleX, 'rocketman-flash');
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
    const fit = RocketInfantry.aimFit;
    const frame = RocketInfantry.aimFrame;
    return {
      x: anchorX + (RocketInfantry.breech.x - fit.originX * frame.w) * scale,
      y: anchorY + (RocketInfantry.breech.y - fit.originY * frame.h) * scale,
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
    launcher.setScale(scale * RocketInfantry.armsFit);
    launcher.setRotation(rotation);
  }

  // Срез раструба и направление струи назад, против полёта ракеты.
  // x, y — носик. Длина — от носа до среза на картинке рук.
  static backblastPose(
    x: number,
    y: number,
    angle: number,
    scale: number,
  ): { x: number; y: number; rotation: number } {
    const rotation = angle + Math.PI;
    const reach = RocketInfantry.tubeSpan * scale * RocketInfantry.armsFit;
    return {
      x: x + Math.cos(rotation) * reach,
      y: y + Math.sin(rotation) * reach,
      rotation,
    };
  }

  // Огонь у среза и клубы, которые уходят назад и поднимаются.
  static playBackblast(
    scene: Phaser.Scene,
    x: number,
    y: number,
    angle: number,
    scale: number,
    flashKey: string,
  ): void {
    const pose = RocketInfantry.backblastPose(x, y, angle, scale);
    const pop = RocketInfantry.flashPop;
    Rocket.ensurePuff(scene);
    const cos = Math.cos(pose.rotation);
    const sin = Math.sin(pose.rotation);
    for (let i = 0; i < 5; i += 1) {
      const along = (4 + i * 6) * scale;
      const side = (i % 2 === 0 ? 1 : -1) * (1 + i) * scale;
      const px = pose.x + cos * along - sin * side;
      const py = pose.y + sin * along + cos * side;
      const puff = scene.add.image(px, py, 'smoke-puff').setDepth(11);
      puff.setScale(0.18 * scale);
      puff.setAlpha(0.5);
      puff.setTint(i < 2 ? 0xd2cdc2 : 0x7a766e);
      scene.tweens.add({
        targets: puff,
        x: px + cos * (16 + i * 7) * scale,
        y: py + sin * (16 + i * 7) * scale - 8 * scale,
        scale: (0.42 + i * 0.06) * scale,
        alpha: 0,
        duration: 320 + i * 80,
        ease: 'Quad.Out',
        onComplete: () => puff.destroy(),
      });
    }
    const flash = scene.add.image(pose.x, pose.y, flashKey).setOrigin(0, 0.5).setDepth(12);
    flash.setRotation(pose.rotation);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setScale(scale * pop.x, scale * pop.y);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: flash.scaleX * 1.2,
      scaleY: flash.scaleY * 1.45,
      duration: pop.ms,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy(),
    });
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

  // Запасной рисунок, если png нет. Ось на y = 3: нос в (0, 3), раструб вокруг x = 50.
  static renderLauncher(g: Phaser.GameObjects.Graphics, look: SoldierLook = ROCKET_LOOK): void {
    g.fillStyle(look.emblem);
    g.fillTriangle(0, 3, 18, 1, 18, 5);
    g.fillStyle(look.rifle);
    g.fillRect(16, 1, 38, 5);
    g.fillStyle(look.outline);
    g.fillRect(30, 0, 4, 2);
    g.fillStyle(look.rifleWood);
    g.fillRect(22, 6, 6, 5);
    g.fillRect(32, 6, 4, 4);
    g.fillStyle(look.rifleMetal);
    g.fillRect(54, 0, 6, 7);
  }

  // Левый край — срез раструба, струя вправо. Круги, не трапеции: ядро, языки, редкие искры.
  static renderFlash(g: Phaser.GameObjects.Graphics): void {
    const y = ROCKET_FLASH_FRAME.h / 2;
    const blobs: readonly [number, number, number, number][] = [
      [34, 2, 5, 0xc42810],
      [28, -3, 5, 0xe03010],
      [30, 5, 4, 0xff3a10],
      [22, -6, 4, 0xff4a10],
      [24, 6, 4, 0xe83810],
      [18, 0, 6, 0xff5a14],
      [14, -4, 4, 0xff6a18],
      [15, 4, 4, 0xff8a22],
      [10, -1, 5, 0xffaa33],
      [9, 3, 4, 0xffc24a],
      [6, 0, 4, 0xffe080],
      [40, -2, 2, 0xff6a18],
      [42, 4, 2, 0xffaa33],
      [36, -5, 2, 0xffe080],
    ];
    for (const [x, dy, radius, color] of blobs) {
      g.fillStyle(color, 1);
      g.fillCircle(x, y + dy, radius);
    }
    g.fillStyle(0xfff6d0, 1);
    g.fillCircle(4, y, 2);
  }
}
