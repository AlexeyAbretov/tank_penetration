// Танк игрока, здоровье базы и сценарий поражения.

import Phaser from 'phaser';
import { Tank } from '../entities/Tank';
import type { GameHud } from '../ui/GameHud';
import type { TankDeath } from './TankDeath';

type DefeatDeps = {
  enemyShots: Phaser.Physics.Arcade.Group;
  infantry: Phaser.Physics.Arcade.Group;
  clearPlayerCombat: () => void;
};

export class PlayerController {
  readonly tank: Tank;
  private hp = Tank.baseHp;
  private gameOver = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hud: GameHud,
    private readonly defeatDeps: DefeatDeps,
    private readonly onDefeated: () => void,
    private readonly deathSound: TankDeath,
  ) {
    this.tank = new Tank(scene, Tank.spawn.x, Tank.spawn.y);
  }

  get isGameOver(): boolean {
    return this.gameOver;
  }

  get health(): number {
    return this.hp;
  }

  reset(): void {
    this.hp = Tank.baseHp;
    this.gameOver = false;
    this.hud.setHp(this.hp);
  }

  restoreHealth(hp: number): void {
    this.hp = Math.min(Tank.baseHp, Math.max(1, Math.round(hp)));
    this.gameOver = false;
    this.hud.setHp(this.hp);
  }

  tick(delta: number, aimX: number, aimY: number): void {
    this.tank.tick(delta);
    this.tank.aimAt(aimX, aimY);
  }

  damage(amount: number): void {
    if (this.gameOver) {
      return;
    }
    this.hp = Math.max(0, this.hp - amount);
    this.hud.setHp(this.hp);
    if (this.hp <= 0) {
      this.defeat();
    }
  }

  private defeat(): void {
    this.gameOver = true;
    this.scene.registry.set('combat', false);
    this.scene.physics.world.pause();
    this.defeatDeps.clearPlayerCombat();
    this.defeatDeps.enemyShots.clear(true, true);
    this.defeatDeps.infantry.getChildren().forEach((obj) => {
      (obj as Phaser.Physics.Arcade.Sprite).body?.stop();
    });
    this.deathSound.play();
    this.tank.die();
    this.scene.cameras.main.shake(680, 0.014);
    this.scene.time.delayedCall(1300, () => {
      this.onDefeated();
    });
  }
}
