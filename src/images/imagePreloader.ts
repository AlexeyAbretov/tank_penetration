import { AssaultInfantry } from '../entities/AssaultInfantry';
import { MachineGun } from '../entities/MachineGun';
import { Tank } from '../entities/Tank';

// Картинки живут у сущностей. Здесь только собираем их в один вызов для GameScene.
export const preloadImages = (scene: Phaser.Scene) => {
  Tank.preload(scene);
  MachineGun.preload(scene);
  AssaultInfantry.preload(scene);
};
