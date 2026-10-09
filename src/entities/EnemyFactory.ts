// Состав волны: сколько врагов и кто именно.
// WaveManager знает только номер в списке. Кого создать — решает этот класс.
// roster проигрывает волны с 1-й до текущей и складывает отряд заново.
// Так дебют стрелка на 3-й волне сам появляется и в составе 15-й.

import { AssaultInfantry } from './AssaultInfantry';
import { GunnerInfantry } from './GunnerInfantry';
import { Infantry } from './Infantry';
import { PickupTruck } from './PickupTruck';
import { RocketInfantry } from './RocketInfantry';
import { SuperSoldier } from './SuperSoldier';
import type { SpawnContext } from './SpawnContext';

export type { SpawnContext } from './SpawnContext';
export type { WorldPoint } from './WorldPoint';

// Короткое имя вида для сохранения партии. Имя класса после сборки Vite может измениться,
// поэтому в localStorage пишется эта строка, а не AssaultInfantry.
export const ENEMY_KINDS = ['assault', 'gunner', 'truck', 'rocket', 'super'] as const;
export type EnemySaveKind = (typeof ENEMY_KINDS)[number];

type EnemyKind =
  | typeof AssaultInfantry
  | typeof GunnerInfantry
  | typeof PickupTruck
  | typeof RocketInfantry
  | typeof SuperSoldier;

export class EnemyFactory {
  // Техника со своим debutWave. В пул шагов попадает по возрастанию этой волны.
  // Пикап стоит раньше ракетчика в массиве, сортировка в pool() всё равно ставит ракетчика первым:
  // его дебют — 10-я волна, у пикапа — 20-я.
  private static readonly vehicles: EnemyKind[] = [PickupTruck, RocketInfantry];

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

  // 10, 20, 30… На экран выходит только суперсолдат.
  // Внутри roster более поздняя волна этот номер всё равно проигрывает,
  // чтобы дебют ракетчика на 10-й не потерялся.
  static isBossWave(wave: number): boolean {
    return wave > 0 && wave % 10 === 0;
  }

  // Длина списка. WaveManager сравнивает её с тем, сколько врагов уже вышло.
  static count(wave: number): number {
    return this.roster(wave).length;
  }

  // index — порядковый номер врага внутри волны, с нуля.
  // ctx — сцена, точка появления, номер волны и группа, куда враг будет класть пули.
  static create(index: number, ctx: SpawnContext): Infantry {
    const kind = this.roster(ctx.wave)[index] ?? AssaultInfantry;
    return this.spawnUnit(kind, ctx);
  }

  // Обратное превращение: живой спрайт → строка для сохранения. null — это не наш враг.
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
    if (unit instanceof SuperSoldier) {
      return 'super';
    }
    if (unit instanceof AssaultInfantry) {
      return 'assault';
    }
    return null;
  }

  // Собирает уже вышедшего врага на сохранённом месте. Запас здоровья берётся из ранга,
  // как при обычном спавне, а полоска ставится на оставшиеся hp.
  // У суперсолдата ранг скорости всегда 1, запас считает номер появления на текущей волне.
  static restore(kind: EnemySaveKind, ctx: SpawnContext, hp: number, pace: number): Infantry {
    const rankHp = Infantry.waveHp(pace);
    const unit = this.spawnSaved(kind, ctx, rankHp);
    unit.setPaceWave(pace);
    unit.setHealth(hp);
    return unit;
  }

  private static spawnSaved(kind: EnemySaveKind, ctx: SpawnContext, rankHp: number): Infantry {
    const { scene, x, y, shots, fireTarget } = ctx;
    if (kind === 'super') {
      const hp = SuperSoldier.hpForAppearance(SuperSoldier.appearanceOn(ctx.wave));
      return new SuperSoldier(scene, x, y, hp, shots, fireTarget);
    }
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

  // Здоровье и ранг скорости. Штурмовик растёт от номера волны.
  // Остальные на своей первой волне получают ранг 1, дальше +1 за волну.
  // Суперсолдат: первый выход всегда 100, дальше +500 за каждое следующее появление. Скорость остаётся на ранге 1.
  private static spawnUnit(kind: EnemyKind, ctx: SpawnContext): Infantry {
    const { scene, x, y, wave, shots, fireTarget } = ctx;

    if (kind === SuperSoldier) {
      const hp = SuperSoldier.hpForAppearance(SuperSoldier.appearanceOn(wave));
      const unit = new SuperSoldier(scene, x, y, hp, shots, fireTarget);
      unit.setPaceWave(1);
      return unit;
    }

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

  // Симуляция волн 1..N. На каждой итерации в список падает ноль или один новый враг,
  // кроме первой волны: она кладёт сразу startCount штурмовиков.
  private static roster(wave: number): EnemyKind[] {
    if (wave < 1) {
      return [];
    }
    // Босс подменяет весь отряд. Расчёт волны 11 и дальше всё равно дойдёт до номера 10
    // в цикле ниже, поэтому дебют ракетчика на босс-волне в поздний отряд попадает.
    if (this.isBossWave(wave)) {
      return [SuperSoldier];
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

      // Волна первого выхода ракетчика или пикапа. Очередной «шаг» в этот номер не идёт.
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
