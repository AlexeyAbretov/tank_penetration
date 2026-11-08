// Состав волны: сколько врагов и кто именно.
// WaveManager знает только номер в списке. Кого создать — решает этот класс.
// roster проигрывает волны с 1-й до текущей и складывает отряд заново.
// Так дебют стрелка на 3-й волне сам появляется и в составе 15-й.

import { AssaultInfantry } from './AssaultInfantry';
import { GunnerInfantry } from './GunnerInfantry';
import { Infantry } from './Infantry';
import { HeavyTank } from './HeavyTank';
import { Helicopter } from './Helicopter';
import { PickupTruck } from './PickupTruck';
import { RocketBuggy } from './RocketBuggy';
import { RocketInfantry } from './RocketInfantry';
import { SuperSoldier } from './SuperSoldier';
import type { SpawnContext } from '../types/SpawnContext';
import type { EnemySaveKind } from '../types/EnemySave';
import type { WaveUnit } from '../types/WaveUnit';

export type { SpawnContext } from '../types/SpawnContext';
export type { WorldPoint } from '../types/WorldPoint';
export type { EnemySaveKind } from '../types/EnemySave';
export { ENEMY_KINDS } from '../types/EnemySave';

type EnemyKind =
  | typeof AssaultInfantry
  | typeof GunnerInfantry
  | typeof HeavyTank
  | typeof Helicopter
  | typeof PickupTruck
  | typeof RocketBuggy
  | typeof RocketInfantry
  | typeof SuperSoldier;

export class EnemyFactory {
  // Техника со своим debutWave. В пул шагов попадает по возрастанию этой волны.
  // Пикап дебютирует на 10-й, ракетчик на 20-й, багги на 30-й, вертолёт на 40-й.
  // pool() сортирует по этому номеру, поэтому порядок в массиве на круг не влияет.
  private static readonly vehicles: EnemyKind[] = [PickupTruck, RocketInfantry, RocketBuggy, Helicopter];

  static readonly wave = {
    // Штурмовиков в самой первой волне.
    startCount: 5,
    // До этой волны отряд растёт пехотой. Число берётся у стрелка, сейчас это 3.
    infantryRampUntil: GunnerInfantry.debutWave,
    // После стрелка новый враг добавляется раз в столько волн: 8, 13, 18…
    stepEvery: 5,
    // Дальше push молча отбрасывает юнита. История волн при этом доигрывается.
    maxCount: 100,
  };

  static readonly timing = {
    // Миллисекунды между появлениями на 1-й волне. Каждая следующая волна паузу сокращает.
    spawnGap: 340,
    // Короче этого интервала враги не выходят.
    minGap: 150,
    // Сколько висит «ВОЛНА» или «БОСС», прежде чем первый враг шагнёт на поле.
    announceMs: 1300,
    // Пауза после загрузки новой партии. Сохранённый бой этот таймер не ждёт.
    startDelayMs: 700,
  };

  static readonly boss = {
    // Сколько своих выходов состав держит одно число, прежде чем выйдет ещё один.
    // У партии это 10–30-я — один, 40–60-я — двое, дальше тем же шагом.
    hold: 3,
    // Дальше новые тела не добавляются. Запас и урон продолжают расти с номером появления.
    maxCount: 5,
  };

  // 28 мс короче за каждую волну после первой, но не ниже minGap.
  static spawnGap(wave: number): number {
    const steps = Math.max(0, wave - 1);
    return Math.max(this.timing.minGap, this.timing.spawnGap - steps * 28);
  }

  // 10, 20, 30… На экран выходят боссы: нечётный выход — суперсолдат, чётный — тяжёлый танк.
  // Со второго тела на поле оба: чётные места очереди держит ведущий, нечётные — другой.
  // Сколько — считает bossCount. Внутри roster более поздняя волна этот номер
  // всё равно проигрывает, чтобы дебют пикапа на 10-й и ракетчика на 20-й не потерялся.
  static isBossWave(wave: number): boolean {
    return wave > 0 && wave % 10 === 0;
  }

  // На обычной волне ноль. На босс-волне — от одного до boss.maxCount.
  // Номер появления даёт bossAppearance: у партии это волна / 10, у дебага — свой.
  // Три первых выхода дают одного, следующие три — двоих, и так до потолка.
  static bossCount(wave: number): number {
    if (!this.isBossWave(wave)) {
      return 0;
    }
    const step = Math.floor((this.bossAppearance(wave) - 1) / this.boss.hold);
    return Math.min(this.boss.maxCount, 1 + step);
  }

  // Длина списка. WaveManager сравнивает её с тем, сколько врагов уже вышло.
  static count(wave: number): number {
    return this.roster(wave).length;
  }

  // index — порядковый номер врага внутри волны, с нуля.
  // ctx — сцена, точка появления, номер волны и группа, куда враг будет класть пули.
  static create(index: number, ctx: SpawnContext): Infantry {
    const kind = this.roster(ctx.wave)[index] ?? AssaultInfantry;
    return this.spawnUnit(kind, ctx, index);
  }

  // Обратное превращение: живой спрайт → строка для сохранения. null — это не наш враг.
  static kindOf(unit: WaveUnit): EnemySaveKind | null {
    if (unit instanceof RocketBuggy) {
      return 'buggy';
    }
    if (unit instanceof Helicopter) {
      return 'heli';
    }
    if (unit instanceof PickupTruck) {
      return 'truck';
    }
    if (unit instanceof RocketInfantry) {
      return 'rocket';
    }
    if (unit instanceof GunnerInfantry) {
      return 'gunner';
    }
    if (unit instanceof SuperSoldier) {
      return 'super';
    }
    if (unit instanceof HeavyTank) {
      return 'tank';
    }
    if (unit instanceof AssaultInfantry) {
      return 'assault';
    }
    return null;
  }

  // Собирает уже вышедшего врага на сохранённом месте. Запас здоровья берётся из ранга,
  // как при обычном спавне, а полоска ставится на оставшиеся hp.
  // У суперсолдата ранг скорости всегда 1, запас считает номер появления на текущей волне.
  static restore(kind: EnemySaveKind, ctx: SpawnContext, hp: number, pace: number, slot = 0): Infantry {
    const rankHp = Infantry.waveHp(pace);
    const unit = this.spawnSaved(kind, ctx, rankHp, slot);
    unit.setPaceWave(pace);
    unit.setHealth(hp);
    return unit;
  }

  private static spawnSaved(kind: EnemySaveKind, ctx: SpawnContext, rankHp: number, slot: number): Infantry {
    const { scene, x, y, shots, fireTarget } = ctx;
    if (kind === 'super') {
      const appearance = this.bossAppearance(ctx.wave);
      const count = this.bossCount(ctx.wave);
      const hp = SuperSoldier.hpForAppearance(appearance);
      return new SuperSoldier(scene, x, y, hp, shots, fireTarget, appearance, slot, count);
    }
    if (kind === 'tank') {
      const showing = this.tankShowing(ctx.wave);
      const purse = this.bossAppearance(ctx.wave);
      const count = this.bossCount(ctx.wave);
      const hp = HeavyTank.hpForAppearance(showing);
      return new HeavyTank(scene, x, y, hp, shots, fireTarget, showing, purse, slot, count);
    }
    let unit: Infantry;
    if (kind === 'assault') {
      unit = new AssaultInfantry(scene, x, y, rankHp);
    } else if (kind === 'gunner') {
      unit = new GunnerInfantry(scene, x, y, rankHp, shots, fireTarget);
    } else if (kind === 'truck') {
      unit = new PickupTruck(scene, x, y, rankHp, shots, fireTarget);
    } else if (kind === 'buggy') {
      unit = new RocketBuggy(scene, x, y, rankHp, shots, fireTarget);
    } else if (kind === 'heli') {
      unit = new Helicopter(scene, x, y, rankHp, shots, fireTarget);
    } else {
      unit = new RocketInfantry(scene, x, y, rankHp, shots, fireTarget);
    }
    unit.setDamageWave(ctx.wave);
    return unit;
  }

  private static debutWave(kind: EnemyKind): number {
    if (kind === GunnerInfantry) {
      return GunnerInfantry.debutWave;
    }
    if (kind === PickupTruck) {
      return PickupTruck.debutWave;
    }
    if (kind === RocketBuggy) {
      return RocketBuggy.debutWave;
    }
    if (kind === Helicopter) {
      return Helicopter.debutWave;
    }
    if (kind === RocketInfantry) {
      return RocketInfantry.debutWave;
    }
    return 1;
  }

  // Здоровье и ранг скорости. Штурмовик растёт от номера волны.
  // Остальные на своей первой волне получают ранг 1, дальше +1 за волну.
  // Суперсолдат: запас и урон от номера босс-волны. Первый такой номер — 100 и 1, дальше +500 и +1.
  // Тяжёлый танк: запас и урон от своего выхода. Первый — 2000 и 50, дальше +500 и +1.
  // Монеты — одна касса волны на все тела. Скорость обоих боссов остаётся на ранге 1.
  // Остальные прибавляют 1 урона каждые 10 волн: на 10-й уже +1, на 20-й +2.
  // Дебаг-наследник считает ранг по номеру своей волны, без дебюта обычной партии.
  protected static spawnUnit(kind: EnemyKind, ctx: SpawnContext, slot = 0): Infantry {
    const { scene, x, y, wave, shots, fireTarget } = ctx;

    if (kind === SuperSoldier) {
      const appearance = this.bossAppearance(wave);
      const count = this.bossCount(wave);
      const hp = SuperSoldier.hpForAppearance(appearance);
      const unit = new SuperSoldier(scene, x, y, hp, shots, fireTarget, appearance, slot, count);
      unit.setPaceWave(1);
      return unit;
    }

    if (kind === HeavyTank) {
      const showing = this.tankShowing(wave);
      const purse = this.bossAppearance(wave);
      const count = this.bossCount(wave);
      const hp = HeavyTank.hpForAppearance(showing);
      const unit = new HeavyTank(scene, x, y, hp, shots, fireTarget, showing, purse, slot, count);
      unit.setPaceWave(1);
      return unit;
    }

    if (kind === AssaultInfantry) {
      const rank = this.assaultRank(wave);
      const unit = new AssaultInfantry(scene, x, y, Infantry.waveHp(rank));
      return this.arm(unit, wave, rank);
    }

    if (kind === GunnerInfantry) {
      const rank = this.growthRank(wave, GunnerInfantry.debutWave);
      const unit = new GunnerInfantry(scene, x, y, Infantry.waveHp(rank), shots, fireTarget);
      return this.arm(unit, wave, rank);
    }

    if (kind === PickupTruck) {
      const rank = this.growthRank(wave, PickupTruck.debutWave);
      const unit = new PickupTruck(scene, x, y, Infantry.waveHp(rank), shots, fireTarget);
      return this.arm(unit, wave, rank);
    }

    if (kind === RocketBuggy) {
      const rank = this.growthRank(wave, RocketBuggy.debutWave);
      const unit = new RocketBuggy(scene, x, y, Infantry.waveHp(rank), shots, fireTarget);
      return this.arm(unit, wave, rank);
    }

    if (kind === Helicopter) {
      const rank = this.growthRank(wave, Helicopter.debutWave);
      const unit = new Helicopter(scene, x, y, Infantry.waveHp(rank), shots, fireTarget);
      return this.arm(unit, wave, rank);
    }

    const rank = this.growthRank(wave, RocketInfantry.debutWave);
    const unit = new RocketInfantry(scene, x, y, Infantry.waveHp(rank), shots, fireTarget);
    return this.arm(unit, wave, rank);
  }

  // Скорость от ранга, урон от номера волны: дебют стрелка на 3-й не откладывает прибавку.
  private static arm(unit: Infantry, wave: number, pace: number): Infantry {
    unit.setPaceWave(pace);
    unit.setDamageWave(wave);
    return unit;
  }

  protected static assaultRank(wave: number): number {
    return wave;
  }

  protected static bossAppearance(wave: number): number {
    return SuperSoldier.appearanceOn(wave);
  }

  // Какой по счёту выход именно танка. Дебаг подменяет: там номер своего круга.
  protected static tankShowing(wave: number): number {
    return HeavyTank.appearanceOn(wave);
  }

  // Ведущий чередуется. Пока тело одно, на поле только он.
  // Дальше чётные места очереди — ведущий, нечётные — второй босс.
  // Тяжёлый танк на волне один: место, которое досталось бы второму танку, занимает суперсолдат.
  protected static bossKindAt(wave: number, slot: number): EnemyKind {
    const lead = this.bossAppearance(wave) % 2 === 1 ? SuperSoldier : HeavyTank;
    const kind =
      this.bossCount(wave) < 2 || slot % 2 === 0
        ? lead
        : lead === SuperSoldier
          ? HeavyTank
          : SuperSoldier;
    if (kind !== HeavyTank) {
      return kind;
    }
    const firstTank = lead === HeavyTank ? 0 : 1;
    return slot === firstTank ? HeavyTank : SuperSoldier;
  }

  // Имя на баннере. null — это не босс-волна.
  static bossTitle(wave: number): string | null {
    if (!this.isBossWave(wave)) {
      return null;
    }
    const total = this.bossCount(wave);
    let tank = false;
    let soldier = false;
    for (let i = 0; i < total; i += 1) {
      if (this.bossKindAt(wave, i) === HeavyTank) {
        tank = true;
      } else {
        soldier = true;
      }
    }
    if (tank && soldier) {
      return 'СУПЕРСОЛДАТ И ТЯЖЁЛЫЙ ТАНК';
    }
    if (tank) {
      return 'ТЯЖЁЛЫЙ ТАНК';
    }
    return 'СУПЕРСОЛДАТ';
  }

  protected static growthRank(wave: number, debutWave: number): number {
    return Infantry.growthRank(wave, debutWave);
  }

  // Симуляция волн 1..N. На каждой итерации в список падает ноль или один новый враг,
  // кроме первой волны: она кладёт сразу startCount штурмовиков.
  private static roster(wave: number): EnemyKind[] {
    if (wave < 1) {
      return [];
    }
    // Боссы подменяют весь отряд. Сколько их — bossCount.
    // Расчёт волны 11 и дальше всё равно дойдёт до номера 10
    // в цикле ниже, поэтому дебют пикапа на босс-волне в поздний отряд попадает.
    // То же с ракетчиком, багги и вертолётом: волна 21 доходит до номера 20, 31 — до 30, 41 — до 40.
    if (this.isBossWave(wave)) {
      const bosses: EnemyKind[] = [];
      const total = this.bossCount(wave);
      for (let i = 0; i < total; i += 1) {
        bosses.push(this.bossKindAt(wave, i));
      }
      return bosses;
    }

    const { startCount, infantryRampUntil, stepEvery, maxCount } = EnemyFactory.wave;
    const units: EnemyKind[] = [];
    // Единая дверца в список: на потолке лишние виды просто не добавляются.
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
        // Если дебют стрелка сдвинули на 1-ю волну, последнее место стартовой пачки занимает он.
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

      // Волны 2 .. debutWave-1: по одному дополнительному штурмовику.
      if (w < infantryRampUntil) {
        push(AssaultInfantry);
        this.pushVehicleDebut(w, push);
        continue;
      }

      // Волна дебюта стрелка. Штурмовик в этот номер уже не добавляется.
      if (w === infantryRampUntil) {
        push(GunnerInfantry);
        this.pushVehicleDebut(w, push);
        continue;
      }

      // Волна первого выхода пикапа, ракетчика, багги или вертолёта. Очередной «шаг» в этот номер не идёт.
      const vehicleDebut = this.vehicles.find((kind) => this.debutWave(kind) === w);
      if (vehicleDebut) {
        push(vehicleDebut);
        continue;
      }

      // since — сколько волн прошло после стрелка. На 8-й это 5, дальше 10, 15, 20…
      const since = w - infantryRampUntil;
      if (since % stepEvery === 0) {
        // step — какой по счёту это шаг: 1, 2, 3… Вид берётся по кругу из pool().
        push(this.stepKind(since / stepEvery, w));
      }
    }

    return units;
  }

  // Дописывает технику, если эта волна — её первая. На волнах без дебюта ничего не делает.
  private static pushVehicleDebut(w: number, push: (kind: EnemyKind) => void): void {
    const kind = this.vehicles.find((k) => this.debutWave(k) === w);
    if (kind) {
      push(kind);
    }
  }

  // step % длина пула даёт индекс. Пул длиннее на поздних волнах, поэтому тот же step
  // на 8-й волне и на 23-й может указать на разных врагов.
  private static stepKind(step: number, wave: number): EnemyKind {
    const pool = this.pool(wave);
    return pool[step % pool.length];
  }

  // Кто уже имеет право выпасть на шаге. Техника попадает сюда только после своей debutWave,
  // поэтому на волне дебюта её добавляет отдельная ветка, а в круг она входит со следующей.
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
