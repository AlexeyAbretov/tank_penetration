import Phaser from 'phaser';
import { AssaultInfantry } from './AssaultInfantry';
import { GunnerInfantry } from './GunnerInfantry';
import { Infantry } from './Infantry';
import { PickupTruck } from './PickupTruck';

export type SpawnContext = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  hp: number;
  shots: Phaser.Physics.Arcade.Group;
};

type EnemyKind = {
  matches(index: number): boolean;
  spawn(ctx: SpawnContext): Infantry;
};

export class EnemyFactory {
  private static readonly kinds: EnemyKind[] = [
    PickupTruck,
    GunnerInfantry,
    AssaultInfantry,
  ];

  static create(index: number, ctx: SpawnContext): Infantry {
    const kind = this.kinds.find((entry) => entry.matches(index)) ?? AssaultInfantry;
    return kind.spawn(ctx);
  }
}
