// Дебаг-партия. Тот же формат, что у обычной, но свой ключ в localStorage.
// Пустая запись уже с купленными пулемётом, лазером, огнемётом, РСЗО, автострельбой, артиллерией, минами и атомным взрывом.
// Монеты за них не списываются: магазин просто поднимает флаги через restore.

import { TankDebugBaseHp } from '../entities/Tank/TankDebugBaseHp';
import { CombatSave, type SavedRun } from '../saves/CombatSave';

const DEBUG_KEY = 'tank-penetration-combat:debug';

export class DebugCombatSave extends CombatSave {
  // Старый дебаг-сейв записался до мин и атомного взрыва: в файле их нет, а партия с ними начинается.
  load(): SavedRun | null {
    const saved = super.load();
    if (saved) {
      saved.shop.mines = true;
      saved.shop.nuclear = true;
      saved.shop.laser = true;
      saved.shop.flame = true;
      saved.shop.salvo = true;
    }
    return saved;
  }

  protected storageKey(): string {
    return DEBUG_KEY;
  }

  protected hpMax(): number {
    return TankDebugBaseHp.max;
  }

  protected emptyRun(): SavedRun {
    return {
      version: 1,
      score: 0,
      coins: 0,
      hp: TankDebugBaseHp.currentOf(),
      haste: 1,
      artilleryCooldownMs: 0,
      minesCooldownMs: 0,
      nuclearCooldownMs: 0,
      flameCooldownMs: 0,
      flameWall: null,
      plantedMines: [],
      wave: 1,
      phase: 'combat',
      spawned: 0,
      enemies: [],
      shop: {
        blast: 0,
        damage: 0,
        fireRate: 0,
        flight: 0,
        knockback: 0,
        pierce: 0,
        wire: true,
        machineGun: true,
        laser: true,
        flame: true,
        salvo: true,
        artillery: true,
        artilleryCooldown: 0,
        mines: true,
        minesCooldown: 0,
        nuclear: true,
        nuclearCooldown: 0,
        autoFire: true,
        autoFireOn: true,
        mgDamage: 0,
        mgFireRate: 0,
        mgFlight: 0,
        wireDamage: 0,
        flameDamage: 0,
        salvoDamage: 0,
        artilleryDamage: 0,
        minesDamage: 0,
      },
    };
  }
}
