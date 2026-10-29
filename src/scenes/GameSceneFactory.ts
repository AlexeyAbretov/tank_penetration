// Собирает сцену до старта Phaser. В список сцен кладётся готовый объект:
// иначе движок вызовет конструктор без аргументов, и restart() поднимет пустую сцену.
// Дебаг-ветка стоит отдельно. В сборке для игроков isDebugRun() становится false,
// и дебаг-классы из бандла выпадают.

import { DebugPlayerController } from '../controllers/DebugPlayerController';
import { DebugEnemyFactory } from '../entities/DebugEnemyFactory';
import { EnemyFactory } from '../entities/EnemyFactory';
import { GAME, isDebugRun } from '../gameConfig';
import { BattleMusic } from '../sounds/BattleMusic';
import { DebugCombatSave } from '../saves/DebugCombatSave';
import { DebugProgressSave } from '../saves/DebugProgressSave';
import { CombatSave } from '../saves/CombatSave';
import { ProgressSave } from '../saves/ProgressSave';
import { DebugQuietPause } from '../controllers/DebugQuietPause';
import { PauseStack } from '../controllers/PauseStack';
import { ScreenPause } from '../controllers/ScreenPause';
import { ProgressShopController } from '../controllers/ProgressShopController';
import { DebugWaveManager } from '../systems/DebugWaveManager';
import { WaveManager } from '../systems/WaveManager';
import { GameScene } from './GameScene';
import { DebugCombatSystem } from '../systems/DebugCombatSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { DebugGameHud } from '../ui/huds/DebugGameHud';
import { GameHud } from '../ui/huds/GameHud';
import { DebugSettingsPanel } from '../ui/settings/DebugSettingsPanel';

export class GameSceneFactory {
  static create(): GameScene {
    if (isDebugRun()) {
      const enemies = DebugEnemyFactory;
      
      return new GameScene(
        new DebugCombatSave(),
        new ProgressShopController(new DebugProgressSave()),
        new DebugWaveManager(enemies, GAME),
        new BattleMusic(enemies),
        DebugGameHud,
        DebugCombatSystem,
        new PauseStack([new ScreenPause(), new DebugQuietPause()]),
        DebugSettingsPanel,
        DebugPlayerController,
      );
    }

    const enemies = EnemyFactory;

    return new GameScene(
      new CombatSave(),
      new ProgressShopController(new ProgressSave()),
      new WaveManager(enemies, GAME),
      new BattleMusic(enemies),
      GameHud,
      CombatSystem,
      new PauseStack([new ScreenPause()]),
    );
  }
}
