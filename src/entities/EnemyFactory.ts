// Состав волны: сколько врагов и кто именно.
// Сцена просит число и создаёт юнита по номеру в этом составе.

import { AssaultInfantry } from './AssaultInfantry';
import { GunnerInfantry } from './GunnerInfantry';
import { Infantry } from './Infantry';
import { PickupTruck } from './PickupTruck';
import { RocketInfantry } from './RocketInfantry';
import type { SpawnContext } from './SpawnContext';

export type { SpawnContext } from './SpawnContext';
export type { WorldPoint } from './WorldPoint';

// Короткое имя вида для сохранения. Имя класса после сборки может измениться.
export const ENEMY_KINDS = ['assault', 'gunner', 'truck', 'rocket'] as const;
export type EnemySaveKind = (typeof ENEMY_KINDS)[number];

type EnemyKind = typeof AssaultInfantry | typeof GunnerInfantry | typeof PickupTruck | typeof RocketInfantry;

export class EnemyFactory {
  // Техника с debutWave. Порядок в пуле шагов — по возрастанию debutWave.
  private static readonly vehicles: EnemyKind[] = [PickupTruck, RocketInfantry];

  static readonly wave = {
    startCount: 5,
    infantryRampUntil: GunnerInfantry.debutWave,
    stepEvery: 5,
    maxCount: 100,
  };

  static readonly timing = {
    spawnGap: 340,
    minGap: 150,
    announceMs: 1300,
    startDelayMs: 700,
  };

  static count(wave: number): number {
    return this.roster(wave).length;
  }

  // index — порядковый номер врага внутри волны, начиная с 0.
  static create(index: number, ctx: SpawnContext): Infantry {
    const kind = this.roster(ctx.wave)[index] ?? AssaultInfantry;
    return this.spawnUnit(kind, ctx);
  }

  static kindOf(unit: Infantry): EnemySaveKind | null {
    if (unit instanceof PickupTruck) {
      return 'truck';
    }
    if (unit instanceof RocketInfantry) {
      return 'rocket';
    }
    if (unit instanceof GunnerInfantry) {
      return 'gunner';
    }
    if (unit instanceof AssaultInfantry) {
      return 'assault';
    }
    return null;
  }

  // Собирает уже вышедшего врага на сохранённом месте. Запас здоровья берётся из ранга,
  // как при обычном спавне, а полоска ставится на оставшиеся hp.
  static restore(kind: EnemySaveKind, ctx: SpawnContext, hp: number, pace: number): Infantry {
    const rankHp = Infantry.waveHp(pace);
    const unit = this.spawnSaved(kind, ctx, rankHp);
    unit.setPaceWave(pace);
    unit.setHealth(hp);
    return unit;
  }

  private static spawnSaved(kind: EnemySaveKind, ctx: SpawnContext, rankHp: number): Infantry {
    const { scene, x, y, shots, fireTarget } = ctx;
    if (kind === 'assault') {
      return new AssaultInfantry(scene, x, y, rankHp);
    }
    if (kind === 'gunner') {
      return new GunnerInfantry(scene, x, y, rankHp, shots, fireTarget);
    }
    if (kind === 'truck') {
      return new PickupTruck(scene, x, y, rankHp, shots, fireTarget);
    }
    return new RocketInfantry(scene, x, y, rankHp, shots, fireTarget);
  }

  private static debutWave(kind: EnemyKind): number {
    if (kind === GunnerInfantry) {
      return GunnerInfantry.debutWave;
    }
    if (kind === PickupTruck) {
      return PickupTruck.debutWave;
    }
    if (kind === RocketInfantry) {
      return RocketInfantry.debutWave;
    }
    return 1;
  }

  private static spawnUnit(kind: EnemyKind, ctx: SpawnContext): Infantry {
    const { scene, x, y, wave, shots, fireTarget } = ctx;

    if (kind === AssaultInfantry) {
      const unit = new AssaultInfantry(scene, x, y, Infantry.waveHp(wave));
      unit.setPaceWave(wave);
      return unit;
    }

    if (kind === GunnerInfantry) {
      const rank = Infantry.growthRank(wave, GunnerInfantry.debutWave);
      const unit = new GunnerInfantry(scene, x, y, Infantry.waveHp(rank), shots, fireTarget);
      unit.setPaceWave(rank);
      return unit;
    }

    if (kind === PickupTruck) {
      const rank = Infantry.growthRank(wave, PickupTruck.debutWave);
      const unit = new PickupTruck(scene, x, y, Infantry.waveHp(rank), shots, fireTarget);
      unit.setPaceWave(rank);
      return unit;
    }

    const rank = Infantry.growthRank(wave, RocketInfantry.debutWave);
    const unit = new RocketInfantry(scene, x, y, Infantry.waveHp(rank), shots, fireTarget);
    unit.setPaceWave(rank);
    return unit;
  }

  // Симуляция волн 1..N: рост штурмовиков, дебют стрелка, debutWave техники, шаги после стрелка.
  private static roster(wave: number): EnemyKind[] {
    if (wave < 1) {
      return [];
    }

    const { startCount, infantryRampUntil, stepEvery, maxCount } = EnemyFactory.wave;
    const units: EnemyKind[] = [];
    const push = (enemyKind: EnemyKind) => {
      if (units.length < maxCount) {
        units.push(enemyKind);
      }
    };

    for (let w = 1; w <= wave; w += 1) {
      if (units.length >= maxCount) {
        break;
      }

      if (w === 1) {
        const gunnerFromStart = infantryRampUntil <= 1;
        const assaults = gunnerFromStart ? Math.max(0, startCount - 1) : startCount;
        for (let i = 0; i < assaults; i += 1) {
          push(AssaultInfantry);
        }
        if (gunnerFromStart) {
          push(GunnerInfantry);
        }
        this.pushVehicleDebut(w, push);
        continue;
      }

      if (w < infantryRampUntil) {
        push(AssaultInfantry);
        this.pushVehicleDebut(w, push);
        continue;
      }

      if (w === infantryRampUntil) {
        push(GunnerInfantry);
        this.pushVehicleDebut(w, push);
        continue;
      }

      const vehicleDebut = this.vehicles.find((kind) => this.debutWave(kind) === w);
      if (vehicleDebut) {
        push(vehicleDebut);
        continue;
      }

      const since = w - infantryRampUntil;
      if (since % stepEvery === 0) {
        push(this.stepKind(since / stepEvery, w));
      }
    }

    return units;
  }

  private static pushVehicleDebut(w: number, push: (kind: EnemyKind) => void): void {
    const kind = this.vehicles.find((k) => this.debutWave(k) === w);
    if (kind) {
      push(kind);
    }
  }

  private static stepKind(step: number, wave: number): EnemyKind {
    const pool = this.pool(wave);
    return pool[step % pool.length];
  }

  private static pool(wave: number): EnemyKind[] {
    const pool: EnemyKind[] = [AssaultInfantry];
    if (wave >= this.wave.infantryRampUntil) {
      pool.push(GunnerInfantry);
    }
    const debuted = [...this.vehicles]
      .filter((kind) => this.debutWave(kind) < wave)
      .sort((a, b) => this.debutWave(a) - this.debutWave(b));
    pool.push(...debuted);
    return pool;
  }
}
