// Скорость времени в бою. Обычная партия оставляет 1: секунда игры равна секунде на часах.
// Дебаг-наследник умеет замедлять. Сцена класс только подключает и спрашивает,
// не попал ли курсор в его кнопку.

import Phaser from 'phaser';

export class FramePace {
  attach(scene: Phaser.Scene): void {
    this.applyScale(scene, 1);
  }

  covers(_pointer: Phaser.Input.Pointer): boolean {
    return false;
  }

  // Множитель меньше 1 тянет анимацию, твины и таймеры сцены.
  // У физики шкала обратная: 5 значит «шаг в пять раз реже», то есть та же медленная скорость.
  protected applyScale(scene: Phaser.Scene, scale: number): void {
    scene.game.loop.setFPSLimit(0);
    scene.anims.globalTimeScale = scale;
    scene.tweens.setGlobalTimeScale(scale);
    scene.time.timeScale = scale;
    scene.physics.world.timeScale = 1 / scale;
  }
}
