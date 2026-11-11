// Пули и ракеты врагов: уборка за экраном, урон по танку, поглощение и гашение на завесе.

import Phaser from 'phaser';
import { EnemyShot } from '../entities/EnemyShot';
import { HeavyShell } from '../entities/HeavyShell';
import { Rocket } from '../entities/Rocket';
import { Tank, type PartBox } from '../entities/Tank/Tank';
import { GAME } from '../gameConfig';
import { createArmorSparks, emitArmorSparks } from '../gfx/sparks';
import type { BattleEffects } from '../sounds/BattleEffects';

export class ProjectileSystem {
  private readonly armorSparks: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tank: Tank,
    private readonly enemyShots: Phaser.Physics.Arcade.Group,
    private readonly onTankDamage: (amount: number) => void,
    private readonly effects: BattleEffects,
    private readonly shieldFace: () => number | null,
    private readonly onShield: (y: number) => void,
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
      // Завеса стоит впереди брони. Входящий патрон гаснет на её правом крае.
      // Уже отскочивший летит дальше: он бьёт врагов, а не базу.
      const face = this.shieldFace();
      if (face !== null && !shot.hasBounced() && shot.x <= face) {
        const y = shot.y;
        shot.destroy();
        this.onShield(y);
        return;
      }
      if (!this.tank.containsPoint(shot.x, shot.y)) {
        return;
      }
      // Уже отскочивший патрон броню больше не бьёт, даже если ещё касается силуэта.
      if (shot.hasBounced()) {
        return;
      }

      const damage = shot.damage;
      const x = shot.x;
      const y = shot.y;
      const travel = shot.rotation;
      const isRocket = shot instanceof Rocket;
      if (this.absorbed()) {
        this.ricochet(shot, x, y, travel, isRocket);
        return;
      }
      shot.destroy();

      if (shot instanceof HeavyShell) {
        HeavyShell.burstAt(this.scene, x, y);
        // Тот же файл, что у артиллерии, но громче: снаряд один, не залп.
        this.effects.boomSounds.playTankHit();
      } else if (isRocket) {
        Rocket.burstAt(this.scene, x, y);
        this.effects.rocketSounds.playHit();
      } else {
        emitArmorSparks(this.armorSparks, x, y, travel);
        this.effects.bulletHit.play();
      }
      this.onTankDamage(damage);
    });
  }

  // Свой бросок на каждый патрон и снаряд. Очередь общий шанс не делит.
  private absorbed(): boolean {
    const chance = Tank.absorbChance();
    if (chance <= 0) {
      return false;
    }
    return Math.random() * 100 < chance;
  }

  // Танку урона нет. Патрон меняет курс и выходит из силуэта, ракета не рвётся.
  // Каждый враг на обратном пути получает урон этого выстрела: это считает бой.
  private ricochet(shot: EnemyShot, x: number, y: number, travel: number, isRocket: boolean): void {
    const angle = this.deflectAngle(x, y, travel);
    shot.bounce(angle);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let step = 0; step < 48 && this.tank.containsPoint(shot.x, shot.y); step += 1) {
      shot.setPosition(shot.x + cos * 4, shot.y + sin * 4);
    }
    // Конец кадра прибавляет спрайту уже посчитанный сдвиг. Без сброса патрон втягивает обратно в броню.
    const body = shot.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.prevFrame.x = body.position.x;
      body.prevFrame.y = body.position.y;
    }
    emitArmorSparks(this.armorSparks, x, y, travel);
    if (!isRocket) {
      this.effects.bulletHit.play();
    }
  }

  // Случайный курс в открытую сторону от грани, в которую патрон вошёл.
  private deflectAngle(x: number, y: number, travel: number): number {
    const normal = this.faceNormal(x, y, travel);
    const outward = normal ? Math.atan2(normal.y, normal.x) : travel + Math.PI;
    return outward + (Math.random() - 0.5) * Math.PI;
  }

  // Внешняя нормаль грани в мире. Корпус считается до поворота башни.
  private faceNormal(x: number, y: number, travel: number): Point | null {
    const shake = this.tank.shake;
    const localX = x - this.tank.x - shake.x;
    const localY = y - this.tank.y - shake.y;
    const vx = Math.cos(travel);
    const vy = Math.sin(travel);
    const hull = this.entryNormal(localX, localY, Tank.hullBox(), vx, vy);
    if (hull) {
      return hull;
    }
    const aimAngle = this.tank.aimAngle;
    const aim = Tank.intoAim(localX, localY, aimAngle);
    const vel = this.spinBack(vx, vy, aimAngle);
    const gun = this.tank.gunPlace;
    const boxes = [Tank.turretBox(), Tank.gunBox(gun.x, gun.y), ...this.tank.turretHitBoxes];
    for (const box of boxes) {
      const normal = this.entryNormal(aim.x, aim.y, box, vel.x, vel.y);
      if (!normal) {
        continue;
      }
      return this.spinForward(normal.x, normal.y, aimAngle);
    }
    return null;
  }

  // Вектор из мира в оси башни. Сиденье не вычитаем: это направление, не точка.
  private spinBack(x: number, y: number, angle: number): Point {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { x: x * cos + y * sin, y: -x * sin + y * cos };
  }

  private spinForward(x: number, y: number, angle: number): Point {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  }

  // Внешняя нормаль грани, через которую точка вошла в прямоугольник. Скорость — единичный вектор.
  private entryNormal(x: number, y: number, box: PartBox, vx: number, vy: number): Point | null {
    if (!Tank.inBox(x, y, box)) {
      return null;
    }
    let best = Number.POSITIVE_INFINITY;
    let nx = 0;
    let ny = -1;
    const consider = (t: number, faceX: number, faceY: number) => {
      if (t >= 0 && t < best) {
        best = t;
        nx = faceX;
        ny = faceY;
      }
    };
    if (vx > 0) {
      consider((x - box.x) / vx, -1, 0);
    } else if (vx < 0) {
      consider((box.x + box.w - x) / -vx, 1, 0);
    }
    if (vy > 0) {
      consider((y - box.y) / vy, 0, -1);
    } else if (vy < 0) {
      consider((box.y + box.h - y) / -vy, 0, 1);
    }
    if (!Number.isFinite(best)) {
      return this.nearestFace(x, y, box);
    }
    return { x: nx, y: ny };
  }

  private nearestFace(x: number, y: number, box: PartBox): Point {
    const left = x - box.x;
    const right = box.x + box.w - x;
    const top = y - box.y;
    const bottom = box.y + box.h - y;
    const nearest = Math.min(left, right, top, bottom);
    if (nearest === left) {
      return { x: -1, y: 0 };
    }
    if (nearest === right) {
      return { x: 1, y: 0 };
    }
    if (nearest === top) {
      return { x: 0, y: -1 };
    }
    return { x: 0, y: 1 };
  }
}

type Point = { x: number; y: number };
