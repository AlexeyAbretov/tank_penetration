// Окно магазина между волнами: улучшения, колючая проволока и кнопка «дальше».
// Список карточек выше окна, поэтому он живёт в отдельной камере и скроллится.
// Покупки делегируются ShopController через ShopDelegate.

import Phaser from 'phaser';

export type ShopCardView = {
  title: string;
  info: string;
  cost: string;
  // false — карточка уже куплена или уровень максимальный, клик не нужен.
  open: boolean;
  canBuy: boolean;
  buy: () => void;
};

export type ShopView = {
  coins: number;
  cards: ShopCardView[];
};

// «Следующая волна». Сами покупки приходят в карточке: окно их список не знает.
export type ShopDelegate = {
  closeAndContinue(): void;
};

// Рамка окна. Координаты детей контейнера считаются от центра экрана.
const PANEL_W = 700;
const PANEL_H = 640;

// Полоса карточек: ниже заголовка, выше кнопки волны.
const VIEW_W = 620;
const VIEW_H = 400;
const VIEW_TOP = -200;
const SCROLL_W = 10;
const SCROLL_GAP = 14;

const CARD_H = 112;
const CARD_GAP = 12;
const CARD_W = VIEW_W - 16;
const CONTENT_PAD = 6;

const TITLE_WRAP = CARD_W - 190;
const INFO_WRAP = CARD_W - 44;

type Offer = {
  card: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  info: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  buy: () => void;
};

export class ShopPanel {
  // Шапка, рамка и кнопка. Список карточек сюда не входит: его рисует своя камера.
  readonly container: Phaser.GameObjects.Container;

  private readonly coinsText: Phaser.GameObjects.Text;
  private readonly offers: Offer[] = [];

  // Камера с маленьким окном обрезает карточки, которые уехали за шапку или кнопку.
  private readonly listCam: Phaser.Cameras.Scene2D.Camera;
  private readonly listContent: Phaser.GameObjects.Container;
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly thumb: Phaser.GameObjects.Rectangle;

  private readonly viewLeft: number;
  private readonly viewTop: number;
  private contentHeight = 0;
  private maxScroll = 0;
  private thumbH = 36;
  private readonly trackTop: number;

  private scroll = 0;
  // Пауза сцены. Карточки и «следующая волна» не реагируют, пока игрок сам не продолжит.
  // Окно настроек этот флаг не ставит: оно только прячет камеру списка.
  private paused = false;
  private drag: { y: number; scroll: number; moved: boolean } | null = null;
  private pressedCard: Phaser.GameObjects.Rectangle | null = null;

  constructor(
    scene: Phaser.Scene,
    shop: ShopDelegate,
    private readonly screen: { width: number; height: number },
  ) {
    const groupW = VIEW_W + SCROLL_GAP + SCROLL_W;
    this.viewLeft = this.screen.width / 2 - groupW / 2;
    this.viewTop = this.screen.height / 2 + VIEW_TOP;
    this.trackTop = VIEW_TOP;

    // scrollX/scrollY — левый верх окна камеры в мире. Окно совпадает с полосой карточек.
    this.listCam = scene.cameras.add(this.viewLeft, this.viewTop, VIEW_W, VIEW_H);
    this.listCam.setScroll(this.viewLeft, this.viewTop);
    this.listCam.roundPixels = true;
    this.listCam.setVisible(false);

    this.listContent = scene.add.container(this.viewLeft + VIEW_W / 2, this.viewTop);
    // ignore() на контейнере помечает только уже существующих детей.
    // Бит на самом контейнере прячет и текущие, и будущие карточки от основной камеры.
    this.listContent.cameraFilter |= scene.cameras.main.id;

    const dim = scene.add.rectangle(0, 0, this.screen.width, this.screen.height, 0x000000, 0.62);
    const panel = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x3a0c0c, 0.96);
    panel.setStrokeStyle(4, 0xc9a227);

    const title = scene.add
      .text(0, -274, 'МАГАЗИН', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '40px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.coinsText = scene.add
      .text(0, -230, 'Монеты  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);

    const scrollX = -groupW / 2 + VIEW_W + SCROLL_GAP + SCROLL_W / 2;
    this.track = scene.add.rectangle(scrollX, VIEW_TOP + VIEW_H / 2, SCROLL_W, VIEW_H, 0x2a1010);
    this.thumb = scene.add
      .rectangle(scrollX, VIEW_TOP + this.thumbH / 2, SCROLL_W, this.thumbH, 0xf0d56a)
      .setInteractive({ useHandCursor: true, draggable: true });
    scene.input.setDraggable(this.thumb);
    this.thumb.on('drag', (pointer: Phaser.Input.Pointer) => this.dragThumb(pointer));
    this.track.setVisible(false);
    this.thumb.setVisible(false);

    const next = scene.add.rectangle(0, 262, 280, 52, 0x8a1810).setStrokeStyle(2, 0xf0d56a);
    next.setInteractive({ useHandCursor: true });
    next.on('pointerup', () => {
      if (!this.blocked()) {
        shop.closeAndContinue();
      }
    });
    const nextLabel = scene.add
      .text(0, 262, 'СЛЕДУЮЩАЯ ВОЛНА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    this.container = scene.add.container(this.screen.width / 2, this.screen.height / 2, [
      dim,
      panel,
      title,
      this.coinsText,
      this.track,
      this.thumb,
      next,
      nextLabel,
    ]);
    // Выше игрового UI (51–60), ниже плашки поражения (80).
    this.container.setDepth(70).setVisible(false);
    this.listContent.setDepth(71).setVisible(false);

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.blocked()) {
        this.dragList(pointer);
      }
    });
    scene.input.on('pointerup', () => {
      this.drag = null;
      this.pressedCard = null;
    });
    scene.input.on(
      'wheel',
      (pointer: Phaser.Input.Pointer, _over: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
        if (this.blocked() || !this.container.visible || !this.overPanel(pointer)) {
          return;
        }
        this.setScroll(this.scroll + dy * 0.55);
      },
    );

    // Пока магазин открыт, новые объекты сцены (проволока, пулемёт) не должны попасть в окно списка.
    // Сцена при перезапуске та же, поэтому подписку снимаем на shutdown, иначе старый обработчик
    // трогает уже уничтоженный список карточек и обрывает игровой цикл.
    scene.events.on('update', this.syncListCamera, this);
    scene.events.once('shutdown', () => {
      scene.events.off('update', this.syncListCamera, this);
    });
    this.syncListCamera();
  }

  show(view: ShopView): void {
    this.refresh(view);
    this.setScroll(0);
    this.syncListCamera();
    this.container.setVisible(true);
    this.listContent.setVisible(true);
    this.listCam.setVisible(true);
    this.applyScrollChrome(true);
  }

  hide(): void {
    this.drag = null;
    this.pressedCard = null;
    this.container.setVisible(false);
    this.listContent.setVisible(false);
    this.listCam.setVisible(false);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  // Камера списка рисуется поверх основной и стирает центр экрана.
  // Пока игра на паузе, прячем её, иначе плашка «ПАУЗА» пропадает над карточками.
  coverForPause(paused: boolean): void {
    if (!this.container.visible) {
      return;
    }
    const showList = !paused;
    this.listCam.setVisible(showList);
    this.listContent.setVisible(showList);
    this.applyScrollChrome(showList);
  }

  refresh(view: ShopView): void {
    this.coinsText.setText(`Монеты  ${view.coins}`);
    this.syncOffers(view.cards);
    for (let i = 0; i < view.cards.length; i += 1) {
      this.paint(this.offers[i], view.cards[i]);
    }
  }

  // Карточки появляются вместе с первым списком. Новая покупка — ещё одна строка в нём, не новое поле окна.
  private syncOffers(cards: ShopCardView[]): void {
    if (this.offers.length === cards.length) {
      return;
    }
    for (const offer of this.offers) {
      offer.card.destroy();
      offer.title.destroy();
      offer.info.destroy();
      offer.cost.destroy();
    }
    this.offers.length = 0;
    const scene = this.listContent.scene;
    cards.forEach((card, index) => {
      this.offers.push(this.makeOffer(scene, index, card.title, card.buy));
    });
    this.layout(cards.length);
  }

  private layout(count: number): void {
    const gaps = Math.max(0, count - 1);
    this.contentHeight = CONTENT_PAD * 2 + count * CARD_H + gaps * CARD_GAP;
    this.maxScroll = Math.max(0, this.contentHeight - VIEW_H);
    const span = Math.max(this.contentHeight, 1);
    this.thumbH = Math.min(VIEW_H, Math.max(36, Math.round((VIEW_H * VIEW_H) / span)));
    this.thumb.setSize(SCROLL_W, this.thumbH);
    this.setScroll(this.scroll);
    this.applyScrollChrome(this.listCam.visible);
  }

  private applyScrollChrome(listVisible: boolean): void {
    const scroll = listVisible && this.maxScroll > 0;
    this.track.setVisible(scroll);
    this.thumb.setVisible(scroll);
  }

  private makeOffer(scene: Phaser.Scene, index: number, label: string, buy: () => void): Offer {
    const top = CONTENT_PAD + index * (CARD_H + CARD_GAP);
    const card = scene.add
      .rectangle(0, top + CARD_H / 2, CARD_W, CARD_H, 0x5a1210)
      .setStrokeStyle(2, 0xf0d56a);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.blocked()) {
        return;
      }
      this.pressedCard = card;
      this.beginDrag(pointer);
    });

    const title = scene.add
      .text(-CARD_W / 2 + 22, top + 16, label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
        wordWrap: { width: TITLE_WRAP, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    const info = scene.add
      .text(-CARD_W / 2 + 22, top + 50, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f0dcc0',
        wordWrap: { width: INFO_WRAP, useAdvancedWrap: true },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
    const cost = scene.add
      .text(CARD_W / 2 - 22, top + 16, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
        align: 'right',
      })
      .setOrigin(1, 0);

    this.listContent.add([card, title, info, cost]);
    const offer: Offer = { card, title, info, cost, buy };
    // Короткое нажатие покупает. Сдвиг списка — это уже скролл, не покупка.
    card.on('pointerup', () => {
      if (this.blocked() || this.pressedCard !== card || this.drag?.moved) {
        return;
      }
      offer.buy();
    });
    return offer;
  }

  private blocked(): boolean {
    return this.paused;
  }

  private beginDrag(pointer: Phaser.Input.Pointer): void {
    this.drag = { y: pointer.y, scroll: this.scroll, moved: false };
  }

  private dragList(pointer: Phaser.Input.Pointer): void {
    if (!this.drag || !pointer.isDown) {
      return;
    }
    const dy = pointer.y - this.drag.y;
    if (Math.abs(dy) > 8) {
      this.drag.moved = true;
    }
    if (this.drag.moved) {
      this.setScroll(this.drag.scroll - dy);
    }
  }

  private dragThumb(pointer: Phaser.Input.Pointer): void {
    if (this.blocked()) {
      return;
    }
    const screenTop = this.screen.height / 2 + this.trackTop;
    const travel = VIEW_H - this.thumbH;
    const center = Phaser.Math.Clamp(pointer.y, screenTop + this.thumbH / 2, screenTop + travel + this.thumbH / 2);
    const t = travel > 0 ? (center - (screenTop + this.thumbH / 2)) / travel : 0;
    this.setScroll(t * this.maxScroll);
  }

  private setScroll(value: number): void {
    this.scroll = Phaser.Math.Clamp(value, 0, this.maxScroll);
    this.listContent.y = this.viewTop - this.scroll;
    const travel = VIEW_H - this.thumbH;
    const t = this.maxScroll > 0 ? this.scroll / this.maxScroll : 0;
    this.thumb.y = this.trackTop + this.thumbH / 2 + travel * t;
  }

  private overPanel(pointer: Phaser.Input.Pointer): boolean {
    const left = this.screen.width / 2 - PANEL_W / 2;
    const top = this.screen.height / 2 - PANEL_H / 2;
    return pointer.x >= left && pointer.x <= left + PANEL_W && pointer.y >= top && pointer.y <= top + PANEL_H;
  }

  // Камера списка рисует только карточки. Всё остальное на сцене для неё невидимо.
  private syncListCamera(): void {
    const listId = this.listCam.id;
    const mainId = this.listContent.scene.cameras.main.id;
    const children = this.listContent.scene.children.list;
    for (const child of children) {
      if (child === this.listContent) {
        child.cameraFilter = (child.cameraFilter & ~listId) | mainId;
      } else {
        child.cameraFilter |= listId;
      }
    }
  }

  private paint(offer: Offer, card: ShopCardView): void {
    offer.buy = card.buy;
    offer.info.setText(card.info);
    offer.cost.setText(card.cost);
    if (!card.open) {
      offer.card.setFillStyle(0x3d2a12);
      offer.cost.setColor('#f3d56a');
      offer.card.disableInteractive();
      return;
    }
    if (!offer.card.input?.enabled) {
      offer.card.setInteractive({ useHandCursor: true });
    }
    this.tintCard(offer.card, offer.cost, card.canBuy);
  }

  private tintCard(card: Phaser.GameObjects.Rectangle, cost: Phaser.GameObjects.Text, canBuy: boolean): void {
    card.setFillStyle(canBuy ? 0x5a1210 : 0x2a1010);
    cost.setColor(canBuy ? '#f3d56a' : '#8a6a4a');
  }
}
