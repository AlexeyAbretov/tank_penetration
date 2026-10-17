// Дебаг-скорость. Кнопка и клавиша F переключают обычное время и замедление в пять раз.
// Частоту кадров не трогаем: редкий кадр с большим шагом перескакивает позы ног.
// Замедление держит каждую позу дольше, а тело идёт в том же темпе, что и шаг.

import Phaser from 'phaser';
import { FramePace } from './FramePace';

const SLOW = 0.2;

export class DebugFramePace extends FramePace {
  private slow = false;
  private plate?: Phaser.GameObjects.Rectangle;
  private label?: Phaser.GameObjects.Text;

  override attach(scene: Phaser.Scene): void {
    this.applyScale(scene, this.slow ? SLOW : 1);

    // Справа от надписи DEBUG, в одном ряду со счётом. Глубина как у шестерёнки:
    // затемнение магазина (70) иначе забирает и клик, и саму плашку.
    const x = scene.scale.width / 2 + 100;
    const y = 28;
    this.plate = scene.add
      .rectangle(x, y, 96, 22, 0x3a0c0c)
      .setStrokeStyle(2, 0xc9a227)
      .setDepth(80)
      .setInteractive({ useHandCursor: true });
    this.label = scene.add
      .text(x, y, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#f3d56a',
      })
      .setOrigin(0.5)
      .setDepth(81);
    this.paint();
    this.plate.on('pointerup', () => this.toggle(scene));

    const key = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    scene.events.on('update', () => {
      if (key && Phaser.Input.Keyboard.JustDown(key)) {
        this.toggle(scene);
      }
    });
  }

  override covers(pointer: Phaser.Input.Pointer): boolean {
    return this.plate?.getBounds().contains(pointer.worldX, pointer.worldY) ?? false;
  }

  private toggle(scene: Phaser.Scene): void {
    this.slow = !this.slow;
    this.applyScale(scene, this.slow ? SLOW : 1);
    this.paint();
  }

  private paint(): void {
    this.plate?.setFillStyle(this.slow ? 0x8a1810 : 0x3a0c0c);
    this.label?.setText(this.slow ? '×0.2' : 'НОРМА');
  }
}
