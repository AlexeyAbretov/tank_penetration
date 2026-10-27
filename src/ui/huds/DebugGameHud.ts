import Phaser from 'phaser';
import { GameHud, type HudAbility, type HudFrame } from './GameHud';

export class DebugGameHud extends GameHud {
  private readonly debugLabel: Phaser.GameObjects.Text;

  // Дебаг-клавиши только в окне списка. Верхняя плашка остаётся статусом партии.
  protected override controlHints(): readonly string[] {
    return [
      ...super.controlHints(),
      'пробел — пауза без экрана',
      'двойное нажатие — сброс',
      'N — пропуск волны',
    ];
  }

  constructor(scene: Phaser.Scene, frame: HudFrame, maxHp: number, abilities: readonly HudAbility[]) {
    super(scene, frame, maxHp, abilities);

    this.debugLabel = scene.add
      .text(frame.width / 2, this.statusY, 'DEBUG', {
        ...this.statusStyle,
        color: '#ff5a48',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(51);

    // То же имя шлёт DebugQuietPause. Константа ради одной подписи не нужна.
    scene.events.on('quiet-pause', (on: boolean) => {
      this.debugLabel.setText(on ? 'DEBUG  ПАУЗА' : 'DEBUG');
    });
  }
}
