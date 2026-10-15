// Стрелок: те же кадры бега, что у штурмовика, но камуфляж сине-серый.
// До середины поля идёт с винтовкой в кадре. На рубеже встаёт: ствол — отдельная картинка,
// чтобы при выстреле отъезжать, а кисти оставались на месте.

import Phaser, { Scene } from 'phaser';
import {
  CORPSE_FRAME,
  GUNNER_FLASH_FRAME,
  GUNNER_LOOK,
  GUNNER_RIFLE_FRAME,
  SOLDIER_FRAME,
  type SoldierLook,
} from '../gfx/looks';
import { bake } from '../gfx/textures';
import { Infantry } from './Infantry';
import type { WorldPoint } from '../types/WorldPoint';
import { RangedEnemy } from './RangedEnemy';

export class GunnerInfantry extends RangedEnemy {
  // Последняя волна рампы штурмовиков; на ней выходит стрелок.
  static readonly debutWave = 3;
  // Тот же цикл, что у штурмовика: контакт, подъём, пронос и то же другой ногой.
  static readonly walkFps = 9;
  static readonly corpseKey = 'gunner-corpse';
  static readonly aimKey = 'gunner-aim';
  static readonly rifleKey = 'gunner-rifle';
  static readonly handsKey = 'gunner-hands';
  // Середина среза относительно точки ног, ствол строго влево. Жёлтая метка и пуля в просмотре.
  static get muzzleOffset(): { x: number; y: number } {
    const point = GunnerInfantry.muzzleAt(0, 0, Infantry.placed.scale, 0);
    return { x: point.x, y: point.y };
  }
  // Левый верх винтовки внутри кадра солдата 64×80. Срез картинки бега сидит на x = 5, y = 26.
  static readonly rifleCut = { x: 5, y: 26 };
  // Затыльник: ось, вокруг которой винтовка целится в танк. Откат сдвигает срез к этой точке.
  static readonly breech = { x: 32, y: 31 };
  // Дульный срез в кадре солдата. От затыльника эта точка уходит влево и крутится вместе с винтовкой.
  static readonly muzzleTip = { x: 5, y: 31 };
  // Откат короче, чем у станка пикапа: винтовка короткая, удар должен читаться и сразу гаснуть.
  static readonly recoilKick = { x: 5, climb: 0.12, ms: 90 };
  // Множитель к масштабу винтовки. 1 — пиксель вспышки совпадает с пикселем ствола, иначе огонь не читается.
  static readonly flashPop = { x: 1, y: 1, ms: 100 };
  // На сколько пикселей текстуры ядро уходит вперёд от металла.
  // Выстрел уже откатил срез назад, поэтому к смещению прибавляется длина отката.
  static readonly flashLead = 2;

  // Дороже штурмовика: убивать стрелка выгоднее.
  readonly coinReward = 2;
  // Выстрел раз в 1.5 секунды.
  static readonly shotInterval = 1500;
  // Медленнее пули пикапа, но урон выше.
  static readonly shotSpeed = 420;

  // Рубеж остановки. 640 — центр поля шириной 1280.
  protected readonly holdX = 640;
  protected readonly fireDelay = GunnerInfantry.shotInterval;
  protected readonly bulletSpeed = GunnerInfantry.shotSpeed;
  // Один выстрел снимает 8 HP базы из 100.
  protected readonly shotDamage = 8;
  // Стойка стрельбы: тело без винтовки. Пока идёт, в кадрах шага ствол уже нарисован.
  protected readonly idleTexture = GunnerInfantry.aimKey;
  protected readonly muzzle = GunnerInfantry.muzzleOffset;

  // Винтовка поверх тела. Кисти — ещё выше, чтобы при откате остаться на рукояти.
  private rifle!: Phaser.GameObjects.Image;
  private hands?: Phaser.GameObjects.Image;
  // x — пиксели текстуры назад вдоль винтовки. climb — добавка к прицелу, подъём дула в радианах.
  private readonly recoil = { x: 0, climb: 0 };
  // Поворот картинки винтовки к танку, без отдачи. Ноль — строго влево.
  private aim = 0;

  // Кадры бега с винтовкой, стойка без неё, сам ствол и кисти поверх. Труп — последняя картинка.
  // Пути в public/. Строки буквальные: singlefile-сборка подменяет их на data:.
  static readonly images = {
    'gunner-0': 'assets/gunner-0.png',
    'gunner-1': 'assets/gunner-1.png',
    'gunner-2': 'assets/gunner-2.png',
    'gunner-3': 'assets/gunner-3.png',
    'gunner-4': 'assets/gunner-4.png',
    'gunner-5': 'assets/gunner-5.png',
    [GunnerInfantry.aimKey]: 'assets/gunner-aim.png',
    [GunnerInfantry.rifleKey]: 'assets/gunner-rifle.png',
    [GunnerInfantry.handsKey]: 'assets/gunner-hands.png',
    [GunnerInfantry.corpseKey]: 'assets/gunner-corpse.png',
  } as const;

  // Шесть кадров шага, в том же порядке, что у штурмовика.
  static readonly frameKeys = (
    ['gunner-0', 'gunner-1', 'gunner-2', 'gunner-3', 'gunner-4', 'gunner-5'] as const
  );

  static preload(scene: Phaser.Scene): void {
    for (const [key, path] of Object.entries(this.images)) {
      scene.load.image(key, path);
    }
  }

  // Картинки из assets/. Фигурный рисунок остаётся, если файл не загрузили.
  static ensureTextures(scene: Scene): void {
    if (!scene.textures.exists('gunner-0')) {
      bake(scene, 'gunner-0', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 0, GUNNER_LOOK, false),
      );
      bake(scene, 'gunner-1', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 1, GUNNER_LOOK, false),
      );
    }
    if (!scene.textures.exists(this.aimKey)) {
      bake(scene, this.aimKey, SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 0, GUNNER_LOOK, false),
      );
    }
    if (!scene.textures.exists(this.corpseKey)) {
      bake(scene, this.corpseKey, CORPSE_FRAME.w, CORPSE_FRAME.h, (g) =>
        this.drawCorpse(g, GUNNER_LOOK),
      );
    }
    if (!scene.textures.exists(this.rifleKey)) {
      bake(scene, this.rifleKey, GUNNER_RIFLE_FRAME.w, GUNNER_RIFLE_FRAME.h, (g) => this.renderRifle(g));
    }
    if (!scene.textures.exists('gunner-flash')) {
      bake(scene, 'gunner-flash', GUNNER_FLASH_FRAME.w, GUNNER_FLASH_FRAME.h, (g) => this.renderFlash(g));
    }
    const frames = this.frameKeys.filter((key) => scene.textures.exists(key));
    for (const key of [...frames, this.aimKey, this.rifleKey, this.handsKey, this.corpseKey, 'gunner-flash']) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
    // Анимация живёт в общем менеджере. Собираем заново: набор кадров мог смениться.
    if (scene.anims.exists('gunner-walk')) {
      scene.anims.remove('gunner-walk');
    }
    scene.anims.create({
      key: 'gunner-walk',
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
    // Синяя полоска отличает стрелка от красного штурмовика и жёлтого пикапа.
    super(scene, x, y, hp, GunnerInfantry.frameKeys[0], 'gunner-walk', 0x3a8ad4, shots, fireTarget);
    this.rifle = scene.add.image(x, y, GunnerInfantry.rifleKey);
    this.rifle.setOrigin(
      (GunnerInfantry.breech.x - GunnerInfantry.rifleCut.x) / GUNNER_RIFLE_FRAME.w,
      (GunnerInfantry.breech.y - GunnerInfantry.rifleCut.y) / GUNNER_RIFLE_FRAME.h,
    );
    // Та же глубина, что у тела. Картинку добавляем позже, поэтому при равной глубине винтовка сверху.
    this.rifle.setDepth(this.depth);
    if (scene.textures.exists(GunnerInfantry.handsKey)) {
      this.hands = scene.add.image(x, y, GunnerInfantry.handsKey);
      this.hands.setOrigin(this.originX, this.originY);
      this.hands.setDepth(this.depth);
    }
    this.once('destroy', () => {
      this.scene.tweens.killTweensOf(this.recoil);
      this.rifle.destroy();
      this.hands?.destroy();
    });
    this.syncRifle();
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.syncRifle();
  }

  protected override corpseTexture(): string | null {
    return GunnerInfantry.corpseKey;
  }

  // Винтовка и кисти — отдельные спрайты. На трупе ствол уже лежит рядом с телом.
  protected override onDie(slain: boolean): void {
    if (!slain) {
      return;
    }
    if (this.rifle.active) {
      this.rifle.setVisible(false);
    }
    if (this.hands?.active) {
      this.hands.setVisible(false);
    }
  }

  override hit(damage?: number): boolean {
    const dead = damage === undefined ? super.hit() : super.hit(damage);
    this.rifle.setTint(0xffccaa);
    this.hands?.setTint(0xffccaa);
    this.scene.time.delayedCall(70, () => {
      if (this.rifle.active) {
        this.rifle.clearTint();
      }
      if (this.hands?.active) {
        this.hands.clearTint();
      }
    });
    return dead;
  }

  // Пуля выходит из середины среза и летит в танк. Отдача уже в позе: срез не уезжает от пули.
  protected override shotPose(): { x: number; y: number; angle: number } {
    this.aim = GunnerInfantry.barrelAngle(
      this.x,
      this.y,
      this.scaleX,
      this.fireTarget.x,
      this.fireTarget.y,
    );
    this.kickRifle();
    return GunnerInfantry.muzzleAt(this.x, this.y, this.scaleX, this.aim, this.recoil);
  }

  // Вспышка впереди среза, не на стволе. Пуля выходит из канала, огонь — из дула наружу.
  protected override onFire(x: number, y: number, angle: number): void {
    const at = GunnerInfantry.flashOrigin(x, y, angle, this.scaleX);
    const flash = this.scene.add.image(at.x, at.y, 'gunner-flash').setOrigin(0, 0.5).setDepth(16);
    flash.setRotation(angle);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    const pop = GunnerInfantry.flashPop;
    flash.setScale(this.scaleX * pop.x, this.scaleY * pop.y);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: pop.ms,
      ease: 'Quad.In',
      onComplete: () => flash.destroy(),
    });
  }

  private kickRifle(): void {
    this.scene.tweens.killTweensOf(this.recoil);
    const kick = GunnerInfantry.recoilKick;
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

  private syncRifle(): void {
    if (!this.rifle.active) {
      return;
    }
    // На бегу ствол нарисован в кадре. Отдельная картинка нужна только в стойке, иначе стволов два.
    const planted = !this.reachedWall && this.texture.key === this.idleTexture;
    this.rifle.setVisible(planted);
    if (this.hands?.active) {
      this.hands.setVisible(planted);
      this.hands.setPosition(this.x, this.y);
      this.hands.setScale(this.scaleX, this.scaleY);
      this.hands.setAlpha(this.alpha);
    }
    if (!planted) {
      return;
    }
    this.aim = GunnerInfantry.barrelAngle(
      this.x,
      this.y,
      this.scaleX,
      this.fireTarget.x,
      this.fireTarget.y,
    );
    GunnerInfantry.poseRifle(this.rifle, this.x, this.y, this.scaleX, this.aim, this.recoil);
    this.rifle.setAlpha(this.alpha);
  }

  // Угол картинки винтовки, чтобы срез смотрел в корпус танка.
  // Сама текстура при нуле уже смотрит влево, поэтому к углу на цель прибавляется разворот.
  static barrelAngle(
    anchorX: number,
    anchorY: number,
    scale: number,
    targetX: number,
    targetY: number,
  ): number {
    const mount = GunnerInfantry.mountPoint(anchorX, anchorY, scale);
    const at = Phaser.Math.Angle.Between(mount.x, mount.y, targetX, targetY);
    return Phaser.Math.Angle.Wrap(at + Math.PI);
  }

  // Середина среза и направление пули к цели. aim — поворот без подъёма.
  // Откат сдвигает срез назад вдоль выстрела и не опускает его относительно ствола.
  static muzzleAt(
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number } = { x: 0, climb: 0 },
  ): { x: number; y: number; angle: number } {
    const point = GunnerInfantry.muzzlePoint(anchorX, anchorY, scale, aim, recoil);
    return {
      x: point.x,
      y: point.y,
      angle: Phaser.Math.Angle.Wrap(aim - Math.PI),
    };
  }

  // Срез на линии прицела. recoil.x — пиксели текстуры назад, к прикладу.
  private static muzzlePoint(
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number },
  ): { x: number; y: number } {
    const mount = GunnerInfantry.mountPoint(anchorX, anchorY, scale);
    const tip = GunnerInfantry.turned(
      aim,
      GunnerInfantry.muzzleTip.x - GunnerInfantry.breech.x + recoil.x,
      GunnerInfantry.muzzleTip.y - GunnerInfantry.breech.y,
      scale,
    );
    return { x: mount.x + tip.x, y: mount.y + tip.y };
  }

  // Приклад на спрайте солдата. anchor — точка ног, scale — масштаб тела.
  private static mountPoint(anchorX: number, anchorY: number, scale: number): { x: number; y: number } {
    return {
      x: anchorX + (GunnerInfantry.breech.x - GunnerInfantry.placed.originX * SOLDIER_FRAME.w) * scale,
      y: anchorY + (GunnerInfantry.breech.y - GunnerInfantry.placed.originY * SOLDIER_FRAME.h) * scale,
    };
  }

  // localX/localY — пиксели текстуры от приклада. Положительный X смотрит назад, к прикладу.
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

  // Приклад в руках, срез на линии выстрела. Подъём крутит приклад вокруг среза, чтобы пуля осталась в середине ствола.
  static poseRifle(
    rifle: Phaser.GameObjects.Image,
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number },
  ): void {
    const rotation = aim + recoil.climb;
    const muzzle = GunnerInfantry.muzzlePoint(anchorX, anchorY, scale, aim, recoil);
    const tip = GunnerInfantry.turned(
      rotation,
      GunnerInfantry.muzzleTip.x - GunnerInfantry.breech.x,
      GunnerInfantry.muzzleTip.y - GunnerInfantry.breech.y,
      scale,
    );
    rifle.setPosition(muzzle.x - tip.x, muzzle.y - tip.y);
    rifle.setScale(scale);
    rifle.setRotation(rotation);
  }

  static renderRifle(g: Phaser.GameObjects.Graphics, look: SoldierLook = GUNNER_LOOK): void {
    this.drawRifle(g, look, -GunnerInfantry.rifleCut.x, -GunnerInfantry.rifleCut.y);
  }

  // Точка ядра вспышки: впереди дула по направлению выстрела.
  // x/y — уже откатившийся срез. Ствол потом едет обратно, огонь остаётся у того места, где было дуло.
  static flashOrigin(x: number, y: number, angle: number, scale: number): { x: number; y: number } {
    const ahead = (GunnerInfantry.recoilKick.x + GunnerInfantry.flashLead) * scale;
    return {
      x: x + Math.cos(angle) * ahead,
      y: y + Math.sin(angle) * ahead,
    };
  }

  // Вспышка винтовки у среза. Левый край — дуло, огонь только вперёд.
  // Ядро белое, язык узкий, лепестки разной длины: ровный клин выглядит как наклейка.
  static renderFlash(g: Phaser.GameObjects.Graphics): void {
    const y = GUNNER_FLASH_FRAME.h / 2;

    // Оранжевая бахрома. Короткая и кривая, не веер на весь кадр.
    g.fillStyle(0xff4a14, 0.5);
    g.fillTriangle(2, y, 10, 1, 7, y - 1);
    g.fillTriangle(3, y + 1, 9, 16, 6, y + 1);
    g.fillTriangle(6, y, 17, y - 2, 17, y + 3);

    // Жёлтый пороховой язык: шире у канала и сходит на нет. Нижний лепесток длиннее верхнего.
    g.fillStyle(0xffc24a, 1);
    g.fillTriangle(0, y, 12, y - 2, 12, y + 2);
    g.fillTriangle(1, y, 5, 3, 6, y - 1);
    g.fillTriangle(2, y + 1, 4, 15, 8, y + 2);

    // Белое ядро у среза и второй узел чуть выше оси — вспышка не симметричная.
    g.fillStyle(0xfff4c8, 1);
    g.fillTriangle(1, y, 8, y - 1, 8, y + 1);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(2, y, 2);
    g.fillCircle(7, y - 1, 1);
    g.fillRect(13, y - 3, 2, 1);
    g.fillRect(14, y + 3, 1, 2);
  }
}
