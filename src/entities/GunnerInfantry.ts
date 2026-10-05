// Стрелок: доходит до середины поля, встаёт и редко, но больно стреляет по танку.
// Винтовка — отдельная картинка поверх тела, чтобы при выстреле отъезжать и вспыхивать.

import { Scene } from 'phaser';
import {
  CORPSE_FRAME,
  GUNNER_FLASH_FRAME,
  GUNNER_LOOK,
  GUNNER_RIFLE_FRAME,
  SOLDIER_FRAME,
  type SoldierLook,
} from '../gfx/looks';
import { bake } from '../gfx/textures';
import type { WorldPoint } from './WorldPoint';
import { RangedEnemy } from './RangedEnemy';

export class GunnerInfantry extends RangedEnemy {
  // Последняя волна рампы штурмовиков; на ней выходит стрелок.
  static readonly debutWave = 3;
  static readonly walkFps = 7;
  static readonly corpseKey = 'gunner-corpse';
  // Дуло длинной винтовки левее и выше точки ног спрайта.
  static readonly muzzleOffset = { x: -38, y: -42 };
  // Левый верх винтовки внутри кадра солдата 64×80. Рисунок сидит на y = 34.
  static readonly rifleCut = { x: 0, y: 32 };
  // Приклад: ось, вокруг которой винтовка поворачивается к танку и отскакивает назад.
  static readonly breech = { x: 44, y: 38 };
  // Дульный срез в кадре солдата. От приклада эта точка уходит влево и крутится вместе с винтовкой.
  static readonly muzzleTip = { x: 0, y: 38 };
  // Откат короче, чем у станка пикапа: винтовка короткая, удар должен читаться и сразу гаснуть.
  static readonly recoilKick = { x: 5, climb: 0.12, ms: 90 };
  // Вспышка у среза. Доли меньше единицы: картинка сама шире дула.
  static readonly flashPop = { x: 0.7, y: 0.75, ms: 80 };

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
  // Стоящий кадр: первая картинка из пары шага.
  protected readonly idleTexture = 'gunner-0';
  protected readonly muzzle = GunnerInfantry.muzzleOffset;

  // Винтовка поверх тела: так же, как в рисунке, она перекрывает руки.
  private rifle!: Phaser.GameObjects.Image;
  // x — пиксели текстуры назад вдоль винтовки. climb — добавка к прицелу, подъём дула в радианах.
  private readonly recoil = { x: 0, climb: 0 };
  // Поворот картинки винтовки к танку, без отдачи. Ноль — строго влево.
  private aim = 0;

  // Кадры шага без винтовки: в бою её рисует отдельный спрайт и двигает при отдаче.
  static ensureTextures(scene: Scene): void {
    if (!scene.textures.exists('gunner-0')) {
      bake(scene, 'gunner-0', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 0, GUNNER_LOOK, false),
      );
      bake(scene, 'gunner-1', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 1, GUNNER_LOOK, false),
      );
    }
    if (!scene.textures.exists(this.corpseKey)) {
      bake(scene, this.corpseKey, CORPSE_FRAME.w, CORPSE_FRAME.h, (g) =>
        this.drawCorpse(g, GUNNER_LOOK),
      );
    }
    if (!scene.textures.exists('gunner-rifle')) {
      bake(scene, 'gunner-rifle', GUNNER_RIFLE_FRAME.w, GUNNER_RIFLE_FRAME.h, (g) => this.renderRifle(g));
    }
    if (!scene.textures.exists('gunner-flash')) {
      bake(scene, 'gunner-flash', GUNNER_FLASH_FRAME.w, GUNNER_FLASH_FRAME.h, (g) => this.renderFlash(g));
    }
    if (!scene.anims.exists('gunner-walk')) {
      scene.anims.create({
        key: 'gunner-walk',
        frames: [{ key: 'gunner-0' }, { key: 'gunner-1' }],
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
    // Синяя полоска отличает стрелка от красного штурмовика и жёлтого пикапа.
    super(scene, x, y, hp, 'gunner-0', 'gunner-walk', 0x3a8ad4, shots, fireTarget);
    this.rifle = scene.add.image(x, y, 'gunner-rifle');
    this.rifle.setOrigin(
      (GunnerInfantry.breech.x - GunnerInfantry.rifleCut.x) / GUNNER_RIFLE_FRAME.w,
      (GunnerInfantry.breech.y - GunnerInfantry.rifleCut.y) / GUNNER_RIFLE_FRAME.h,
    );
    // Та же глубина, что у тела. Картинку добавляем позже, поэтому при равной глубине винтовка сверху.
    this.rifle.setDepth(this.depth);
    this.once('destroy', () => {
      this.scene.tweens.killTweensOf(this.recoil);
      this.rifle.destroy();
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

  // Винтовка — отдельный спрайт поверх тела. На трупе она уже нарисована в текстуре.
  protected override onDie(slain: boolean): void {
    if (!slain || !this.rifle.active) {
      return;
    }
    this.rifle.setVisible(false);
  }

  override hit(damage?: number): boolean {
    const dead = damage === undefined ? super.hit() : super.hit(damage);
    this.rifle.setTint(0xffccaa);
    this.scene.time.delayedCall(70, () => {
      if (this.rifle.active) {
        this.rifle.clearTint();
      }
    });
    return dead;
  }

  // Дуло уже повёрнуто к танку: пуля выходит из среза и летит вдоль винтовки.
  protected override shotPose(): { x: number; y: number; angle: number } {
    this.aim = GunnerInfantry.barrelAngle(
      this.x,
      this.y,
      this.scaleX,
      this.fireTarget.x,
      this.fireTarget.y,
    );
    return GunnerInfantry.muzzleAt(this.x, this.y, this.scaleX, this.aim);
  }

  // Вспышка остаётся в точке дула, винтовка в этот момент отскакивает назад.
  protected override onFire(x: number, y: number, angle: number): void {
    this.kickRifle();
    const flash = this.scene.add.image(x, y, 'gunner-flash').setOrigin(0, 0.5).setDepth(16);
    flash.setRotation(angle);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    const pop = GunnerInfantry.flashPop;
    flash.setScale(pop.x, pop.y);
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

  // Мировые координаты среза и направление пули. aim — поворот картинки без отдачи.
  static muzzleAt(
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
  ): { x: number; y: number; angle: number } {
    const mount = GunnerInfantry.mountPoint(anchorX, anchorY, scale);
    const tip = GunnerInfantry.turned(
      aim,
      GunnerInfantry.muzzleTip.x - GunnerInfantry.breech.x,
      GunnerInfantry.muzzleTip.y - GunnerInfantry.breech.y,
      scale,
    );
    return {
      x: mount.x + tip.x,
      y: mount.y + tip.y,
      angle: Phaser.Math.Angle.Wrap(aim - Math.PI),
    };
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

  // Ставит винтовку прикладом в руки. Отдача сдвигается назад вдоль уже повёрнутого ствола.
  static poseRifle(
    rifle: Phaser.GameObjects.Image,
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number },
  ): void {
    const rotation = aim + recoil.climb;
    const mount = GunnerInfantry.mountPoint(anchorX, anchorY, scale);
    const kick = GunnerInfantry.turned(rotation, recoil.x, 0, scale);
    rifle.setPosition(mount.x + kick.x, mount.y + kick.y);
    rifle.setScale(scale);
    rifle.setRotation(rotation);
  }

  static renderRifle(g: Phaser.GameObjects.Graphics, look: SoldierLook = GUNNER_LOOK): void {
    this.drawRifle(g, look, -GunnerInfantry.rifleCut.x, -GunnerInfantry.rifleCut.y);
  }

  // Короткий язычок пламени. Левый край — срез ствола, вперёд — вправо.
  static renderFlash(g: Phaser.GameObjects.Graphics): void {
    const y = GUNNER_FLASH_FRAME.h / 2;
    g.fillStyle(0xff4a10, 1);
    g.fillTriangle(0, y, 14, 1, 8, y);
    g.fillTriangle(0, y, 14, GUNNER_FLASH_FRAME.h - 1, 8, y);
    g.fillStyle(0xffcc44, 1);
    g.fillTriangle(0, y, 24, 4, 24, GUNNER_FLASH_FRAME.h - 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, y, 3);
  }
}
