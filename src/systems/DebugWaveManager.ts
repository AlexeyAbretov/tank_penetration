// Дебаг-волны. N убивает живых и сразу открывает следующую, без магазина.
// Сцена этот класс не знает: фабрика подставляет его вместо WaveManager.
// Другая клавиша или другой момент пропуска меняются здесь. Сам пропуск — WaveManager.skipToNext.

import Phaser from 'phaser';
import { WaveManager } from './WaveManager';

export class DebugWaveManager extends WaveManager {
  private key?: Phaser.Input.Keyboard.Key;

  protected override onBound(scene: Phaser.Scene): void {
    this.key = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.N);
  }

  override tick(): void {
    if (this.key !== undefined && Phaser.Input.Keyboard.JustDown(this.key)) {
      this.skipToNext();
    }
    super.tick();
  }
}
