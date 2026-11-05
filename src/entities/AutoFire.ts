// Иконка автострельбы. Покупка и выключатель живут в прогрессе, стреляет бой.
// Пока файла нет, кнопка рисуется кругом. Готовая картинка — public/assets/auto-fire-icon.png.

import Phaser from 'phaser';
import { paintSkillDisc } from '../gfx/skillDisc';
import { bake } from '../gfx/textures';

export class AutoFire {
  static readonly iconKey = 'auto-fire-icon';
  // Радиус круга. Такой же, как у иконки автонаведения и способностей над лентой.
  static readonly iconRadius = 30;

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(AutoFire.iconKey)) {
      scene.textures.get(AutoFire.iconKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
      return;
    }
    bake(scene, AutoFire.iconKey, 64, 64, (g) => AutoFire.renderIcon(g));
  }

  // Запасной круг: тот же обод, что у автонаведения, и ствол с трассами. Файл этот рисунок не вызывает.
  private static renderIcon(g: Phaser.GameObjects.Graphics): void {
    paintSkillDisc(g, 32, 32, AutoFire.iconRadius);
    g.fillStyle(0xf0d56a);
    g.fillRect(14, 29, 16, 6);
    g.fillRect(28, 25, 4, 14);
    g.fillRect(34, 26, 12, 2);
    g.fillRect(34, 31, 16, 2);
    g.fillRect(34, 36, 10, 2);
  }
}
