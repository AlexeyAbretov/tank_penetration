// Надпись над снарядом танка. «пробивает» — следующий враг получит урон без взрыва.
// «не пробивает» — ближайший удар разорвётся как обычно.
// Рисует, только пока включены PierceMarks. Урон от надписи не меняется.

import Phaser from 'phaser';
import { PierceMarks } from './PierceMarks';

export class PierceMarkOverlay {
  private readonly labels: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly shells: Phaser.Physics.Arcade.Group,
    private readonly pierces: (shell: Phaser.Physics.Arcade.Image) => boolean,
  ) {
    const draw = (): void => this.draw();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, draw);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, draw);
      for (const label of this.labels) {
        label.destroy();
      }
    });
  }

  private draw(): void {
    if (!PierceMarks.isEnabled) {
      this.hideFrom(0);
      return;
    }
    const shells = this.shells.getChildren() as Phaser.Physics.Arcade.Image[];
    let at = 0;
    for (const shell of shells) {
      if (!shell.active) {
        continue;
      }
      const label = this.labelAt(at);
      at += 1;
      const pierce = this.pierces(shell);
      label.setText(pierce ? 'пробивает' : 'не пробивает');
      label.setColor(pierce ? '#b6f5a0' : '#ffb4a8');
      label.setPosition(shell.x, shell.y - 14);
      label.setVisible(true);
    }
    this.hideFrom(at);
  }

  private labelAt(index: number): Phaser.GameObjects.Text {
    const existing = this.labels[index];
    if (existing) {
      return existing;
    }
    const label = this.scene.add
      .text(0, 0, '', {
        fontSize: '14px',
        color: '#ffb4a8',
        stroke: '#1a1208',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(28);
    this.labels.push(label);
    return label;
  }

  private hideFrom(index: number): void {
    for (let i = index; i < this.labels.length; i += 1) {
      this.labels[i].setVisible(false);
    }
  }
}
