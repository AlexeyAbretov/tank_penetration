// Главная сцена. Phaser один раз вызывает create(), потом каждый кадр — update().
// Сцена собирает системы и держит общее состояние партии.

import Phaser from 'phaser';
import { EnemyShot } from '../entities/EnemyShot';
import { Infantry } from '../entities/Infantry';
import { ENEMY_HASTE, GAME, enemyHasteOf } from '../gameConfig';
import { createAmbientEmbers } from '../gfx/particles';
import { ensureGameTextures } from '../gfx/ensureGameTextures';
import { CombatSystem } from '../systems/CombatSystem';
import { PlayerController } from '../systems/PlayerController';
import { ProjectileSystem } from '../systems/ProjectileSystem';
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
  private hasteKey?: Phaser.Input.Keyboard.Key;
  private hasteNumpad?: Phaser.Input.Keyboard.Key;

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

    this.add.image(GAME.width / 2, GAME.height / 2, 'battlefield').setDepth(0);
    createAmbientEmbers(this);
    this.input.mouse?.disableContextMenu();

    this.enemyShots = this.physics.add.group();
    this.infantry = this.physics.add.group();

    this.hud = new GameHud(this);
    this.hud.setHaste(1);
    this.hud.onHasteCycle(() => this.cycleEnemyHaste());
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.hasteKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
      this.hasteNumpad = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO);
    }

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
    );

    combat = this.combat = new CombatSystem(this, this.player.tank, this.infantry, this.shop, {
      onKill: (reward) => this.onEnemyKill(reward),
      onBaseHit: (amount) => this.player.damage(amount),
    });
    this.combat.setupOverlap();

    this.waves = new WaveManager(
      this,
      this.infantry,
      this.enemyShots,
      this.hud,
      () => this.player.isGameOver,
      () => this.shop.open(),
    );

    this.projectiles = new ProjectileSystem(
      this,
      this.player.tank,
      this.enemyShots,
      (amount) => this.player.damage(amount),
    );

    this.applyCameraFx();
    this.shop.syncTankStats();
    this.waves.scheduleFirstWave();

    this.input.on('pointerdown', () => {
      if (this.player.isGameOver && this.hud.defeatOverlayVisible) {
        this.scene.restart();
      }
    });
  }

  update(_time: number, delta: number): void {
    if (this.player.isGameOver) {
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

    this.combat.tick(delta, !this.hud.coversHaste(pointer));
    this.projectiles.tick();
    this.waves.tick();
  }

  private hastePressed(): boolean {
    const keyDown = (key?: Phaser.Input.Keyboard.Key) =>
      key !== undefined && Phaser.Input.Keyboard.JustDown(key);
    return keyDown(this.hasteKey) || keyDown(this.hasteNumpad);
  }

  private cycleEnemyHaste(): void {
    if (this.player.isGameOver) {
      return;
    }
    const current = enemyHasteOf(this.registry);
    const next = current >= ENEMY_HASTE.max ? 1 : current + 1;
    this.registry.set(ENEMY_HASTE.key, next);
    this.hud.setHaste(next);
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
