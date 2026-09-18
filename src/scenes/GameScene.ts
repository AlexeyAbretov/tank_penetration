import Phaser from 'phaser';
import { Infantry } from '../entities/Infantry';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import { createAnimations, createTextures } from '../gfx/textures';

export class GameScene extends Phaser.Scene {
  private tank!: Tank;
  private shells!: Phaser.Physics.Arcade.Group;
  private infantry!: Phaser.Physics.Arcade.Group;
  private hpFill!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private blast!: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers!: Phaser.GameObjects.Particles.ParticleEmitter;

  private hp: number = GAME.baseHp;
  private score = 0;
  private spawnDelay = 1300;
  private elapsed = 0;
  private gameOver = false;

  constructor() {
    super('game');
  }

  create(): void {
    if (!this.textures.exists('battlefield')) {
      createTextures(this);
    }
    createAnimations(this);

    this.hp = GAME.baseHp;
    this.score = 0;
    this.spawnDelay = 900;
    this.elapsed = 0;
    this.gameOver = false;

    this.add.image(GAME.width / 2, GAME.height / 2, 'battlefield').setDepth(0);

    this.embers = this.add.particles(700, 360, 'ember', {
      x: { min: 40, max: 1260 },
      y: { min: 80, max: 620 },
      lifespan: { min: 900, max: 2200 },
      speedY: { min: -40, max: -12 },
      speedX: { min: -12, max: 18 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.7, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      frequency: 80,
      quantity: 1,
    });
    this.embers.setDepth(2);

    this.blast = this.add.particles(0, 0, 'spark', {
      lifespan: 380,
      speed: { min: 60, max: 280 },
      scale: { start: 1.3, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
      quantity: 18,
    });
    this.blast.setDepth(16);

    this.tank = new Tank(this, GAME.tankX, GAME.tankY);
    this.input.mouse?.disableContextMenu();

    this.shells = this.physics.add.group();
    this.infantry = this.physics.add.group();

    this.physics.add.overlap(
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

    this.createUi();
    this.applyCameraFx();
    this.spawnInfantry();
    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => this.maybeSpawn(),
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.gameOver) {
        this.scene.restart();
        return;
      }
      if (pointer.leftButtonDown()) {
        this.shoot();
      }
    });
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) {
      return;
    }

    this.elapsed += delta;
    const pointer = this.input.activePointer;
    this.tank.tick(delta);
    this.tank.aimAt(pointer.worldX, pointer.worldY);

    if (pointer.leftButtonDown()) {
      this.shoot();
    }

    this.resolveShellHits();

    this.shells.getChildren().forEach((obj) => {
      const shell = obj as Phaser.Physics.Arcade.Image;
      if (shell.x > GAME.width + 40 || shell.x < 0 || shell.y < 0 || shell.y > GAME.bannerY) {
        shell.destroy();
      }
    });

    this.infantry.getChildren().forEach((obj) => {
      const unit = obj as Infantry;
      if (!unit.active || unit.reachedWall) {
        return;
      }
      if (unit.x <= GAME.reachX) {
        this.hitBase(unit);
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

  private shellHitsUnit(shell: Phaser.Physics.Arcade.Image, unit: Infantry): boolean {
    const torso = this.torsoPoint(unit);
    return Phaser.Math.Distance.Between(shell.x, shell.y, torso.x, torso.y) <= GAME.shellHitRadius;
  }

  private torsoPoint(unit: Infantry): { x: number; y: number } {
    return {
      x: unit.x,
      y: unit.y - unit.displayHeight * 0.42,
    };
  }

  private detonateShell(shell: Phaser.Physics.Arcade.Image, direct?: Infantry): void {
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

    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (unit === direct || !unit.active || unit.reachedWall) {
        return;
      }
      const torso = this.torsoPoint(unit);
      if (Phaser.Math.Distance.Between(x, y, torso.x, torso.y) <= GAME.blastRadius) {
        this.hurtInfantry(unit);
      }
    });
  }

  private hurtInfantry(unit: Infantry): void {
    if (unit.hit()) {
      this.score += 10;
      this.scoreText.setText(`SCORE  ${this.score}`);
      unit.kill();
    }
  }

  private playBlast(x: number, y: number): void {
    this.blast.emitParticleAt(x, y, 16);
    const flash = this.add.image(x, y, 'muzzle').setDepth(16).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2.2,
      duration: 160,
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

  private maybeSpawn(): void {
    if (this.gameOver) {
      return;
    }
    const rate = Math.max(420, this.spawnDelay - this.elapsed * 0.04);
    if (Math.random() > 200 / rate) {
      return;
    }
    const pack = this.elapsed > 25000 ? Phaser.Math.Between(1, 3) : 1;
    for (let i = 0; i < pack; i += 1) {
      this.time.delayedCall(i * 180, () => this.spawnInfantry());
    }
  }

  private shoot(): void {
    const shot = this.tank.tryFire();
    if (shot) {
      this.fireShell(shot.x, shot.y, shot.angle);
    }
  }

  private spawnInfantry(): void {
    if (this.gameOver) {
      return;
    }
    const y = Phaser.Math.Between(150, 560);
    const unit = new Infantry(this, GAME.width + 20, y);
    this.infantry.add(unit);
    unit.march();
  }

  private fireShell(x: number, y: number, angle: number): void {
    const shell = this.physics.add.image(x, y, 'shell');
    this.shells.add(shell);
    shell.setDepth(15);
    shell.setBlendMode(Phaser.BlendModes.ADD);
    shell.setRotation(angle);
    shell.setVelocity(Math.cos(angle) * GAME.shellSpeed, Math.sin(angle) * GAME.shellSpeed);
    const body = shell.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(18);

    const flash = this.add.image(x, y, 'muzzle').setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    flash.setRotation(angle);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.6,
      duration: 90,
      onComplete: () => flash.destroy(),
    });
  }

  private hitBase(unit: Infantry): void {
    unit.kill();
    this.hp = Math.max(0, this.hp - GAME.infantryDamage);
    this.hpFill.width = 236 * (this.hp / GAME.baseHp);
    this.cameras.main.shake(160, 0.008);
    this.cameras.main.flash(80, 180, 20, 10, false);
    if (this.hp <= 0) {
      this.endGame();
    }
  }

  private createUi(): void {
    this.add.image(GAME.width / 2, 677, 'banner').setDepth(50);

    this.add
      .text(GAME.width / 2, 678, 'TANK', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '42px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(51);

    this.scoreText = this.add
      .text(28, 18, 'SCORE  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f3d56a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setDepth(51);

    this.add
      .text(GAME.width / 2, 708, 'мышь — прицел   ЛКМ — огонь', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#e8c48a',
      })
      .setOrigin(0.5)
      .setDepth(51)
      .setAlpha(0.8);

    this.add.image(1128, 28, 'hp-frame').setDepth(51);
    this.add.rectangle(1018, 28, 236, 10, 0x2a0a0a).setOrigin(0, 0.5).setDepth(51);
    this.hpFill = this.add.rectangle(1018, 28, 236, 10, 0xd42a2a).setOrigin(0, 0.5).setDepth(52);

    this.overlay = this.add.container(GAME.width / 2, GAME.height / 2).setDepth(80).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.55);
    const title = this.add
      .text(0, -24, 'БАЗА РАЗБИТА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '48px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(0, 36, 'Кликните, чтобы начать снова', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);
    this.overlay.add([dim, title, hint]);
  }

  private applyCameraFx(): void {
    const camera = this.cameras.main;
    try {
      camera.filters.internal.addVignette(0.5, 0.5, 0.85, 0.18);
    } catch {
      // Vignette signature may differ between Phaser 4 minor versions.
    }
    try {
      Phaser.Actions.AddEffectBloom(camera, {
        threshold: 0.62,
        blurRadius: 1.2,
        blurSteps: 3,
      });
    } catch {
      // Bloom is optional atmosphere; gameplay does not depend on it.
    }
  }

  private endGame(): void {
    this.gameOver = true;
    this.infantry.getChildren().forEach((obj) => {
      (obj as Infantry).body?.stop();
    });
    this.overlay.setVisible(true);
  }
}
