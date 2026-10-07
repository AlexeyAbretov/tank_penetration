// Счёт, полоска HP, баннер волны и плашка поражения.

import Phaser from 'phaser';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import { ShopPanel } from './ShopPanel';

type ShopHandlers = {
  onBuyBlast: () => void;
  onBuyDamage: () => void;
  onBuyWire: () => void;
  onContinue: () => void;
};

export class GameHud {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly coinsText: Phaser.GameObjects.Text;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly waveBanner: Phaser.GameObjects.Text;
  private readonly overlay: Phaser.GameObjects.Container;
  readonly shop: ShopPanel;

  constructor(scene: Phaser.Scene, shopHandlers: ShopHandlers) {
    scene.add.image(GAME.width / 2, 677, 'banner').setDepth(50);

    scene.add
      .text(GAME.width / 2, 678, 'TANK', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '42px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(51);

    this.scoreText = scene.add
      .text(28, 18, 'SCORE  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f3d56a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setDepth(51);

    this.waveText = scene.add
      .text(28, 48, 'WAVE  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#e8c48a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setDepth(51);

    this.coinsText = scene.add
      .text(28, 74, 'COINS  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setDepth(51);

    this.waveBanner = scene.add
      .text(GAME.width / 2, 120, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '56px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setAlpha(0);

    scene.add
      .text(GAME.width / 2, 708, 'мышь — прицел   ЛКМ — огонь', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#e8c48a',
      })
      .setOrigin(0.5)
      .setDepth(51)
      .setAlpha(0.8);

    scene.add.image(1128, 28, 'hp-frame').setDepth(51);
    scene.add.rectangle(1018, 28, 236, 10, 0x2a0a0a).setOrigin(0, 0.5).setDepth(51);
    this.hpFill = scene.add.rectangle(1018, 28, 236, 10, 0xd42a2a).setOrigin(0, 0.5).setDepth(52);

    this.overlay = scene.add.container(GAME.width / 2, GAME.height / 2).setDepth(80).setVisible(false);
    const dim = scene.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.55);
    const title = scene.add
      .text(0, -24, 'БАЗА РАЗБИТА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '48px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const hint = scene.add
      .text(0, 36, 'Кликните, чтобы начать снова', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);
    this.overlay.add([dim, title, hint]);

    this.shop = new ShopPanel(scene, shopHandlers);
  }

  setScore(score: number): void {
    this.scoreText.setText(`SCORE  ${score}`);
  }

  setWave(wave: number): void {
    this.waveText.setText(`WAVE  ${wave}`);
  }

  setCoins(coins: number): void {
    this.coinsText.setText(`COINS  ${coins}`);
  }

  setHp(hp: number): void {
    this.hpFill.width = 236 * (hp / Tank.baseHp);
  }

  showWaveBanner(wave: number): void {
    const scene = this.waveBanner.scene;
    this.waveBanner.setText(`ВОЛНА ${wave}`);
    this.waveBanner.setAlpha(1);
    this.waveBanner.setScale(0.86);
    scene.tweens.killTweensOf(this.waveBanner);
    scene.tweens.add({
      targets: this.waveBanner,
      scale: 1.08,
      duration: 280,
      ease: 'Back.Out',
    });
    scene.tweens.add({
      targets: this.waveBanner,
      alpha: 0,
      duration: 500,
      delay: 900,
    });
  }

  showDefeatOverlay(): void {
    this.overlay.setVisible(true);
  }

  get defeatOverlayVisible(): boolean {
    return this.overlay.visible;
  }
}
