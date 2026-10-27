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

  // Кадр листа 401×212. 1.55 — шапка последней фазы почти у верхнего края и накрывает середину поля.
  static readonly mushroomScale = 1.55;

  // Чаша на ширину гриба. Кадры 0–2 разной ширины, масштаб считается от выбранного.
  static craterWidth(): number {
    return nuke.frame.w * NuclearStrike.mushroomScale;
  }

  // Облако гаснет за это время. Воронка живёт дольше: это след на земле, не сам взрыв.
  static readonly cloudMs = nuke.goneMs;

  // Середина дорожек. Танк стоит слева, враги въезжают справа — это центр поля, не край экрана.
  static readonly impact = {
    x: GAME.width / 2,
    y: 356,
  };

  // GameScene и студия зовут до create. Иконка по-прежнему рисуется в ensureTextures.
  static preload(scene: Phaser.Scene): void {
    scene.load.image(NuclearStrike.bombKey, NuclearStrike.imagePath);
  }

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(NuclearStrike.iconKey)) {
      bake(scene, NuclearStrike.iconKey, 64, 64, (g) => NuclearStrike.renderIcon(g));
    }
    if (scene.textures.exists(NuclearStrike.bombKey)) {
      scene.textures.get(NuclearStrike.bombKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }

  // Большая бомба падает из-за верхнего края низом в центр поля. onImpact — взрыв, когда корпус сел.
  static drop(scene: Phaser.Scene, onImpact: () => void): NuclearFlight {
    const { x, y } = NuclearStrike.impact;
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
    const { x, y } = NuclearStrike.impact;
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
