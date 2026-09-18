import { Infantry } from './Infantry';
import type { SpawnContext } from './EnemyFactory';

export class AssaultInfantry extends Infantry {
  readonly coinReward = 1;
  readonly reachesBase = true;
  readonly contactDamage = 12;

  static matches(_index: number): boolean {
    return true;
  }

  static spawn(ctx: SpawnContext): Infantry {
    return new AssaultInfantry(ctx.scene, ctx.x, ctx.y, ctx.hp);
  }

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number) {
    super(scene, x, y, hp, 'infantry-0', 'infantry-walk', 0xd42a2a);
  }
}
