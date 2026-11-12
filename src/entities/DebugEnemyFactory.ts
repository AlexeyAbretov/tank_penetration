// Дебаг-круг волн. Наследует появление юнитов у обычной фабрики и подменяет состав.
// Круг длиннее списка видов на шесть волн: сначала каждый вид своей волной,
// потом смешанная, потом суперсолдат, потом тяжёлый танк, потом дрономатка, потом БТР,
// потом общая: эти четыре босса по одному. Она замыкает круг.
// С вертолётом это двенадцать: 1–6 один вид, 7-я все обычные по одному,
// 8-я суперсолдат, 9-я танк, 10-я дрономатка, 11-я БТР, 12-я все боссы по одному.
// Дальше круг сначала: 20, 21, 22, 23 и 24 — боссы второго круга.
// Обычных в волне по умолчанию трое. Поле в настройках пишет число в localStorage, потолок 50.
// Смешанная волна и босс это число не читают. Здоровье и скорость растут с номером волны.
// Ранг обычного юнита — сам номер: круг видов не держит его на дебюте обычной партии.
// Босс толстеет и бьёт больнее с каждым кругом: 8-я, 9-я, 10-я, 11-я и 12-я — первое появление.
// Число суперсолдат на своей волне то же, что в партии: три выхода на одном составе, потолок пять.
// Волна танка всегда из одного. Общая волна это число не растит: всегда по одному телу.
// Дрономатка на своей волне: три первых круга одна, с четвёртого две, больше двух не бывает.
// На общей волне она тоже одна. БТР на своей волне и на общей всегда один.
// Появление здесь — волна / длину круга.
// Монеты считает та же касса, что в партии: номер выхода умножается на 25, тела делят сумму.

import { AssaultInfantry } from './AssaultInfantry';
import { Btr } from './Btr';
import { DroneCarrier } from './DroneCarrier';
import { HeavyTank } from './HeavyTank';
import { Helicopter } from './Helicopter';
import { EnemyFactory } from './EnemyFactory';
import type { EnemySaveKind } from '../types/EnemySave';
import { GunnerInfantry } from './GunnerInfantry';
import { Infantry } from './Infantry';
import { PickupTruck } from './PickupTruck';
import { RocketBuggy } from './RocketBuggy';
import { RocketInfantry } from './RocketInfantry';
import { SuperSoldier } from './SuperSoldier';
import type { SpawnContext } from '../types/SpawnContext';

type EnemyKind =
  | typeof AssaultInfantry
  | typeof Btr
  | typeof DroneCarrier
  | typeof GunnerInfantry
  | typeof HeavyTank
  | typeof Helicopter
  | typeof PickupTruck
  | typeof RocketBuggy
  | typeof RocketInfantry
  | typeof SuperSoldier;

// Виды смешанной волны и круг обычных волн. Боссы сюда не входят.
const REGULAR: EnemyKind[] = [
  AssaultInfantry,
  GunnerInfantry,
  PickupTruck,
  RocketInfantry,
  RocketBuggy,
  Helicopter,
];

// Общая босс-волна, по одному и в этом порядке. Касса делится на длину списка.
const PARADE: EnemyKind[] = [SuperSoldier, HeavyTank, DroneCarrier, Btr];

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

  // Свои волны боссов не смешиваются. Общая после БТР берёт список PARADE:
  // здесь только суперсолдат и танк, дрономатка и БТР прибавляются своими счётчиками.
  // Танк на своей волне всегда один. Волна дрономатки и волна БТР других боссов не берут.
  static override bossCount(wave: number): number {
    if (this.isAllBossWave(wave)) {
      return this.paradeOf(SuperSoldier) + this.paradeOf(HeavyTank);
    }
    if (this.isCarrierWave(wave) || this.isBtrWave(wave)) {
      return 0;
    }
    if (this.isTankWave(wave)) {
      return 1;
    }
    return super.bossCount(wave);
  }

  static override carrierCount(wave: number): number {
    if (this.isAllBossWave(wave)) {
      return this.paradeOf(DroneCarrier);
    }
    if (!this.isCarrierWave(wave)) {
      return 0;
    }
    const step = Math.floor((this.bossAppearance(wave) - 1) / this.boss.hold);
    return Math.min(DroneCarrier.maxOnField, 1 + step);
  }

  static override btrCount(wave: number): number {
    if (this.isAllBossWave(wave)) {
      return this.paradeOf(Btr);
    }
    return this.isBtrWave(wave) ? 1 : 0;
  }

  static isBossWave(wave: number): boolean {
    return (
      this.isSuperWave(wave) ||
      this.isTankWave(wave) ||
      this.isCarrierWave(wave) ||
      this.isBtrWave(wave) ||
      this.isAllBossWave(wave)
    );
  }

  static isSuperWave(wave: number): boolean {
    const cycle = this.cycle();
    return wave > 0 && wave % cycle === cycle - 4;
  }

  static isTankWave(wave: number): boolean {
    const cycle = this.cycle();
    return wave > 0 && wave % cycle === cycle - 3;
  }

  static isCarrierWave(wave: number): boolean {
    const cycle = this.cycle();
    return wave > 0 && wave % cycle === cycle - 2;
  }

  static isBtrWave(wave: number): boolean {
    const cycle = this.cycle();
    return wave > 0 && wave % cycle === cycle - 1;
  }

  // Последняя волна круга. С шестью видами это 12, 24, 36…
  static isAllBossWave(wave: number): boolean {
    return wave > 0 && wave % this.cycle() === 0;
  }

  // Волна перед суперсолдатом в том же круге. С шестью видами это 7, 19, 31…
  static isMixedWave(wave: number): boolean {
    const cycle = this.cycle();
    return wave > 0 && wave % cycle === cycle - 5;
  }

  static override bossTitle(wave: number): string | null {
    if (this.isAllBossWave(wave)) {
      return 'ВСЕ БОССЫ';
    }
    if (this.isBtrWave(wave)) {
      return 'БТР';
    }
    if (this.isCarrierWave(wave)) {
      return 'ДРОНОМАТКА';
    }
    if (this.isTankWave(wave)) {
      return 'ТЯЖЁЛЫЙ ТАНК';
    }
    if (this.isSuperWave(wave)) {
      return 'СУПЕРСОЛДАТ';
    }
    return null;
  }

  static count(wave: number): number {
    if (wave < 1) {
      return 0;
    }
    if (this.isBossWave(wave)) {
      return this.bossCount(wave) + this.carrierCount(wave) + this.btrCount(wave);
    }
    if (this.isMixedWave(wave)) {
      return REGULAR.length;
    }
    return this.regularCount;
  }

  // Монеты юнита на этом месте очереди. У обычной волны вид один, номер не важен.
  // У босса доля зависит от места: касса делится на все тела волны, остаток — первым.
  // На общей волне это четверо, поэтому пропуск платит ту же долю, что и убийство.
  // В смешанной у каждого места свой вид. Пропуск платит сумму и спрайт для них не создаёт.
  static coinReward(wave: number, index = 0): number {
    if (wave < 1) {
      return 0;
    }
    const kind = this.kindAt(wave, index);
    const bodies = this.bossCount(wave) + this.carrierCount(wave) + this.btrCount(wave);
    if (kind === SuperSoldier) {
      return SuperSoldier.coinsForBody(this.bossAppearance(wave), index, bodies);
    }
    if (kind === HeavyTank) {
      return HeavyTank.coinsForBody(this.bossAppearance(wave), index, bodies);
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
    if (kind === RocketBuggy) {
      return RocketBuggy.coinReward;
    }
    if (kind === Helicopter) {
      return Helicopter.coinReward;
    }
    if (kind === DroneCarrier) {
      return DroneCarrier.coinsForBody(this.bossAppearance(wave), index, bodies);
    }
    if (kind === Btr) {
      return Btr.coinsForBody(this.bossAppearance(wave), index, bodies);
    }
    return AssaultInfantry.coinReward;
  }

  static create(index: number, ctx: SpawnContext): Infantry {
    return this.spawnUnit(this.kindAt(ctx.wave, index), ctx, index);
  }

  // pace из сохранения не нужен: ранг уже посчитан по номеру волны.
  // Текущее hp ставим поверх этого запаса, чтобы полоска помнила урон.
  // slot — место в очереди. У босса от него доля кассы. Старое сохранение без места даёт 0.
  static restore(
    kind: EnemySaveKind,
    ctx: SpawnContext,
    hp: number,
    _pace: number,
    slot = 0,
    dropped = 0,
  ): Infantry {
    const unit = this.spawnUnit(this.kindOfSave(kind), ctx, slot, dropped);
    unit.setHealth(hp);
    return unit;
  }

  // Дебют обычной партии здесь не при чём: стрелок выходит на 2-й волне, пикап на 3-й.
  // Ранг равен номеру волны, поэтому 7-я быстрее и толще 2-й.
  protected static growthRank(wave: number, _debutWave: number): number {
    return Math.max(1, wave);
  }

  // Номер круга. У суперсолдата и танка одного круга он общий: оба впервые на нём с запасом 1.
  protected static bossAppearance(wave: number): number {
    return Math.max(1, Math.ceil(wave / this.cycle()));
  }

  // В дебаге выход танка и дрономатки считает круги, а не десятки партии.
  protected static override tankShowing(wave: number): number {
    return this.bossAppearance(wave);
  }

  protected static override carrierShowing(wave: number): number {
    return this.bossAppearance(wave);
  }

  protected static override btrShowing(wave: number): number {
    return this.bossAppearance(wave);
  }

  // Обычная волна — один слот круга, пока не дошли до смешанной.
  // Смешанная отдаёт вид по месту в очереди. Добавка с клавиши A идёт по тому же списку.
  // Общая босс-волна отдаёт вид по месту: суперсолдат, танк, дрономатка, БТР.
  private static kindAt(wave: number, index: number): EnemyKind {
    if (this.isAllBossWave(wave)) {
      return PARADE[index] ?? SuperSoldier;
    }
    if (this.isBtrWave(wave)) {
      return Btr;
    }
    if (this.isCarrierWave(wave)) {
      return DroneCarrier;
    }
    if (this.isTankWave(wave)) {
      return HeavyTank;
    }
    if (this.isBossWave(wave)) {
      return SuperSoldier;
    }
    if (this.isMixedWave(wave)) {
      return REGULAR[index % REGULAR.length] ?? AssaultInfantry;
    }
    const slot = (Math.max(1, wave) - 1) % this.cycle();
    return REGULAR[slot] ?? AssaultInfantry;
  }

  // Виды по одному, затем смешанная, затем четыре своих босс-волны и общая.
  private static cycle(): number {
    return REGULAR.length + 6;
  }

  // Сколько тел этого вида стоит в общей волне.
  private static paradeOf(kind: EnemyKind): number {
    return PARADE.filter((item) => item === kind).length;
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
    if (kind === 'buggy') {
      return RocketBuggy;
    }
    if (kind === 'heli') {
      return Helicopter;
    }
    if (kind === 'super') {
      return SuperSoldier;
    }
    if (kind === 'tank') {
      return HeavyTank;
    }
    if (kind === 'carrier') {
      return DroneCarrier;
    }
    if (kind === 'btr') {
      return Btr;
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
