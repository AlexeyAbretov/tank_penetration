// Штурмовик: обычный солдат. Идёт влево до базы и бьёт её при контакте.
// Это тип врага «по умолчанию», если номер в волне не подошёл стрелку или пикапу.

// Phaser нужен из-за типа Scene в конструкторе.
import Phaser from 'phaser';
import { ASSAULT_LOOK, CORPSE_FRAME, SOLDIER_FRAME } from '../gfx/looks';
import { bake } from '../gfx/textures';
import { Infantry } from './Infantry';
// Тип спавна в своём файле. Импорт из EnemyFactory замкнул бы круг: фабрика уже импортирует этот класс.
import type { SpawnContext } from './SpawnContext';

export class AssaultInfantry extends Infantry {
  static readonly walkFps = 7;
  static readonly corpseKey = 'infantry-corpse';

  // Убийство даёт 1 монету.
  readonly coinReward = 1;
  // Доходит до стены, в отличие от стрелков.
  readonly reachesBase = true;
  // Столько здоровья базы снимает один дошедший солдат.
  readonly contactDamage = 12;

  // Фабрика спрашивает по очереди: «этот номер в волне — твой?».
  // Штурмовик отвечает «да» всегда, поэтому в списке фабрики он стоит последним.
  // _index не используется: подчёркивание показывает, что аргумент нужен только ради общей сигнатуры.
  static matches(_index: number): boolean {
    return true;
  }

  // Собирает солдата из данных, которые сцена передала фабрике.
  static spawn(ctx: SpawnContext): Infantry {
    return new AssaultInfantry(ctx.scene, ctx.x, ctx.y, ctx.hp);
  }

  // Два кадра шага и анимация, которая их чередует. Повторный вызов ничего не рисует заново.
  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('infantry-0')) {
      bake(scene, 'infantry-0', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 0, ASSAULT_LOOK),
      );
      bake(scene, 'infantry-1', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 1, ASSAULT_LOOK),
      );
    }
    if (!scene.textures.exists(this.corpseKey)) {
      bake(scene, this.corpseKey, CORPSE_FRAME.w, CORPSE_FRAME.h, (g) =>
        this.drawCorpse(g, ASSAULT_LOOK),
      );
    }
    // exists: после поражения сцена создаётся снова, а анимация живёт в общем менеджере.
    if (!scene.anims.exists('infantry-walk')) {
      scene.anims.create({
        key: 'infantry-walk',
        // Кадры — две отдельные текстуры, не разрезанный лист.
        frames: [{ key: 'infantry-0' }, { key: 'infantry-1' }],
        frameRate: this.walkFps,
        repeat: -1, // крутить без конца
      });
    }
  }

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number) {
    // Картинки infantry-0 / infantry-1 и анимация infantry-walk, красная полоска HP.
    super(scene, x, y, hp, 'infantry-0', 'infantry-walk', 0xd42a2a);
  }

  protected override corpseTexture(): string | null {
    return AssaultInfantry.corpseKey;
  }
}
