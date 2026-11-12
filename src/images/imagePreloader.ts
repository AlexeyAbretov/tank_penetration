import { BomberStrike } from '../entities/BomberStrike';
import { EnergyWall } from '../entities/EnergyWall';
import { IonCannon } from '../entities/IonCannon';
import { AssaultInfantry } from '../entities/AssaultInfantry';
import { BarbedWire } from '../entities/BarbedWire';
import { GunnerInfantry } from '../entities/GunnerInfantry';
import { PickupTruck } from '../entities/PickupTruck';
import { HeavyTank } from '../entities/HeavyTank';
import { Helicopter } from '../entities/Helicopter';
import { RocketBuggy } from '../entities/RocketBuggy';
import { RocketInfantry } from '../entities/RocketInfantry';
import { SuperSoldier } from '../entities/SuperSoldier';
import { FlameTank } from '../entities/FlameTank';
import { LaserDefense } from '../entities/LaserDefense';
import { RocketSalvo } from '../entities/RocketSalvo';
import { MachineGun } from '../entities/MachineGun';
import { Mines } from '../entities/Mines';
import { NuclearStrike } from '../entities/NuclearStrike';
import { Tank } from '../entities/Tank/Tank';
import { EmpFlash } from '../abilities/EmpFlashAbility/EmpFlash';
import { preloadAirBurst } from '../gfx/airBurst';
import { preloadCampfire, preloadFlameStream, preloadScorchedEarth } from '../gfx/flame';
import { preloadBombBoom } from '../gfx/bombBoom';
import { preloadBoom } from '../gfx/boom';
import { preloadCraters } from '../gfx/craters';
import { preloadNuke } from '../gfx/nuke';
import { preloadTankBoom } from '../gfx/tankBoom';
import { ShopPanel } from '../ui/shops/ShopPanel';

// Картинки живут у сущностей. Здесь только собираем их в один вызов для GameScene.
export const preloadImages = (scene: Phaser.Scene) => {
  // Трава с той же фотографии, что и воронки. Строка буквальная: singlefile подменяет её на data:.
  scene.load.image('battlefield', 'assets/battlefield.jpg');
  
  Tank.preload(scene);
  BarbedWire.preload(scene);
  preloadCraters(scene);
  MachineGun.preload(scene);
  LaserDefense.preload(scene);
  FlameTank.preload(scene);
  RocketSalvo.preload(scene);

  NuclearStrike.preload(scene);
  Mines.preload(scene);
  BomberStrike.preload(scene);
  IonCannon.preload(scene);
  EnergyWall.preload(scene);
  EmpFlash.preload(scene);
  
  AssaultInfantry.preload(scene);
  GunnerInfantry.preload(scene);
  PickupTruck.preload(scene);
  RocketBuggy.preload(scene);
  Helicopter.preload(scene);
  RocketInfantry.preload(scene);
  SuperSoldier.preload(scene);
  HeavyTank.preload(scene);
  preloadTankBoom(scene);
  preloadNuke(scene);
  preloadBoom(scene);
  preloadBombBoom(scene);
  preloadCampfire(scene);
  preloadFlameStream(scene);
  preloadScorchedEarth(scene);
  preloadAirBurst(scene);
  // Знак монеты обычного магазина. Путь к файлу — в ShopPanel.preload.
  ShopPanel.preload(scene);
};
