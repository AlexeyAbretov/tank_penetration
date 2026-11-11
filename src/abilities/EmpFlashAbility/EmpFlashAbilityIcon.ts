// Круг ЭМИ над лентой. Покупка открывает клавишу 7 и эту иконку.
// Запасной рисунок печётся, только если файла в public нет.

import Phaser from 'phaser';
import { bake } from '../../gfx/textures';
import { AbilityIconBase } from '../AbilityIconBase';

export class EmpFlashAbilityIcon extends AbilityIconBase {
  static readonly iconKey = 'emp-flash-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static readonly iconPath = 'assets/emp-flash-icon.png';

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(EmpFlashAbilityIcon.iconKey)) {
      scene.textures.get(EmpFlashAbilityIcon.iconKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
      return;
    }
    bake(scene, EmpFlashAbilityIcon.iconKey, 64, 64, (g) => EmpFlashAbilityIcon.render(g));
  }

  private static render(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x071018, 1);
    g.fillCircle(32, 32, 30);
    g.lineStyle(3, 0x8ee7ff, 1);
    g.strokeCircle(32, 32, 26);
    g.fillStyle(0xf4fbff, 1);
    g.fillTriangle(34, 8, 22, 34, 33, 34);
    g.fillTriangle(30, 30, 44, 30, 28, 56);
    g.fillStyle(0x7ad7ff, 1);
    g.fillTriangle(32, 14, 25, 32, 32, 32);
    g.fillTriangle(32, 32, 39, 32, 30, 48);
  }
}
