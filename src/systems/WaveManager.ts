// Волны врагов: объявление, спавн и переход в магазин после зачистки.

import Phaser from 'phaser';
import { EnemyFactory } from '../entities/EnemyFactory';
import { Infantry } from '../entities/Infantry';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import type { GameHud } from '../ui/GameHud';
import type { EnemySave, WavePhase } from './RunSave';

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
    private readonly onProgress: () => void,
  ) {}

  capture(): { wave: number; phase: WavePhase; spawned: number; enemies: EnemySave[] } | null {
    if (this.wave < 1) {
      return null;
    }
    if (this.awaitingClear) {
      return { wave: this.wave, phase: 'shop', spawned: 0, enemies: [] };
    }
    const total = EnemyFactory.count(this.wave);
    const enemies: EnemySave[] = [];
    for (const unit of this.infantry.getChildren() as Infantry[]) {
      if (!unit.active || unit.reachedWall) {
        continue;
      }
      const kind = EnemyFactory.kindOf(unit);
      if (!kind) {
        continue;
      }
      enemies.push({
        kind,
        x: unit.x,
        y: unit.y,
        hp: unit.hp,
        pace: unit.paceRank,
      });
    }
    return {
      wave: this.wave,
      phase: 'combat',
      spawned: Math.max(0, total - this.remainingToSpawn),
      enemies,
    };
  }

  // Волна уже зачищена, магазин ещё открыт. Номер не увеличиваем: «дальше» само вызовет следующую.
  resumeShop(wave: number): void {
    this.wave = wave;
    this.remainingToSpawn = 0;
    this.awaitingClear = true;
    this.hud.setWave(wave);
  }

  // Середина волны: живые враги встают на сохранённые места, ещё не вышедшие доспавниваются.
  resumeCombat(wave: number, spawned: number, enemies: EnemySave[]): void {
    this.wave = wave;
    this.awaitingClear = false;
    this.hud.setWave(wave);
    for (const enemy of enemies) {
      this.restoreEnemy(enemy);
    }
    const total = EnemyFactory.count(wave);
    const already = Math.min(total, Math.max(spawned, enemies.length));
    this.remainingToSpawn = total - already;
    if (already === 0) {
      this.hud.showWaveBanner(wave);
      this.scene.time.delayedCall(EnemyFactory.timing.announceMs, () => {
        if (this.isGameOver()) {
          return;
        }
        this.releaseFrom(0);
      });
      return;
    }
    this.releaseFrom(already);
  }

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

    this.onProgress();
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
    this.onProgress();
  }

  private releaseWave(): void {
    this.releaseFrom(0);
  }

  private releaseFrom(startIndex: number): void {
    const total = EnemyFactory.count(this.wave);
    const gap = Math.max(
      EnemyFactory.timing.minGap,
      EnemyFactory.timing.spawnGap - (this.wave - 1) * 28,
    );

    for (let i = startIndex; i < total; i += 1) {
      this.scene.time.delayedCall((i - startIndex) * gap, () => {
        if (this.isGameOver()) {
          return;
        }
        this.spawnInfantry(i);
        this.remainingToSpawn = Math.max(0, this.remainingToSpawn - 1);
      });
    }
  }

  private restoreEnemy(enemy: EnemySave): void {
    const unit = EnemyFactory.restore(
      enemy.kind,
      {
        scene: this.scene,
        x: enemy.x,
        y: enemy.y,
        wave: this.wave,
        shots: this.enemyShots,
        fireTarget: Tank.aimPoint(),
      },
      enemy.hp,
      enemy.pace,
    );
    this.infantry.add(unit);
    unit.march();
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
