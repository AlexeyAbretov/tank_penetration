// Круг ЭМИ над лентой. Покупка открывает клавишу 7 и эту иконку.

import { AbilityIconBase } from '../AbilityIconBase';

export class EmpFlashAbilityIcon extends AbilityIconBase {
  static readonly iconKey = 'emp-flash-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static readonly iconPath = 'assets/emp-flash-icon.png';
}
