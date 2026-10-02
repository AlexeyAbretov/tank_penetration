// Состав волны: сколько врагов и кто именно.
// Сцена просит число и создаёт юнита по номеру в этом составе.

import { GAME, gunnerDebutWave, vehicleDebutWave } from '../gameConfig';
import { AssaultInfantry } from './AssaultInfantry';
import { GunnerInfantry } from './GunnerInfantry';
import { Infantry } from './Infantry';
import { PickupTruck } from './PickupTruck';
import type { SpawnContext } from './SpawnContext';

// Сцена и другие файлы по-прежнему могут взять тип рядом с фабрикой.
export type { SpawnContext };

// Класс врага, который фабрика умеет поставить на поле.
type EnemyKind = {
  spawn(ctx: SpawnContext): Infantry;
};

export class EnemyFactory {
  // Новая техника по порядку появления. Пока здесь только пикап: он выходит на 20-й волне.
  // Следующий класс в этом списке выйдет на 30-й, ещё один на 40-й. Пустой слот ничего не добавляет.
  private static readonly vehicles: EnemyKind[] = [PickupTruck];

  private static readonly cache = new Map<number, EnemyKind[]>();

  static count(wave: number): number {
    return this.roster(wave).length;
  }

  // index — порядковый номер врага внутри волны, начиная с 0.
  static create(index: number, ctx: SpawnContext): Infantry {
    const kind = this.roster(ctx.wave)[index] ?? AssaultInfantry;
    return kind.spawn(ctx);
  }

  // До 10-й волны каждый раз +1 пехотинец, на 10-й это стрелок.
  // Дальше +1 юнит раз в 5 волн. Пикап занимает такой шаг на 20-й.
  // Между шагами список тот же. На 100 рост списка останавливается.
  private static roster(wave: number): EnemyKind[] {
    const cached = this.cache.get(wave);
    if (cached) {
      return cached;
    }

    const units: EnemyKind[] = [];
    const push = (kind: EnemyKind) => {
      if (units.length < GAME.waveMaxCount) {
        units.push(kind);
      }
    };

    const seen = Math.min(Math.max(wave, 1), GAME.infantryRampUntil);
    const foot = GAME.waveStartCount + seen - 1;
    // На 10-й волне последний из этих пехотинцев — стрелок, не ещё один штурмовик.
    const withGunner = wave >= gunnerDebutWave();
    const assaults = withGunner ? foot - 1 : foot;
    for (let i = 0; i < assaults; i += 1) {
      push(AssaultInfantry);
    }
    if (withGunner) {
      push(GunnerInfantry);
    }

    for (let w = GAME.infantryRampUntil + 1; w <= wave; w += 1) {
      if (units.length >= GAME.waveMaxCount) {
        break;
      }
      const since = w - GAME.infantryRampUntil;
      if (since % GAME.waveStepEvery !== 0) {
        continue;
      }
      // Дебют техники забирает этот шаг целиком: на 20-й это один пикап, не два юнита.
      const vehicleIndex = this.vehicles.findIndex((_, index) => vehicleDebutWave(index) === w);
      if (vehicleIndex >= 0) {
        push(this.vehicles[vehicleIndex]);
      } else {
        push(this.stepKind(since / GAME.waveStepEvery, w));
      }
    }

    this.cache.set(wave, units);
    return units;
  }

  // Юнит шага «раз в 5 волн», если на этой волне никто не дебютирует.
  // Открытые типы чередуются. Пикап входит в череду после своей 20-й волны.
  private static stepKind(step: number, wave: number): EnemyKind {
    const pool = this.pool(wave);
    return pool[step % pool.length];
  }

  private static pool(wave: number): EnemyKind[] {
    const pool: EnemyKind[] = [AssaultInfantry];
    if (wave >= gunnerDebutWave()) {
      pool.push(GunnerInfantry);
    }
    this.vehicles.forEach((kind, index) => {
      if (vehicleDebutWave(index) < wave) {
        pool.push(kind);
      }
    });
    return pool;
  }
}
