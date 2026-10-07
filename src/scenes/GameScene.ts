// Главная сцена. Phaser один раз вызывает create(), потом каждый кадр — update().
// Сцена собирает системы и держит общее состояние партии.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
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

  constructor() {
    super('game');
  }

  create(): void {
    ensureGameTextures(this);
    this.score = 0;
    this.coins = 0;
    this.registry.set('combat', true);

    this.add.image(GAME.width / 2, GAME.height / 2, 'battlefield').setDepth(0);
    createAmbientEmbers(this);
    this.input.mouse?.disableContextMenu();

    this.enemyShots = this.physics.add.group();
    this.infantry = this.physics.add.group();

    this.hud = new GameHud(this);

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

    const fighting = !this.shop.shopOpen;
    this.combat.tickArtillery(delta, fighting);
    this.hud.setArtillery(this.shop.artilleryOwned, this.combat.artilleryCooldown);
    if (!fighting) {
      return;
    }

    const pointer = this.input.activePointer;
    this.player.tick(delta, pointer.worldX, pointer.worldY);

    this.combat.tick(delta);
    this.projectiles.tick();
    this.waves.tick();
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
