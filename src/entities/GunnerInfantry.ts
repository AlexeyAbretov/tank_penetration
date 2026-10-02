// Стрелок: доходит до середины поля, встаёт и редко, но больно стреляет по танку.

import Phaser from 'phaser';
import { GUNNER_LOOK, SOLDIER_FRAME } from '../gfx/looks';
import { bake } from '../gfx/textures';
import type { SpawnContext } from './SpawnContext';
import { Infantry } from './Infantry';
import { RangedEnemy } from './RangedEnemy';

export class GunnerInfantry extends RangedEnemy {
  static readonly walkFps = 7;
  // Дуло длинной винтовки левее и выше точки ног спрайта.
  static readonly muzzleOffset = { x: -38, y: -42 };

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
  protected readonly muzzle = GunnerInfantry.muzzleOffset;

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
      bake(scene, 'gunner-0', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 0, GUNNER_LOOK),
      );
      bake(scene, 'gunner-1', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 1, GUNNER_LOOK),
      );
    }
    if (!scene.anims.exists('gunner-walk')) {
      scene.anims.create({
        key: 'gunner-walk',
        frames: [{ key: 'gunner-0' }, { key: 'gunner-1' }],
        frameRate: this.walkFps,
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
