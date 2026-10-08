// Магазин после гибели базы. Четыре постоянных улучшения, оплата накопленным score.

import Phaser from 'phaser';
import { Infantry } from '../entities/Infantry';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import { metaCost, type MetaSave } from '../systems/MetaSave';

export type MetaShopDelegate = {
  buyCoins(): void;
  buyDamage(): void;
  buyBlast(): void;
  buySpeed(): void;
  closeAndRestart(): void;
  wipeAndRestart(): void;
};

const PANEL_W = 700;
const PANEL_H = 680;
const CARD_W = 620;
const CARD_H = 96;
const CARD_GAP = 10;
const CARD_TOP = -190;

type Offer = {
  card: Phaser.GameObjects.Rectangle;
  hit: Phaser.GameObjects.Container;
  info: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
};

export class MetaShopPanel {
  readonly container: Phaser.GameObjects.Container;

  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly coins: Offer;
  private readonly damage: Offer;
  private readonly blast: Offer;
  private readonly speed: Offer;

  constructor(scene: Phaser.Scene, shop: MetaShopDelegate) {
    const dim = scene.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.62).setInteractive();
    const panel = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x3a0c0c, 0.96);
    panel.setStrokeStyle(4, 0xc9a227);

    const title = scene.add
      .text(0, -304, 'БАЗА РАЗБИТА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '40px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.scoreText = scene.add
      .text(0, -256, 'SCORE  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);

    this.container = scene.add.container(GAME.width / 2, GAME.height / 2, [dim, panel, title, this.scoreText]);

    this.coins = this.makeOffer(scene, 0, '+1 монета за убийство', () => shop.buyCoins());
    this.damage = this.makeOffer(scene, 1, '+1 урон', () => shop.buyDamage());
    this.blast = this.makeOffer(scene, 2, '+1 область взрыва', () => shop.buyBlast());
    this.speed = this.makeOffer(scene, 3, 'Скорость −0.01 с', () => shop.buySpeed());

    const fresh = this.makeButton(scene, -155, 286, 290, 'НОВАЯ ИГРА', () => shop.wipeAndRestart());
    const next = this.makeButton(scene, 155, 286, 290, 'В БОЙ', () => shop.closeAndRestart());
    this.container.add([fresh, next]);

    // Выше игрового UI и окна между волнами. Пауза (90) остаётся сверху.
    this.container.setDepth(85).setVisible(false);
  }

  show(meta: MetaSave): void {
    this.refresh(meta);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  refresh(meta: MetaSave): void {
    this.scoreText.setText(`SCORE  ${meta.score}`);
    this.showCoins(meta);
    this.showDamage(meta);
    this.showBlast(meta);
    this.showSpeed(meta);
  }

  private makeOffer(scene: Phaser.Scene, index: number, label: string, buy: () => void): Offer {
    const top = CARD_TOP + index * (CARD_H + CARD_GAP);
    const hit = scene.add.container(0, top + CARD_H / 2);
    const card = scene.add.rectangle(0, 0, CARD_W, CARD_H, 0x5a1210).setStrokeStyle(2, 0xf0d56a);
    const title = scene.add
      .text(-CARD_W / 2 + 22, -CARD_H / 2 + 14, label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
        wordWrap: { width: CARD_W - 190, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    const info = scene.add
      .text(-CARD_W / 2 + 22, -CARD_H / 2 + 48, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f0dcc0',
      })
      .setOrigin(0, 0);
    const cost = scene.add
      .text(CARD_W / 2 - 22, -CARD_H / 2 + 14, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
        align: 'right',
      })
      .setOrigin(1, 0);

    hit.add([card, title, info, cost]);
    // Одна зона на всю карточку: надписи не перехватывают клик по центру.
    this.arm(hit, CARD_W, CARD_H, () => {
      if (this.container.visible) {
        buy();
      }
    });
    this.container.add(hit);
    return { card, hit, info, cost };
  }

  private makeButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    label: string,
    fire: () => void,
  ): Phaser.GameObjects.Container {
    const button = scene.add.container(x, y);
    const bg = scene.add.rectangle(0, 0, w, 52, 0x8a1810).setStrokeStyle(2, 0xf0d56a);
    const text = scene.add
      .text(0, 0, label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    button.add([bg, text]);
    this.arm(button, w, 52, () => {
      if (this.container.visible) {
        fire();
      }
    });
    return button;
  }

  private arm(zone: Phaser.GameObjects.Container, w: number, h: number, fire: () => void): void {
    zone.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    zone.on('pointerup', fire);
  }

  private showCoins(meta: MetaSave): void {
    const price = metaCost(meta.coins);
    this.coins.info.setText(`ур. ${meta.coins}   +${meta.coins} → +${meta.coins + 1} к монетам`);
    this.coins.cost.setText(`цена  ${price}`);
    this.tintCard(this.coins.card, this.coins.cost, meta.score >= price);
  }

  private showDamage(meta: MetaSave): void {
    const price = metaCost(meta.damage);
    const now = Infantry.shellDamage + meta.damage;
    this.damage.info.setText(`ур. ${meta.damage}   урон ${now} → ${now + 1}`);
    this.damage.cost.setText(`цена  ${price}`);
    this.tintCard(this.damage.card, this.damage.cost, meta.score >= price);
  }

  private showBlast(meta: MetaSave): void {
    const price = metaCost(meta.blast);
    const now = meta.blast * Tank.blastRadiusPerLevel;
    const next = (meta.blast + 1) * Tank.blastRadiusPerLevel;
    this.blast.info.setText(`ур. ${meta.blast}   радиус ${now} → ${next}`);
    this.blast.cost.setText(`цена  ${price}`);
    this.tintCard(this.blast.card, this.blast.cost, meta.score >= price);
  }

  private showSpeed(meta: MetaSave): void {
    const now = Tank.fireDelayFor(0, meta.speed);
    const next = Tank.fireDelayFor(0, meta.speed + 1);
    const maxed = meta.speed >= Tank.maxMetaSpeedLevel || next >= now;
    this.speed.info.setText(
      maxed
        ? `ур. ${meta.speed}   ${this.formatDelay(now)} (макс.)`
        : `ур. ${meta.speed}   ${this.formatDelay(now)} → ${this.formatDelay(next)}`,
    );
    if (maxed) {
      this.speed.cost.setText('максимум');
      this.speed.card.setFillStyle(0x3d2a12);
      this.speed.cost.setColor('#f3d56a');
      this.speed.hit.disableInteractive();
      return;
    }
    const price = metaCost(meta.speed);
    this.speed.cost.setText(`цена  ${price}`);
    if (this.speed.hit.input && !this.speed.hit.input.enabled) {
      this.speed.hit.input.enabled = true;
    }
    this.tintCard(this.speed.card, this.speed.cost, meta.score >= price);
  }

  private formatDelay(ms: number): string {
    return `${(ms / 1000).toFixed(2)} с`;
  }

  private tintCard(card: Phaser.GameObjects.Rectangle, cost: Phaser.GameObjects.Text, canBuy: boolean): void {
    card.setFillStyle(canBuy ? 0x5a1210 : 0x2a1010);
    cost.setColor(canBuy ? '#f3d56a' : '#8a6a4a');
  }
}
