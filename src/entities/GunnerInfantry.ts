// Стрелок: доходит до середины поля, встаёт и редко, но больно стреляет по танку.

import Phaser from 'phaser';
import { bake } from '../gfx/textures';
import type { SpawnContext } from './SpawnContext';
import { Infantry, type SoldierLook } from './Infantry';
import { RangedEnemy } from './RangedEnemy';

export class GunnerInfantry extends RangedEnemy {
  // Стрелок темнее и в сине-сером, винтовка длиннее — её дуло вылезает левее тела.
  private static readonly look: SoldierLook = {
    pants: 0x2a3a32,
    tunic: 0x4a5a52,
    vest: 0x1a2a22,
    helmet: 0x2a3a28,
    helmetLight: 0x8ab0c8,
    longRifle: true,
  };

  // Дороже штурмовика: убивать стрелка выгоднее.
  readonly coinReward = 2;
  // Рубеж остановки. 640 — центр поля шириной 1280.
  protected readonly holdX = 640;
  // Выстрел раз в 1.5 секунды.
  protected readonly fireDelay = 1500;
  // Медленнее пули пикапа, но урон выше.
  protected readonly bulletSpeed = 420;
  // Один выстрел снимает 8 HP базы из 100.
  protected readonly shotDamage = 8;
  // Стоящий кадр: первая картинка из пары шага.
  protected readonly idleTexture = 'gunner-0';
  // Дуло длинной винтовки левее и выше точки ног спрайта.
  protected readonly muzzle = { x: -38, y: -42 };

  // Каждый 3-й индекс из четвёрки: 2, 6, 10, 14...
  // Но 14 ещё и «каждый 5-й хвост» для пикапа (14 % 5 === 4).
  // Пикап в фабрике проверяется раньше, поэтому такой номер станет машиной, не стрелком.
  static matches(index: number): boolean {
    return index % 4 === 2;
  }

  static spawn(ctx: SpawnContext): Infantry {
    return new GunnerInfantry(ctx.scene, ctx.x, ctx.y, ctx.hp, ctx.shots);
  }

  // Кадры шага стрелка. Рисунок общий с пехотой, цвета — look этого класса.
  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('gunner-0')) {
      bake(scene, 'gunner-0', 64, 80, (g) => this.drawSoldier(g, 0, this.look));
      bake(scene, 'gunner-1', 64, 80, (g) => this.drawSoldier(g, 1, this.look));
    }
    if (!scene.anims.exists('gunner-walk')) {
      scene.anims.create({
        key: 'gunner-walk',
        frames: [{ key: 'gunner-0' }, { key: 'gunner-1' }],
        frameRate: 7,
        repeat: -1,
      });
    }
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    shots: Phaser.Physics.Arcade.Group,
  ) {
    // Синяя полоска отличает стрелка от красного штурмовика и жёлтого пикапа.
    super(scene, x, y, hp, 'gunner-0', 'gunner-walk', 0x3a8ad4, shots);
  }
}
