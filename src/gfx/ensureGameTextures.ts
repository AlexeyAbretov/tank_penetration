// Прогрев всех текстур игры. Отдельный файл, чтобы textures.ts не импортировал сущности:
// сущности сами вызывают bake() из textures.ts, и общий импорт зациклил бы модули.

import Phaser from 'phaser';
import { BomberStrike } from '../entities/BomberStrike';
import { IonCannon } from '../entities/IonCannon';
import { BarbedWire } from '../entities/BarbedWire';
import { FlameTank } from '../entities/FlameTank';
import { LaserDefense } from '../entities/LaserDefense';
import { RocketSalvo } from '../entities/RocketSalvo';
import { MachineGun } from '../entities/MachineGun';
import { Mines } from '../entities/Mines';
import { EnergyWall } from '../entities/EnergyWall';
import { NuclearStrike } from '../entities/NuclearStrike';
import { AssaultInfantry } from '../entities/AssaultInfantry';
import { GunnerInfantry } from '../entities/GunnerInfantry';
import { PickupTruck } from '../entities/PickupTruck';
import { Rocket } from '../entities/Rocket';
import { HeavyTank } from '../entities/HeavyTank';
import { Helicopter } from '../entities/Helicopter';
import { RocketBuggy } from '../entities/RocketBuggy';
import { RocketInfantry } from '../entities/RocketInfantry';
import { SuperSoldier } from '../entities/SuperSoldier';
import { ensureCoinMark } from './coinMark';
import { ensureCraters } from './craters';
import { createTextures } from './textures';
import { Muzzle } from './muzzle';

export function ensureGameTextures(scene: Phaser.Scene): void {
  createTextures(scene);
  ensureCraters(scene);
  ensureCoinMark(scene);

  Muzzle.ensureTextures(scene);
  MachineGun.ensureTextures(scene);
  LaserDefense.ensureTextures(scene);
  FlameTank.ensureTextures(scene);
  RocketSalvo.ensureTextures(scene);
  BarbedWire.ensureTextures(scene);
  BomberStrike.ensureTextures(scene);
  IonCannon.ensureTextures(scene);
  Mines.ensureTextures(scene);
  NuclearStrike.ensureTextures(scene);
  EnergyWall.ensureTextures(scene);
  AssaultInfantry.ensureTextures(scene);
  GunnerInfantry.ensureTextures(scene);
  RocketInfantry.ensureTextures(scene);
  SuperSoldier.ensureTextures(scene);
  Rocket.ensureTextures(scene);
  PickupTruck.ensureTextures(scene);
  RocketBuggy.ensureTextures(scene);
  Helicopter.ensureTextures(scene);
  HeavyTank.ensureTextures(scene);
}
