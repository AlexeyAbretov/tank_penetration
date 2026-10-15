import { AssaultInfantry } from '../entities/AssaultInfantry';
import { GunnerInfantry } from '../entities/GunnerInfantry';
import { MachineGun } from '../entities/MachineGun';
import { Tank } from '../entities/Tank';
import { preloadTankBoom } from '../gfx/tankBoom';

// Картинки живут у сущностей. Здесь только собираем их в один вызов для GameScene.
export const preloadImages = (scene: Phaser.Scene) => {
  Tank.preload(scene);
  MachineGun.preload(scene);
  AssaultInfantry.preload(scene);
  GunnerInfantry.preload(scene);
  preloadTankBoom(scene);
};
