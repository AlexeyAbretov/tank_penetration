// Колючая проволока перед танком: две полосы спиралей от верха поля до баннера.
// Вторая сдвинута на полвитка и заполняет просветы первой.
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
  // Сырая полоса. В бою из неё собирается текстура из двух слоёв.
  private static readonly sourceKey = 'barbed-wire-coil';
  // Путь в public/. Строка буквальная: singlefile-сборка подменяет её на data:.
  static readonly imagePath = 'assets/barbed-wire.png';
  // Сдвиг второго слоя в пикселях исходной полосы: спирали попадают в просветы первой.
  private static readonly coilShift = 34;
  // Повтор тех же спиралей. Второй слой замыкается на него, а не на всю высоту картинки:
  // иначе вверх попадает обрубок нижнего края и там остаётся один виток.
  private static readonly coilPeriod = 92;

  // face — правый край, в него упирается пехота.
  // x — левый край витка: полоса из картинки растянута на высоту поля, ширина равна диаметру спирали.
  static readonly bounds = {
    x: 170,
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
    const top = BarbedWire.bounds.top;
    const height = BarbedWire.bounds.bottom - top;
    const width = BarbedWire.bounds.face - BarbedWire.bounds.x;
    // Картинка якорится центром, поэтому X — середина между левым краем и линией упора.
    super(
      scene,
      (BarbedWire.bounds.x + BarbedWire.bounds.face) / 2,
      top + height / 2,
      BarbedWire.textureKey,
    );
    scene.add.existing(this);
    this.setDisplaySize(width, height);
    // Выше солдат (10), ниже снарядов (15) и танка (25): фигуры упираются в нити и читаются за ними.
    this.setDepth(13);
  }

  // GameScene зовёт до create.
  static preload(scene: Phaser.Scene): void {
    scene.load.image(this.sourceKey, this.imagePath);
  }

  // В бою полоса — картинка из assets/, наложенная дважды. Фигурный рисунок остаётся, если файл не загрузили.
  static ensureTextures(scene: Scene): void {
    if (scene.textures.exists(this.textureKey)) {
      scene.textures.get(this.textureKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      return;
    }
    const width = BarbedWire.bounds.face - BarbedWire.bounds.x;
    const height = BarbedWire.bounds.bottom - BarbedWire.bounds.top;
    if (!scene.textures.exists(this.sourceKey)) {
      bake(scene, this.textureKey, width, height, (g) => this.draw(g, width, height));
      return;
    }
    const source = scene.textures.get(this.sourceKey).getSourceImage() as CanvasImageSource;
    const frame = scene.textures.get(this.sourceKey).get();
    const canvas = scene.textures.createCanvas(this.textureKey, width, height);
    if (!canvas) {
      return;
    }
    const scale = height / frame.height;
    const shift = Math.round(BarbedWire.coilShift * scale);
    const period = Math.round(BarbedWire.coilPeriod * scale);
    canvas.context.drawImage(source, 0, 0, width, height);
    canvas.context.drawImage(source, 0, shift, width, height);
    canvas.context.drawImage(source, 0, shift - period, width, height);
    canvas.refresh();
    scene.textures.get(this.textureKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
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
