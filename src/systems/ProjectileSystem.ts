// Пули и ракеты врагов: уборка за экраном и урон по танку.

import Phaser from 'phaser';
import { EnemyShot } from '../entities/EnemyShot';
import { Rocket } from '../entities/Rocket';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import { createArmorSparks, emitArmorSparks } from '../gfx/sparks';
import type { BulletHitTank } from './BulletHitTank';

export class ProjectileSystem {
  private readonly armorSparks: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tank: Tank,
    private readonly enemyShots: Phaser.Physics.Arcade.Group,
    private readonly onTankDamage: (amount: number) => void,
    private readonly bulletHit: BulletHitTank,
  ) {
    this.armorSparks = createArmorSparks(scene);
  }

  tick(): void {
    this.enemyShots.getChildren().forEach((obj) => {
      const shot = obj as EnemyShot;
      if (!shot.active) {
        return;
      }
      if (shot.x < 0 || shot.x > GAME.width || shot.y < 0 || shot.y > GAME.bannerY) {
        shot.destroy();
        return;
      }
      if (!this.tank.containsPoint(shot.x, shot.y)) {
        return;
      }

      const damage = shot.damage;
      const x = shot.x;
      const y = shot.y;
      const travel = shot.rotation;
      const isRocket = shot instanceof Rocket;
      shot.destroy();

      if (isRocket) {
        Rocket.burstAt(this.scene, x, y);
      } else {
        emitArmorSparks(this.armorSparks, x, y, travel);
        this.bulletHit.play();
      }
      this.onTankDamage(damage);
    });
  }
}
