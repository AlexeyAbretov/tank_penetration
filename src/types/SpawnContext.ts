// Данные для появления одного врага. Собирает сцена, читает только EnemyFactory.

import Phaser from 'phaser';
import type { WorldPoint } from './WorldPoint';

export type SpawnContext = {
  scene: Phaser.Scene; // сцена, на которую встанет спрайт
  x: number; // стартовая координата, обычно правее экрана
  y: number; // дорожка
  wave: number; // номер текущей волны: от него зависят тип врага и ранг роста
  shots: Phaser.Physics.Arcade.Group; // куда стрелки складывают пули
  // Куда целятся дальнобойные враги. Задаёт сцена, юнит класс танка не знает.
  fireTarget: WorldPoint;
};
