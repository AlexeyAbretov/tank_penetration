// Стрелок: доходит до середины поля, встаёт и редко, но больно стреляет по танку.
// Винтовка — отдельная картинка поверх тела, чтобы при выстреле отъезжать и вспыхивать.

import Phaser from 'phaser';
import {
  CORPSE_FRAME,
  GUNNER_FLASH_FRAME,
  GUNNER_LOOK,
  GUNNER_RIFLE_FRAME,
  SOLDIER_FRAME,
  type SoldierLook,
} from '../gfx/looks';
import { bake } from '../gfx/textures';
import type { SpawnContext } from './SpawnContext';
import { Infantry } from './Infantry';
import { RangedEnemy } from './RangedEnemy';

export class GunnerInfantry extends RangedEnemy {
  static readonly walkFps = 7;
  static readonly corpseKey = 'gunner-corpse';
  // Дуло длинной винтовки левее и выше точки ног спрайта.
  static readonly muzzleOffset = { x: -38, y: -42 };
  // Левый верх винтовки внутри кадра солдата 64×80. Рисунок сидит на y = 34.
  static readonly rifleCut = { x: 0, y: 32 };
  // Приклад: отдача сдвигает винтовку вправо и поднимает дуло вокруг этой точки.
  static readonly breech = { x: 44, y: 38 };
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
  // x — пиксели текстуры назад (вправо по картинке). climb — подъём дула в радианах.
  private readonly recoil = { x: 0, climb: 0 };

  // Каждый 3-й индекс из четвёрки: 2, 6, 10, 14...
  // Но 14 ещё и «каждый 5-й хвост» для пикапа (14 % 5 === 4).
  // Пикап в фабрике проверяется раньше, поэтому такой номер станет машиной, не стрелком.
  static matches(index: number): boolean {
    return index % 4 === 2;
  }

  static spawn(ctx: SpawnContext): Infantry {
    return new GunnerInfantry(ctx.scene, ctx.x, ctx.y, ctx.hp, ctx.shots);
  }

  // Кадры шага без винтовки: в бою её рисует отдельный спрайт и двигает при отдаче.
  static ensureTextures(scene: Phaser.Scene): void {
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
  ) {
    // Синяя полоска отличает стрелка от красного штурмовика и жёлтого пикапа.
    super(scene, x, y, hp, 'gunner-0', 'gunner-walk', 0x3a8ad4, shots);
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
    const scale = this.scaleX;
    const breechX = GunnerInfantry.breech.x + this.recoil.x;
    const breechY = GunnerInfantry.breech.y;
    this.rifle.setPosition(
      this.x + (breechX - Infantry.placed.originX * SOLDIER_FRAME.w) * scale,
      this.y + (breechY - Infantry.placed.originY * SOLDIER_FRAME.h) * scale,
    );
    this.rifle.setScale(scale);
    // Дуло слева от приклада. По часовой стрелке срез идёт вверх: из «девяти часов» к «двенадцати».
    this.rifle.setRotation(this.recoil.climb);
    this.rifle.setAlpha(this.alpha);
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
