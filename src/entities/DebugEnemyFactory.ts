// Дебаг-круг волн. Наследует появление юнитов у обычной фабрики и подменяет состав.
// Круг из шести волн. 1–4 — один вид: штурмовик, стрелок, пикап, ракетчик.
// 5-я — все эти виды по одному, без босса. 6-я — босс. Дальше круг сначала: 11 и 12, 17 и 18.
// Обычных в волне по умолчанию трое. Поле в настройках пишет число в localStorage, потолок 50.
// Смешанная волна и босс это число не читают. Здоровье и скорость растут с номером волны.
// Ранг обычного юнита — сам номер: круг видов не держит его на дебюте обычной партии.
// Босс толстеет и бьёт больнее с каждым своим выходом: 6-я волна — первое появление, 12-я — второе.
// Число на поле то же, что в партии: три выхода на одном составе, потолок пять. Появление здесь — волна / 6.
// Монеты считает та же касса, что в партии: номер выхода умножается на 25, тела делят сумму.

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

// Виды смешанной волны и круг обычных волн. Суперсолдат сюда не входит: он только на 6-й.
const REGULAR: EnemyKind[] = [
  AssaultInfantry,
  GunnerInfantry,
  PickupTruck,
  RocketInfantry,
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
    return wave > 0 && wave % 6 === 0;
  }

  // 5, 11, 17… Волна перед боссом в том же круге из шести.
  static isMixedWave(wave: number): boolean {
    return wave > 0 && wave % 6 === 5;
  }

  static count(wave: number): number {
    if (wave < 1) {
      return 0;
    }
    if (this.isBossWave(wave)) {
      return this.bossCount(wave);
    }
    if (this.isMixedWave(wave)) {
      return REGULAR.length;
    }
    return this.regularCount;
  }

  // Монеты юнита на этом месте очереди. У обычной волны вид один, номер не важен.
  // У босса доля зависит от места: касса делится на число тел, остаток — первым.
  // В смешанной у каждого места свой вид. Пропуск платит сумму и спрайт для них не создаёт.
  static coinReward(wave: number, index = 0): number {
    if (wave < 1) {
      return 0;
    }
    const kind = this.kindAt(wave, index);
    if (kind === SuperSoldier) {
      return SuperSoldier.coinsForBody(this.bossAppearance(wave), index, this.bossCount(wave));
    }
    if (kind === GunnerInfantry) {
      return GunnerInfantry.coinReward;
    }
    if (kind === PickupTruck) {
      return PickupTruck.coinReward;
    }
    if (kind === RocketInfantry) {
      return RocketInfantry.coinReward;
    }
    return AssaultInfantry.coinReward;
  }

  static create(index: number, ctx: SpawnContext): Infantry {
    return this.spawnUnit(this.kindAt(ctx.wave, index), ctx, index);
  }

  // pace из сохранения не нужен: ранг уже посчитан по номеру волны.
  // Текущее hp ставим поверх этого запаса, чтобы полоска помнила урон.
  // slot — место в очереди. У босса от него доля кассы. Старое сохранение без места даёт 0.
  static restore(kind: EnemySaveKind, ctx: SpawnContext, hp: number, _pace: number, slot = 0): Infantry {
    const unit = this.spawnUnit(this.kindOfSave(kind), ctx, slot);
    unit.setHealth(hp);
    return unit;
  }

  // Дебют обычной партии здесь не при чём: стрелок выходит на 2-й волне, пикап на 3-й.
  // Ранг равен номеру волны, поэтому 7-я быстрее и толще 2-й.
  protected static growthRank(wave: number, _debutWave: number): number {
    return Math.max(1, wave);
  }

  // Босс выходит на 6, 12, 18… Запас считает номер появления, не номер волны обычной партии.
  protected static bossAppearance(wave: number): number {
    return Math.max(1, Math.floor(wave / 6));
  }

  // Обычная волна — один из первых четырёх слотов круга.
  // Смешанная отдаёт вид по месту в очереди. Добавка с клавиши A идёт по тому же списку.
  private static kindAt(wave: number, index: number): EnemyKind {
    if (this.isBossWave(wave)) {
      return SuperSoldier;
    }
    if (this.isMixedWave(wave)) {
      return REGULAR[index % REGULAR.length] ?? AssaultInfantry;
    }
    const slot = (Math.max(1, wave) - 1) % 6;
    return REGULAR[slot] ?? AssaultInfantry;
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
