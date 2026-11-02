import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { AssaultInfantry } from '../entities/AssaultInfantry';
import { BarbedWire } from '../entities/BarbedWire';
import { GunnerInfantry } from '../entities/GunnerInfantry';
import { PickupTruck } from '../entities/PickupTruck';
import { RocketInfantry } from '../entities/RocketInfantry';
import { SuperSoldier } from '../entities/SuperSoldier';
import { LaserDefense } from '../entities/LaserDefense';
import { RocketSalvo } from '../entities/RocketSalvo';
import { MachineGun } from '../entities/MachineGun';
import { Mines } from '../entities/Mines';
import { NuclearStrike } from '../entities/NuclearStrike';
import { Tank } from '../entities/Tank/Tank';
import { GameHud } from '../ui/huds/GameHud';
import { preloadAirBurst } from '../gfx/airBurst';
import { preloadBoom } from '../gfx/boom';
import { preloadCraters } from '../gfx/craters';
import { preloadNuke } from '../gfx/nuke';
import { preloadTankBoom } from '../gfx/tankBoom';

// Картинки живут у сущностей. Здесь только собираем их в один вызов для GameScene.
export const preloadImages = (scene: Phaser.Scene) => {
  // Трава с той же фотографии, что и воронки. Строка буквальная: singlefile подменяет её на data:.
  scene.load.image('battlefield', 'assets/battlefield.jpg');
  GameHud.preload(scene);
  Tank.preload(scene);
  BarbedWire.preload(scene);
  preloadCraters(scene);
  MachineGun.preload(scene);
  LaserDefense.preload(scene);
  RocketSalvo.preload(scene);
  NuclearStrike.preload(scene);
  Mines.preload(scene);
  ArtilleryStrike.preload(scene);
  AssaultInfantry.preload(scene);
  GunnerInfantry.preload(scene);
  PickupTruck.preload(scene);
  RocketInfantry.preload(scene);
  SuperSoldier.preload(scene);
  preloadTankBoom(scene);
  preloadNuke(scene);
  preloadBoom(scene);
  preloadAirBurst(scene);
};
