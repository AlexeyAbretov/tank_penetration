// Иконка автопокупки. Покупка и выключатель живут в прогрессе, монеты тратит магазин волны.
// Картинка — assets/auto-shop-icon.png.

import { AbilityIconBase } from "./AbilityIconBase";

export class AutoShopAbilityIcon extends AbilityIconBase {
  static override iconKey = 'auto-shop-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static override iconPath = 'assets/auto-shop-icon.png';
}
