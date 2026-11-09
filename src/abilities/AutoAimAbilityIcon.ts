// Иконка автонаведения. Покупка и выключатель живут в прогрессе, точку башне отдаёт бой.
// Картинка — assets/auto-aim-icon.png. Если файл не загрузился, кнопка рисуется кругом.

import { AbilityIconBase } from './AbilityIconBase';

export class AutoAimAbilityIcon extends AbilityIconBase {
  static override iconKey = 'auto-aim-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static override iconPath = 'assets/auto-aim-icon.png';
}
