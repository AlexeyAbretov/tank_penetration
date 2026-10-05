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

type EnemyKind = typeof AssaultInfantry | typeof GunnerInfantry | typeof PickupTruck | typeof RocketInfantry;

export class EnemyFactory {
  // Новые враги по порядку появления. Пикап — 20-я волна, ракетчик — 30-я.
  // Следующий класс в этом списке выйдет на 40-й. Пустой слот ничего не добавляет.
  private static readonly vehicles: EnemyKind[] = [PickupTruck, RocketInfantry];

  static readonly wave = {
    startCount: 5,
    infantryRampUntil: GunnerInfantry.debutWave,
    stepEvery: 5,
    maxCount: 100,
    vehicleEvery: 10,
  };

  static readonly timing = {
    spawnGap: 340,
    minGap: 150,
    announceMs: 1300,
    startDelayMs: 700,
  };

  private static readonly cache = new Map<number, EnemyKind[]>();

  static count(wave: number): number {
    return this.roster(wave).length;
  }

  // index — порядковый номер врага внутри волны, начиная с 0.
  static create(index: number, ctx: SpawnContext): Infantry {
    const kind = this.roster(ctx.wave)[index] ?? AssaultInfantry;
    return this.spawnUnit(kind, ctx);
  }

  static vehicleDebutWave(index: number): number {
    return EnemyFactory.wave.vehicleEvery * (index + 2);
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

  // До волны infantryRampUntil каждый раз +1 пехотинец, на ней — стрелок.
  // Дальше +1 юнит раз в stepEvery волн. Пикап занимает такой шаг на 20-й.
  // Между шагами список тот же. На maxCount рост списка останавливается.
  private static roster(wave: number): EnemyKind[] {
    const cached = this.cache.get(wave);
    if (cached) {
      return cached;
    }

    const { startCount, infantryRampUntil, stepEvery, maxCount } = EnemyFactory.wave;
    const units: EnemyKind[] = [];
    const push = (enemyKind: EnemyKind) => {
      if (units.length < maxCount) {
        units.push(enemyKind);
      }
    };

    const seen = Math.min(Math.max(wave, 1), infantryRampUntil);
    const foot = startCount + seen - 1;
    const withGunner = wave >= infantryRampUntil;
    const assaults = withGunner ? foot - 1 : foot;
    for (let i = 0; i < assaults; i += 1) {
      push(AssaultInfantry);
    }
    if (withGunner) {
      push(GunnerInfantry);
    }

    for (let w = infantryRampUntil + 1; w <= wave; w += 1) {
      if (units.length >= maxCount) {
        break;
      }
      const since = w - infantryRampUntil;
      if (since % stepEvery !== 0) {
        continue;
      }
      const vehicleIndex = this.vehicles.findIndex((_, index) => this.vehicleDebutWave(index) === w);
      if (vehicleIndex >= 0) {
        push(this.vehicles[vehicleIndex]);
      } else {
        push(this.stepKind(since / stepEvery, w));
      }
    }

    this.cache.set(wave, units);
    return units;
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
    this.vehicles.forEach((_, index) => {
      if (this.vehicleDebutWave(index) < wave) {
        pool.push(this.vehicles[index]);
      }
    });
    return pool;
  }
}
