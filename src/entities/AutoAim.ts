// Иконка автонаведения. Покупка и выключатель живут в прогрессе, точку башне отдаёт бой.
// Картинка — assets/auto-aim-icon.png. Если файл не загрузился, кнопка рисуется кругом.

import Phaser from 'phaser';
import { paintSkillDisc } from '../gfx/skillDisc';
import { bake } from '../gfx/textures';

export class AutoAim {
  static readonly iconKey = 'auto-aim-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static readonly iconPath = 'assets/auto-aim-icon.png';
  // Радиус круга. Такой же, как у иконок способностей над лентой.
  static readonly iconRadius = 30;

  static preload(scene: Phaser.Scene): void {
    if (scene.textures.exists(AutoAim.iconKey)) {
      return;
    }
    scene.load.image(AutoAim.iconKey, AutoAim.iconPath);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(AutoAim.iconKey)) {
      scene.textures.get(AutoAim.iconKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
      return;
    }
    bake(scene, AutoAim.iconKey, 64, 64, (g) => AutoAim.renderIcon(g));
  }

  // Запасной круг: золотой обод и перекрестие. Файл, если загрузился, этот рисунок не вызывает.
  private static renderIcon(g: Phaser.GameObjects.Graphics): void {
    paintSkillDisc(g, 32, 32, AutoAim.iconRadius);
    g.lineStyle(2, 0xf0d56a, 1);
    g.strokeCircle(32, 32, 10);
    g.beginPath();
    g.moveTo(32, 14);
    g.lineTo(32, 22);
    g.moveTo(32, 42);
    g.lineTo(32, 50);
    g.moveTo(14, 32);
    g.lineTo(22, 32);
    g.moveTo(42, 32);
    g.lineTo(50, 32);
    g.strokePath();
    g.fillStyle(0xf0d56a);
    g.fillRect(18, 30, 12, 4);
  }
}
