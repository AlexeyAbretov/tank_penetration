import { Infantry } from './Infantry';

export class AssaultInfantry extends Infantry {
  readonly coinReward = 1;
  readonly reachesBase = true;
  readonly contactDamage = 12;

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number) {
    super(scene, x, y, hp, 'infantry-0', 'infantry-walk', 0xd42a2a);
  }
}
