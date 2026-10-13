// Атомный взрыв: одна бомба падает в центр поля и накрывает всех, кто уже в кадре.
// Покупка в магазине открывает вызов по клавише 3 и по иконке на HUD.
// Падение, гриб и воронку считает CombatSystem.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { nuke, nukeAt } from '../gfx/nuke';
import { bake } from '../gfx/textures';
import { playNuclearBoom } from '../sounds/NuclearExplosion';

export type NuclearFlight = {
  cancel(): void;
};

export class NuclearStrike {
  static readonly iconKey = 'nuclear-icon';
  static readonly bombKey = 'nuclear-bomb';
  static readonly craterKey = 'nuclear-crater';
  static readonly iconRadius = 30;

  static readonly shop = {
    cost: 500,
    cooldownMs: 3 * 60_000,
    craterMs: 5_000,
    fallMs: 780,
  };

  // Гриб тот же, что при гибели танка, только крупнее: отдельный рисунок разъехался бы с ним.
  // 2.2 — шапка упирается в верх кадра и накрывает середину поля, не вторую копию маленького взрыва.
  static readonly mushroomScale = 2.2;

  // Облако гаснет за это время. Воронка живёт дольше: это след на земле, не сам взрыв.
  static readonly cloudMs = nuke.goneMs;

  // Середина дорожек. Танк стоит слева, враги въезжают справа — это центр поля, не край экрана.
  static readonly impact = {
    x: GAME.width / 2,
    y: 356,
  };

  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(NuclearStrike.iconKey)) {
      bake(scene, NuclearStrike.iconKey, 64, 64, (g) => NuclearStrike.renderIcon(g));
    }
    if (!scene.textures.exists(NuclearStrike.bombKey)) {
      bake(scene, NuclearStrike.bombKey, 96, 210, (g) => NuclearStrike.renderBomb(g));
    }
    if (!scene.textures.exists(NuclearStrike.craterKey)) {
      bake(scene, NuclearStrike.craterKey, 640, 260, (g) => NuclearStrike.renderCrater(g));
    }
  }

  // Большая бомба падает из-за верхнего края носом в центр поля. onImpact — взрыв, когда носик сел.
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

    const crater = scene.add.image(x, y, NuclearStrike.craterKey).setDepth(3);
    scene.tweens.add({
      targets: crater,
      alpha: 0,
      delay: NuclearStrike.shop.craterMs - 500,
      duration: 500,
      onComplete: () => crater.destroy(),
    });

    // Ножка растёт от воронки: земля гриба на nuke.ground ниже переданной точки.
    nukeAt(scene, x, y - nuke.ground * scale, scale);
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

  // Носик у нижнего края: origin спрайта стоит на острие.
  private static renderBomb(g: Phaser.GameObjects.Graphics): void {
    const cx = 48;
    g.fillStyle(0x4a4034);
    g.fillTriangle(18, 18, 34, 64, 6, 72);
    g.fillTriangle(78, 18, 62, 64, 90, 72);
    g.fillStyle(0x2a261e);
    g.fillRoundedRect(40, 8, 16, 54, 4);

    g.fillStyle(0x2a3026);
    g.fillRoundedRect(22, 54, 52, 102, 22);
    g.fillStyle(0x4c5644);
    g.fillRoundedRect(28, 62, 16, 80, 8);

    g.fillStyle(0xf0c43a);
    g.fillRect(22, 90, 52, 10);
    g.fillRect(22, 114, 52, 7);

    g.fillStyle(0x241e16);
    g.fillTriangle(22, 142, 74, 142, cx, 206);
    g.fillStyle(0xffe080);
    g.fillCircle(cx, 176, 5);
  }

  private static renderCrater(g: Phaser.GameObjects.Graphics): void {
    const cx = 320;
    const cy = 130;
    // Светлый вал и чёрная яма: на тёмном поле мягкое пятно не читается.
    g.fillStyle(0x000000, 0.45);
    g.fillEllipse(cx, cy + 16, 630, 150);
    g.fillStyle(0xe7d2a4, 1);
    g.fillEllipse(cx, cy, 600, 210);
    g.fillStyle(0x6a4328, 1);
    g.fillEllipse(cx, cy, 490, 164);
    g.fillStyle(0x1a0c06, 1);
    g.fillEllipse(cx, cy + 4, 370, 112);
    g.fillStyle(0x000000, 1);
    g.fillEllipse(cx, cy + 8, 230, 68);
    g.fillStyle(0xfff0c8, 1);
    g.fillEllipse(cx - 190, cy - 36, 78, 22);
    g.fillEllipse(cx + 170, cy + 40, 60, 18);
    g.fillStyle(0xff6a18, 1);
    g.fillCircle(cx - 48, cy + 8, 7);
    g.fillCircle(cx + 72, cy + 18, 5);
    g.fillCircle(cx + 8, cy - 6, 4);
    g.fillStyle(0xffe080, 1);
    g.fillCircle(cx - 48, cy + 6, 3);
  }
}
