// Атомный взрыв: одна бомба падает в центр поля и накрывает всех, кто уже в кадре.
// Покупка в магазине открывает вызов по клавише 3 и по иконке на HUD.
// Падение, гриб и воронку считает CombatSystem.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { nuclearCraterKeys, placeCrater } from '../gfx/craters';
import { nuke, nukeAt } from '../gfx/nuke';
import { bake } from '../gfx/textures';
import { playNuclearBoom } from '../sounds/NuclearExplosion';

export type NuclearFlight = {
  cancel(): void;
};

export class NuclearStrike {
  static readonly iconKey = 'nuclear-icon';
  static readonly bombKey = 'nuclear-bomb';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static readonly iconPath = 'assets/nuclear-icon.png';
  static readonly iconRadius = 30;

  // Путь в public/. Строка буквальная: singlefile-сборка подменяет её на data:.
  // Кадр 100×210. Низ корпуса — точка опоры: бомба садится им в центр поля.
  static readonly imagePath = 'assets/nuclear-bomb.png';
  static readonly bombFrame = { w: 100, h: 210 };

  static readonly shop = {
    cost: 500,
    cooldownMs: 3 * 60_000,
    craterMs: 5_000,
    fallMs: 780,
  };

  // Вместе с магазином партии откат не короче 2 минут. Шаг обоих магазинов — 1 с.
  static readonly minCooldownMs = 2 * 60_000;
  static readonly cooldownStepMs = 1_000;
  // Прогресс снимает не больше полминуты и останавливается на 2:30.
  static readonly progressCutMsMax = 30_000;
  static progressCooldownLevel = 0;
  // Сколько секунд партия уже докупила в этом заходе. Прогресс читает это, чтобы не продавать шаг до 2:30 поверх пола.
  static shopCooldownLevel = 0;

  static setShopCooldownLevel(level: number): void {
    NuclearStrike.shopCooldownLevel = Math.max(0, Math.round(level));
  }

  // Сколько секунд партия ещё может докупить до пола 2 минут при уже купленном прогрессе.
  static get maxShopCooldownLevel(): number {
    return NuclearStrike.shopLevelsFor(NuclearStrike.progressCooldownLevel);
  }

  static get minProgressCooldownMs(): number {
    return NuclearStrike.shop.cooldownMs - NuclearStrike.progressCutMsMax;
  }

  static get maxProgressCooldownLevel(): number {
    return (
      (NuclearStrike.shop.cooldownMs - NuclearStrike.minProgressCooldownMs) / NuclearStrike.cooldownStepMs
    );
  }

  static setProgressCooldownLevel(level: number): void {
    NuclearStrike.progressCooldownLevel = Math.min(
      NuclearStrike.maxProgressCooldownLevel,
      Math.max(0, Math.round(level)),
    );
  }

  // Прогресс не уводит откат ниже 2:30, даже если в сохранении уровень выше нового потолка.
  private static progressCutMs(level: number): number {
    const cut = Math.max(0, Math.round(level)) * NuclearStrike.cooldownStepMs;
    return Math.min(cut, NuclearStrike.shop.cooldownMs - NuclearStrike.minProgressCooldownMs);
  }

  // Партия забирает всё, что прогресс ещё не снял, вплоть до 2 минут.
  private static shopLevelsFor(progressLevel: number): number {
    const room =
      NuclearStrike.shop.cooldownMs -
      NuclearStrike.progressCutMs(progressLevel) -
      NuclearStrike.minCooldownMs;
    return Math.max(0, Math.floor(room / NuclearStrike.cooldownStepMs));
  }

  // Партия уже у 2 минут — следующий уровень прогресса откат не укорачивает.
  static progressCooldownShortens(progressLevel: number): boolean {
    const shop = NuclearStrike.shopCooldownLevel;
    return (
      NuclearStrike.cooldownFor(shop, progressLevel + 1) < NuclearStrike.cooldownFor(shop, progressLevel)
    );
  }

  static cooldownFor(shopLevel: number, progressLevel = NuclearStrike.progressCooldownLevel): number {
    const progressCut = NuclearStrike.progressCutMs(progressLevel);
    const maxShop = NuclearStrike.shopLevelsFor(progressLevel);
    const capped = Math.min(Math.max(0, Math.round(shopLevel)), maxShop);
    return Math.max(
      NuclearStrike.minCooldownMs,
      NuclearStrike.shop.cooldownMs - progressCut - capped * NuclearStrike.cooldownStepMs,
    );
  }

  // Дольше минуты — как на иконке: 3:00, следующий шаг 2:59. Пол — 2:00.
  static cooldownLabel(ms: number): string {
    const totalSec = ms / 1000;
    if (totalSec < 60) {
      const text = Number.isInteger(totalSec) ? String(totalSec) : totalSec.toFixed(1);
      return `${text} с`;
    }
    const min = Math.floor(totalSec / 60);
    const sec = totalSec - min * 60;
    const secText = Number.isInteger(sec) ? String(sec).padStart(2, '0') : sec.toFixed(1).padStart(4, '0');
    return `${min}:${secText}`;
  }

  // Кадр листа 400×256. 1.28 — шапка последней фазы почти у верхнего края и накрывает середину поля.
  static readonly mushroomScale = 1.28;

  // Чаша на ширину гриба. Кадры 0–2 разной ширины, масштаб считается от выбранного.
  static craterWidth(): number {
    return nuke.frame.w * NuclearStrike.mushroomScale;
  }

  // Облако гаснет за это время. Воронка живёт дольше: это след на земле, не сам взрыв.
  static readonly cloudMs = nuke.goneMs;

  // Середина дорожек. Танк стоит слева, враги въезжают справа — это центр поля, не край экрана.
  // Ширина читается в момент удара: на широком окне поле шире 1280.
  static impactAt(): { x: number; y: number } {
    return { x: GAME.width / 2, y: 356 };
  }

  // GameScene и студия зовут до create. Нет файла — иконка рисуется в ensureTextures.
  static preload(scene: Phaser.Scene): void {
    scene.load.image(NuclearStrike.bombKey, NuclearStrike.imagePath);
    if (!scene.textures.exists(NuclearStrike.iconKey)) {
      scene.load.image(NuclearStrike.iconKey, NuclearStrike.iconPath);
    }
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(NuclearStrike.iconKey)) {
      scene.textures.get(NuclearStrike.iconKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    } else {
      bake(scene, NuclearStrike.iconKey, 64, 64, (g) => NuclearStrike.renderIcon(g));
    }
    if (scene.textures.exists(NuclearStrike.bombKey)) {
      scene.textures.get(NuclearStrike.bombKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }

  // Большая бомба падает из-за верхнего края низом в центр поля. onImpact — взрыв, когда корпус сел.
  static drop(scene: Phaser.Scene, onImpact: () => void): NuclearFlight {
    const { x, y } = NuclearStrike.impactAt();
    const bomb = scene.add.image(x, -12, NuclearStrike.bombKey).setDepth(20);
    bomb.setOrigin(0.5, 1);

    let settled = false;
    const tween = scene.tweens.add({
      targets: bomb,
      y,
      duration: NuclearStrike.shop.fallMs,
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

  // Гриб на месте удара. Воронка остаётся после того, как облако погасло.
  static boom(scene: Phaser.Scene): void {
    playNuclearBoom(scene);
    const { x, y } = NuclearStrike.impactAt();
    const scale = NuclearStrike.mushroomScale;

    placeCrater(scene, x, y, NuclearStrike.shop.craterMs, {
      keys: nuclearCraterKeys,
      width: NuclearStrike.craterWidth(),
      fadeMs: 500,
    });

    // Пыль кадра стоит на воронке: origin гриба — нижняя линия листа.
    nukeAt(scene, x, y, scale);
    scene.cameras.main.shake(480, 0.009);
  }

  private static renderIcon(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x2a0c0c);
    g.fillCircle(32, 32, NuclearStrike.iconRadius);
    g.fillStyle(0x5a1210);
    g.fillCircle(32, 32, 26);
    g.lineStyle(3, 0xf0d56a, 1);
    g.strokeCircle(32, 32, 28);

    g.fillStyle(0x6a5646);
    g.fillTriangle(27, 52, 37, 52, 32, 28);
    g.fillStyle(0xd8c8b4);
    g.fillEllipse(32, 26, 40, 16);
    g.fillStyle(0xffb040);
    g.fillEllipse(32, 28, 24, 8);
    g.fillStyle(0xfff6d0);
    g.fillCircle(32, 24, 4);
  }
}
