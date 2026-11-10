// Артиллерийский удар: снаряды в случайные точки поля.
// Покупка в магазине открывает вызов по клавише 1 и по иконке на HUD. Сам залп считает CombatSystem.

import { AbilityIconBase } from '../AbilityIconBase';

export class ArtilleryStrikeAbilityIcon extends AbilityIconBase {
  static readonly iconKey = 'artillery-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static readonly iconPath = 'assets/artillery-icon.png';
}
