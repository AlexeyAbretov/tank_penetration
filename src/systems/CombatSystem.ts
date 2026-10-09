// Снаряды танка: выстрел, попадания, взрывы, проволока, арт удар и контакт с базой.

import Phaser from 'phaser';
import { ArtilleryStrike, type ArtilleryFlight } from '../entities/ArtilleryStrike';
import { AssaultInfantry } from '../entities/AssaultInfantry';
import { BarbedWire } from '../entities/BarbedWire';
import { Infantry } from '../entities/Infantry';
import { MachineGun } from '../entities/MachineGun';
import { PickupTruck } from '../entities/PickupTruck';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import { createShellBlast } from '../gfx/particles';
import { playArtilleryShot } from './ArtillerySounds';
import type { AssaultExplosion } from './AssaultExplosion';
import type { InfantryDeath } from './InfantryDeath';
import type { PickupExplosion } from './PickupExplosion';
import type { ShopController } from './ShopController';
import type { ImpactSounds } from './ImpactSounds';
import type { TankMgShot } from './TankMgShot';
import type { TankShot } from './TankShot';

type CombatCallbacks = {
  onKill: (coinReward: number) => void;
  onBaseHit: (amount: number) => void;
};

export class CombatSystem {
  private readonly blast: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly shells: Phaser.Physics.Arcade.Group;
  private readonly mgShots: Phaser.Physics.Arcade.Group;
  private mgCooldown = 0;
  private artilleryCooldownMs = 0;
  private readonly strikeKeys: Phaser.Input.Keyboard.Key[] = [];
  private flights: ArtilleryFlight[] = [];
  private salvoTimers: Phaser.Time.TimerEvent[] = [];
  // Сброс отменяет залп, который ещё ждёт конца хлопка.
  private artilleryToken = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tank: Tank,
    private readonly infantry: Phaser.Physics.Arcade.Group,
    private readonly shop: ShopController,
    private readonly callbacks: CombatCallbacks,
    private readonly metaDamage: number,
    private readonly metaBlast: number,
    private readonly tankShot: TankShot,
    private readonly impacts: ImpactSounds,
    private readonly assaultExplosion: AssaultExplosion,
    private readonly pickupExplosion: PickupExplosion,
    private readonly infantryDeath: InfantryDeath,
    private readonly tankMgShot: TankMgShot,
  ) {
    this.blast = createShellBlast(scene);
    this.shells = scene.physics.add.group();
    this.mgShots = scene.physics.add.group();
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.strikeKeys.push(
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE),
      );
    }
  }

  get artilleryCooldown(): number {
    return this.artilleryCooldownMs;
  }

  setArtilleryCooldown(ms: number): void {
    this.artilleryCooldownMs = Math.max(0, ms);
  }

  clearProjectiles(): void {
    this.shells.clear(true, true);
    this.mgShots.clear(true, true);
    this.cancelArtillery();
  }

  setupOverlap(): void {
    this.scene.physics.add.overlap(
      this.shells,
      this.infantry,
      (shellObj, infObj) => {
        const shell = this.asImage(shellObj);
        const unit = this.asInfantry(infObj);
        if (!shell || !unit) {
          return;
        }
        this.detonateShell(shell, unit);
      },
      undefined,
      this,
    );
  }

  shoot(): void {
    const shot = this.tank.tryFire();
    if (shot) {
      this.fireShell(shot.x, shot.y, shot.angle);
      this.tankShot.play();
    }
  }

  // ЛКМ и автострельба — здесь, чтобы сцена не знала про покупки магазина.
  handleFireInput(pointer: Phaser.Input.Pointer): void {
    if (this.tank.hasAutoFire || pointer.leftButtonDown()) {
      this.shoot();
    }
  }

  // Перезарядка идёт и в магазине. Выстрел — только в бою, по клавише 1.
  tickArtillery(delta: number, canFire: boolean): void {
    if (!this.shop.artilleryOwned) {
      return;
    }
    this.artilleryCooldownMs = Math.max(0, this.artilleryCooldownMs - delta);
    if (!canFire || this.artilleryCooldownMs > 0 || !this.strikePressed()) {
      return;
    }
    this.artilleryCooldownMs = ArtilleryStrike.shop.cooldownMs;
    this.launchArtillery();
  }

  private strikePressed(): boolean {
    return this.strikeKeys.some((key) => Phaser.Input.Keyboard.JustDown(key));
  }

  // Сразу хлопок. Снаряды — через секунду после того, как он доиграл.
  private launchArtillery(): void {
    const token = this.artilleryToken;
    const armed = playArtilleryShot(this.scene, () => this.queueShells(token));
    if (!armed) {
      this.queueShells(token);
    }
  }

  private queueShells(token: number): void {
    if (token !== this.artilleryToken) {
      return;
    }
    const timer = this.scene.time.delayedCall(ArtilleryStrike.shop.afterShotMs, () => {
      this.salvoTimers = this.salvoTimers.filter((item) => item !== timer);
      if (token !== this.artilleryToken) {
        return;
      }
      this.releaseShells();
    });
    this.salvoTimers.push(timer);
  }

  private releaseShells(): void {
    const gap = ArtilleryStrike.shop.gapMs;
    ArtilleryStrike.impacts().forEach((point, index) => {
      const timer = this.scene.time.delayedCall(index * gap, () => {
        this.salvoTimers = this.salvoTimers.filter((item) => item !== timer);
        const flight = ArtilleryStrike.drop(this.scene, point.x, point.y, () => {
          this.flights = this.flights.filter((item) => item !== flight);
          this.detonateArtillery(point.x, point.y);
        });
        this.flights.push(flight);
      });
      this.salvoTimers.push(timer);
    });
  }

  private detonateArtillery(x: number, y: number): void {
    ArtilleryStrike.boom(this.scene, x, y);
    const radius = ArtilleryStrike.shop.blastRadius;
    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (!unit.active || unit.reachedWall) {
        return;
      }
      const torso = this.torsoPoint(unit);
      if (Phaser.Math.Distance.Between(x, y, torso.x, torso.y) <= radius) {
        this.hurtInfantry(unit, ArtilleryStrike.shop.damage);
      }
    });
  }

  private cancelArtillery(): void {
    this.artilleryToken += 1;
    for (const timer of this.salvoTimers) {
      timer.remove(false);
    }
    this.salvoTimers = [];
    for (const flight of this.flights) {
      flight.cancel();
    }
    this.flights = [];
  }

  tick(delta: number, allowFire = true): void {
    if (allowFire) {
      this.handleFireInput(this.scene.input.activePointer);
    }
    this.resolveShellHits();
    this.cleanupShells();
    this.tickMachineGun(delta);
    this.resolveMgHits();
    this.cleanupMgShots();
    this.snareOnWire(delta);
    this.checkBaseReach();
  }

  detonateShell(shell: Phaser.Physics.Arcade.Image, direct?: Infantry): void {
    if (!shell.active) {
      return;
    }

    const x = shell.x;
    const y = shell.y;
    shell.destroy();
    this.playBlast(x, y);
    // Один удар на снаряд. Осколки взрыва второй раз не звенят.
    this.impacts.play();

    if (direct) {
      this.hurtInfantry(direct);
    }

    const blastRadius = this.blastRadius();
    if (blastRadius <= 0) {
      return;
    }

    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (unit === direct || !unit.active || unit.reachedWall) {
        return;
      }
      const torso = this.torsoPoint(unit);
      if (Phaser.Math.Distance.Between(x, y, torso.x, torso.y) <= blastRadius) {
        this.hurtInfantry(unit);
      }
    });
  }

  private resolveShellHits(): void {
    const shells = this.shells.getChildren() as Phaser.Physics.Arcade.Image[];
    const units = this.infantry.getChildren() as Infantry[];

    for (const shell of shells) {
      if (!shell.active) {
        continue;
      }
      for (const unit of units) {
        if (!unit.active || unit.reachedWall) {
          continue;
        }
        if (this.shellHitsUnit(shell, unit)) {
          this.detonateShell(shell, unit);
          break;
        }
      }
    }
  }

  private cleanupShells(): void {
    this.shells.getChildren().forEach((obj) => {
      const shell = obj as Phaser.Physics.Arcade.Image;
      if (shell.x > GAME.width + 40 || shell.x < 0 || shell.y < 0 || shell.y > GAME.bannerY) {
        shell.destroy();
      }
    });
  }

  private tickMachineGun(delta: number): void {
    const mg = this.shop.machineGun;
    if (!mg) {
      return;
    }
    this.mgCooldown = Math.max(0, this.mgCooldown - delta);
    if (this.mgCooldown > 0) {
      return;
    }
    const shot = mg.muzzle();
    this.fireMgBullet(shot.x, shot.y, shot.angle);
    this.tankMgShot.play();
    this.mgCooldown = MachineGun.shop.fireIntervalMs;
  }

  private fireMgBullet(x: number, y: number, angle: number): void {
    const bullet = this.scene.physics.add.image(x, y, MachineGun.textureKey);
    this.mgShots.add(bullet);
    bullet.setDepth(14);
    bullet.setBlendMode(Phaser.BlendModes.ADD);
    bullet.setRotation(angle);
    bullet.setVelocity(
      Math.cos(angle) * MachineGun.shop.bulletSpeed,
      Math.sin(angle) * MachineGun.shop.bulletSpeed,
    );
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(6);
  }

  private resolveMgHits(): void {
    const bullets = this.mgShots.getChildren() as Phaser.Physics.Arcade.Image[];
    const units = this.infantry.getChildren() as Infantry[];
    for (const bullet of bullets) {
      if (!bullet.active) {
        continue;
      }
      for (const unit of units) {
        if (!unit.active || unit.reachedWall) {
          continue;
        }
        const torso = this.torsoPoint(unit);
        if (Phaser.Math.Distance.Between(bullet.x, bullet.y, torso.x, torso.y) <= unit.hitRadius * 0.55) {
          bullet.destroy();
          // Тот же удар, что у снаряда: пуля долетела до солдата.
          this.impacts.play();
          this.hurtInfantry(unit, MachineGun.shop.damage);
          break;
        }
      }
    }
  }

  private cleanupMgShots(): void {
    this.mgShots.getChildren().forEach((obj) => {
      const bullet = obj as Phaser.Physics.Arcade.Image;
      if (bullet.x > GAME.width + 40 || bullet.x < 0 || bullet.y < 0 || bullet.y > GAME.bannerY) {
        bullet.destroy();
      }
    });
  }

  private snareOnWire(delta: number): void {
    const wire = this.shop.wire;
    if (!wire) {
      return;
    }
    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (!wire.blocks(unit)) {
        return;
      }
      if (unit.snare(BarbedWire.bounds.face, delta, BarbedWire.shop.hurtIntervalMs)) {
        this.hurtInfantry(unit, BarbedWire.shop.damage, true);
      }
    });
  }

  private checkBaseReach(): void {
    this.infantry.getChildren().forEach((obj) => {
      const unit = obj as Infantry;
      if (!unit.active || unit.reachedWall || !unit.reachesBase) {
        return;
      }
      if (this.meetsTank(unit) || unit.x <= Infantry.baseReachX) {
        this.hitBase(unit);
      }
    });
  }

  // Нос спрайта смотрит к танку. Взрыв в момент, когда он входит в хитбокс,
  // а не когда центр солдата доходит до середины корпуса.
  private meetsTank(unit: Infantry): boolean {
    const nose = unit.x - unit.displayWidth * unit.originX;
    const top = unit.y - unit.displayHeight * unit.originY;
    const chest = unit.y - unit.displayHeight * 0.45;
    return (
      this.tank.containsPoint(nose, top) ||
      this.tank.containsPoint(nose, chest) ||
      this.tank.containsPoint(nose, unit.y)
    );
  }

  private shellHitsUnit(shell: Phaser.Physics.Arcade.Image, unit: Infantry): boolean {
    const torso = this.torsoPoint(unit);
    return Phaser.Math.Distance.Between(shell.x, shell.y, torso.x, torso.y) <= unit.hitRadius;
  }

  private torsoPoint(unit: Infantry): { x: number; y: number } {
    return {
      x: unit.x,
      y: unit.y - unit.displayHeight * 0.42,
    };
  }

  private hurtInfantry(
    unit: Infantry,
    damage = this.shellDamage(),
    wire = false,
  ): void {
    if (unit.hit(damage, wire)) {
      this.callbacks.onKill(unit.coinReward);
      // Пикап — техника: свой взрыв, не крик пехоты.
      // Дошедший до базы сюда не попадает: его убивает hitBase.
      if (unit instanceof PickupTruck) {
        this.pickupExplosion.play();
      } else {
        this.infantryDeath.play();
      }
      unit.kill();
    }
  }

  private hitBase(unit: Infantry): void {
    if (!unit.reachesBase) {
      return;
    }
    if (unit instanceof AssaultInfantry) {
      this.assaultExplosion.play();
    }
    unit.kill();
    this.callbacks.onBaseHit(unit.contactDamage);
  }

  private shellDamage(): number {
    return Infantry.shellDamage + this.shop.damageLevel + this.metaDamage;
  }

  private blastRadius(): number {
    return (this.shop.blastLevel + this.metaBlast) * Tank.blastRadiusPerLevel;
  }

  private playBlast(x: number, y: number): void {
    const radius = this.blastRadius();
    this.blast.emitParticleAt(x, y, radius > 0 ? 16 : 8);
    const flash = this.scene.add.image(x, y, 'muzzle').setDepth(16).setBlendMode(Phaser.BlendModes.ADD);
    flash.setScale(radius > 0 ? 1 : 0.55);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: radius > 0 ? 2.2 : 1.1,
      duration: radius > 0 ? 160 : 90,
      onComplete: () => flash.destroy(),
    });
  }

  private fireShell(x: number, y: number, angle: number): void {
    const shell = this.scene.physics.add.image(x, y, 'shell');
    this.shells.add(shell);
    shell.setDepth(15);
    shell.setBlendMode(Phaser.BlendModes.ADD);
    shell.setRotation(angle);
    shell.setVelocity(
      Math.cos(angle) * Tank.shellSpeed,
      Math.sin(angle) * Tank.shellSpeed,
    );
    const body = shell.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(18);

    const flash = this.scene.add.image(x, y, 'muzzle').setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    flash.setRotation(angle);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: Tank.muzzleFlash.scale,
      duration: Tank.muzzleFlash.ms,
      onComplete: () => flash.destroy(),
    });
  }

  private asImage(
    obj:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): Phaser.Physics.Arcade.Image | null {
    const go = 'gameObject' in obj && obj.gameObject ? obj.gameObject : obj;
    if (!(go instanceof Phaser.Physics.Arcade.Image) || !go.active) {
      return null;
    }
    return go;
  }

  private asInfantry(
    obj:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): Infantry | null {
    const go = 'gameObject' in obj && obj.gameObject ? obj.gameObject : obj;
    if (!(go instanceof Infantry) || !go.active || go.reachedWall) {
      return null;
    }
    return go;
  }
}
