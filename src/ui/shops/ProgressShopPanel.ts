// Магазин после гибели базы. Оплата накопленным score.
// Слева закладки, справа карточки выбранной. Скролла нет.
// Высота карточки не сжимается. Больше четырёх встают в два узких столбца.
// Покупки и тексты карточек приходят из контроллера: окно их список не знает.

import Phaser from 'phaser';
import {
  fieldInk,
  fieldInkStroke,
  fieldMuted,
  fieldPaper,
  paintFieldPlate,
  paintFieldRule,
  paintOrderBar,
} from '../militaryDialog';

export type ProgressCardView = {
  title: string;
  info: string;
  cost: string;
  // false — скорость, пули или лучи уже на пределе, клик не покупает.
  open: boolean;
  canBuy: boolean;
  buy: () => void;
};

export type ProgressTabView = {
  id: string;
  label: string;
  cards: ProgressCardView[];
};

export type ProgressShopView = {
  score: number;
  tabs: ProgressTabView[];
};

// «Новая игра» и «в бой». Сами покупки приходят в карточке.
export type ProgressShopDelegate = {
  closeAndRestart(): void;
  wipeAndRestart(): void;
};

const PANEL_W = 980;
const PANEL_H = 680;

const SIDE = 22;
const TAB_W = 250;
const TAB_H = 46;
const TAB_GAP = 6;
const CONTENT_TOP = -220;
const TAB_X = -PANEL_W / 2 + SIDE + TAB_W / 2;

const CARD_GAP_X = 16;
const CARD_W = PANEL_W - SIDE * 2 - TAB_W - CARD_GAP_X;
const CARD_X = TAB_X + TAB_W / 2 + CARD_GAP_X + CARD_W / 2;
const CARD_H = 92;
const CARD_GAP = 10;

const TITLE_Y = -302;
const SCORE_Y = -258;
const RULE_Y = -238;
const BUTTON_Y = 292;
const BUTTON_W = 260;
const BUTTON_X = 145;

const BRASS = 0xc4a15a;

type Offer = {
  card: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  info: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  buy: () => void;
  open: boolean;
};

type Tab = {
  id: string;
  face: Phaser.GameObjects.Graphics;
  hit: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

export class ProgressShopPanel {
  readonly container: Phaser.GameObjects.Container;

  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly offers: Offer[] = [];
  private readonly tabs: Tab[] = [];

  private paused = false;
  private selected = '';
  private tabKey = '';
  private lastView: ProgressShopView | null = null;
  private lastCards: ProgressCardView[] = [];

  constructor(
    scene: Phaser.Scene,
    shop: ProgressShopDelegate,
    private readonly screen: { width: number; height: number },
  ) {
    this.dim = scene.add.rectangle(0, 0, screen.width, screen.height, 0x000000, 0.62).setInteractive();
    const panel = scene.add.graphics();
    paintFieldPlate(panel, PANEL_W, PANEL_H);
    const wellTop = CONTENT_TOP - 8;
    const wellBottom = BUTTON_Y - 26 - 14;
    const well = scene.add.rectangle(
      CARD_X,
      (wellTop + wellBottom) / 2,
      CARD_W + 16,
      wellBottom - wellTop,
      0x12170e,
    );
    const rule = scene.add.graphics();
    paintFieldRule(rule, RULE_Y, PANEL_W / 2 - 36);

    const title = scene.add
      .text(0, TITLE_Y, 'БАЗА РАЗБИТА', {
        fontSize: '40px',
        color: fieldInk,
        stroke: fieldInkStroke,
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.scoreText = scene.add
      .text(0, SCORE_Y, 'SCORE  0', {
        fontSize: '22px',
        color: fieldPaper,
      })
      .setOrigin(0.5);

    this.container = scene.add.container(screen.width / 2, screen.height / 2, [
      this.dim,
      panel,
      well,
      rule,
      title,
      this.scoreText,
    ]);

    const fresh = this.makeButton(scene, -BUTTON_X, BUTTON_Y, BUTTON_W, 'НОВАЯ ИГРА', () => shop.wipeAndRestart());
    const next = this.makeButton(scene, BUTTON_X, BUTTON_Y, BUTTON_W, 'В БОЙ', () => shop.closeAndRestart());
    this.container.add([fresh, next]);

    // Выше игрового UI и окна между волнами. Пауза (90) остаётся сверху.
    this.container.setDepth(85).setVisible(false);
    this.layout();
  }

  // Поле шире 1280 — окно и затемнение остаются по центру.
  layout(): void {
    this.container.setPosition(this.screen.width / 2, this.screen.height / 2);
    this.dim.setSize(this.screen.width, this.screen.height);
  }

  show(view: ProgressShopView): void {
    this.selected = view.tabs[0]?.id ?? '';
    this.refresh(view);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  // Покупки ждут продолжения. «В бой» и «Новая игра» паузу не спрашивают.
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  refresh(view: ProgressShopView): void {
    this.lastView = view;
    this.scoreText.setText(`SCORE  ${view.score}`);
    this.syncTabs(view.tabs);
  }

  private syncTabs(tabs: ProgressTabView[]): void {
    const key = tabs.map((tab) => tab.id).join('\0');
    if (key !== this.tabKey) {
      this.destroyTabs();
      this.tabKey = key;
      tabs.forEach((tab, index) => {
        this.tabs.push(this.makeTab(tab.id, tab.label, index));
      });
    } else {
      tabs.forEach((tab, index) => {
        this.tabs[index]?.label.setText(tab.label);
      });
    }
    if (!tabs.some((tab) => tab.id === this.selected)) {
      this.selected = tabs[0]?.id ?? '';
    }
    for (const tab of this.tabs) {
      this.paintTab(tab, tab.id === this.selected);
    }
    const current = tabs.find((tab) => tab.id === this.selected);
    this.lastCards = current?.cards ?? [];
    this.applyOffers();
  }

  private makeTab(id: string, label: string, index: number): Tab {
    const scene = this.container.scene;
    const y = CONTENT_TOP + TAB_H / 2 + index * (TAB_H + TAB_GAP);
    const face = scene.add.graphics().setPosition(TAB_X, y);
    const hit = scene.add.rectangle(TAB_X, y, TAB_W, TAB_H, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      if (this.blocked() || this.selected === id || !this.lastView) {
        return;
      }
      this.selected = id;
      this.refresh(this.lastView);
    });
    const text = scene.add
      .text(TAB_X - TAB_W / 2 + 18, y, label, {
        fontSize: '16px',
        color: fieldPaper,
      })
      .setOrigin(0, 0.5);
    this.container.add([face, hit, text]);
    return { id, face, hit, label: text };
  }

  private paintTab(tab: Tab, selected: boolean): void {
    const g = tab.face;
    g.clear();
    const left = -TAB_W / 2;
    const top = -TAB_H / 2;
    g.fillStyle(selected ? 0x6e6240 : 0x3e4634, 1);
    g.fillRect(left, top, TAB_W, TAB_H);
    g.fillStyle(selected ? 0x3a4630 : 0x1e2618, 1);
    g.fillRect(left + 3, top + 3, TAB_W - 6, TAB_H - 6);
    if (selected) {
      g.fillStyle(BRASS, 1);
      g.fillRect(left + 3, top + 3, 5, TAB_H - 6);
    }
    tab.label.setColor(selected ? fieldInk : fieldPaper);
  }

  private destroyTabs(): void {
    for (const tab of this.tabs) {
      tab.face.destroy();
      tab.hit.destroy();
      tab.label.destroy();
    }
    this.tabs.length = 0;
  }

  private applyOffers(): void {
    this.ensureOffers(this.lastCards.length);
    this.placeOffers(this.lastCards.length);
    for (let i = 0; i < this.offers.length; i += 1) {
      const card = this.lastCards[i];
      const shown = card !== undefined;
      this.setOfferShown(this.offers[i], shown);
      if (shown && card) {
        this.paint(this.offers[i], card);
      }
    }
  }

  // Плашек ровно столько, сколько карточек в самой длинной вкладке. Короткая вкладка лишние прячет.
  private ensureOffers(count: number): void {
    const scene = this.container.scene;
    while (this.offers.length < count) {
      const offer = this.makeOffer(scene, this.offers.length);
      this.offers.push(offer);
      // Кнопки «Новая игра» и «В бой» остаются поверх карточек.
      const at = Math.max(0, this.container.length - 2);
      const nodes = [offer.card, offer.title, offer.info, offer.cost];
      nodes.forEach((node, index) => this.container.addAt(node, at + index));
    }
  }

  // Больше четырёх карточек не лезут столбиком. Высота та же, ширина делится на два столбца.
  private placeOffers(count: number): void {
    const columns = count > 4 ? 2 : 1;
    const cardW = columns === 2 ? (CARD_W - CARD_GAP) / 2 : CARD_W;
    const span = cardW + CARD_GAP;
    for (let i = 0; i < this.offers.length; i += 1) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = CARD_X - ((columns - 1) * span) / 2 + col * span;
      const y = CONTENT_TOP + CARD_H / 2 + row * (CARD_H + CARD_GAP);
      const offer = this.offers[i];
      offer.card.setPosition(x, y);
      offer.card.setSize(cardW, CARD_H);
      offer.title.setPosition(x, y - CARD_H / 2 + 12);
      offer.title.setWordWrapWidth(cardW - 16);
      offer.info.setPosition(x, y + 4);
      offer.info.setWordWrapWidth(cardW - 16);
      offer.cost.setPosition(x, y + CARD_H / 2 - 10);
    }
  }

  private setOfferShown(offer: Offer, shown: boolean): void {
    offer.card.setVisible(shown);
    offer.title.setVisible(shown);
    offer.info.setVisible(shown);
    offer.cost.setVisible(shown);
    if (!shown) {
      offer.card.disableInteractive();
      return;
    }
    offer.card.setInteractive({ useHandCursor: true });
  }

  private makeOffer(scene: Phaser.Scene, index: number): Offer {
    const y = CONTENT_TOP + CARD_H / 2 + index * (CARD_H + CARD_GAP);
    const card = scene.add.rectangle(CARD_X, y, CARD_W, CARD_H, 0x343e2a).setStrokeStyle(2, 0x6e6848);
    const title = scene.add
      .text(CARD_X, y - CARD_H / 2 + 12, '', {
        fontSize: '18px',
        color: fieldInk,
        align: 'center',
      })
      .setOrigin(0.5, 0);
    const info = scene.add
      .text(CARD_X, y + 4, '', {
        fontSize: '16px',
        color: fieldPaper,
        align: 'center',
      })
      .setOrigin(0.5);
    const cost = scene.add
      .text(CARD_X, y + CARD_H / 2 - 10, '', {
        fontSize: '18px',
        color: fieldInk,
        align: 'center',
      })
      .setOrigin(0.5, 1);
    const offer: Offer = { card, title, info, cost, buy: () => undefined, open: false };
    card.on('pointerup', () => {
      if (this.blocked() || !offer.open) {
        return;
      }
      offer.buy();
    });
    this.setOfferShown(offer, false);
    return offer;
  }

  private blocked(): boolean {
    return this.paused || !this.container.visible;
  }

  private paint(offer: Offer, card: ProgressCardView): void {
    offer.buy = card.buy;
    offer.open = card.open;
    offer.title.setText(card.title);
    offer.info.setText(card.info);
    offer.cost.setText(card.cost);
    if (offer.card.input) {
      offer.card.input.cursor = card.open ? 'pointer' : 'default';
    }
    if (!card.open) {
      offer.card.setFillStyle(0x2c3224);
      offer.cost.setColor(fieldInk);
      return;
    }
    this.tintCard(offer.card, offer.cost, card.canBuy);
  }

  private tintCard(card: Phaser.GameObjects.Rectangle, cost: Phaser.GameObjects.Text, canBuy: boolean): void {
    card.setFillStyle(canBuy ? 0x3a4630 : 0x242a1c);
    cost.setColor(canBuy ? fieldInk : fieldMuted);
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
    const face = scene.add.graphics();
    paintOrderBar(face, w, 52);
    const text = scene.add
      .text(0, 0, label, {
        fontSize: '18px',
        color: fieldInk,
      })
      .setOrigin(0.5);
    button.add([face, text]);
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
}
