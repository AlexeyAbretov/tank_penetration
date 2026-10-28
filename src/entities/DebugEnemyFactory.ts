// Дебаг-круг волн. Наследует появление юнитов у обычной фабрики и подменяет состав.
// Волна 1 — штурмовики, 5 — босс, 6 — снова штурмовики.
// Обычных в волне по умолчанию трое. Поле в настройках пишет число в localStorage, потолок 50.
// Босс остаётся один. Здоровье и скорость всегда как у первого выхода.

import { AssaultInfantry } from './AssaultInfantry';
import { EnemyFactory } from './EnemyFactory';
import type { EnemySaveKind } from '../types/EnemySave';
import { GunnerInfantry } from './GunnerInfantry';
import { Infantry } from './Infantry';
import { PickupTruck } from './PickupTruck';
import { RocketInfantry } from './RocketInfantry';
import { SuperSoldier } from './SuperSoldier';
import type { SpawnContext } from '../types/SpawnContext';

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

// Свой ключ, не ключ партии: «новая игра» стирает бой, а размер волны остаётся.
const WAVE_COUNT_KEY = 'tank-penetration-wave-count:debug';
const DEFAULT_REGULAR_COUNT = 3;
const REGULAR_MAX = 50;

export class DebugEnemyFactory extends EnemyFactory {
  // Потолок обычной волны. Поле в настройках выше не ставит.
  // Клавиша A останавливается здесь же и может перейти число из поля.
  // Ниже одного обычная волна не опускается: пустой выход сразу бы её закрыл.
  static readonly regularMax = REGULAR_MAX;
  private static regularCount = readRegularCount();

  static regularCountOf(): number {
    return this.regularCount;
  }

  static setRegularCount(count: number): void {
    const whole = Math.trunc(count);
    if (!Number.isFinite(whole)) {
      return;
    }
    this.regularCount = Math.min(this.regularMax, Math.max(1, whole));
    writeRegularCount(this.regularCount);
  }

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
    return this.isBossWave(wave) ? 1 : this.regularCount;
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

function readRegularCount(): number {
  try {
    const raw = localStorage.getItem(WAVE_COUNT_KEY);
    if (raw === null) {
      return DEFAULT_REGULAR_COUNT;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return DEFAULT_REGULAR_COUNT;
    }
    return Math.min(REGULAR_MAX, Math.max(1, Math.trunc(value)));
  } catch {
    return DEFAULT_REGULAR_COUNT;
  }
}

function writeRegularCount(count: number): void {
  try {
    localStorage.setItem(WAVE_COUNT_KEY, String(count));
  } catch {
    // Приватный режим: число работает, пока открыта вкладка.
  }
}
