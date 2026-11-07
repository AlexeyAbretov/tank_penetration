// Иконка автопокупки. Покупка и выключатель живут в прогрессе, монеты тратит магазин волны.
// Картинка — assets/auto-shop-icon.png. Если файл не загрузился, кнопка рисуется кругом.

import Phaser from 'phaser';
import { paintSkillDisc } from '../gfx/skillDisc';
import { bake } from '../gfx/textures';

export class AutoShop {
  static readonly iconKey = 'auto-shop-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static readonly iconPath = 'assets/auto-shop-icon.png';
  // Радиус круга. Такой же, как у автонаведения и способностей над лентой.
  static readonly iconRadius = 30;

  static preload(scene: Phaser.Scene): void {
    if (scene.textures.exists(AutoShop.iconKey)) {
      return;
    }
    scene.load.image(AutoShop.iconKey, AutoShop.iconPath);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(AutoShop.iconKey)) {
      scene.textures.get(AutoShop.iconKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
      return;
    }
    bake(scene, AutoShop.iconKey, 64, 64, (g) => AutoShop.renderIcon(g));
  }

  // Запасной круг: тот же обод и монета с плюсом. Файл, если загрузился, этот рисунок не вызывает.
  private static renderIcon(g: Phaser.GameObjects.Graphics): void {
    paintSkillDisc(g, 32, 32, AutoShop.iconRadius);
    g.fillStyle(0xc4a15a);
    g.fillCircle(32, 34, 12);
    g.fillStyle(0xf0d56a);
    g.fillCircle(32, 32, 10);
    g.fillStyle(0x3a140c);
    g.fillRect(30, 26, 4, 12);
    g.fillRect(26, 30, 12, 4);
  }
}
