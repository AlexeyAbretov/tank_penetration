// Колючая проволока перед танком: одна полоса от верха поля до баннера.
// Пехоту, которая идёт к базе, она не пускает и каждые несколько секунд ранит.

import Phaser, { GameObjects, Physics, Scene } from 'phaser';
import { bake } from '../gfx/textures';

type WireBlockTarget = {
  reachesBase: boolean;
  active: boolean;
  reachedWall: boolean;
  body: Physics.Arcade.Body | Physics.Arcade.StaticBody | null;
};

export class BarbedWire extends GameObjects.Image {
  static readonly textureKey = 'barbed-wire';

  static readonly bounds = {
    x: 196,
    face: 232,
    top: 72,
    bottom: 630,
  };

  static readonly shop = {
    cost: 50,
    damage: 1,
    hurtIntervalMs: 3000,
  };

  constructor(scene: Phaser.Scene) {
    BarbedWire.ensureTextures(scene);
    const top = BarbedWire.bounds.top;
    const height = BarbedWire.bounds.bottom - top;
    // Картинка якорится центром, поэтому X — середина между левым краем и линией упора.
    super(
      scene,
      (BarbedWire.bounds.x + BarbedWire.bounds.face) / 2,
      top + height / 2,
      BarbedWire.textureKey,
    );
    scene.add.existing(this);
    // Выше солдат (10), ниже снарядов (15) и танка (25): фигуры упираются в нити и читаются за ними.
    this.setDepth(13);
  }

  static ensureTextures(scene: Scene): void {
    if (scene.textures.exists(this.textureKey)) {
      return;
    }
    const width = BarbedWire.bounds.face - BarbedWire.bounds.x;
    const height = BarbedWire.bounds.bottom - BarbedWire.bounds.top;
    bake(scene, this.textureKey, width, height, (g) => this.draw(g, width, height));
  }

  // Два столба и косые нити с колючками. Высота уже посчитана сценой, рисуем её целиком без швов.
  private static draw(g: GameObjects.Graphics, width: number, height: number): void {
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
  blocks(unit: WireBlockTarget): boolean {
    if (!unit.reachesBase || !unit.active || unit.reachedWall) {
      return false;
    }
    const body = unit.body;
    // Масштаб 1.45 оставляет левый край на долю пикселя правее линии упора.
    // Строгое сравнение с face видит касание один кадр, и удары раз в 3 с не повторяются.
    return !!body && body.left <= BarbedWire.bounds.face + 1;
  }
}
