// Защитная завеса: вертикальная стена энергии перед линией, которую передаёт бой.
// Покупка открывает вызов по клавише 5 и по иконке. Срок и откат считает CombatSystem.
// Пока завеса стоит, пуля и ракета гаснут на ней, а удар по базе урона не наносит.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { t } from '../locale';

type Glint = {
  y: number;
  life: number;
};

export class EnergyWall {
  static readonly iconKey = 'energy-wall-icon';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static readonly iconPath = 'assets/energy-wall-icon.png';
  static readonly iconRadius = 30;

  static readonly shop = {
    cost: 100,
    // Без покупок завеса стоит одну секунду.
    durationMs: 1_000,
    cooldownMs: 3 * 60_000,
  };

  // Бой прибавляет это к правому краю проволоки и передаёт уже центр завесы.
  static readonly ahead = 16;
  // Толщина светящейся полосы. Правый край — плоскость, на которой гаснет выстрел.
  static readonly thickness = 18;

  // Магазин партии прибавляет свою секунду шагом 0,1 с. Прогресс — свою, тем же шагом.
  static readonly shopDurationStepMs = 100;
  static readonly progressDurationStepMs = 100;
  static readonly shopDurationAddMsMax = 1_000;
  static readonly progressDurationAddMsMax = 1_000;

  // Каждый магазин снимает свои 0,5 с шагом 0,1 с. Вместе откат не короче 2:59.
  static readonly shopCooldownStepMs = 100;
  static readonly progressCooldownStepMs = 100;
  static readonly shopCooldownCutMsMax = 500;
  static readonly progressCooldownCutMsMax = 500;
  static readonly minCooldownMs =
    EnergyWall.shop.cooldownMs - EnergyWall.shopCooldownCutMsMax - EnergyWall.progressCooldownCutMsMax;

  static progressDurationLevel = 0;
  static shopDurationLevel = 0;
  static progressCooldownLevel = 0;
  static shopCooldownLevel = 0;

  private x = 0;
  private leftMs = 0;
  private graphic?: Phaser.GameObjects.Graphics;
  private readonly glints: Glint[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  static setShopDurationLevel(level: number): void {
    EnergyWall.shopDurationLevel = Math.min(
      EnergyWall.maxShopDurationLevel,
      Math.max(0, Math.round(level)),
    );
  }

  static get maxShopDurationLevel(): number {
    return EnergyWall.shopDurationAddMsMax / EnergyWall.shopDurationStepMs;
  }

  static get maxProgressDurationLevel(): number {
    return EnergyWall.progressDurationAddMsMax / EnergyWall.progressDurationStepMs;
  }

  static setProgressDurationLevel(level: number): void {
    EnergyWall.progressDurationLevel = Math.min(
      EnergyWall.maxProgressDurationLevel,
      Math.max(0, Math.round(level)),
    );
  }

  // Свой запас прогресса уже выбран — следующий уровень завесу не удлиняет.
  static progressDurationLengthens(progressLevel: number): boolean {
    const shop = EnergyWall.shopDurationLevel;
    return EnergyWall.durationFor(shop, progressLevel + 1) > EnergyWall.durationFor(shop, progressLevel);
  }

  static durationFor(shopLevel: number, progressLevel = EnergyWall.progressDurationLevel): number {
    const shopAdd = Math.min(
      EnergyWall.shopDurationAddMsMax,
      Math.max(0, Math.round(shopLevel)) * EnergyWall.shopDurationStepMs,
    );
    const progressAdd = Math.min(
      EnergyWall.progressDurationAddMsMax,
      Math.max(0, Math.round(progressLevel)) * EnergyWall.progressDurationStepMs,
    );
    return EnergyWall.shop.durationMs + shopAdd + progressAdd;
  }

  static setShopCooldownLevel(level: number): void {
    EnergyWall.shopCooldownLevel = Math.min(
      EnergyWall.maxShopCooldownLevel,
      Math.max(0, Math.round(level)),
    );
  }

  static get maxShopCooldownLevel(): number {
    return EnergyWall.shopCooldownCutMsMax / EnergyWall.shopCooldownStepMs;
  }

  static get maxProgressCooldownLevel(): number {
    return EnergyWall.progressCooldownCutMsMax / EnergyWall.progressCooldownStepMs;
  }

  static setProgressCooldownLevel(level: number): void {
    EnergyWall.progressCooldownLevel = Math.min(
      EnergyWall.maxProgressCooldownLevel,
      Math.max(0, Math.round(level)),
    );
  }

  // Свой запас прогресса уже выбран — следующий уровень откат не укорачивает.
  static progressCooldownShortens(progressLevel: number): boolean {
    const shop = EnergyWall.shopCooldownLevel;
    return EnergyWall.cooldownFor(shop, progressLevel + 1) < EnergyWall.cooldownFor(shop, progressLevel);
  }

  static cooldownFor(shopLevel: number, progressLevel = EnergyWall.progressCooldownLevel): number {
    const progressCut = Math.min(
      EnergyWall.progressCooldownCutMsMax,
      Math.max(0, Math.round(progressLevel)) * EnergyWall.progressCooldownStepMs,
    );
    const shopCut = Math.min(
      EnergyWall.shopCooldownCutMsMax,
      Math.max(0, Math.round(shopLevel)) * EnergyWall.shopCooldownStepMs,
    );
    return Math.max(EnergyWall.minCooldownMs, EnergyWall.shop.cooldownMs - progressCut - shopCut);
  }

  // 1.0 с, следующий шаг 1.1 с. Потолок обоих магазинов — 3.0 с.
  static durationLabel(ms: number): string {
    return t().time.seconds((ms / 1000).toFixed(1));
  }

  static preload(scene: Phaser.Scene): void {
    if (scene.textures.exists(EnergyWall.iconKey)) {
      return;
    }
    scene.load.image(EnergyWall.iconKey, EnergyWall.iconPath);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(EnergyWall.iconKey)) {
      scene.textures.get(EnergyWall.iconKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  up(): boolean {
    return this.leftMs > 0;
  }

  // Правый край полосы при уже выбранном центре. За этой линией — поле врагов.
  static outerFace(centerX: number): number {
    return centerX + EnergyWall.thickness / 2;
  }

  // Правый край стоящей полосы. Выстрел левее этой линии уже за завесой.
  face(): number | null {
    if (this.leftMs <= 0) {
      return null;
    }
    return EnergyWall.outerFace(this.x);
  }

  // centerX — середина полосы. Длительность уже с обоими магазинами.
  raise(centerX: number, durationMs: number): void {
    this.x = centerX;
    this.leftMs = Math.max(0, durationMs);
    this.glints.length = 0;
    if (!this.graphic) {
      // Выше солдат (10), проволоки (13) и чужих пуль (15), ниже танка (25).
      this.graphic = this.scene.add.graphics().setDepth(16);
    }
    this.graphic.setVisible(true);
    this.graphic.setAlpha(1);
    this.draw();
  }

  // Вспышка на плоскости: патрон или ракета погасли, до брони не дошли.
  glint(y: number): void {
    if (this.leftMs <= 0) {
      return;
    }
    this.glints.push({ y, life: 180 });
    if (this.glints.length > 16) {
      this.glints.shift();
    }
  }

  tick(delta: number): void {
    if (this.leftMs <= 0) {
      return;
    }
    this.leftMs -= delta;
    for (const hit of this.glints) {
      hit.life -= delta;
    }
    for (let i = this.glints.length - 1; i >= 0; i -= 1) {
      if (this.glints[i].life <= 0) {
        this.glints.splice(i, 1);
      }
    }
    if (this.leftMs <= 0) {
      this.drop();
      return;
    }
    this.draw();
  }

  drop(): void {
    this.leftMs = 0;
    this.glints.length = 0;
    this.graphic?.clear();
    this.graphic?.setVisible(false);
  }

  // Мягкое поле, синяя стена и белая сердцевина. Последние 0,2 с завеса гаснет.
  private draw(): void {
    const g = this.graphic;
    if (!g) {
      return;
    }
    const fade = this.leftMs < 200 ? Math.max(0, this.leftMs / 200) : 1;
    g.setAlpha(fade);
    g.clear();
    const top = 0;
    const height = GAME.bannerY - top;
    const x = this.x;
    const thick = EnergyWall.thickness;
    const left = x - thick / 2;

    g.fillStyle(0x1a6cff, 0.16);
    g.fillRect(left - 14, top, thick + 28, height);
    g.fillStyle(0x2f8cff, 0.38);
    g.fillRect(left, top, thick, height);
    g.fillStyle(0x9be7ff, 0.72);
    g.fillRect(x - 3, top, 6, height);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(x - 1, top, 2, height);

    const travel = (this.scene.time.now / 1000) * 90;
    g.fillStyle(0xe8fbff, 0.55);
    for (let i = 0; i < 7; i += 1) {
      const y = top + ((travel + i * (height / 7)) % height);
      g.fillRect(left + 2, y, thick - 4, 5);
    }

    for (const hit of this.glints) {
      const alpha = Math.max(0, hit.life / 180);
      g.fillStyle(0xffffff, 0.85 * alpha);
      g.fillEllipse(x, hit.y, 28, 16);
      g.fillStyle(0x9be7ff, 0.45 * alpha);
      g.fillEllipse(x, hit.y, 48, 28);
    }
  }
}
