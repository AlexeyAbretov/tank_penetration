import Phaser from 'phaser';
import { QUIET_PAUSE } from '../../controllers/DebugQuietPause';
import { WAVE_SKIP_HINT } from '../../systems/DebugWaveManager';
import { GameHud, type HudAbility, type HudFrame } from './GameHud';

export class DebugGameHud extends GameHud {
  private readonly debugLabel: Phaser.GameObjects.Text;

  protected override controlsLine(): string {
    return `${super.controlsLine()}   пробел — пауза без экрана   двойное нажатие — сброс`;
  }

  constructor(scene: Phaser.Scene, frame: HudFrame, maxHp: number, abilities: readonly HudAbility[]) {
    super(scene, frame, maxHp, abilities);

    this.debugLabel = scene.add
      .text(frame.width / 2, this.statusY, `DEBUG   ${WAVE_SKIP_HINT}`, {
        ...this.statusStyle,
        color: '#ff5a48',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(51);

    scene.events.on(QUIET_PAUSE, (on: boolean) => {
      this.debugLabel.setText(on ? `DEBUG  ПАУЗА   ${WAVE_SKIP_HINT}` : `DEBUG   ${WAVE_SKIP_HINT}`);
    });
  }
}
