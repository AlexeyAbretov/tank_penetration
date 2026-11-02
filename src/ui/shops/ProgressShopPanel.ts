// Магазин после гибели базы. Оплата накопленным score.
// Один список в своей камере: он скроллится вертикально и не залезает на кнопки.
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
  // false — скорость уже на пределе, клик не покупает.
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

const PANEL_W = 660;
const PANEL_H = 600;

const CARD_W = 133;
const CARD_H = 68;
const CARD_GAP = 10;
const PAD = 8;
const TRACK = 8;
// Две кнопки внизу. Список совпадает с их внешними краями.
const BUTTON_W = 260;
const BUTTON_X = 145;
const BUTTON_SPAN = BUTTON_X * 2 + BUTTON_W;
const VIEW_W = BUTTON_SPAN;

const TITLE_Y = -258;
const SCORE_Y = -214;
const VIEW_BAND = -184;
// Низ панели минус зазор и половина кнопки.
const BUTTON_Y = PANEL_H / 2 - 28 - 26;
const VIEW_H = BUTTON_Y - 26 - 16 - VIEW_BAND;

type Offer = {
  card: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  info: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  buy: () => void;
  open: boolean;
};

export class ProgressShopPanel {
  readonly container: Phaser.GameObjects.Container;

  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly screen: { width: number; height: number };
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private readonly content: Phaser.GameObjects.Container;
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly thumb: Phaser.GameObjects.Rectangle;
  private readonly offers: Offer[] = [];

  private viewLeft = 0;
  private viewTop = 0;
  private scroll = 0;
  private maxScroll = 0;
  private thumbH = 36;
  private listShown = false;
  private paused = false;
  private drag: { y: number; scroll: number; moved: boolean } | null = null;
  private pressedCard: Phaser.GameObjects.Rectangle | null = null;

  constructor(
    scene: Phaser.Scene,
    shop: ProgressShopDelegate,
    screen: { width: number; height: number },
  ) {
    this.screen = screen;
    this.cam = scene.cameras.add(0, 0, VIEW_W, VIEW_H);
    this.cam.roundPixels = true;
    this.cam.setVisible(false);

    this.content = scene.add.container(0, 0);
    this.content.cameraFilter |= scene.cameras.main.id;
    this.content.setVisible(false).setDepth(86);

    this.dim = scene.add.rectangle(0, 0, screen.width, screen.height, 0x000000, 0.62).setInteractive();
    const panel = scene.add.graphics();
    paintFieldPlate(panel, PANEL_W, PANEL_H);
    const well = scene.add.rectangle(0, VIEW_BAND + VIEW_H / 2, VIEW_W, VIEW_H, 0x12170e);
    const rule = scene.add.graphics();
    paintFieldRule(rule, -236, 200);

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

    const trackX = VIEW_W / 2 - TRACK / 2;
    this.track = scene.add.rectangle(trackX, VIEW_BAND + VIEW_H / 2, TRACK, VIEW_H, 0x161c12);
    this.thumb = scene.add
      .rectangle(trackX, VIEW_BAND + this.thumbH / 2, TRACK, this.thumbH, 0x8a7848)
      .setInteractive({ useHandCursor: true, draggable: true });
    scene.input.setDraggable(this.thumb);
    this.track.setVisible(false);
    this.thumb.setVisible(false);
    this.thumb.on('drag', (pointer: Phaser.Input.Pointer) => {
      if (!this.paused && this.listShown) {
        this.dragThumb(pointer);
      }
    });

    this.container = scene.add.container(screen.width / 2, screen.height / 2, [
      this.dim,
      panel,
      well,
      rule,
      title,
      this.scoreText,
      this.track,
      this.thumb,
    ]);

    const fresh = this.makeButton(scene, -BUTTON_X, BUTTON_Y, BUTTON_W, 'НОВАЯ ИГРА', () => shop.wipeAndRestart());
    const next = this.makeButton(scene, BUTTON_X, BUTTON_Y, BUTTON_W, 'В БОЙ', () => shop.closeAndRestart());
    this.container.add([fresh, next]);

    // Выше игрового UI и окна между волнами. Пауза (90) остаётся сверху.
    this.container.setDepth(85).setVisible(false);

    const onMove = (pointer: Phaser.Input.Pointer) => {
      if (!this.paused) {
        this.dragList(pointer);
      }
    };
    const onUp = () => {
      this.drag = null;
      this.pressedCard = null;
    };
    const onWheel = (
      pointer: Phaser.Input.Pointer,
      _over: Phaser.GameObjects.GameObject[],
      _dx: number,
      dy: number,
    ) => {
      if (this.paused || !this.listShown || !this.container.visible || !this.overList(pointer)) {
        return;
      }
      this.setScroll(this.scroll + dy * 0.55);
    };
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.input.on('wheel', onWheel);

    // Сцена при перезапуске та же, поэтому подписки снимаем на shutdown.
    scene.events.on('update', this.syncListCamera, this);
    scene.events.once('shutdown', () => {
      scene.events.off('update', this.syncListCamera, this);
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      scene.input.off('wheel', onWheel);
    });
    this.layout();
    this.syncListCamera();
  }

  layout(): void {
    this.viewLeft = this.screen.width / 2 - VIEW_W / 2;
    this.viewTop = this.screen.height / 2 + VIEW_BAND;
    this.cam.setPosition(this.viewLeft, this.viewTop);
    this.cam.setScroll(this.viewLeft, this.viewTop);
    this.content.setPosition(this.viewLeft + VIEW_W / 2, this.viewTop - this.scroll);
    this.container.setPosition(this.screen.width / 2, this.screen.height / 2);
    this.dim.setSize(this.screen.width, this.screen.height);
  }

  show(view: ProgressShopView): void {
    this.refresh(view);
    this.setScroll(0);
    this.container.setVisible(true);
    this.listShown = !this.paused;
    this.applyList();
    this.syncListCamera();
  }

  hide(): void {
    this.drag = null;
    this.pressedCard = null;
    this.listShown = false;
    this.container.setVisible(false);
    this.applyList();
  }

  // Камера списка рисуется поверх основной и закрыла бы плашку «ПАУЗА».
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.container.visible) {
      return;
    }
    this.listShown = !paused;
    this.applyList();
  }

  refresh(view: ProgressShopView): void {
    this.scoreText.setText(`SCORE  ${view.score}`);
    this.syncOffers(view.cards);
    for (let i = 0; i < view.cards.length; i += 1) {
      this.paint(this.offers[i], view.cards[i]);
    }
  }

  private applyList(): void {
    this.cam.setVisible(this.listShown);
    this.content.setVisible(this.listShown);
    const scroll = this.listShown && this.maxScroll > 0;
    this.track.setVisible(scroll);
    this.thumb.setVisible(scroll);
  }

  private syncOffers(cards: ProgressCardView[]): void {
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
    const scene = this.content.scene;
    cards.forEach((card, index) => {
      this.offers.push(this.makeOffer(scene, index, card.buy));
    });
    this.layoutList();
  }

  private layoutList(): void {
    const rows = Math.ceil(this.offers.length / this.columns());
    const gaps = Math.max(0, rows - 1);
    const contentHeight = PAD * 2 + rows * CARD_H + gaps * CARD_GAP;
    this.maxScroll = Math.max(0, contentHeight - VIEW_H);
    const span = Math.max(contentHeight, 1);
    this.thumbH = Math.min(VIEW_H, Math.max(36, Math.round((VIEW_H * VIEW_H) / span)));
    this.thumb.setSize(TRACK, this.thumbH);
    this.setScroll(this.scroll);
    this.applyList();
  }

  private columns(): number {
    const inner = VIEW_W - PAD * 2 + CARD_GAP;
    return Math.max(1, Math.floor(inner / (CARD_W + CARD_GAP)));
  }

  private makeOffer(scene: Phaser.Scene, index: number, buy: () => void): Offer {
    const cols = this.columns();
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = -VIEW_W / 2 + PAD + col * (CARD_W + CARD_GAP) + CARD_W / 2;
    const y = PAD + row * (CARD_H + CARD_GAP) + CARD_H / 2;
    const card = scene.add.rectangle(x, y, CARD_W, CARD_H, 0x343e2a).setStrokeStyle(2, 0x6e6848);
    // Выше затемнения окна: иначе полный экран перехватывает клик по карточке.
    card.setDepth(10);
    card.setInteractive({ useHandCursor: true });
    const title = scene.add
      .text(x, y - CARD_H / 2 + 6, '', {
        fontSize: '13px',
        color: fieldInk,
        align: 'center',
      })
      .setOrigin(0.5, 0);
    const info = scene.add
      .text(x, y + 1, '', {
        fontSize: '11px',
        color: fieldPaper,
        align: 'center',
      })
      .setOrigin(0.5);
    const cost = scene.add
      .text(x, y + CARD_H / 2 - 5, '', {
        fontSize: '13px',
        color: fieldInk,
        align: 'center',
      })
      .setOrigin(0.5, 1);

    this.content.add([card, title, info, cost]);
    const offer: Offer = { card, title, info, cost, buy, open: true };
    card.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || !this.listShown || !this.inView(pointer)) {
        return;
      }
      this.pressedCard = card;
      this.drag = { y: pointer.y, scroll: this.scroll, moved: false };
    });
    card.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || !this.listShown || this.pressedCard !== card || this.drag?.moved || !offer.open) {
        return;
      }
      if (!this.inView(pointer)) {
        return;
      }
      offer.buy();
    });
    return offer;
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
    const screenTop = this.screen.height / 2 + VIEW_BAND;
    const travel = VIEW_H - this.thumbH;
    const half = this.thumbH / 2;
    const center = Phaser.Math.Clamp(pointer.y, screenTop + half, screenTop + travel + half);
    const t = travel > 0 ? (center - (screenTop + half)) / travel : 0;
    this.setScroll(t * this.maxScroll);
  }

  private setScroll(value: number): void {
    this.scroll = Phaser.Math.Clamp(value, 0, this.maxScroll);
    this.content.y = this.viewTop - this.scroll;
    const travel = VIEW_H - this.thumbH;
    const t = this.maxScroll > 0 ? this.scroll / this.maxScroll : 0;
    this.thumb.y = VIEW_BAND + this.thumbH / 2 + travel * t;
  }

  private overList(pointer: Phaser.Input.Pointer): boolean {
    const right = this.viewLeft + VIEW_W;
    return (
      pointer.x >= this.viewLeft &&
      pointer.x <= right &&
      pointer.y >= this.viewTop &&
      pointer.y <= this.viewTop + VIEW_H
    );
  }

  private inView(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= this.viewLeft &&
      pointer.x <= this.viewLeft + VIEW_W &&
      pointer.y >= this.viewTop &&
      pointer.y <= this.viewTop + VIEW_H
    );
  }

  // Камера списка рисует только карточки. Остальная сцена для неё невидима.
  private syncListCamera(): void {
    const listId = this.cam.id;
    const mainId = this.content.scene.cameras.main.id;
    const children = this.content.scene.children.list;
    for (const child of children) {
      if (child === this.content) {
        child.cameraFilter = (child.cameraFilter & ~listId) | mainId;
      } else {
        child.cameraFilter |= listId;
      }
    }
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
