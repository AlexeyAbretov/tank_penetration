// Бомбардировщик: пролёт над полем и очередь бомб на одной линии от завесы до края поля.
// Покупка в магазине открывает вызов по клавише 6 и по иконке на HUD.
// Линию и подрыв считает CombatSystem. Самолёт линию врагов не выбирает.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { bombBoomAt } from '../gfx/bombBoom';
import { craterReach, placeCrater } from '../gfx/craters';
import { playBoom } from '../sounds/BoomSounds';

export type BomberFlight = {
  cancel(): void;
};

export class BomberStrike {
  static readonly iconKey = 'bomber-icon';
  static readonly planeKey = 'bomber';
  static readonly bombKey = 'air-bomb';
  // Пути буквальные: singlefile-сборка подменяет каждый на data:.
  static readonly iconPath = 'assets/bomber-icon.png';
  static readonly planePath = 'assets/bomber.png';
  static readonly bombPath = 'assets/air-bomb.png';
  static readonly iconRadius = 30;
  // Холст самолёта. Нос смотрит вправо, поэтому пролёт идёт слева направо.
  static readonly frame = { w: 168, h: 72 };
  // Холст бомбы. Носик у нижнего края: origin спрайта стоит на острие.
  static readonly bombFrame = { w: 32, h: 64 };

  static readonly shop = {
    cost: 1000,
    damage: 100,
    cooldownMs: 3 * 60_000,
    craterMs: 5_000,
    // Пехота на этой линии в круге получает урон. Соседняя дорожка (72 px) уже вне круга.
    blastRadius: 40,
    // Самый широкий шаг вдоль линии. Меньше двух радиусов: чаши заходят друг на друга.
    gap: 36,
    fallMs: 460,
    // Высота пролёта. Ниже неё — полоса, где ходят враги.
    flyY: 78,
    // Пиксели в секунду. Поле 1280 самолёт проходит чуть дольше двух секунд.
    speed: 560,
  };

  // Вместе с магазином очков откат не короче 1 минуты. У каждого магазина свой запас в 1 минуту.
  // Шаг — 0,1 минуты.
  static readonly minCooldownMs = 60_000;
  static readonly cooldownStepMs = 6_000;
  static readonly shopCutMsMax = 60_000;
  static readonly progressCutMsMax = 60_000;
  static progressCooldownLevel = 0;
  // Сколько шагов партия уже докупила в этом заходе. Прогресс читает это, чтобы карточка показывала текущий откат.
  static shopCooldownLevel = 0;

  static setShopCooldownLevel(level: number): void {
    BomberStrike.shopCooldownLevel = Math.min(
      BomberStrike.maxShopCooldownLevel,
      Math.max(0, Math.round(level)),
    );
  }

  static get maxShopCooldownLevel(): number {
    return BomberStrike.shopCutMsMax / BomberStrike.cooldownStepMs;
  }

  static get maxProgressCooldownLevel(): number {
    return BomberStrike.progressCutMsMax / BomberStrike.cooldownStepMs;
  }

  static setProgressCooldownLevel(level: number): void {
    BomberStrike.progressCooldownLevel = Math.min(
      BomberStrike.maxProgressCooldownLevel,
      Math.max(0, Math.round(level)),
    );
  }

  // Свой запас прогресса уже выбран — следующий уровень откат не укорачивает.
  static progressCooldownShortens(progressLevel: number): boolean {
    const shop = BomberStrike.shopCooldownLevel;
    return BomberStrike.cooldownFor(shop, progressLevel + 1) < BomberStrike.cooldownFor(shop, progressLevel);
  }

  static cooldownFor(shopLevel: number, progressLevel = BomberStrike.progressCooldownLevel): number {
    const progressCut = Math.min(
      BomberStrike.progressCutMsMax,
      Math.max(0, Math.round(progressLevel)) * BomberStrike.cooldownStepMs,
    );
    const shopCut = Math.min(
      BomberStrike.shopCutMsMax,
      Math.max(0, Math.round(shopLevel)) * BomberStrike.cooldownStepMs,
    );
    return Math.max(BomberStrike.minCooldownMs, BomberStrike.shop.cooldownMs - progressCut - shopCut);
  }

  // Полоса высот, где ходят враги. Края линии по горизонтали считает impacts.
  static readonly field = {
    minY: 168,
    maxY: 544,
  };

  static preload(scene: Phaser.Scene): void {
    scene.load.image(BomberStrike.planeKey, BomberStrike.planePath);
    scene.load.image(BomberStrike.bombKey, BomberStrike.bombPath);
    if (!scene.textures.exists(BomberStrike.iconKey)) {
      scene.load.image(BomberStrike.iconKey, BomberStrike.iconPath);
    }
  }

  static ensureTextures(scene: Phaser.Scene): void {
    for (const key of [BomberStrike.planeKey, BomberStrike.bombKey, BomberStrike.iconKey]) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
  }

  // Одна высота от правого края завесы до правого края поля.
  // pastX даёт бой: бомбардировщик не знает, где стоит стена.
  // Первая бомба сразу за этой плоскостью, чаша не заходит на сторону базы.
  // Последняя — у края поля, чаша остаётся в кадре. Шаг не шире gap, края заняты.
  static impacts(pastX: number, y: number): { x: number; y: number }[] {
    const reach = craterReach();
    const field = BomberStrike.field;
    const yLine = Phaser.Math.Clamp(Math.round(y), field.minY, field.maxY);
    const left = Math.ceil(pastX + reach);
    const right = Math.max(left, Math.floor(GAME.width - reach));
    const span = right - left;
    if (span <= 0) {
      return [{ x: left, y: yLine }];
    }
    const steps = Math.ceil(span / BomberStrike.shop.gap);
    const step = span / steps;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i += 1) {
      points.push({ x: Math.round(left + i * step), y: yLine });
    }
    return points;
  }

  // Самолёт пересекает поле слева направо и роняет бомбу над каждой точкой.
  // onImpact — взрыв, когда носик сел. Отмена гасит и самолёт, и бомбы, которые ещё летят.
  static pass(
    scene: Phaser.Scene,
    points: { x: number; y: number }[],
    onImpact: (x: number, y: number) => void,
  ): BomberFlight {
    const shop = BomberStrike.shop;
    const startX = -BomberStrike.frame.w / 2;
    const endX = GAME.width + BomberStrike.frame.w / 2;
    const duration = ((endX - startX) / shop.speed) * 1000;
    const plane = scene.add
      .image(startX, shop.flyY, BomberStrike.planeKey)
      .setOrigin(0.5, 0.5)
      .setDepth(19);
    let cancelled = false;
    const drops: { cancel(): void }[] = [];
    const timers: Phaser.Time.TimerEvent[] = [];

    const tween = scene.tweens.add({
      targets: plane,
      x: endX,
      duration,
      ease: 'Linear',
      onComplete: () => {
        if (!cancelled && plane.scene) {
          plane.destroy();
        }
      },
    });

    // Бомба выходит из-под брюха, когда нос самолёта поравнялся с точкой.
    const belly = shop.flyY + BomberStrike.frame.h / 2;
    for (const point of points) {
      const delay = Math.max(0, ((point.x - startX) / shop.speed) * 1000);
      const timer = scene.time.delayedCall(delay, () => {
        if (cancelled) {
          return;
        }
        drops.push(BomberStrike.drop(scene, point.x, belly, point.y, () => onImpact(point.x, point.y)));
      });
      timers.push(timer);
    }

    return {
      cancel() {
        if (cancelled) {
          return;
        }
        cancelled = true;
        tween.stop();
        if (plane.scene) {
          plane.destroy();
        }
        for (const timer of timers) {
          timer.remove(false);
        }
        for (const drop of drops) {
          drop.cancel();
        }
      },
    };
  }

  // Разрыв, воронка и хлопок. Воронка гаснет сама через craterMs.
  static boom(scene: Phaser.Scene, x: number, y: number): void {
    playBoom(scene);
    bombBoomAt(scene, x, y);
    placeCrater(scene, x, y, BomberStrike.shop.craterMs);
    scene.cameras.main.shake(70, 0.0025);
  }

  private static drop(
    scene: Phaser.Scene,
    x: number,
    fromY: number,
    y: number,
    onImpact: () => void,
  ): { cancel(): void } {
    const bomb = scene.add.image(x, fromY, BomberStrike.bombKey).setOrigin(0.5, 1).setDepth(18);
    let settled = false;
    const tween = scene.tweens.add({
      targets: bomb,
      y,
      duration: BomberStrike.shop.fallMs,
      ease: 'Quad.In',
      onComplete: () => {
        if (settled) {
          return;
        }
        settled = true;
        bomb.destroy();
        onImpact();
      },
    });
    return {
      cancel() {
        if (settled) {
          return;
        }
        settled = true;
        tween.stop();
        bomb.destroy();
      },
    };
  }
}
