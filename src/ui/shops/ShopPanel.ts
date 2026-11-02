// Магазин между волнами: сверху уровни танка, снизу разовые покупки.
// У каждой полки своя камера и свой горизонтальный скролл.
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

export type ShopCardView = {
  title: string;
  info: string;
  cost: string;
  // false — клик не покупает: уровень максимальный или вещь уже взята.
  open: boolean;
  canBuy: boolean;
  // Нижний ряд: галочка вместо слов «куплено» и «установлена».
  owned: boolean;
  buy: () => void;
};

export type ShopView = {
  coins: number;
  stats: ShopCardView[];
  gear: ShopCardView[];
};

// «Следующая волна». Сами покупки приходят в карточке: окно их список не знает.
export type ShopDelegate = {
  closeAndContinue(): void;
};

const PANEL_W = 800;
const PANEL_H = 680;

const VIEW_W = 750;
const CARD_W = 224;
const CARD_H = 86;
const CARD_GAP = 12;
const PAD = 12;
// В колонке две карточки. Четыре пикселя сверху и снизу — запас под обводку.
const COLS_ROWS = 2;
const VIEW_H = CARD_H * COLS_ROWS + CARD_GAP + 4;
const TRACK = 8;
const TRACK_GAP = 6;
const ROW_GAP = 16;

const TOP_BAND = -228;
const TOP_TRACK_Y = TOP_BAND + VIEW_H + TRACK_GAP + TRACK / 2;
const BOTTOM_BAND = TOP_TRACK_Y + TRACK / 2 + ROW_GAP;
const BOTTOM_TRACK_Y = BOTTOM_BAND + VIEW_H + TRACK_GAP + TRACK / 2;

const TITLE_Y = -300;
const COINS_Y = -256;
const RULE_Y = (TOP_TRACK_Y + TRACK / 2 + BOTTOM_BAND) / 2;
const BUTTON_Y = 286;

const BRASS = 0xc4a15a;

type Offer = {
  card: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  info: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  mark: Phaser.GameObjects.Graphics;
  buy: () => void;
  open: boolean;
};

type Row = {
  cam: Phaser.Cameras.Scene2D.Camera;
  content: Phaser.GameObjects.Container;
  track: Phaser.GameObjects.Rectangle;
  thumb: Phaser.GameObjects.Rectangle;
  offers: Offer[];
  band: number;
  viewLeft: number;
  viewTop: number;
  scroll: number;
  maxScroll: number;
  thumbW: number;
};

export class ShopPanel {
  // Шапка, рамка, ползунки и кнопка. Карточки сюда не входят: их рисуют две камеры.
  readonly container: Phaser.GameObjects.Container;

  private readonly coinsText: Phaser.GameObjects.Text;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly statsRow: Row;
  private readonly gearRow: Row;

  private listShown = false;
  private paused = false;
  private drag: { x: number; scroll: number; moved: boolean; row: Row } | null = null;
  private pressedCard: Phaser.GameObjects.Rectangle | null = null;

  constructor(
    scene: Phaser.Scene,
    shop: ShopDelegate,
    private readonly screen: { width: number; height: number },
  ) {
    this.statsRow = this.createRow(scene, TOP_BAND, TOP_TRACK_Y);
    this.gearRow = this.createRow(scene, BOTTOM_BAND, BOTTOM_TRACK_Y);

    this.dim = scene.add.rectangle(0, 0, this.screen.width, this.screen.height, 0x000000, 0.62);
    const panel = scene.add.graphics();
    paintFieldPlate(panel, PANEL_W, PANEL_H);
    const statsWell = scene.add.rectangle(0, TOP_BAND + VIEW_H / 2, VIEW_W, VIEW_H, 0x12170e);
    const gearWell = scene.add.rectangle(0, BOTTOM_BAND + VIEW_H / 2, VIEW_W, VIEW_H, 0x12170e);
    const rule = scene.add.graphics();
    paintFieldRule(rule, RULE_Y, VIEW_W / 2 - 8);

    const title = scene.add
      .text(0, TITLE_Y, 'МАГАЗИН', {
        fontSize: '40px',
        color: fieldInk,
        stroke: fieldInkStroke,
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.coinsText = scene.add
      .text(0, COINS_Y, 'Монеты  0', {
        fontSize: '22px',
        color: fieldPaper,
      })
      .setOrigin(0.5);

    const nextFace = scene.add.graphics().setPosition(0, BUTTON_Y);
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
      statsWell,
      gearWell,
      rule,
      title,
      this.coinsText,
      this.statsRow.track,
      this.statsRow.thumb,
      this.gearRow.track,
      this.gearRow.thumb,
      nextFace,
      next,
      nextLabel,
    ]);
    // Выше игрового UI (51–60), ниже плашки поражения (80).
    this.container.setDepth(70).setVisible(false);
    this.statsRow.content.setDepth(71);
    this.gearRow.content.setDepth(71);

    const onMove = (pointer: Phaser.Input.Pointer) => {
      if (!this.blocked()) {
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
      dx: number,
      dy: number,
    ) => {
      if (this.blocked() || !this.listShown || !this.container.visible) {
        return;
      }
      const row = this.rowAt(pointer);
      if (!row) {
        return;
      }
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      this.setScroll(row, row.scroll + delta * 0.55);
    };
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.input.on('wheel', onWheel);

    // Пока магазин открыт, новые объекты сцены (проволока, пулемёт) не должны попасть в окно полки.
    // Сцена при перезапуске та же, поэтому подписки снимаем на shutdown, иначе старый обработчик
    // трогает уже уничтоженный список карточек и обрывает игровой цикл.
    scene.events.on('update', this.syncListCamera, this);
    scene.events.once('shutdown', () => {
      scene.events.off('update', this.syncListCamera, this);
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      scene.input.off('wheel', onWheel);
    });
    this.place();
    this.syncListCamera();
  }

  // Поле шире 1280 — окно и затемнение остаются по центру, полки едут вместе с ним.
  place(): void {
    const viewLeft = this.screen.width / 2 - VIEW_W / 2;
    this.placeRow(this.statsRow, viewLeft);
    this.placeRow(this.gearRow, viewLeft);
    this.container.setPosition(this.screen.width / 2, this.screen.height / 2);
    this.dim.setSize(this.screen.width, this.screen.height);
  }

  show(view: ShopView): void {
    this.listShown = true;
    this.refresh(view);
    this.setScroll(this.statsRow, 0);
    this.setScroll(this.gearRow, 0);
    this.syncListCamera();
    this.container.setVisible(true);
    this.showRow(this.statsRow, true);
    this.showRow(this.gearRow, true);
  }

  hide(): void {
    this.drag = null;
    this.pressedCard = null;
    this.listShown = false;
    this.container.setVisible(false);
    this.showRow(this.statsRow, false);
    this.showRow(this.gearRow, false);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  // Камеры полок рисуются поверх основной и стирают центр экрана.
  // Пока игра на паузе, прячем их, иначе плашка «ПАУЗА» пропадает над карточками.
  coverForPause(paused: boolean): void {
    if (!this.container.visible) {
      return;
    }
    this.listShown = !paused;
    this.showRow(this.statsRow, this.listShown);
    this.showRow(this.gearRow, this.listShown);
  }

  refresh(view: ShopView): void {
    this.coinsText.setText(`Монеты  ${view.coins}`);
    this.syncRow(this.statsRow, view.stats);
    this.syncRow(this.gearRow, view.gear);
  }

  private createRow(scene: Phaser.Scene, band: number, trackY: number): Row {
    const cam = scene.cameras.add(0, 0, VIEW_W, VIEW_H);
    cam.roundPixels = true;
    cam.setVisible(false);

    const content = scene.add.container(0, 0);
    content.cameraFilter |= scene.cameras.main.id;
    content.setVisible(false);

    const track = scene.add.rectangle(0, trackY, VIEW_W, TRACK, 0x161c12);
    const thumb = scene.add
      .rectangle(0, trackY, 36, TRACK, 0x8a7848)
      .setInteractive({ useHandCursor: true, draggable: true });
    scene.input.setDraggable(thumb);
    track.setVisible(false);
    thumb.setVisible(false);

    const row: Row = {
      cam,
      content,
      track,
      thumb,
      offers: [],
      band,
      viewLeft: 0,
      viewTop: 0,
      scroll: 0,
      maxScroll: 0,
      thumbW: 36,
    };
    thumb.on('drag', (pointer: Phaser.Input.Pointer) => {
      if (!this.blocked() && this.listShown) {
        this.dragThumb(row, pointer);
      }
    });
    return row;
  }

  private placeRow(row: Row, viewLeft: number): void {
    row.viewLeft = viewLeft;
    row.viewTop = this.screen.height / 2 + row.band;
    row.cam.setPosition(row.viewLeft, row.viewTop);
    row.cam.setScroll(row.viewLeft, row.viewTop);
    row.content.setPosition(row.viewLeft - row.scroll, row.viewTop + VIEW_H / 2);
  }

  private showRow(row: Row, shown: boolean): void {
    row.cam.setVisible(shown);
    row.content.setVisible(shown);
    this.applyChrome(row);
  }

  private syncRow(row: Row, cards: ShopCardView[]): void {
    if (row.offers.length !== cards.length) {
      for (const offer of row.offers) {
        offer.card.destroy();
        offer.title.destroy();
        offer.info.destroy();
        offer.cost.destroy();
        offer.mark.destroy();
      }
      row.offers.length = 0;
      const scene = row.content.scene;
      cards.forEach((card, index) => {
        row.offers.push(this.makeOffer(scene, row, index, card.buy));
      });
      this.layout(row);
    }
    for (let i = 0; i < cards.length; i += 1) {
      this.paint(row.offers[i], cards[i]);
    }
  }

  private layout(row: Row): void {
    const cols = Math.ceil(row.offers.length / COLS_ROWS);
    const gaps = Math.max(0, cols - 1);
    const contentWidth = PAD * 2 + cols * CARD_W + gaps * CARD_GAP;
    row.maxScroll = Math.max(0, contentWidth - VIEW_W);
    const span = Math.max(contentWidth, 1);
    row.thumbW = Math.min(VIEW_W, Math.max(36, Math.round((VIEW_W * VIEW_W) / span)));
    row.thumb.setSize(row.thumbW, TRACK);
    this.setScroll(row, row.scroll);
    this.applyChrome(row);
  }

  private applyChrome(row: Row): void {
    const scroll = this.listShown && row.maxScroll > 0;
    row.track.setVisible(scroll);
    row.thumb.setVisible(scroll);
  }

  private makeOffer(scene: Phaser.Scene, row: Row, index: number, buy: () => void): Offer {
    const col = Math.floor(index / COLS_ROWS);
    const slot = index % COLS_ROWS;
    const x = PAD + col * (CARD_W + CARD_GAP) + CARD_W / 2;
    const y = (slot - (COLS_ROWS - 1) / 2) * (CARD_H + CARD_GAP);
    const card = scene.add.rectangle(x, y, CARD_W, CARD_H, 0x343e2a).setStrokeStyle(2, 0x6e6848);
    card.setInteractive({ useHandCursor: true });
    const title = scene.add
      .text(x, y - CARD_H / 2 + 10, '', {
        fontSize: '16px',
        color: fieldInk,
        align: 'center',
      })
      .setOrigin(0.5, 0);
    const info = scene.add
      .text(x, y + 2, '', {
        fontSize: '14px',
        color: fieldPaper,
        align: 'center',
      })
      .setOrigin(0.5);
    const cost = scene.add
      .text(x, y + CARD_H / 2 - 8, '', {
        fontSize: '16px',
        color: fieldInk,
        align: 'center',
      })
      .setOrigin(0.5, 1);
    const mark = scene.add.graphics().setPosition(x - CARD_W / 2 + 22, y + CARD_H / 2 - 22);
    paintOwnedMark(mark);
    mark.setVisible(false);

    row.content.add([card, title, info, cost, mark]);
    const offer: Offer = { card, title, info, cost, mark, buy, open: true };
    card.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Карточка за краем камеры всё ещё ловит клик: мир шире окна полки.
      if (this.blocked() || !this.listShown || !this.inView(row, pointer)) {
        return;
      }
      this.pressedCard = card;
      this.drag = { x: pointer.x, scroll: row.scroll, moved: false, row };
    });
    // Короткое нажатие покупает. Сдвиг полки — это уже скролл, не покупка.
    card.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (
        this.blocked() ||
        !this.listShown ||
        this.pressedCard !== card ||
        this.drag?.moved ||
        !offer.open
      ) {
        return;
      }
      if (!this.inView(row, pointer)) {
        return;
      }
      offer.buy();
    });
    return offer;
  }

  private blocked(): boolean {
    return this.paused;
  }

  private dragList(pointer: Phaser.Input.Pointer): void {
    if (!this.drag || !pointer.isDown) {
      return;
    }
    const dx = pointer.x - this.drag.x;
    if (Math.abs(dx) > 8) {
      this.drag.moved = true;
    }
    if (this.drag.moved) {
      this.setScroll(this.drag.row, this.drag.scroll - dx);
    }
  }

  private dragThumb(row: Row, pointer: Phaser.Input.Pointer): void {
    const screenLeft = this.screen.width / 2 - VIEW_W / 2;
    const travel = VIEW_W - row.thumbW;
    const half = row.thumbW / 2;
    const center = Phaser.Math.Clamp(pointer.x, screenLeft + half, screenLeft + travel + half);
    const t = travel > 0 ? (center - (screenLeft + half)) / travel : 0;
    this.setScroll(row, t * row.maxScroll);
  }

  private setScroll(row: Row, value: number): void {
    row.scroll = Phaser.Math.Clamp(value, 0, row.maxScroll);
    row.content.x = row.viewLeft - row.scroll;
    const travel = VIEW_W - row.thumbW;
    const t = row.maxScroll > 0 ? row.scroll / row.maxScroll : 0;
    row.thumb.x = -VIEW_W / 2 + row.thumbW / 2 + travel * t;
  }

  private rowAt(pointer: Phaser.Input.Pointer): Row | null {
    if (this.overRow(this.statsRow, pointer)) {
      return this.statsRow;
    }
    if (this.overRow(this.gearRow, pointer)) {
      return this.gearRow;
    }
    return null;
  }

  private overRow(row: Row, pointer: Phaser.Input.Pointer): boolean {
    const bottom = row.viewTop + VIEW_H + TRACK_GAP + TRACK;
    return (
      pointer.x >= row.viewLeft &&
      pointer.x <= row.viewLeft + VIEW_W &&
      pointer.y >= row.viewTop &&
      pointer.y <= bottom
    );
  }

  private inView(row: Row, pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= row.viewLeft &&
      pointer.x <= row.viewLeft + VIEW_W &&
      pointer.y >= row.viewTop &&
      pointer.y <= row.viewTop + VIEW_H
    );
  }

  // Каждая камера рисует только свою полку. Всё остальное на сцене для неё невидимо.
  private syncListCamera(): void {
    const statsId = this.statsRow.cam.id;
    const gearId = this.gearRow.cam.id;
    const mainId = this.statsRow.content.scene.cameras.main.id;
    const both = statsId | gearId;
    const children = this.statsRow.content.scene.children.list;
    for (const child of children) {
      if (child === this.statsRow.content) {
        child.cameraFilter = (child.cameraFilter & ~statsId) | mainId | gearId;
      } else if (child === this.gearRow.content) {
        child.cameraFilter = (child.cameraFilter & ~gearId) | mainId | statsId;
      } else {
        child.cameraFilter |= both;
      }
    }
  }

  private paint(offer: Offer, card: ShopCardView): void {
    offer.buy = card.buy;
    offer.open = card.open;
    offer.title.setText(card.title);
    offer.info.setText(card.info);
    offer.cost.setText(card.cost);
    offer.cost.setVisible(!card.owned);
    offer.mark.setVisible(card.owned);
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
