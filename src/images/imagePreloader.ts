import { AssaultInfantry } from '../entities/AssaultInfantry';
import { GunnerInfantry } from '../entities/GunnerInfantry';
import { MachineGun } from '../entities/MachineGun';
import { NuclearStrike } from '../entities/NuclearStrike';
import { Tank } from '../entities/Tank';
import { preloadNuke } from '../gfx/nuke';
import { preloadTankBoom } from '../gfx/tankBoom';

// Картинки живут у сущностей. Здесь только собираем их в один вызов для GameScene.
export const preloadImages = (scene: Phaser.Scene) => {
  Tank.preload(scene);
  MachineGun.preload(scene);
  NuclearStrike.preload(scene);
  AssaultInfantry.preload(scene);
  GunnerInfantry.preload(scene);
  preloadTankBoom(scene);
  preloadNuke(scene);
};
