// Дебаг-круг волн. Наследует появление юнитов у обычной фабрики и подменяет состав.
// Волна 1 — три штурмовика, 5 — босс, 6 — снова три штурмовика.
// Здоровье и скорость всегда как у первого выхода: номер волны их не поднимает.

import { AssaultInfantry } from './AssaultInfantry';
import { EnemyFactory, type EnemySaveKind } from './EnemyFactory';
import { GunnerInfantry } from './GunnerInfantry';
import { Infantry } from './Infantry';
import { PickupTruck } from './PickupTruck';
import { RocketInfantry } from './RocketInfantry';
import { SuperSoldier } from './SuperSoldier';
import type { SpawnContext } from './SpawnContext';

type EnemyKind =
  | typeof AssaultInfantry
  | typeof GunnerInfantry
  | typeof PickupTruck
  | typeof RocketInfantry
  | typeof SuperSoldier;

const CYCLE: EnemyKind[] = [
  AssaultInfantry,
  GunnerInfantry,
  PickupTruck,
  RocketInfantry,
  SuperSoldier,
];

export class DebugEnemyFactory extends EnemyFactory {
  // Пауза между выходами не сжимается: следующий круг такой же, как первый.
  static spawnGap(_wave: number): number {
    return this.timing.spawnGap;
  }

  static isBossWave(wave: number): boolean {
    return wave > 0 && this.kindOn(wave) === SuperSoldier;
  }

  static count(wave: number): number {
    if (wave < 1) {
      return 0;
    }
    return this.isBossWave(wave) ? 1 : 3;
  }

  static create(_index: number, ctx: SpawnContext): Infantry {
    return this.spawnUnit(this.kindOn(ctx.wave), ctx);
  }

  // pace из сохранения не применяем: ранг роста в этом режиме всегда 1.
  // Текущее hp ставим поверх дебютного запаса, чтобы полоска помнила урон.
  static restore(kind: EnemySaveKind, ctx: SpawnContext, hp: number, _pace: number): Infantry {
    const unit = this.spawnUnit(this.kindOfSave(kind), ctx);
    unit.setHealth(hp);
    return unit;
  }

  protected static assaultRank(_wave: number): number {
    return 1;
  }

  protected static bossAppearance(_wave: number): number {
    return 1;
  }

  protected static growthRank(_wave: number, _debutWave: number): number {
    return 1;
  }

  private static kindOn(wave: number): EnemyKind {
    const slot = (Math.max(1, wave) - 1) % CYCLE.length;
    return CYCLE[slot] ?? AssaultInfantry;
  }

  private static kindOfSave(kind: EnemySaveKind): EnemyKind {
    if (kind === 'gunner') {
      return GunnerInfantry;
    }
    if (kind === 'truck') {
      return PickupTruck;
    }
    if (kind === 'rocket') {
      return RocketInfantry;
    }
    if (kind === 'super') {
      return SuperSoldier;
    }
    return AssaultInfantry;
  }
}
