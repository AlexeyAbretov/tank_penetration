// Прогрев всех текстур игры. Отдельный файл, чтобы textures.ts не импортировал сущности:
// сущности сами вызывают bake() из textures.ts, цикл сломает studio.

import Phaser from 'phaser';
import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { AssaultInfantry } from '../entities/AssaultInfantry';
import { EnemyShot } from '../entities/EnemyShot';
import { GunnerInfantry } from '../entities/GunnerInfantry';
import { PickupTruck } from '../entities/PickupTruck';
import { Rocket } from '../entities/Rocket';
import { RocketInfantry } from '../entities/RocketInfantry';
import { Tank } from '../entities/Tank';
import { createTextures } from './textures';

export function ensureGameTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('battlefield')) {
    createTextures(scene);
  }
  Tank.ensureTextures(scene);
  ArtilleryStrike.ensureTextures(scene);
  AssaultInfantry.ensureTextures(scene);
  GunnerInfantry.ensureTextures(scene);
  RocketInfantry.ensureTextures(scene);
  Rocket.ensureTextures(scene);
  PickupTruck.ensureTextures(scene);
  EnemyShot.ensureTextures(scene);
}
