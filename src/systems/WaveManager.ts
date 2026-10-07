// Волны врагов: объявление, спавн и переход в магазин после зачистки.

import Phaser from 'phaser';
import { EnemyFactory } from '../entities/EnemyFactory';
import { Infantry } from '../entities/Infantry';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import type { GameHud } from '../ui/GameHud';

export class WaveManager {
  wave = 0;
  remainingToSpawn = 0;
  awaitingClear = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly infantry: Phaser.Physics.Arcade.Group,
    private readonly enemyShots: Phaser.Physics.Arcade.Group,
    private readonly hud: GameHud,
    private readonly isGameOver: () => boolean,
    private readonly onWaveCleared: () => void,
  ) {}

  reset(): void {
    this.wave = 0;
    this.remainingToSpawn = 0;
    this.awaitingClear = true;
  }

  scheduleFirstWave(): void {
    this.scene.time.delayedCall(EnemyFactory.timing.startDelayMs, () => this.beginNextWave());
  }

  beginNextWave(): void {
    if (this.isGameOver()) {
      return;
    }

    this.wave += 1;
    this.awaitingClear = false;
    this.remainingToSpawn = EnemyFactory.count(this.wave);
    this.hud.setWave(this.wave);
    this.hud.showWaveBanner(this.wave);

    this.scene.time.delayedCall(EnemyFactory.timing.announceMs, () => {
      if (this.isGameOver()) {
        return;
      }
      this.releaseWave();
    });
  }

  tick(): void {
    if (this.isGameOver() || this.awaitingClear || this.remainingToSpawn > 0) {
      return;
    }
    if (this.livingInfantryCount() > 0) {
      return;
    }
    this.awaitingClear = true;
    this.onWaveCleared();
  }

  private releaseWave(): void {
    const count = this.remainingToSpawn;
    const gap = Math.max(
      EnemyFactory.timing.minGap,
      EnemyFactory.timing.spawnGap - (this.wave - 1) * 28,
    );

    for (let i = 0; i < count; i += 1) {
      this.scene.time.delayedCall(i * gap, () => {
        if (this.isGameOver()) {
          return;
        }
        this.spawnInfantry(i);
        this.remainingToSpawn = Math.max(0, this.remainingToSpawn - 1);
      });
    }
  }

  private spawnInfantry(index = 0): void {
    if (this.isGameOver()) {
      return;
    }

    const lanes = [176, 248, 320, 392, 464, 536];
    const y = lanes[Phaser.Math.Between(0, lanes.length - 1)] + Phaser.Math.Between(-16, 16);
    const x = GAME.width + 24 + Phaser.Math.Between(0, 70);
    const unit = EnemyFactory.create(index, {
      scene: this.scene,
      x,
      y,
      wave: this.wave,
      shots: this.enemyShots,
      fireTarget: Tank.aimPoint(),
    });
    this.infantry.add(unit);
    unit.march();
  }

  private livingInfantryCount(): number {
    return (this.infantry.getChildren() as Infantry[]).filter(
      (unit) => unit.active && !unit.reachedWall,
    ).length;
  }
}
