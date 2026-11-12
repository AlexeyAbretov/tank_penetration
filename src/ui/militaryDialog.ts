// Полевая карточка диалогов: олива, тёмная середина, латунные уголки.
// Кнопки HUD сюда не входят: у тех своя пластина с пробоинами.

import Phaser from 'phaser';

export const fieldInk = '#e6d7a8';
export const fieldInkStroke = '#1a2214';
export const fieldPaper = '#d4ccb8';
export const fieldMuted = '#7d7868';

const OLIVE_EDGE = 0x5a6844;
const OLIVE_WELL = 0x242c1c;
const BRASS = 0xc4a15a;
const ORDER_EDGE = 0x6e6240;
const ORDER_WELL = 0x3a4630;

// Углы — скобы, не заклёпки. alpha меньше единицы только у окна клавиш: поле за ним видно.
export function paintFieldPlate(g: Phaser.GameObjects.Graphics, w: number, h: number, alpha = 0.96): void {
  g.clear();
  const left = -w / 2;
  const top = -h / 2;
  g.fillStyle(OLIVE_EDGE, alpha);
  g.fillRect(left, top, w, h);
  g.fillStyle(OLIVE_WELL, alpha);
  g.fillRect(left + 10, top + 10, w - 20, h - 20);

  const arm = Math.min(26, Math.round(Math.min(w, h) * 0.08));
  const inset = 16;
  g.lineStyle(3, BRASS, 1);
  const marks: ReadonlyArray<readonly [number, number, number, number]> = [
    [left + inset, top + inset, 1, 1],
    [left + w - inset, top + inset, -1, 1],
    [left + inset, top + h - inset, 1, -1],
    [left + w - inset, top + h - inset, -1, -1],
  ];
  for (const [x, y, sx, sy] of marks) {
    g.beginPath();
    g.moveTo(x + sx * arm, y);
    g.lineTo(x, y);
    g.lineTo(x, y + sy * arm);
    g.strokePath();
  }
}

// Широкая планка приказа: латунный край и полоска слева. Не квадрат с заклёпками.
export function paintOrderBar(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.clear();
  const left = -w / 2;
  const top = -h / 2;
  g.fillStyle(ORDER_EDGE, 1);
  g.fillRect(left, top, w, h);
  g.fillStyle(ORDER_WELL, 1);
  g.fillRect(left + 3, top + 3, w - 6, h - 6);
  g.fillStyle(BRASS, 1);
  g.fillRect(left + 3, top + 3, 5, h - 6);
}

export const plusChipSize = 32;

// Квадрат «+» в заголовке дебаг-витрины. Латунной полосы нет: плюс остаётся в центре.
export function mountPlusChip(scene: Phaser.Scene, fire: () => void): Phaser.GameObjects.Container {
  const size = plusChipSize;
  const chip = scene.add.container(0, 0);
  const face = scene.add.graphics();
  const left = -size / 2;
  const top = -size / 2;
  face.fillStyle(ORDER_EDGE, 1);
  face.fillRect(left, top, size, size);
  face.fillStyle(ORDER_WELL, 1);
  face.fillRect(left + 3, top + 3, size - 6, size - 6);
  const label = scene.add
    .text(0, 0, '+', {
      fontSize: '22px',
      color: fieldInk,
    })
    .setOrigin(0.5);
  chip.add([face, label]);
  chip.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(left, top, size, size),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  });
  chip.on('pointerup', fire);
  return chip;
}

export function paintFieldRule(g: Phaser.GameObjects.Graphics, y: number, half: number): void {
  g.lineStyle(2, 0x8a7848, 0.9);
  g.beginPath();
  g.moveTo(-half, y);
  g.lineTo(half, y);
  g.strokePath();
}
