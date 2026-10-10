// Окно магазина между волнами: улучшения, колючая проволока и кнопка «дальше».
// Список карточек выше окна, поэтому он живёт в отдельной камере и скроллится.
// Покупки делегируются ShopController через ShopDelegate.

import Phaser from 'phaser';
import { GAME, PAUSED } from '../gameConfig';
import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { BarbedWire } from '../entities/BarbedWire';
import { Infantry } from '../entities/Infantry';
import { MachineGun } from '../entities/MachineGun';
import { Tank } from '../entities/Tank';
import { loadMeta } from '../systems/MetaSave';

// Методы покупок, которые реализует ShopController.
export type ShopDelegate = {
  buyBlast(): void;
  buyDamage(): void;
  buyFireRate(): void;
  buyWire(): void;
  buyAutoFire(): void;
  buyMachineGun(): void;
  buyArtillery(): void;
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
const OFFER_COUNT = 7;

const TITLE_WRAP = CARD_W - 190;
const INFO_WRAP = CARD_W - 44;

type Offer = {
  card: Phaser.GameObjects.Rectangle;
  info: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
};

export class ShopPanel {
  static readonly upgrades = {
    baseCost: 3,
    costStep: 2,
  };

  static upgradeCost(level: number): number {
    return ShopPanel.upgrades.baseCost + level * ShopPanel.upgrades.costStep;
  }

  // Шапка, рамка и кнопка. Список карточек сюда не входит: его рисует своя камера.
  readonly container: Phaser.GameObjects.Container;

  private readonly coinsText: Phaser.GameObjects.Text;
  private readonly blast: Offer;
  private readonly damage: Offer;
  private readonly fireRate: Offer;
  private readonly wire: Offer;
  private readonly autoFire: Offer;
  private readonly machineGun: Offer;
  private readonly artillery: Offer;

  // Камера с маленьким окном обрезает карточки, которые уехали за шапку или кнопку.
  private readonly listCam: Phaser.Cameras.Scene2D.Camera;
  private readonly listContent: Phaser.GameObjects.Container;
  private readonly track: Phaser.GameObjects.Rectangle;
  private readonly thumb: Phaser.GameObjects.Rectangle;

  private readonly viewLeft: number;
  private readonly viewTop: number;
  private readonly contentHeight: number;
  private readonly maxScroll: number;
  private readonly thumbH: number;
  private readonly trackTop: number;

  private scroll = 0;
  private drag: { y: number; scroll: number; moved: boolean } | null = null;
  private pressedCard: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene, shop: ShopDelegate) {
    const groupW = VIEW_W + SCROLL_GAP + SCROLL_W;
    this.viewLeft = GAME.width / 2 - groupW / 2;
    this.viewTop = GAME.height / 2 + VIEW_TOP;
    this.contentHeight = CONTENT_PAD * 2 + OFFER_COUNT * CARD_H + (OFFER_COUNT - 1) * CARD_GAP;
    this.maxScroll = Math.max(0, this.contentHeight - VIEW_H);
    this.thumbH = Math.max(36, Math.round((VIEW_H * VIEW_H) / this.contentHeight));
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

    this.blast = this.makeOffer(scene, 0, '+1 область взрыва', () => shop.buyBlast());
    this.damage = this.makeOffer(scene, 1, '+1 урон', () => shop.buyDamage());
    this.fireRate = this.makeOffer(scene, 2, '−0.02 с перезарядки', () => shop.buyFireRate());
    this.wire = this.makeOffer(scene, 3, 'Колючая проволока', () => shop.buyWire());
    this.autoFire = this.makeOffer(scene, 4, 'Автострельба', () => shop.buyAutoFire());
    this.machineGun = this.makeOffer(scene, 5, 'Пулемёт', () => shop.buyMachineGun());
    this.artillery = this.makeOffer(scene, 6, 'Артиллерийский удар', () => shop.buyArtillery());

    const dim = scene.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.62);
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
    const canScroll = this.maxScroll > 0;
    this.track.setVisible(canScroll);
    this.thumb.setVisible(canScroll);

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

    this.container = scene.add.container(GAME.width / 2, GAME.height / 2, [
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

  show(
    coins: number,
    blastLevel: number,
    damageLevel: number,
    fireRateLevel: number,
    wireOwned: boolean,
    autoFireOwned: boolean,
    machineGunOwned: boolean,
    artilleryOwned: boolean,
  ): void {
    this.setScroll(0);
    this.refresh(
      coins,
      blastLevel,
      damageLevel,
      fireRateLevel,
      wireOwned,
      autoFireOwned,
      machineGunOwned,
      artilleryOwned,
    );
    this.syncListCamera();
    this.container.setVisible(true);
    this.listContent.setVisible(true);
    this.listCam.setVisible(true);
  }

  hide(): void {
    this.drag = null;
    this.pressedCard = null;
    this.container.setVisible(false);
    this.listContent.setVisible(false);
    this.listCam.setVisible(false);
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
    const scroll = showList && this.maxScroll > 0;
    this.track.setVisible(scroll);
    this.thumb.setVisible(scroll);
  }

  refresh(
    coins: number,
    blastLevel: number,
    damageLevel: number,
    fireRateLevel: number,
    wireOwned: boolean,
    autoFireOwned: boolean,
    machineGunOwned: boolean,
    artilleryOwned: boolean,
  ): void {
    this.coinsText.setText(`Монеты  ${coins}`);

    const blastPrice = ShopPanel.upgradeCost(blastLevel);
    const damagePrice = ShopPanel.upgradeCost(damageLevel);
    const fireRatePrice = ShopPanel.upgradeCost(fireRateLevel);
    const meta = loadMeta();
    const radius = (blastLevel + meta.blast) * Tank.blastRadiusPerLevel;
    const nextRadius = (blastLevel + 1 + meta.blast) * Tank.blastRadiusPerLevel;
    const damageNow = Infantry.shellDamage + damageLevel + meta.damage;

    this.blast.info.setText(`ур. ${blastLevel}   радиус ${radius} → ${nextRadius}`);
    this.blast.cost.setText(`цена  ${blastPrice}`);
    this.damage.info.setText(`ур. ${damageLevel}   урон ${damageNow} → ${damageNow + 1}`);
    this.damage.cost.setText(`цена  ${damagePrice}`);

    this.tintCard(this.blast.card, this.blast.cost, coins >= blastPrice);
    this.tintCard(this.damage.card, this.damage.cost, coins >= damagePrice);
    this.showFireRate(coins, fireRateLevel, fireRatePrice);
    this.showWire(coins, wireOwned);
    this.showAutoFire(coins, autoFireOwned);
    this.showMachineGun(coins, machineGunOwned);
    this.showArtillery(coins, artilleryOwned);
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
    // Короткое нажатие покупает. Сдвиг списка — это уже скролл, не покупка.
    card.on('pointerup', () => {
      if (this.blocked() || this.pressedCard !== card || this.drag?.moved) {
        return;
      }
      buy();
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
    return { card, info, cost };
  }

  private blocked(): boolean {
    return this.listContent.scene.registry.get(PAUSED) === true;
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
    const screenTop = GAME.height / 2 + this.trackTop;
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
    const left = GAME.width / 2 - PANEL_W / 2;
    const top = GAME.height / 2 - PANEL_H / 2;
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

  private formatDelay(ms: number): string {
    return `${(ms / 1000).toFixed(2)} с`;
  }

  private showFireRate(coins: number, level: number, price: number): void {
    const maxed = level >= Tank.maxFireRateLevel;
    const delay = Tank.fireDelayFor(level);
    const nextDelay = Tank.fireDelayFor(level + 1);
    this.fireRate.info.setText(
      maxed
        ? `ур. ${level}   ${this.formatDelay(delay)} (макс.)`
        : `ур. ${level}   ${this.formatDelay(delay)} → ${this.formatDelay(nextDelay)}`,
    );
    if (maxed) {
      this.fireRate.cost.setText('максимум');
      this.fireRate.card.setFillStyle(0x3d2a12);
      this.fireRate.cost.setColor('#f3d56a');
      this.fireRate.card.disableInteractive();
      return;
    }
    this.fireRate.cost.setText(`цена  ${price}`);
    if (!this.fireRate.card.input?.enabled) {
      this.fireRate.card.setInteractive({ useHandCursor: true });
    }
    this.tintCard(this.fireRate.card, this.fireRate.cost, coins >= price);
  }

  private showWire(coins: number, owned: boolean): void {
    if (owned) {
      this.wire.info.setText('стоит перед танком, от верха до низа');
      this.wire.cost.setText('установлена');
      this.wire.card.setFillStyle(0x3d2a12);
      this.wire.cost.setColor('#f3d56a');
      this.wire.card.disableInteractive();
      return;
    }
    this.wire.info.setText('не пускает пехоту · 1 урона / 3 с');
    this.wire.cost.setText(`цена  ${BarbedWire.shop.cost}`);
    if (!this.wire.card.input?.enabled) {
      this.wire.card.setInteractive({ useHandCursor: true });
    }
    this.tintCard(this.wire.card, this.wire.cost, coins >= BarbedWire.shop.cost);
  }

  private showAutoFire(coins: number, owned: boolean): void {
    if (owned) {
      this.autoFire.info.setText('кнопка слева от шестерёнки — вкл и выкл');
      this.autoFire.cost.setText('куплено');
      this.autoFire.card.setFillStyle(0x3d2a12);
      this.autoFire.cost.setColor('#f3d56a');
      this.autoFire.card.disableInteractive();
      return;
    }
    this.autoFire.info.setText('не нужно держать ЛКМ');
    this.autoFire.cost.setText(`цена  ${Tank.shop.autoFireCost}`);
    if (!this.autoFire.card.input?.enabled) {
      this.autoFire.card.setInteractive({ useHandCursor: true });
    }
    this.tintCard(this.autoFire.card, this.autoFire.cost, coins >= Tank.shop.autoFireCost);
  }

  private showMachineGun(coins: number, owned: boolean): void {
    if (owned) {
      this.machineGun.info.setText('перед люком башни · 1 урона / 3 с');
      this.machineGun.cost.setText('установлен');
      this.machineGun.card.setFillStyle(0x3d2a12);
      this.machineGun.cost.setColor('#f3d56a');
      this.machineGun.card.disableInteractive();
      return;
    }
    this.machineGun.info.setText('стреляет вдоль прицела башни');
    this.machineGun.cost.setText(`цена  ${MachineGun.shop.cost}`);
    if (!this.machineGun.card.input?.enabled) {
      this.machineGun.card.setInteractive({ useHandCursor: true });
    }
    this.tintCard(this.machineGun.card, this.machineGun.cost, coins >= MachineGun.shop.cost);
  }

  private showArtillery(coins: number, owned: boolean): void {
    const offer = ArtilleryStrike.shop;
    const reload = offer.cooldownMs / 1000;
    const crater = offer.craterMs / 1000;
    if (owned) {
      this.artillery.info.setText(`клавиша 1 · перезарядка ${reload} с`);
      this.artillery.cost.setText('куплено');
      this.artillery.card.setFillStyle(0x3d2a12);
      this.artillery.cost.setColor('#f3d56a');
      this.artillery.card.disableInteractive();
      return;
    }
    this.artillery.info.setText(
      `${offer.shells} снаряда в случайные точки · ${offer.damage} урона\nвзрыв и воронка ${crater} с · клавиша 1 · перезарядка ${reload} с`,
    );
    this.artillery.cost.setText(`цена  ${offer.cost}`);
    if (!this.artillery.card.input?.enabled) {
      this.artillery.card.setInteractive({ useHandCursor: true });
    }
    this.tintCard(this.artillery.card, this.artillery.cost, coins >= offer.cost);
  }

  private tintCard(card: Phaser.GameObjects.Rectangle, cost: Phaser.GameObjects.Text, canBuy: boolean): void {
    card.setFillStyle(canBuy ? 0x5a1210 : 0x2a1010);
    cost.setColor(canBuy ? '#f3d56a' : '#8a6a4a');
  }
}
