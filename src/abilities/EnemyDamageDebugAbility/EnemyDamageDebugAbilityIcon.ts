// Урон врагов по танку в дебаг-партии.
// Иконка на ряду способностей пишет флаг. Игрок читает его в момент удара.

import { AbilityIconBase } from '../AbilityIconBase';

export class EnemyDamageDebugAbilityIcon extends AbilityIconBase {
  static override iconKey = 'enemy-damage-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static override iconPath = 'assets/enemy-damage-icon.png';
}
