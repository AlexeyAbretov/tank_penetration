// Линейка поля боя: риски и сетка каждые 50 px по полю до баннера.
// Подписи на каждой сотой. Скрывается выключателем в настройках дебага.
// Глубина выше поля и интерфейса, ниже окон настроек и паузы.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { FieldRuler } from './FieldRuler';

const STEP = 50;
const MAJOR = 100;
const DEPTH = 86;
const COLOR = 0xffe14a;
const ALPHA = 0.7;
const GRID_ALPHA = 0.28;
const GRID_MAJOR_ALPHA = 0.45;
const TICK = 10;
const MAJOR_TICK = 16;

export class FieldRulerOverlay {
  private readonly pen: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.pen = scene.add.graphics().setDepth(DEPTH);
    const draw = (): void => this.draw();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, draw);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, draw);
      this.pen.destroy();
      for (const label of this.labels) {
        label.destroy();
      }
      this.labels.length = 0;
    });
  }

  private draw(): void {
    this.pen.clear();
    if (!FieldRuler.isEnabled) {
      this.hideLabels();
      return;
    }

    const width = GAME.width;
    const bottom = GAME.bannerY;
    this.drawGrid(width, bottom);
    this.pen.lineStyle(1, COLOR, ALPHA);

    this.pen.lineBetween(0, 0, width, 0);
    this.pen.lineBetween(0, bottom, width, bottom);
    this.pen.lineBetween(0, 0, 0, bottom);
    this.pen.lineBetween(width, 0, width, bottom);

    for (let x = 0; x <= width; x += STEP) {
      const len = x % MAJOR === 0 ? MAJOR_TICK : TICK;
      this.pen.lineBetween(x, 0, x, len);
      this.pen.lineBetween(x, bottom, x, bottom - len);
    }
    for (let y = 0; y <= bottom; y += STEP) {
      const len = y % MAJOR === 0 ? MAJOR_TICK : TICK;
      this.pen.lineBetween(0, y, len, y);
      this.pen.lineBetween(width, y, width - len, y);
    }

    this.paintLabels(width, bottom);
  }

  // Линии на весь кадр. Края пропускаем: их рисует сама линейка.
  private drawGrid(width: number, bottom: number): void {
    for (let x = STEP; x < width; x += STEP) {
      this.pen.lineStyle(1, COLOR, x % MAJOR === 0 ? GRID_MAJOR_ALPHA : GRID_ALPHA);
      this.pen.lineBetween(x, 0, x, bottom);
    }
    for (let y = STEP; y < bottom; y += STEP) {
      this.pen.lineStyle(1, COLOR, y % MAJOR === 0 ? GRID_MAJOR_ALPHA : GRID_ALPHA);
      this.pen.lineBetween(0, y, width, y);
    }
  }

  private paintLabels(width: number, bottom: number): void {
    let at = 0;
    for (let x = 0; x <= width; x += MAJOR) {
      const label = this.labelAt(at);
      label.setText(String(x));
      label.setOrigin(x === 0 ? 0 : x === width ? 1 : 0.5, 0);
      label.setPosition(x, MAJOR_TICK + 2);
      label.setVisible(true);
      at += 1;
    }
    for (let x = 0; x <= width; x += MAJOR) {
      const label = this.labelAt(at);
      label.setText(String(x));
      label.setOrigin(x === 0 ? 0 : x === width ? 1 : 0.5, 1);
      label.setPosition(x, bottom - MAJOR_TICK - 2);
      label.setVisible(true);
      at += 1;
    }
    // Ноль уже стоит на горизонтальных осях. По вертикали подписи со 100.
    for (let y = MAJOR; y <= bottom; y += MAJOR) {
      const label = this.labelAt(at);
      label.setText(String(y));
      label.setOrigin(0, 0.5);
      label.setPosition(MAJOR_TICK + 4, y);
      label.setVisible(true);
      at += 1;
    }
    for (let y = MAJOR; y < bottom; y += MAJOR) {
      const label = this.labelAt(at);
      label.setText(String(y));
      label.setOrigin(1, 0.5);
      label.setPosition(width - MAJOR_TICK - 4, y);
      label.setVisible(true);
      at += 1;
    }
    for (let i = at; i < this.labels.length; i += 1) {
      this.labels[i].setVisible(false);
    }
  }

  private labelAt(index: number): Phaser.GameObjects.Text {
    const existing = this.labels[index];
    if (existing) {
      return existing;
    }
    const label = this.scene.add
      .text(0, 0, '', {
        fontSize: '14px',
        color: '#ffe14a',
        fontFamily: 'monospace',
      })
      .setDepth(DEPTH)
      .setAlpha(ALPHA)
      .setOrigin(0, 0.5);
    this.labels.push(label);
    return label;
  }

  private hideLabels(): void {
    for (const label of this.labels) {
      label.setVisible(false);
    }
  }
}
