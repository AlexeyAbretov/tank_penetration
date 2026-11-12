// Данные для появления одного врага. Собирает сцена, читает только EnemyFactory.

import Phaser from 'phaser';
import type { WorldPoint } from './WorldPoint';

// Кого БТР просит выпустить из двери. Класс пехоты выбирает фабрика, не бронетранспортёр.
export type TroopKind = 'assault' | 'gunner' | 'rocket';

export type SpawnContext = {
  scene: Phaser.Scene; // сцена, на которую встанет спрайт
  x: number; // стартовая координата, обычно правее экрана
  y: number; // дорожка
  wave: number; // номер текущей волны: от него зависят тип врага и ранг роста
  shots: Phaser.Physics.Arcade.Group; // куда стрелки складывают пули
  // Куда целятся дальнобойные враги. Задаёт сцена, юнит класс танка не знает.
  fireTarget: WorldPoint;
  // Дверь БТР зовёт это, когда выпускает солдата. Волна кладёт его в отряд.
  deploy?: (kind: TroopKind, x: number, y: number) => void;
};
