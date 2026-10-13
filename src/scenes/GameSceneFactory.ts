// Собирает сцену до старта Phaser. В список сцен кладётся готовый объект:
// иначе движок вызовет конструктор без аргументов, и restart() поднимет пустую сцену.
// Дебаг-ветка стоит отдельно. В сборке для игроков isDebugRun() становится false,
// и DebugCombatSave с DebugEnemyFactory из бандла выпадают.

import { DebugEnemyFactory } from '../entities/DebugEnemyFactory';
import { EnemyFactory } from '../entities/EnemyFactory';
import { isDebugRun } from '../gameConfig';
import { BattleMusic } from '../systems/BattleMusic';
import { DebugCombatSave } from '../saves/DebugCombatSave';
import { CombatSave } from '../saves/CombatSave';
import { WaveManager } from '../systems/WaveManager';
import { GameScene } from './GameScene';
import { DebugGameHud } from '../ui/DebugGameHud';
import { GameHud } from '../ui/GameHud';

export class GameSceneFactory {
  static create(): GameScene {
    if (isDebugRun()) {
      const enemies = DebugEnemyFactory;
      
      return new GameScene(
        new DebugCombatSave(), 
        new WaveManager(enemies),
        new BattleMusic(enemies),
        DebugGameHud
      );
    }

    const enemies = EnemyFactory;

    return new GameScene(
      new CombatSave(),
      new WaveManager(enemies),
      new BattleMusic(enemies),
      GameHud);
  }
}
