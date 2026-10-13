// Магазин после гибели базы. Оплата накопленным score.
// Покупки и тексты карточек приходят из контроллера: окно их список не знает.

import Phaser from 'phaser';

export type ProgressCardView = {
  title: string;
  info: string;
  cost: string;
  // false — скорость уже на пределе, клик не нужен.
  open: boolean;
  canBuy: boolean;
  buy: () => void;
};

export type ProgressShopView = {
  score: number;
  cards: ProgressCardView[];
};

// «Новая игра» и «в бой». Сами покупки приходят в карточке.
export type ProgressShopDelegate = {
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
  title: Phaser.GameObjects.Text;
  info: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  buy: () => void;
};

export class ProgressShopPanel {
  readonly container: Phaser.GameObjects.Container;

  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly offers: Offer[] = [];

  constructor(
    scene: Phaser.Scene,
    shop: ProgressShopDelegate,
    screen: { width: number; height: number },
  ) {
    const dim = scene.add.rectangle(0, 0, screen.width, screen.height, 0x000000, 0.62).setInteractive();
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

    this.container = scene.add.container(screen.width / 2, screen.height / 2, [dim, panel, title, this.scoreText]);

    const fresh = this.makeButton(scene, -155, 286, 290, 'НОВАЯ ИГРА', () => shop.wipeAndRestart());
    const next = this.makeButton(scene, 155, 286, 290, 'В БОЙ', () => shop.closeAndRestart());
    this.container.add([fresh, next]);

    // Выше игрового UI и окна между волнами. Пауза (90) остаётся сверху.
    this.container.setDepth(85).setVisible(false);
  }

  show(view: ProgressShopView): void {
    this.refresh(view);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  refresh(view: ProgressShopView): void {
    this.scoreText.setText(`SCORE  ${view.score}`);
    this.syncOffers(view.cards);
    for (let i = 0; i < view.cards.length; i += 1) {
      this.paint(this.offers[i], view.cards[i]);
    }
  }

  // Карточки появляются вместе с первым списком. Новый пункт — ещё одна строка, не новое поле окна.
  private syncOffers(cards: ProgressCardView[]): void {
    if (this.offers.length === cards.length) {
      return;
    }
    for (const offer of this.offers) {
      offer.hit.destroy();
    }
    this.offers.length = 0;
    const scene = this.container.scene;
    cards.forEach((card, index) => {
      this.offers.push(this.makeOffer(scene, index, card.title, card.buy));
    });
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
    const offer: Offer = { card, hit, title, info, cost, buy };
    // Одна зона на всю карточку: надписи не перехватывают клик по центру.
    this.arm(hit, CARD_W, CARD_H, () => {
      if (this.container.visible) {
        offer.buy();
      }
    });
    this.container.add(hit);
    return offer;
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

  private paint(offer: Offer, card: ProgressCardView): void {
    offer.buy = card.buy;
    offer.title.setText(card.title);
    offer.info.setText(card.info);
    offer.cost.setText(card.cost);
    if (!card.open) {
      offer.card.setFillStyle(0x3d2a12);
      offer.cost.setColor('#f3d56a');
      offer.hit.disableInteractive();
      return;
    }
    if (offer.hit.input && !offer.hit.input.enabled) {
      offer.hit.input.enabled = true;
    }
    this.tintCard(offer.card, offer.cost, card.canBuy);
  }

  private tintCard(card: Phaser.GameObjects.Rectangle, cost: Phaser.GameObjects.Text, canBuy: boolean): void {
    card.setFillStyle(canBuy ? 0x5a1210 : 0x2a1010);
    cost.setColor(canBuy ? '#f3d56a' : '#8a6a4a');
  }
}
