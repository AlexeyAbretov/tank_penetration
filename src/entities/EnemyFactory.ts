// Фабрика врагов: по номеру в волне решает, кого создать.
// Сцена не знает про классы стрелка и пикапа — она просит «врага номер i».

import { AssaultInfantry } from './AssaultInfantry';
import { GunnerInfantry } from './GunnerInfantry';
import { Infantry } from './Infantry';
import { PickupTruck } from './PickupTruck';
import type { SpawnContext } from './SpawnContext';

// Сцена и другие файлы по-прежнему могут взять тип рядом с фабрикой.
export type { SpawnContext };

// Общий вид класса врага: два статических метода, без создания объекта заранее.
// Так фабрика хранит сами классы, а не экземпляры.
type EnemyKind = {
  matches(index: number): boolean;
  spawn(ctx: SpawnContext): Infantry;
};

export class EnemyFactory {
  // Порядок важен. find берёт первый класс, чей matches вернул true.
  // Пикап проверяется раньше стрелка, штурмовик последний и подходит всегда.
  private static readonly kinds: EnemyKind[] = [
    PickupTruck,
    GunnerInfantry,
    AssaultInfantry,
  ];

  // index — порядковый номер врага внутри волны, начиная с 0.
  static create(index: number, ctx: SpawnContext): Infantry {
    // ?? на случай, если список когда-нибудь останется без «всегда подходящего» класса.
    const kind = this.kinds.find((entry) => entry.matches(index)) ?? AssaultInfantry;
    return kind.spawn(ctx);
  }
}
