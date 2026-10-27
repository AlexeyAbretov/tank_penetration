import { AssaultInfantry } from '../entities/AssaultInfantry';
import { GunnerInfantry } from '../entities/GunnerInfantry';
import { MachineGun } from '../entities/MachineGun';
import { NuclearStrike } from '../entities/NuclearStrike';
import { Tank } from '../entities/Tank';
import { preloadArtilleryBoom } from '../gfx/artilleryBoom';
import { preloadCraters } from '../gfx/craters';
import { preloadNuke } from '../gfx/nuke';
import { preloadTankBoom } from '../gfx/tankBoom';

// Картинки живут у сущностей. Здесь только собираем их в один вызов для GameScene.
export const preloadImages = (scene: Phaser.Scene) => {
  // Трава с той же фотографии, что и воронки. Строка буквальная: singlefile подменяет её на data:.
  scene.load.image('battlefield', 'assets/battlefield.jpg');
  Tank.preload(scene);
  preloadCraters(scene);
  MachineGun.preload(scene);
  NuclearStrike.preload(scene);
  AssaultInfantry.preload(scene);
  GunnerInfantry.preload(scene);
  preloadTankBoom(scene);
  preloadNuke(scene);
  preloadArtilleryBoom(scene);
};
