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
  private shells!: Phaser.Physics.Arcade.Group;
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

    this.shells = this.physics.add.group();
    this.enemyShots = this.physics.add.group();
    this.infantry = this.physics.add.group();

    this.hud = new GameHud(this, {
      onBuyBlast: () => this.shop.buyBlast(),
      onBuyDamage: () => this.shop.buyDamage(),
      onBuyWire: () => this.shop.buyWire(),
      onContinue: () => this.shop.closeAndContinue(),
    });

    this.player = new PlayerController(this, this.hud, {
      shells: this.shells,
      enemyShots: this.enemyShots,
      infantry: this.infantry,
    });
    this.player.reset();

    this.shop = new ShopController(this, this.hud, {
      getCoins: () => this.coins,
      spendCoins: (amount) => {
        if (this.coins < amount) {
          return false;
        }
        this.coins -= amount;
        return true;
      },
    }, () => this.waves.beginNextWave());

    this.combat = new CombatSystem(this, this.player.tank, this.shells, this.infantry, {
      getBlastLevel: () => this.shop.blastLevel,
      getDamageLevel: () => this.shop.damageLevel,
      getWire: () => this.shop.wire,
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
    this.waves.scheduleFirstWave();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.player.isGameOver) {
        if (this.hud.defeatOverlayVisible) {
          this.scene.restart();
        }
        return;
      }
      if (this.shop.shopOpen) {
        return;
      }
      if (pointer.leftButtonDown()) {
        this.combat.shoot();
      }
    });
  }

  update(_time: number, delta: number): void {
    if (this.player.isGameOver || this.shop.shopOpen) {
      return;
    }

    const pointer = this.input.activePointer;
    this.player.tick(delta, pointer.worldX, pointer.worldY);

    if (pointer.leftButtonDown()) {
      this.combat.shoot();
    }

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
