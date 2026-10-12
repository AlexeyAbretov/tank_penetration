// Собирает сцену до старта Phaser. В список сцен кладётся готовый объект:
// иначе движок вызовет конструктор без аргументов, и restart() поднимет пустую сцену.
// Дебаг-ветка стоит отдельно. В сборке для игроков isDebugRun() становится false,
// и DebugCombatSave с DebugEnemyFactory из бандла выпадают.

import { DebugEnemyFactory } from '../entities/DebugEnemyFactory';
import { EnemyFactory } from '../entities/EnemyFactory';
import { isDebugRun } from '../gameConfig';
import { BattleMusic } from '../systems/BattleMusic';
import { DebugCombatSave } from '../systems/DebugCombatSave';
import { CombatSave } from '../systems/CombatSave';
import { WaveManager } from '../systems/WaveManager';
import { GameScene } from './GameScene';

export class GameSceneFactory {
  static create(): GameScene {
    if (isDebugRun()) {
      const enemies = DebugEnemyFactory;
      return new GameScene(new DebugCombatSave(), new WaveManager(enemies), new BattleMusic(enemies));
    }
    const enemies = EnemyFactory;
    return new GameScene(new CombatSave(), new WaveManager(enemies), new BattleMusic(enemies));
  }
}
