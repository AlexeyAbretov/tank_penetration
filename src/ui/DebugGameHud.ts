import Phaser from 'phaser';
import { GameHud, type HudAbility, type HudFrame } from './GameHud';

export class DebugGameHud extends GameHud {
  constructor(scene: Phaser.Scene, frame: HudFrame, maxHp: number, abilities: readonly HudAbility[]) {
    super(scene, frame, maxHp, abilities);

    scene.add
      .text(frame.width / 2, this.statusY, 'DEBUG', { ...this.statusStyle, color: '#ff5a48' })
      .setOrigin(0.5, 0.5)
      .setDepth(51);
  }
}
