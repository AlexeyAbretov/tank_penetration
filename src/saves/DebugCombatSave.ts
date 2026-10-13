// Дебаг-партия. Тот же формат, что у обычной, но свой ключ в localStorage.
// Пустая запись уже с купленными пулемётом, автострельбой и артиллерией.
// Монеты за них не списываются: магазин просто поднимает флаги через restore.

import { Tank } from '../entities/Tank';
import { CombatSave, type SavedRun } from '../saves/CombatSave';

const DEBUG_KEY = 'tank-penetration-combat:debug';

export class DebugCombatSave extends CombatSave {
  protected storageKey(): string {
    return DEBUG_KEY;
  }

  protected emptyRun(): SavedRun {
    return {
      version: 1,
      score: 0,
      coins: 0,
      hp: Tank.baseHp,
      haste: 1,
      artilleryCooldownMs: 0,
      wave: 1,
      phase: 'combat',
      spawned: 0,
      enemies: [],
      shop: {
        blast: 0,
        damage: 0,
        fireRate: 0,
        wire: false,
        machineGun: true,
        artillery: true,
        autoFire: true,
        autoFireOn: true,
      },
    };
  }
}
