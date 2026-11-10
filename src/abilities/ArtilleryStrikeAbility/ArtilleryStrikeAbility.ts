// Артиллерийский удар: снаряды в случайные точки поля.
// Покупка в магазине открывает вызов по клавише 1 и по иконке на HUD. Сам залп считает CombatSystem.

import { ArtilleryStrikeAbilityConfig } from './ArtilleryStrikeAbilityConfig';
import { ArtilleryStrikeAbilityEffects } from './ArtilleryStrikeAbilityEffects';

export class ArtilleryStrikeAbility {
  static readonly effects = new ArtilleryStrikeAbilityEffects(ArtilleryStrikeAbilityConfig);

  // Прямоугольник удара без левого края: его даёт бой, чтобы чаша не ушла за проволоку.
  static readonly field = {
    maxX: 1160,
    minY: 160,
    maxY: 540,
  };
}
