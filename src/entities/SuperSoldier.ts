// Суперсолдат: босс каждой 10-й волны.
// Каждые 5 секунд срывается в случайную точку поля, останавливается и даёт очередь из пулемёта.

import Phaser, { Scene } from 'phaser';
import { enemyHasteOf } from '../gameConfig';
import {
  CORPSE_FRAME,
  GUNNER_FLASH_FRAME,
  SOLDIER_FRAME,
  SUPER_LOOK,
  SUPER_MG_FRAME,
  type SoldierLook,
} from '../gfx/looks';
import { bake } from '../gfx/textures';
import { EnemyShot } from './EnemyShot';
import { Infantry } from './Infantry';
import type { WorldPoint } from './WorldPoint';

type Dash = 'run' | 'burst' | 'idle';

export class SuperSoldier extends Infantry {
  static readonly baseHp = 100;
  static readonly scale = 2;
  static readonly walkFps = 8;
  static readonly corpseKey = 'super-corpse';
  // Новый рывок не чаще чем раз в 5 секунд.
  static readonly relocateMs = 5000;
  static readonly burstCount = 5;
  // Пауза между патронами очереди. Пять выстрелов укладываются в полсекунды.
  static readonly burstGap = 100;
  static readonly shotDamage = 1;
  static readonly shotSpeed = 640;
  static readonly moveSpeed = 220;
  // Прямоугольник, внутри которого он выбирает точку. Левый край правее танка и проволоки.
  static readonly roam = { left: 340, right: 1160, top: 150, bottom: 560 };
  // Левый верх пулемёта внутри кадра солдата. Ствол смотрит влево, к танку.
  static readonly gunCut = { x: 0, y: 31 };
  // Приклад: ось, вокруг которой пулемёт поворачивается к танку и отскакивает.
  static readonly breech = { x: 42, y: 40 };
  // Дульный срез в кадре солдата.
  static readonly muzzleTip = { x: 0, y: 40 };
  // Короткая отдача: очередь частая, длинный откат слипся бы в дрожь.
  static readonly recoilKick = { x: 3, climb: 0.04, ms: 60 };
  static readonly flashPop = { x: 0.85, y: 0.7, ms: 50 };

  static get muzzleOffset(): { x: number; y: number } {
    const point = SuperSoldier.muzzleAt(0, 0, SuperSoldier.scale, 0);
    return { x: point.x, y: point.y };
  }

  readonly coinReward = 10;
  readonly reachesBase = false;
  readonly contactDamage = 0;
  readonly hitRadius = 64;

  private gun!: Phaser.GameObjects.Image;
  private readonly recoil = { x: 0, climb: 0 };
  private aim = 0;
  private readonly shots: Phaser.Physics.Arcade.Group;
  private readonly fireTarget: WorldPoint;
  private phase: Dash = 'idle';
  private clock = 0;
  private destX = 0;
  private destY = 0;
  private dashSpeed = SuperSoldier.moveSpeed;
  private shotsLeft = 0;
  private shotWait = 0;

  static ensureTextures(scene: Scene): void {
    if (!scene.textures.exists('super-0')) {
      bake(scene, 'super-0', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) => this.drawMarch(g, 0, SUPER_LOOK, false));
      bake(scene, 'super-1', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) => this.drawMarch(g, 1, SUPER_LOOK, false));
    }
    if (!scene.textures.exists(this.corpseKey)) {
      bake(scene, this.corpseKey, CORPSE_FRAME.w, CORPSE_FRAME.h, (g) => this.drawCorpse(g, SUPER_LOOK));
    }
    if (!scene.textures.exists('super-gun')) {
      bake(scene, 'super-gun', SUPER_MG_FRAME.w, SUPER_MG_FRAME.h, (g) => this.renderGun(g));
    }
    if (!scene.textures.exists('super-flash')) {
      bake(scene, 'super-flash', GUNNER_FLASH_FRAME.w, GUNNER_FLASH_FRAME.h, (g) => this.renderFlash(g));
    }
    if (!scene.anims.exists('super-walk')) {
      scene.anims.create({
        key: 'super-walk',
        frames: [{ key: 'super-0' }, { key: 'super-1' }],
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
    super(scene, x, y, hp, 'super-0', 'super-walk', 0xff3348);
    this.setScale(SuperSoldier.scale);
    this.hpBarWidth = 54;
    this.syncBar();
    this.shots = shots;
    this.fireTarget = fireTarget;
    this.gun = scene.add.image(x, y, 'super-gun');
    this.gun.setOrigin(
      (SuperSoldier.breech.x - SuperSoldier.gunCut.x) / SUPER_MG_FRAME.w,
      (SuperSoldier.breech.y - SuperSoldier.gunCut.y) / SUPER_MG_FRAME.h,
    );
    this.gun.setDepth(this.depth);
    this.once('destroy', () => {
      this.scene.tweens.killTweensOf(this.recoil);
      this.gun.destroy();
    });
    this.syncGun();
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.syncGun();
  }

  override march(): void {
    this.beginRun();
  }

  override syncPace(): void {
    if (this.reachedWall || this.phase !== 'run') {
      return;
    }
    this.walk();
  }

  override hit(damage?: number): boolean {
    const dead = damage === undefined ? super.hit() : super.hit(damage);
    this.gun.setTint(0xffccaa);
    this.scene.time.delayedCall(70, () => {
      if (this.gun.active) {
        this.gun.clearTint();
      }
    });
    return dead;
  }

  protected override corpseTexture(): string | null {
    return SuperSoldier.corpseKey;
  }

  protected override onDie(slain: boolean): void {
    if (!slain || !this.gun.active) {
      return;
    }
    this.gun.setVisible(false);
  }

  protected override act(delta: number): void {
    const step = delta * enemyHasteOf(this.scene.registry);
    this.clock -= step;

    if (this.phase === 'burst') {
      const done = this.tickBurst(step);
      if (done && this.clock <= 0) {
        this.beginRun();
      }
      return;
    }

    if (this.phase === 'run') {
      if (this.closeEnough(delta)) {
        this.openBurst();
        this.tickBurst(step);
        return;
      }
      if (this.clock <= 0) {
        this.beginRun();
        return;
      }
      this.walk();
      return;
    }

    this.plant();
    if (this.clock <= 0) {
      this.beginRun();
    }
  }

  private beginRun(): void {
    this.pickDest();
    this.dashSpeed = SuperSoldier.moveSpeed + Phaser.Math.Between(-30, 40);
    this.phase = 'run';
    this.clock = SuperSoldier.relocateMs;
    this.walk();
  }

  private pickDest(): void {
    const box = SuperSoldier.roam;
    for (let i = 0; i < 8; i += 1) {
      const x = Phaser.Math.Between(box.left, box.right);
      const y = Phaser.Math.Between(box.top, box.bottom);
      if (Phaser.Math.Distance.Between(this.x, this.y, x, y) >= 180) {
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

  private closeEnough(delta: number): boolean {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.destX, this.destY);
    const step = this.dashSpeed * enemyHasteOf(this.scene.registry) * (delta / 1000);
    return dist <= Math.max(14, step + 2);
  }

  private walk(): void {
    const haste = enemyHasteOf(this.scene.registry);
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.destX, this.destY);
    const speed = this.dashSpeed * haste;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    if (!this.anims.isPlaying) {
      this.play('super-walk');
    }
    this.anims.timeScale = haste;
  }

  private plant(): void {
    this.body?.stop();
    if (this.anims.isPlaying) {
      this.anims.stop();
    }
    if (this.texture.key !== 'super-0') {
      this.setTexture('super-0');
    }
  }

  private openBurst(): void {
    this.phase = 'burst';
    this.shotsLeft = SuperSoldier.burstCount;
    this.shotWait = 0;
    this.plant();
  }

  private tickBurst(step: number): boolean {
    this.plant();
    if (this.shotsLeft <= 0) {
      this.phase = 'idle';
      return true;
    }
    this.shotWait -= step;
    if (this.shotWait > 0) {
      return false;
    }
    this.fireOne();
    this.shotsLeft -= 1;
    this.shotWait = SuperSoldier.burstGap;
    if (this.shotsLeft <= 0) {
      this.phase = 'idle';
      return true;
    }
    return false;
  }

  private fireOne(): void {
    this.aim = SuperSoldier.barrelAngle(
      this.x,
      this.y,
      this.scaleX,
      this.fireTarget.x,
      this.fireTarget.y,
    );
    this.kickGun();
    const shot = SuperSoldier.muzzleAt(this.x, this.y, this.scaleX, this.aim, this.recoil);
    const bullet = new EnemyShot(this.scene, shot.x, shot.y, SuperSoldier.shotDamage);
    this.shots.add(bullet);
    bullet.launch(shot.angle, SuperSoldier.shotSpeed);
    this.flashAt(shot.x, shot.y, shot.angle);
  }

  private kickGun(): void {
    this.scene.tweens.killTweensOf(this.recoil);
    const kick = SuperSoldier.recoilKick;
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

  private flashAt(x: number, y: number, angle: number): void {
    const flash = this.scene.add.image(x, y, 'super-flash').setOrigin(0, 0.5).setDepth(16);
    flash.setRotation(angle);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    const pop = SuperSoldier.flashPop;
    flash.setScale(pop.x, pop.y);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: pop.ms,
      ease: 'Quad.In',
      onComplete: () => flash.destroy(),
    });
  }

  private syncGun(): void {
    if (!this.gun.active || !this.gun.visible) {
      return;
    }
    this.aim = SuperSoldier.barrelAngle(this.x, this.y, this.scaleX, this.fireTarget.x, this.fireTarget.y);
    SuperSoldier.poseGun(this.gun, this.x, this.y, this.scaleX, this.aim, this.recoil);
    this.gun.setAlpha(this.alpha);
  }

  static barrelAngle(anchorX: number, anchorY: number, scale: number, targetX: number, targetY: number): number {
    const mount = SuperSoldier.mountPoint(anchorX, anchorY, scale);
    const at = Phaser.Math.Angle.Between(mount.x, mount.y, targetX, targetY);
    return Phaser.Math.Angle.Wrap(at + Math.PI);
  }

  static muzzleAt(
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number } = { x: 0, climb: 0 },
  ): { x: number; y: number; angle: number } {
    const point = SuperSoldier.muzzlePoint(anchorX, anchorY, scale, aim, recoil);
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
    const mount = SuperSoldier.mountPoint(anchorX, anchorY, scale);
    const tip = SuperSoldier.turned(
      aim,
      SuperSoldier.muzzleTip.x - SuperSoldier.breech.x + recoil.x,
      SuperSoldier.muzzleTip.y - SuperSoldier.breech.y,
      scale,
    );
    return { x: mount.x + tip.x, y: mount.y + tip.y };
  }

  private static mountPoint(anchorX: number, anchorY: number, scale: number): { x: number; y: number } {
    return {
      x: anchorX + (SuperSoldier.breech.x - Infantry.placed.originX * SOLDIER_FRAME.w) * scale,
      y: anchorY + (SuperSoldier.breech.y - Infantry.placed.originY * SOLDIER_FRAME.h) * scale,
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

  static poseGun(
    gun: Phaser.GameObjects.Image,
    anchorX: number,
    anchorY: number,
    scale: number,
    aim: number,
    recoil: { x: number; climb: number },
  ): void {
    const rotation = aim + recoil.climb;
    const muzzle = SuperSoldier.muzzlePoint(anchorX, anchorY, scale, aim, recoil);
    const tip = SuperSoldier.turned(
      rotation,
      SuperSoldier.muzzleTip.x - SuperSoldier.breech.x,
      SuperSoldier.muzzleTip.y - SuperSoldier.breech.y,
      scale,
    );
    gun.setPosition(muzzle.x - tip.x, muzzle.y - tip.y);
    gun.setScale(scale);
    gun.setRotation(rotation);
  }

  static drawMarch(
    g: Phaser.GameObjects.Graphics,
    legPhase: 0 | 1,
    look: SoldierLook,
    withGun = true,
  ): void {
    Infantry.drawSoldier(g, legPhase, look, false);
    g.fillStyle(look.vest);
    g.fillRoundedRect(12, 26, 14, 8, 2);
    g.fillRoundedRect(40, 26, 14, 8, 2);
    if (withGun) {
      this.drawGun(g, look, SuperSoldier.gunCut.x, SuperSoldier.gunCut.y);
    }
  }

  static drawCorpse(g: Phaser.GameObjects.Graphics, look: SoldierLook): void {
    Infantry.drawCorpse(g, look, (pen, colors) => this.drawDroppedGun(pen, colors));
  }

  static renderGun(g: Phaser.GameObjects.Graphics, look: SoldierLook = SUPER_LOOK): void {
    this.drawGun(g, look, 0, 0);
  }

  static renderFlash(g: Phaser.GameObjects.Graphics): void {
    const y = GUNNER_FLASH_FRAME.h / 2;
    g.fillStyle(0xff4a10, 1);
    g.fillTriangle(0, y, 16, 1, 8, y);
    g.fillTriangle(0, y, 16, GUNNER_FLASH_FRAME.h - 1, 8, y);
    g.fillStyle(0xffcc44, 1);
    g.fillTriangle(0, y, 24, 4, 24, GUNNER_FLASH_FRAME.h - 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, y, 3);
  }

  private static drawGun(g: Phaser.GameObjects.Graphics, look: SoldierLook, ox: number, oy: number): void {
    g.fillStyle(look.rifle);
    g.fillRoundedRect(ox, oy + 5, 50, 8, 2);
    g.fillStyle(look.rifleMetal);
    g.fillRect(ox, oy + 6, 8, 6);
    g.fillStyle(look.rifleWood);
    g.fillRect(ox + 12, oy + 7, 18, 4);
    g.fillStyle(look.outline);
    g.fillRoundedRect(ox + 34, oy + 2, 16, 14, 2);
    g.fillStyle(look.rifleWoodLight);
    g.fillRect(ox + 36, oy + 4, 12, 3);
    g.fillStyle(look.vest);
    g.fillRect(ox + 30, oy + 13, 8, 5);
    g.fillStyle(look.rifleWood);
    g.fillRoundedRect(ox + 48, oy + 4, 10, 10, 2);
  }

  private static drawDroppedGun(g: Phaser.GameObjects.Graphics, look: SoldierLook): void {
    g.fillStyle(look.rifle);
    g.fillRoundedRect(6, 64, 36, 6, 2);
    g.fillStyle(look.rifleMetal);
    g.fillRect(4, 63, 8, 8);
    g.fillStyle(look.vest);
    g.fillRect(22, 69, 7, 5);
  }
}
