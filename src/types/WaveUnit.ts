// Юнит на поле с точки зрения менеджера волн: жив ли, где стоит, чем писать снимок.
// GameObject — чтобы сразу класть в группу Phaser; класс Infantry сюда не входит.

import type Phaser from 'phaser';

export type WaveUnit = Phaser.GameObjects.GameObject & {
  // true — дошёл до базы или доигрывает смерть; волну и сохранение не держит.
  reachedWall: boolean;
  x: number;
  y: number;
  hp: number;
  paceRank: number;
  // Включает скорость после появления или восстановления из сохранения.
  march(): void;
};
