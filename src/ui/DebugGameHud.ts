import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { GameHud } from './GameHud';

export class DebugGameHud extends GameHud {
  constructor(scene: Phaser.Scene) {
    super(scene);

    scene.add
      .text(GAME.width / 2, this.statusY, 'DEBUG', { ...this.statusStyle, color: '#ff5a48' })
      .setOrigin(0.5, 0.5)
      .setDepth(51);
  }
}
