// Магазин между волнами: слева закладки, справа карточки выбранной.
// Высота карточки не сжимается. Больше четырёх встают в два узких столбца, скролла нет.
// Покупки делегируются ShopController через ShopDelegate.

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
import { coinMarkKey } from '../../gfx/coinMark';

export type ShopCardView = {
  title: string;
  info: string;
  cost: string;
  // false — клик не покупает: уровень максимальный, вещь уже взята или сначала нужна установка.
  open: boolean;
  canBuy: boolean;
  // Галочка вместо слов «куплено» и «установлена».
  owned: boolean;
  buy: () => void;
};

export type ShopTabView = {
  id: string;
  label: string;
  cards: ShopCardView[];
};

export type ShopView = {
  coins: number;
  tabs: ShopTabView[];
};

// Цена в монетах начинается с этой метки. На карточке вместо неё белый знак.
export const coinCostPrefix = '¤ ';

// «Следующая волна». Сами покупки приходят в карточке: окно их список не знает.
export type ShopDelegate = {
  closeAndContinue(): void;
};

const PANEL_W = 980;
const PANEL_H = 680;

const SIDE = 22;
const TAB_W = 250;
// Монеты в правом верхнем углу: белый знак и число. Колонка занимает их прежний ряд.
// Тринадцать вкладок кончаются над уголком плашки.
const TAB_H = 40;
const TAB_GAP = 2;
const CONTENT_TOP = -264;
const TAB_X = -PANEL_W / 2 + SIDE + TAB_W / 2;

const CARD_GAP_X = 16;
const CARD_W = PANEL_W - SIDE * 2 - TAB_W - CARD_GAP_X;
const CARD_X = TAB_X + TAB_W / 2 + CARD_GAP_X + CARD_W / 2;
const CARD_H = 92;
const CARD_GAP = 10;

const TITLE_Y = -302;
const COINS_X = PANEL_W / 2 - SIDE;
const RULE_Y = -276;
const BUTTON_Y = 292;

const BRASS = 0xc4a15a;
// Серое число, когда монет не хватает. Совпадает с fieldMuted: знак гаснет вместе с ценой.
const PRICE_MUTED = 0x7d7868;

type Offer = {
  card: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  info: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  coin: Phaser.GameObjects.Image;
  mark: Phaser.GameObjects.Graphics;
  buy: () => void;
  open: boolean;
};

type Tab = {
  id: string;
  face: Phaser.GameObjects.Graphics;
  hit: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

export class ShopPanel {
  readonly container: Phaser.GameObjects.Container;

  private readonly coinsText: Phaser.GameObjects.Text;
  // Правый край знака прижат к числу. Дебаг-наследник ставит «+» слева от него.
  protected readonly coinMark: Phaser.GameObjects.Image;
  private readonly coinAspect: number;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly offers: Offer[] = [];
  private readonly waveButton: Phaser.GameObjects.Graphics;
  private readonly tabs: Tab[] = [];

  private paused = false;
  private cardsCovered = false;
  private selected = '';
  private tabKey = '';
  private lastView: ShopView | null = null;
  private lastCards: ShopCardView[] = [];

  constructor(
    scene: Phaser.Scene,
    shop: ShopDelegate,
    private readonly screen: { width: number; height: number },
  ) {
    this.dim = scene.add.rectangle(0, 0, this.screen.width, this.screen.height, 0x000000, 0.62);
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
      .text(0, TITLE_Y, 'МАГАЗИН', {
        fontSize: '40px',
        color: fieldInk,
        stroke: fieldInkStroke,
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const frame = scene.textures.get(coinMarkKey).get();
    this.coinAspect = frame.width / frame.height;
    this.coinMark = scene.add.image(COINS_X, TITLE_Y, coinMarkKey).setOrigin(1, 0.5);
    this.coinsText = scene.add
      .text(COINS_X, TITLE_Y, '0', {
        fontSize: '22px',
        color: fieldPaper,
      })
      .setOrigin(1, 0.5);
    this.placeCoinBalance();

    const nextFace = scene.add.graphics().setPosition(0, BUTTON_Y);
    this.waveButton = nextFace;
    paintOrderBar(nextFace, 280, 52);
    const next = scene.add.rectangle(0, BUTTON_Y, 280, 52, 0x000000, 0);
    next.setInteractive({ useHandCursor: true });
    next.on('pointerup', () => {
      if (!this.blocked()) {
        shop.closeAndContinue();
      }
    });
    const nextLabel = scene.add
      .text(0, BUTTON_Y, 'СЛЕДУЮЩАЯ ВОЛНА', {
        fontSize: '18px',
        color: fieldInk,
      })
      .setOrigin(0.5);

    this.container = scene.add.container(this.screen.width / 2, this.screen.height / 2, [
      this.dim,
      panel,
      well,
      rule,
      title,
      this.coinMark,
      this.coinsText,
      nextFace,
      next,
      nextLabel,
    ]);
    // Выше игрового UI (51–60), ниже плашки поражения (80) и паузы (90).
    this.container.setDepth(70).setVisible(false);
    this.place();
  }

  // Поле шире 1280 — окно и затемнение остаются по центру.
  place(): void {
    this.container.setPosition(this.screen.width / 2, this.screen.height / 2);
    this.dim.setSize(this.screen.width, this.screen.height);
  }

  show(view: ShopView): void {
    this.selected = view.tabs[0]?.id ?? '';
    this.refresh(view);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  // Отдельной камеры нет: плашка паузы и так выше панели. Карточки прячем, чтобы они не торчали по бокам.
  coverForPause(covered: boolean): void {
    this.cardsCovered = covered;
    this.applyOffers();
  }

  refresh(view: ShopView): void {
    this.lastView = view;
    this.coinsText.setText(String(view.coins));
    this.placeCoinBalance();
    this.syncTabs(view.tabs);
  }

  private syncTabs(tabs: ShopTabView[]): void {
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
      const shown = !this.cardsCovered && card !== undefined;
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
      // «Следующая волна» остаётся поверх карточек.
      const at = this.container.getIndex(this.waveButton);
      const nodes = [offer.card, offer.title, offer.info, offer.coin, offer.cost, offer.mark];
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
      offer.mark.setPosition(x - cardW / 2 + 28, y + CARD_H / 2 - 26);
    }
  }

  private setOfferShown(offer: Offer, shown: boolean): void {
    offer.card.setVisible(shown);
    offer.title.setVisible(shown);
    offer.info.setVisible(shown);
    offer.cost.setVisible(shown);
    offer.coin.setVisible(false);
    offer.mark.setVisible(shown);
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
    const coin = scene.add.image(CARD_X, y, coinMarkKey).setVisible(false);
    const mark = scene.add.graphics().setPosition(CARD_X - CARD_W / 2 + 28, y + CARD_H / 2 - 26);
    paintOwnedMark(mark);
    const offer: Offer = { card, title, info, cost, coin, mark, buy: () => undefined, open: false };
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

  private paint(offer: Offer, card: ShopCardView): void {
    offer.buy = card.buy;
    offer.open = card.open;
    offer.title.setText(card.title);
    offer.info.setText(card.info);
    offer.mark.setVisible(card.owned);
    this.layoutPrice(offer, card);
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

  // Знак той же высоты, что строка, и стоит вплотную слева от числа.
  private placeCoinBalance(): void {
    const height = this.coinsText.height;
    this.coinMark.setDisplaySize(height * this.coinAspect, height);
    this.coinMark.setPosition(COINS_X - this.coinsText.width - 6, TITLE_Y);
  }

  // «¤ » в строке цены — метка монеты. На карточке её место занимает белый знак.
  // «максимум» и пустая цена знака не получают. Серая цена гасит и знак.
  private layoutPrice(offer: Offer, card: ShopCardView): void {
    const coin = card.cost.startsWith(coinCostPrefix);
    const label = coin ? card.cost.slice(coinCostPrefix.length) : card.cost;
    offer.cost.setText(label);
    const showCoin = coin && !card.owned;
    offer.coin.setVisible(showCoin);
    offer.cost.setVisible(!card.owned);
    const bottom = offer.card.y + offer.card.height / 2 - 10;
    const mid = offer.card.x;
    if (!showCoin) {
      offer.cost.setOrigin(0.5, 1);
      offer.cost.setPosition(mid, bottom);
      return;
    }
    const height = offer.cost.height;
    offer.coin.setDisplaySize(height * this.coinAspect, height);
    offer.coin.setOrigin(0, 0.5);
    offer.cost.setOrigin(0, 0.5);
    const gap = 4;
    const total = offer.coin.displayWidth + gap + offer.cost.width;
    const left = mid - total / 2;
    const y = bottom - height / 2;
    offer.coin.setPosition(left, y);
    offer.cost.setPosition(left + offer.coin.displayWidth + gap, y);
    if (card.open && !card.canBuy) {
      offer.coin.setTint(PRICE_MUTED);
      return;
    }
    offer.coin.clearTint();
  }

  private tintCard(card: Phaser.GameObjects.Rectangle, cost: Phaser.GameObjects.Text, canBuy: boolean): void {
    card.setFillStyle(canBuy ? 0x3a4630 : 0x242a1c);
    cost.setColor(canBuy ? fieldInk : fieldMuted);
  }
}

function paintOwnedMark(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x1a2214, 1);
  g.fillCircle(0, 0, 14);
  g.lineStyle(2, BRASS, 1);
  g.strokeCircle(0, 0, 14);
  g.lineStyle(3, BRASS, 1);
  g.beginPath();
  g.moveTo(-7, 1);
  g.lineTo(-2, 6);
  g.lineTo(8, -6);
  g.strokePath();
}
