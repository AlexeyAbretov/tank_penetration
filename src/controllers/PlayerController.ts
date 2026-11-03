// Танк игрока, здоровье базы и сценарий поражения.

import Phaser from 'phaser';
import { Tank } from '../entities/Tank/Tank';
import { TankBaseHp } from '../entities/Tank/TankBaseHp';
import { isDebugRun } from '../gameConfig';
import { floatDamage } from '../gfx/damageFloat';
import type { GameHud } from '../ui/huds/GameHud';
import type { TankDeath } from '../sounds/TankDeath';

type DefeatDeps = {
  enemyShots: Phaser.Physics.Arcade.Group;
  infantry: Phaser.Physics.Arcade.Group;
  clearPlayerCombat: () => void;
};

export class PlayerController {
  // Гибель базы: спрайт взрыва короче, огонь и дым над обломками держатся дольше.
  // Магазин очков выходит, когда это уже можно рассмотреть.
  private static readonly defeatShopDelayMs = 2400;

  readonly tank: Tank;
  private hp: number;
  private baseHp: number;
  private gameOver = false;
  private unwatch = (): void => {};

  // Запас новой партии. Дебаг-наследник подставляет число из настроек.
  static baseHp(): number {
    return TankBaseHp.currentOf();
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hud: GameHud,
    private readonly defeatDeps: DefeatDeps,
    private readonly onDefeated: () => void,
    private readonly deathSound: TankDeath,
  ) {
    this.baseHp = (this.constructor as typeof PlayerController).baseHp();
    this.hp = this.baseHp;
    this.tank = new Tank(scene, Tank.spawn.x, Tank.spawn.y);
    this.unwatch = this.watchBaseHp();
    this.tank.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unwatch();
    });
  }

  // Покупка запаса меняет и полоску, и текущее здоровье. Дебаг слушает своё число.
  protected watchBaseHp(): () => void {
    return TankBaseHp.watch((hp) => this.setBaseHp(hp));
  }

  get isGameOver(): boolean {
    return this.gameOver;
  }

  get health(): number {
    return this.hp;
  }

  reset(): void {
    this.hp = this.baseHp;
    this.gameOver = false;
    this.hud.setHp(this.hp);
  }

  restoreHealth(hp: number): void {
    this.hp = Math.min(this.baseHp, Math.max(1, Math.round(hp)));
    this.gameOver = false;
    this.hud.setHp(this.hp);
  }

  // Запас целиком: и потолок полоски, и текущее здоровье.
  protected setBaseHp(hp: number): void {
    this.baseHp = hp;
    this.hp = hp;
    this.hud.setMaxHp(hp);
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
    const before = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    // В дебаге над башней всплывает нанесённое число, как у пехоты.
    // Танк и выхлоп рисуются выше цифр пехоты, поэтому у брони свой слой.
    if (isDebugRun() && before > this.hp) {
      const shown = amount < 10_000 ? amount : before - this.hp;
      const top = this.tank.topPoint();
      floatDamage(this.scene, top.x, top.y, shown, 32);
    }
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
    this.scene.time.delayedCall(PlayerController.defeatShopDelayMs, () => {
      this.onDefeated();
    });
  }
}
