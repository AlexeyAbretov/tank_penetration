import Phaser from 'phaser';
import { GAME, upgradeCost } from '../gameConfig';

type ShopHandlers = {
  onBuyBlast: () => void;
  onBuyDamage: () => void;
  onContinue: () => void;
};

export class ShopPanel {
  readonly container: Phaser.GameObjects.Container;

  private readonly coinsText: Phaser.GameObjects.Text;
  private readonly blastInfo: Phaser.GameObjects.Text;
  private readonly damageInfo: Phaser.GameObjects.Text;
  private readonly blastCost: Phaser.GameObjects.Text;
  private readonly damageCost: Phaser.GameObjects.Text;
  private readonly blastCard: Phaser.GameObjects.Rectangle;
  private readonly damageCard: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, handlers: ShopHandlers) {
    const dim = scene.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.62);
    const panel = scene.add.rectangle(0, -10, 640, 430, 0x3a0c0c, 0.96);
    panel.setStrokeStyle(4, 0xc9a227);

    const title = scene.add
      .text(0, -188, 'МАГАЗИН', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '40px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.coinsText = scene.add
      .text(0, -142, 'Монеты  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);

    this.blastCard = scene.add.rectangle(-150, -10, 260, 150, 0x5a1210).setStrokeStyle(2, 0xf0d56a);
    this.damageCard = scene.add.rectangle(150, -10, 260, 150, 0x5a1210).setStrokeStyle(2, 0xf0d56a);
    this.blastCard.setInteractive({ useHandCursor: true });
    this.damageCard.setInteractive({ useHandCursor: true });
    this.blastCard.on('pointerup', handlers.onBuyBlast);
    this.damageCard.on('pointerup', handlers.onBuyDamage);

    const blastTitle = scene.add
      .text(-150, -62, '+1 область взрыва', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    this.blastInfo = scene.add
      .text(-150, -22, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f0dcc0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.blastCost = scene.add
      .text(-150, 28, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    const damageTitle = scene.add
      .text(150, -62, '+1 урон', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    this.damageInfo = scene.add
      .text(150, -22, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f0dcc0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.damageCost = scene.add
      .text(150, 28, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    const next = scene.add.rectangle(0, 150, 280, 52, 0x8a1810).setStrokeStyle(2, 0xf0d56a);
    next.setInteractive({ useHandCursor: true });
    next.on('pointerup', handlers.onContinue);
    const nextLabel = scene.add
      .text(0, 150, 'СЛЕДУЮЩАЯ ВОЛНА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    this.container = scene.add.container(GAME.width / 2, GAME.height / 2, [
      dim,
      panel,
      title,
      this.coinsText,
      this.blastCard,
      this.damageCard,
      blastTitle,
      this.blastInfo,
      this.blastCost,
      damageTitle,
      this.damageInfo,
      this.damageCost,
      next,
      nextLabel,
    ]);
    this.container.setDepth(70).setVisible(false);
  }

  show(coins: number, blastLevel: number, damageLevel: number): void {
    this.refresh(coins, blastLevel, damageLevel);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  refresh(coins: number, blastLevel: number, damageLevel: number): void {
    this.coinsText.setText(`Монеты  ${coins}`);

    const blastPrice = upgradeCost(blastLevel);
    const damagePrice = upgradeCost(damageLevel);
    const radius = blastLevel * GAME.blastRadiusPerLevel;
    const nextRadius = (blastLevel + 1) * GAME.blastRadiusPerLevel;

    this.blastInfo.setText(`ур. ${blastLevel}   радиус ${radius} → ${nextRadius}`);
    this.blastCost.setText(`цена  ${blastPrice}`);
    this.damageInfo.setText(`ур. ${damageLevel}   урон ${1 + damageLevel} → ${2 + damageLevel}`);
    this.damageCost.setText(`цена  ${damagePrice}`);

    this.tintCard(this.blastCard, this.blastCost, coins >= blastPrice);
    this.tintCard(this.damageCard, this.damageCost, coins >= damagePrice);
  }

  private tintCard(
    card: Phaser.GameObjects.Rectangle,
    cost: Phaser.GameObjects.Text,
    canBuy: boolean,
  ): void {
    card.setFillStyle(canBuy ? 0x5a1210 : 0x2a1010);
    cost.setColor(canBuy ? '#f3d56a' : '#8a6a4a');
  }
}
