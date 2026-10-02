// Колючая проволока перед танком: одна полоса от верха поля до баннера.
// Пехоту, которая идёт к базе, она не пускает и каждые несколько секунд ранит.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { bake } from '../gfx/textures';
import { Infantry } from './Infantry';

export class BarbedWire extends Phaser.GameObjects.Image {
  static readonly textureKey = 'barbed-wire';

  constructor(scene: Phaser.Scene) {
    BarbedWire.ensureTextures(scene);
    const top = GAME.barbedWireTop;
    const height = GAME.barbedWireBottom - top;
    // Картинка якорится центром, поэтому X — середина между левым краем и линией упора.
    super(scene, (GAME.barbedWireX + GAME.barbedWireFace) / 2, top + height / 2, BarbedWire.textureKey);
    scene.add.existing(this);
    // Выше солдат (10), ниже снарядов (15) и танка (25): фигуры упираются в нити и читаются за ними.
    this.setDepth(13);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(this.textureKey)) {
      return;
    }
    const width = GAME.barbedWireFace - GAME.barbedWireX;
    const height = GAME.barbedWireBottom - GAME.barbedWireTop;
    bake(scene, this.textureKey, width, height, (g) => this.draw(g, width, height));
  }

  // Два столба и косые нити с колючками. Высота уже посчитана сценой, рисуем её целиком без швов.
  private static draw(g: Phaser.GameObjects.Graphics, width: number, height: number): void {
    g.fillStyle(0x140604, 0.4);
    g.fillRect(width - 8, 0, 8, height);

    const post = (x: number) => {
      g.fillStyle(0x1c120c);
      g.fillRect(x, 0, 8, height);
      g.fillStyle(0xa06a3c);
      g.fillRect(x + 1, 0, 5, height);
      g.fillStyle(0xf0c080);
      g.fillRect(x + 2, 0, 2, height);
    };
    post(0);
    post(width - 8);

    for (let y = 10; y < height - 6; y += 16) {
      g.lineStyle(4, 0x2a241c, 1);
      g.beginPath();
      g.moveTo(6, y);
      g.lineTo(width - 6, y + 5);
      g.strokePath();
      g.lineStyle(2, 0xe7dcc8, 1);
      g.beginPath();
      g.moveTo(6, y + 5);
      g.lineTo(width - 6, y);
      g.strokePath();

      g.fillStyle(0xfff6e8);
      for (const x of [13, 18, 23]) {
        g.fillTriangle(x, y - 5, x + 3, y + 2, x - 3, y + 2);
        g.fillTriangle(x, y + 10, x + 3, y + 3, x - 3, y + 3);
      }
    }
  }

  // true, если этот юнит идёт к базе и его передний край уже на линии проволоки.
  blocks(unit: Infantry): boolean {
    if (!unit.reachesBase || !unit.active || unit.reachedWall) {
      return false;
    }
    const body = unit.body as Phaser.Physics.Arcade.Body | null;
    // Масштаб 1.45 оставляет левый край на долю пикселя правее линии упора.
    // Строгое сравнение с face видит касание один кадр, и удары раз в 3 с не повторяются.
    return !!body && body.left <= GAME.barbedWireFace + 1;
  }
}
