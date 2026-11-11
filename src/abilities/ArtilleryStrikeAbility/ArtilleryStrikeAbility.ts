// Артиллерийский удар: снаряды в случайные точки поля.
// Покупка в магазине открывает вызов по клавише 1 и по иконке на HUD. Сам залп считает CombatSystem.

import { GAME } from '../../gameConfig';
import { ArtilleryStrikeAbilityConfig } from './ArtilleryStrikeAbilityConfig';
import { ArtilleryStrikeAbilityEffects } from './ArtilleryStrikeAbilityEffects';

export class ArtilleryStrikeAbility {
  static readonly effects = new ArtilleryStrikeAbilityEffects(ArtilleryStrikeAbilityConfig);

  // Отступ от правого края холста. На поле 1280 это прежние 1160. Чаша не вылезает за кадр.
  static readonly rightInset = 120;

  // Полоса по вертикали. Левый край сюда не кладётся: его считает бой от проволоки и передаёт в залп.
  // Правый край читается в момент удара, иначе широкое окно оставляет правую часть поля без снарядов.
  static readonly field = {
    get maxX(): number {
      return GAME.width - ArtilleryStrikeAbility.rightInset;
    },
    minY: 160,
    maxY: 540,
  };
}
