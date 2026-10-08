// Главная сцена. Phaser один раз вызывает create(), потом каждый кадр — update().
// Сцена собирает системы и держит общее состояние партии.

import Phaser from 'phaser';
import { EnemyShot } from '../entities/EnemyShot';
import { Infantry } from '../entities/Infantry';
import { ENEMY_HASTE, GAME, PAUSED, enemyHasteOf } from '../gameConfig';
import { createAmbientEmbers } from '../gfx/particles';
import { ensureGameTextures } from '../gfx/ensureGameTextures';
import { CombatSystem } from '../systems/CombatSystem';
import { PlayerController } from '../systems/PlayerController';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { clearRun, loadRun, saveRun } from '../systems/RunSave';
import { ShopController } from '../systems/ShopController';
import { WaveManager } from '../systems/WaveManager';
import { GameHud } from '../ui/GameHud';

export class GameScene extends Phaser.Scene {
  private enemyShots!: Phaser.Physics.Arcade.Group;
  private infantry!: Phaser.Physics.Arcade.Group;

  private hud!: GameHud;
  private player!: PlayerController;
  private combat!: CombatSystem;
  private waves!: WaveManager;
  private shop!: ShopController;
  private projectiles!: ProjectileSystem;

  private score = 0;
  private coins = 0;
  private paused = false;
  private pausedPhysics = false;
  private resumeRequested = false;
  private resumeArmed = false;
  private pausedEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private hasteKey?: Phaser.Input.Keyboard.Key;
  private hasteNumpad?: Phaser.Input.Keyboard.Key;
  private pauseKey?: Phaser.Input.Keyboard.Key;
  private persistEnabled = false;
  private autosaveMs = 0;
  private readonly onPageHide = (): void => {
    this.writeSave();
  };

  constructor() {
    super('game');
  }

  preload(): void {
    this.load.image('tank-hull', 'assets/tank-hull.png');
    this.load.image('tank-turret', 'assets/tank-turret.png');
    this.load.image('tank-gun', 'assets/tank-gun.png');
    this.load.image('tank-mg', 'assets/tank-mg.png');
  }

  create(): void {
    ensureGameTextures(this);
    this.score = 0;
    this.coins = 0;
    this.registry.set('combat', true);
    this.registry.set(ENEMY_HASTE.key, 1);
    this.registry.set(PAUSED, false);
    this.paused = false;
    this.pausedPhysics = false;
    this.resumeRequested = false;
    this.resumeArmed = false;
    this.pausedEmitters = [];
    this.time.paused = false;
    this.persistEnabled = false;
    this.autosaveMs = 0;

    this.add.image(GAME.width / 2, GAME.height / 2, 'battlefield').setDepth(0);
    createAmbientEmbers(this);
    this.input.mouse?.disableContextMenu();

    this.enemyShots = this.physics.add.group();
    this.infantry = this.physics.add.group();

    this.hud = new GameHud(this);
    this.hud.setHaste(1);
    this.hud.onHasteCycle(() => {
      if (!this.paused) {
        this.cycleEnemyHaste();
      }
    });
    this.hud.onPause(() => this.setPaused(true));
    this.hud.onResume(() => {
      this.resumeRequested = true;
    });
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.hasteKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
      this.hasteNumpad = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO);
      this.pauseKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }
    this.events.once('shutdown', this.onShutdown, this);

    let combat: CombatSystem | undefined;
    this.player = new PlayerController(this, this.hud, {
      enemyShots: this.enemyShots,
      infantry: this.infantry,
      clearPlayerCombat: () => combat?.clearProjectiles(),
    });
    this.player.reset();

    this.shop = new ShopController(
      this,
      this.hud,
      this.player.tank,
      {
        getCoins: () => this.coins,
        spendCoins: (amount) => {
          if (this.coins < amount) {
            return false;
          }
          this.coins -= amount;
          return true;
        },
      },
      () => this.waves.beginNextWave(),
      () => this.writeSave(),
    );

    combat = this.combat = new CombatSystem(this, this.player.tank, this.infantry, this.shop, {
      onKill: (reward) => this.onEnemyKill(reward),
      onBaseHit: (amount) => this.onBaseHit(amount),
    });
    this.combat.setupOverlap();

    this.waves = new WaveManager(
      this,
      this.infantry,
      this.enemyShots,
      this.hud,
      () => this.player.isGameOver,
      () => this.shop.open(),
      () => this.writeSave(),
    );

    this.projectiles = new ProjectileSystem(
      this,
      this.player.tank,
      this.enemyShots,
      (amount) => this.onBaseHit(amount),
    );

    this.applyCameraFx();
    this.continueRun(loadRun());
    this.persistEnabled = true;

    this.input.on('pointerdown', () => {
      if (this.player.isGameOver && this.hud.defeatOverlayVisible) {
        this.persistEnabled = false;
        clearRun();
        this.scene.restart();
      }
    });

    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onTabHidden, this);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('beforeunload', this.onPageHide);
    if (document.hidden) {
      this.setPaused(true);
    }
  }

  update(_time: number, delta: number): void {
    if (this.player.isGameOver) {
      return;
    }

    if (this.paused) {
      const resume = this.resumeArmed && (this.resumeRequested || this.pausePressed());
      this.resumeRequested = false;
      if (resume) {
        this.setPaused(false);
      } else {
        this.resumeArmed = true;
      }
      return;
    }

    if (this.pausePressed()) {
      this.setPaused(true);
      return;
    }

    if (this.hastePressed()) {
      this.cycleEnemyHaste();
    }

    const fighting = !this.shop.shopOpen;
    this.combat.tickArtillery(delta, fighting);
    this.hud.setArtillery(this.shop.artilleryOwned, this.combat.artilleryCooldown);
    if (!fighting) {
      return;
    }

    const pointer = this.input.activePointer;
    this.player.tick(delta, pointer.worldX, pointer.worldY);

    this.combat.tick(delta, !this.hud.coversHaste(pointer) && !this.hud.coversPause(pointer));
    this.projectiles.tick();
    this.waves.tick();
    this.touchAutosave(delta);
  }

  // Ранний выход из update не останавливает физику, таймеры, твины и анимации.
  // Магазин уже держит физику на паузе — тогда мир не трогаем, чтобы не отпустить врагов.
  private setPaused(paused: boolean): void {
    if (this.paused === paused || (paused && this.player.isGameOver)) {
      return;
    }
    this.paused = paused;
    this.registry.set(PAUSED, paused);
    this.time.paused = paused;
    if (paused) {
      this.resumeRequested = false;
      this.resumeArmed = false;
      this.tweens.pauseAll();
      this.anims.pauseAll();
      this.freezeEmitters();
      if (!this.physics.world.isPaused) {
        this.physics.world.pause();
        this.pausedPhysics = true;
      }
    } else {
      this.tweens.resumeAll();
      this.anims.resumeAll();
      this.thawEmitters();
      if (this.pausedPhysics) {
        this.physics.world.resume();
        this.pausedPhysics = false;
      }
    }
    this.hud.setPaused(paused);
    this.shop.panel.coverForPause(paused);
    if (paused) {
      this.writeSave();
    }
  }

  private onTabHidden(): void {
    if (this.player.isGameOver) {
      return;
    }
    this.writeSave();
    if (this.paused) {
      return;
    }
    this.setPaused(true);
  }

  private onShutdown(): void {
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onTabHidden, this);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('beforeunload', this.onPageHide);
    if (this.paused) {
      this.anims.resumeAll();
    }
  }

  private freezeEmitters(): void {
    const held: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
    this.children.each((child) => {
      if (child instanceof Phaser.GameObjects.Particles.ParticleEmitter && child.active) {
        child.pause();
        held.push(child);
      }
    });
    this.pausedEmitters = held;
  }

  private thawEmitters(): void {
    for (const emitter of this.pausedEmitters) {
      if (emitter.scene) {
        emitter.resume();
      }
    }
    this.pausedEmitters = [];
  }

  private hastePressed(): boolean {
    const keyDown = (key?: Phaser.Input.Keyboard.Key) =>
      key !== undefined && Phaser.Input.Keyboard.JustDown(key);
    return keyDown(this.hasteKey) || keyDown(this.hasteNumpad);
  }

  private pausePressed(): boolean {
    return this.pauseKey !== undefined && Phaser.Input.Keyboard.JustDown(this.pauseKey);
  }

  private cycleEnemyHaste(): void {
    if (this.player.isGameOver) {
      return;
    }
    const current = enemyHasteOf(this.registry);
    const next = current >= ENEMY_HASTE.max ? 1 : current + 1;
    this.registry.set(ENEMY_HASTE.key, next);
    this.hud.setHaste(next);
    this.writeSave();
    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (unit.active) {
        unit.syncPace();
      }
    });
    (this.enemyShots.getChildren() as EnemyShot[]).forEach((shot) => {
      if (shot.active) {
        shot.syncPace();
      }
    });
  }

  private onEnemyKill(coinReward: number): void {
    this.score += 10;
    this.coins += coinReward;
    this.hud.setScore(this.score);
    this.hud.setCoins(this.coins);
    this.writeSave();
  }

  private onBaseHit(amount: number): void {
    this.player.damage(amount);
    if (this.player.isGameOver) {
      this.persistEnabled = false;
      clearRun();
      return;
    }
    this.writeSave();
  }

  private continueRun(saved: ReturnType<typeof loadRun>): void {
    if (!saved) {
      this.shop.syncTankStats();
      this.waves.scheduleFirstWave();
      return;
    }

    this.score = saved.score;
    this.coins = saved.coins;
    this.hud.setScore(this.score);
    this.hud.setCoins(this.coins);
    this.player.restoreHealth(saved.hp);
    this.shop.restore(saved.shop);
    this.shop.syncTankStats();
    this.combat.setArtilleryCooldown(saved.artilleryCooldownMs);
    this.registry.set(ENEMY_HASTE.key, saved.haste);
    this.hud.setHaste(saved.haste);
    if (saved.phase === 'shop') {
      this.waves.resumeShop(saved.wave);
      this.shop.open();
      return;
    }
    this.waves.resumeCombat(saved.wave, saved.spawned, saved.enemies);
  }

  private touchAutosave(delta: number): void {
    this.autosaveMs += delta;
    if (this.autosaveMs < 400) {
      return;
    }
    this.autosaveMs = 0;
    this.writeSave();
  }

  private writeSave(): void {
    if (!this.persistEnabled || this.player.isGameOver) {
      return;
    }
    const wave = this.waves.capture();
    if (!wave) {
      return;
    }
    saveRun({
      version: 1,
      score: this.score,
      coins: this.coins,
      hp: this.player.health,
      haste: enemyHasteOf(this.registry),
      artilleryCooldownMs: Math.round(this.combat.artilleryCooldown),
      wave: wave.wave,
      phase: wave.phase,
      spawned: wave.spawned,
      enemies: wave.enemies,
      shop: this.shop.capture(),
    });
  }

  private applyCameraFx(): void {
    const camera = this.cameras.main;
    try {
      camera.filters.internal.addVignette(0.5, 0.5, 0.85, 0.18);
    } catch {
      // Виньетка необязательна.
    }
    try {
      Phaser.Actions.AddEffectBloom(camera, {
        threshold: 0.62,
        blurRadius: 1.2,
        blurSteps: 3,
      });
    } catch {
      // Bloom необязателен.
    }
  }
}
