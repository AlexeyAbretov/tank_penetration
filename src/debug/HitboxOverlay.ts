// Рамки хитбоксов живых врагов. Трупы не обводим: тело уже выключено.
// Зелёная рамка — прямоугольник, которым враг упирается в проволоку.
// Жёлтый круг — куда должен долететь снаряд танка или пуля пулемёта, чтобы засчитать попадание.
// Голубой круг на снаряде — радиус взрыва. Тот же, которым бой задевает соседей.
// Под ним тёмное кольцо: сам снаряд оранжевый и ярче тонкой линии того же цвета.

import Phaser from 'phaser';
import { Infantry } from '../entities/Infantry';
import { Hitboxes } from './Hitboxes';

export class HitboxOverlay {
  private readonly pen: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly infantry: Phaser.Physics.Arcade.Group,
    private readonly shells: Phaser.Physics.Arcade.Group,
    private readonly blastRadius: () => number,
  ) {
    // Выше танка, ниже плашек: обводку видно и когда враг зашёл на корпус.
    this.pen = scene.add.graphics().setDepth(26);
    const draw = (): void => this.draw();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, draw);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, draw);
      this.pen.destroy();
    });
  }

  private draw(): void {
    this.pen.clear();
    if (!Hitboxes.isEnabled) {
      return;
    }
    const units = this.infantry.getChildren() as Infantry[];
    for (const unit of units) {
      if (!unit.active || unit.reachedWall) {
        continue;
      }
      const body = unit.body as Phaser.Physics.Arcade.Body | null;
      if (!body?.enable) {
        continue;
      }
      this.pen.lineStyle(2, 0x3dff7a, 0.95);
      this.pen.strokeRect(body.x, body.y, body.width, body.height);
      const center = unit.hitCenter();
      this.pen.lineStyle(2, 0xffe14a, 0.9);
      this.pen.strokeCircle(center.x, center.y, unit.shellRadius());
    }
    this.drawBlasts();
  }

  private drawBlasts(): void {
    const radius = this.blastRadius();
    if (radius <= 0) {
      return;
    }
    const shells = this.shells.getChildren() as Phaser.Physics.Arcade.Image[];
    for (const shell of shells) {
      if (!shell.active) {
        continue;
      }
      this.pen.lineStyle(5, 0x041018, 0.95);
      this.pen.strokeCircle(shell.x, shell.y, radius);
      this.pen.lineStyle(2, 0x3ee0ff, 1);
      this.pen.strokeCircle(shell.x, shell.y, radius);
    }
  }
}
