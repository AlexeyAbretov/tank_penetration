// Иконка автострельбы. Покупка и выключатель живут в прогрессе, стреляет бой.
// Картинка — assets/auto-fire-icon.png.

import { AbilityIconBase } from "./AbilityIconBase";

export class AutoFireAbilityIcon extends AbilityIconBase {
  static override iconKey = 'auto-fire-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static override iconPath = 'assets/auto-fire-icon.png';
}
