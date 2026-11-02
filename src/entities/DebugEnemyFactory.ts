// Дебаг-круг волн. Наследует появление юнитов у обычной фабрики и подменяет состав.
// Волна 1 — штурмовики, 5 — босс, 6 — снова штурмовики.
// Обычных в волне по умолчанию трое. Поле в настройках пишет число в localStorage, потолок 50.
// Босс остаётся один. Здоровье и скорость растут с номером волны.
// Ранг обычного юнита — сам номер: круг видов не держит его на дебюте обычной партии.
// Босс толстеет и бьёт больнее с каждым своим выходом: 5-я волна — первое появление, 10-я — второе.

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

  // Монеты одного юнита этой волны. У волны один вид, поэтому номер в очереди не важен.
  // Пропуск платит эту сумму тем, кто ещё не вышел, и спрайт для них не создаёт.
  static coinReward(wave: number): number {
    if (wave < 1) {
      return 0;
    }
    return this.kindOn(wave).coinReward;
  }

  static create(_index: number, ctx: SpawnContext): Infantry {
    return this.spawnUnit(this.kindOn(ctx.wave), ctx);
  }

  // pace из сохранения не нужен: ранг уже посчитан по номеру волны.
  // Текущее hp ставим поверх этого запаса, чтобы полоска помнила урон.
  static restore(kind: EnemySaveKind, ctx: SpawnContext, hp: number, _pace: number): Infantry {
    const unit = this.spawnUnit(this.kindOfSave(kind), ctx);
    unit.setHealth(hp);
    return unit;
  }

  // Дебют обычной партии здесь не при чём: стрелок выходит на 2-й волне, пикап на 3-й.
  // Ранг равен номеру волны, поэтому 7-я быстрее и толще 2-й.
  protected static growthRank(wave: number, _debutWave: number): number {
    return Math.max(1, wave);
  }

  // В круге босс каждый 5-й номер. Запас считает номер появления, не номер волны обычной партии.
  protected static bossAppearance(wave: number): number {
    return Math.max(1, Math.floor(wave / CYCLE.length));
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
