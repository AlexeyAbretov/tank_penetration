// Урон врагов по танку в дебаг-партии.
// Иконка на ряду способностей пишет флаг. Игрок читает его в момент удара.
// Свой ключ, не ключ партии: «новая игра» стирает бой, а выключатель остаётся.
// Пока ключа нет, урон идёт. Картинка — assets/enemy-damage-icon.png.
// Если файл не загрузился, кнопка рисуется кругом.

import Phaser from 'phaser';
import { paintSkillDisc } from '../gfx/skillDisc';
import { bake } from '../gfx/textures';

const STORAGE_KEY = 'tank-penetration-enemy-damage:debug';

export class EnemyDamage {
  static readonly iconKey = 'enemy-damage-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static readonly iconPath = 'assets/enemy-damage-icon.png';
  private static enabled = readEnabled();

  static preload(scene: Phaser.Scene): void {
    if (scene.textures.exists(EnemyDamage.iconKey)) {
      return;
    }
    scene.load.image(EnemyDamage.iconKey, EnemyDamage.iconPath);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(EnemyDamage.iconKey)) {
      scene.textures.get(EnemyDamage.iconKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
      return;
    }
    bake(scene, EnemyDamage.iconKey, 64, 64, (g) => EnemyDamage.renderIcon(g));
  }

  // Запасной круг: пуля в борт. Файл, если загрузился, этот рисунок не вызывает.
  private static renderIcon(g: Phaser.GameObjects.Graphics): void {
    paintSkillDisc(g, 32, 32, 30);
    g.fillStyle(0xf0d56a);
    g.fillRect(38, 21, 5, 22);
    g.fillRect(16, 31, 12, 2);
    g.fillTriangle(28, 29, 28, 35, 36, 32);
    g.fillRect(35, 25, 2, 4);
    g.fillRect(35, 35, 2, 4);
  }

  static get isEnabled(): boolean {
    return this.enabled;
  }

  static toggle(): boolean {
    this.enabled = !this.enabled;
    writeEnabled(this.enabled);
    return this.enabled;
  }
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Приватный режим: флаг работает, пока открыта вкладка.
  }
}
