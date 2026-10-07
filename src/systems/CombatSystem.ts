// Снаряды танка: выстрел, попадания, взрывы, проволока и контакт с базой.

import Phaser from 'phaser';
import { BarbedWire } from '../entities/BarbedWire';
import { Infantry } from '../entities/Infantry';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import { createShellBlast } from '../gfx/particles';

type CombatDeps = {
  getBlastLevel: () => number;
  getDamageLevel: () => number;
  getWire: () => BarbedWire | undefined;
  onKill: (coinReward: number) => void;
  onBaseHit: (amount: number) => void;
};

export class CombatSystem {
  private readonly blast: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tank: Tank,
    private readonly shells: Phaser.Physics.Arcade.Group,
    private readonly infantry: Phaser.Physics.Arcade.Group,
    private readonly deps: CombatDeps,
  ) {
    this.blast = createShellBlast(scene);
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
    }
  }

  // ЛКМ и автострельба — здесь, чтобы сцена не знала про покупки магазина.
  handleFireInput(pointer: Phaser.Input.Pointer): void {
    if (this.tank.hasAutoFire || pointer.leftButtonDown()) {
      this.shoot();
    }
  }

  tick(delta: number): void {
    this.handleFireInput(this.scene.input.activePointer);
    this.resolveShellHits();
    this.cleanupShells();
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

    if (direct) {
      this.hurtInfantry(direct);
    }

    const blastRadius = this.deps.getBlastLevel() * Tank.blastRadiusPerLevel;
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

  private snareOnWire(delta: number): void {
    const wire = this.deps.getWire();
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
      if (!unit.active || unit.reachedWall) {
        return;
      }
      if (unit.x <= Infantry.baseReachX) {
        this.hitBase(unit);
      }
    });
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
    damage = Infantry.shellDamage + this.deps.getDamageLevel(),
    wire = false,
  ): void {
    if (unit.hit(damage, wire)) {
      this.deps.onKill(unit.coinReward);
      unit.kill();
    }
  }

  private hitBase(unit: Infantry): void {
    if (!unit.reachesBase) {
      return;
    }
    unit.kill();
    this.deps.onBaseHit(unit.contactDamage);
  }

  private playBlast(x: number, y: number): void {
    const radius = this.deps.getBlastLevel() * Tank.blastRadiusPerLevel;
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
