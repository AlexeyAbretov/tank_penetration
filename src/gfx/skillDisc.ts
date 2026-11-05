// Круг кнопки навыка. Знак внутри рисует сама кнопка.

import Phaser from 'phaser';

// Тёмный обод, багровая заливка и латунное кольцо. Знак кладут поверх, внутри кольца.
export function paintSkillDisc(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number): void {
  g.fillStyle(0x2a0c0c);
  g.fillCircle(cx, cy, radius);
  g.fillStyle(0x5a1210);
  g.fillCircle(cx, cy, radius - 4);
  g.lineStyle(3, 0xf0d56a, 1);
  g.strokeCircle(cx, cy, radius - 2);
}
