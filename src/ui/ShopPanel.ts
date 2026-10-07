// Окно магазина между волнами: улучшения, колючая проволока и кнопка «дальше».
// Покупки делегируются ShopController через ShopDelegate.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { BarbedWire } from '../entities/BarbedWire';
import { Tank } from '../entities/Tank';

// Методы покупок, которые реализует ShopController.
export type ShopDelegate = {
  buyBlast(): void;
  buyDamage(): void;
  buyFireRate(): void;
  buyWire(): void;
  buyAutoFire(): void;
  closeAndContinue(): void;
};

export class ShopPanel {
  static readonly upgrades = {
    baseCost: 3,
    costStep: 2,
  };

  static upgradeCost(level: number): number {
    return ShopPanel.upgrades.baseCost + level * ShopPanel.upgrades.costStep;
  }

  // Все куски интерфейса лежат в одном контейнере: показать и спрятать можно одним вызовом.
  readonly container: Phaser.GameObjects.Container;

  private readonly coinsText: Phaser.GameObjects.Text;
  private readonly blastInfo: Phaser.GameObjects.Text;
  private readonly damageInfo: Phaser.GameObjects.Text;
  private readonly blastCost: Phaser.GameObjects.Text;
  private readonly damageCost: Phaser.GameObjects.Text;
  private readonly fireRateInfo: Phaser.GameObjects.Text;
  private readonly fireRateCost: Phaser.GameObjects.Text;
  private readonly wireInfo: Phaser.GameObjects.Text;
  private readonly wireCost: Phaser.GameObjects.Text;
  private readonly autoFireInfo: Phaser.GameObjects.Text;
  private readonly autoFireCost: Phaser.GameObjects.Text;
  // Карточки — невидимые для логики прямоугольники, но именно они ловят клик.
  private readonly blastCard: Phaser.GameObjects.Rectangle;
  private readonly damageCard: Phaser.GameObjects.Rectangle;
  private readonly fireRateCard: Phaser.GameObjects.Rectangle;
  private readonly wireCard: Phaser.GameObjects.Rectangle;
  private readonly autoFireCard: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, shop: ShopDelegate) {
    // Затемнение на весь экран. Координаты детей контейнера считаются от его центра,
    // поэтому (0, 0) здесь — середина экрана, а не левый верхний угол.
    const dim = scene.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.62);
    // Тёмно-красная плашка окна. Последний аргумент 0.96 — почти непрозрачная заливка.
    const panel = scene.add.rectangle(0, 24, 700, 620, 0x3a0c0c, 0.96);
    // Золотая обводка толщиной 4 пикселя.
    panel.setStrokeStyle(4, 0xc9a227);

    const title = scene.add
      .text(0, -258, 'МАГАЗИН', {
        fontFamily: 'Cinzel, Georgia, serif', // если Cinzel не загрузился, берётся Georgia, затем любой serif
        fontSize: '40px',
        color: '#f3d56a',
        stroke: '#4a1208', // тёмная обводка букв, чтобы текст читался на красном
        strokeThickness: 6,
      })
      .setOrigin(0.5); // якорь текста в центре, а не в левом верхнем углу букв

    this.coinsText = scene.add
      .text(0, -212, 'Монеты  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);

    // Три карточки в ряд: взрыв, урон, скорострельность.
    this.blastCard = scene.add.rectangle(-210, -88, 210, 130, 0x5a1210).setStrokeStyle(2, 0xf0d56a);
    this.damageCard = scene.add.rectangle(0, -88, 210, 130, 0x5a1210).setStrokeStyle(2, 0xf0d56a);
    this.fireRateCard = scene.add.rectangle(210, -88, 210, 130, 0x5a1210).setStrokeStyle(2, 0xf0d56a);
    this.wireCard = scene.add.rectangle(-165, 58, 310, 118, 0x5a1210).setStrokeStyle(2, 0xf0d56a);
    this.autoFireCard = scene.add.rectangle(165, 58, 310, 118, 0x5a1210).setStrokeStyle(2, 0xf0d56a);
    // setInteractive включает попадание курсором. useHandCursor меняет стрелку на «руку».
    this.blastCard.setInteractive({ useHandCursor: true });
    this.damageCard.setInteractive({ useHandCursor: true });
    this.fireRateCard.setInteractive({ useHandCursor: true });
    this.wireCard.setInteractive({ useHandCursor: true });
    this.autoFireCard.setInteractive({ useHandCursor: true });
    // pointerup — отпускание кнопки мыши над карточкой, чтобы клик не срабатывал при нажатии «проездом».
    this.blastCard.on('pointerup', () => shop.buyBlast());
    this.damageCard.on('pointerup', () => shop.buyDamage());
    this.fireRateCard.on('pointerup', () => shop.buyFireRate());
    this.wireCard.on('pointerup', () => shop.buyWire());
    this.autoFireCard.on('pointerup', () => shop.buyAutoFire());

    // Заголовки карточек нарисованы один раз: их текст не меняется.
    const blastTitle = scene.add
      .text(-210, -132, '+1 область взрыва', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    // Уровень и радиус подставляются в refresh, поэтому стартовая строка пустая.
    this.blastInfo = scene.add
      .text(-210, -98, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f0dcc0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.blastCost = scene.add
      .text(-210, -48, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    const damageTitle = scene.add
      .text(0, -132, '+1 урон', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    this.damageInfo = scene.add
      .text(0, -98, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f0dcc0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.damageCost = scene.add
      .text(0, -48, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    const fireRateTitle = scene.add
      .text(210, -132, '−0.02 с перезарядки', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '16px',
        color: '#f3d56a',
        align: 'center',
      })
      .setOrigin(0.5);
    this.fireRateInfo = scene.add
      .text(210, -98, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        color: '#f0dcc0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.fireRateCost = scene.add
      .text(210, -48, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    const wireTitle = scene.add
      .text(-165, 22, 'Колючая проволока', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    this.wireInfo = scene.add
      .text(-165, 50, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f0dcc0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.wireCost = scene.add
      .text(-165, 90, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    const autoFireTitle = scene.add
      .text(165, 22, 'Автострельба', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    this.autoFireInfo = scene.add
      .text(165, 50, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f0dcc0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.autoFireCost = scene.add
      .text(165, 90, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    // Кнопка продолжения под карточками.
    const next = scene.add.rectangle(0, 180, 280, 52, 0x8a1810).setStrokeStyle(2, 0xf0d56a);
    next.setInteractive({ useHandCursor: true });
    next.on('pointerup', () => shop.closeAndContinue());
    const nextLabel = scene.add
      .text(0, 180, 'СЛЕДУЮЩАЯ ВОЛНА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    // Контейнер стоит в центре экрана. Список — порядок отрисовки: первый снизу, последний сверху.
    this.container = scene.add.container(GAME.width / 2, GAME.height / 2, [
      dim,
      panel,
      title,
      this.coinsText,
      this.blastCard,
      this.damageCard,
      this.fireRateCard,
      blastTitle,
      this.blastInfo,
      this.blastCost,
      damageTitle,
      this.damageInfo,
      this.damageCost,
      fireRateTitle,
      this.fireRateInfo,
      this.fireRateCost,
      this.wireCard,
      this.autoFireCard,
      wireTitle,
      this.wireInfo,
      this.wireCost,
      autoFireTitle,
      this.autoFireInfo,
      this.autoFireCost,
      next,
      nextLabel,
    ]);
    // Выше игрового UI (51–60), ниже плашки поражения (80).
    this.container.setDepth(70).setVisible(false);
  }

  // Показывает магазин и сразу пишет актуальные цены.
  show(
    coins: number,
    blastLevel: number,
    damageLevel: number,
    fireRateLevel: number,
    wireOwned: boolean,
    autoFireOwned: boolean,
  ): void {
    this.refresh(coins, blastLevel, damageLevel, fireRateLevel, wireOwned, autoFireOwned);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  // Перерисовывает цифры. Сцена зовёт это после каждой покупки, не закрывая окно.
  refresh(
    coins: number,
    blastLevel: number,
    damageLevel: number,
    fireRateLevel: number,
    wireOwned: boolean,
    autoFireOwned: boolean,
  ): void {
    this.coinsText.setText(`Монеты  ${coins}`);

    // Цена зависит от того, сколько раз ЭТО улучшение уже брали. Уровни копируются независимо.
    const blastPrice = ShopPanel.upgradeCost(blastLevel);
    const damagePrice = ShopPanel.upgradeCost(damageLevel);
    const fireRatePrice = ShopPanel.upgradeCost(fireRateLevel);
    // Текущий радиус и радиус после следующей покупки. На нулевом уровне радиус 0 — взрыв только по прямой цели.
    const radius = blastLevel * Tank.blastRadiusPerLevel;
    const nextRadius = (blastLevel + 1) * Tank.blastRadiusPerLevel;

    // Стрелка в тексте показывает «сейчас → после покупки».
    this.blastInfo.setText(`ур. ${blastLevel}   радиус ${radius} → ${nextRadius}`);
    this.blastCost.setText(`цена  ${blastPrice}`);
    // Базовый урон снаряда 1, каждый уровень damage прибавляет 1. Смотри hurtInfantry в сцене.
    this.damageInfo.setText(`ур. ${damageLevel}   урон ${1 + damageLevel} → ${2 + damageLevel}`);
    this.damageCost.setText(`цена  ${damagePrice}`);

    this.tintCard(this.blastCard, this.blastCost, coins >= blastPrice);
    this.tintCard(this.damageCard, this.damageCost, coins >= damagePrice);
    this.showFireRate(coins, fireRateLevel, fireRatePrice);
    this.showWire(coins, wireOwned);
    this.showAutoFire(coins, autoFireOwned);
  }

  private formatDelay(ms: number): string {
    return `${(ms / 1000).toFixed(2)} с`;
  }

  private showFireRate(coins: number, level: number, price: number): void {
    const maxed = level >= Tank.maxFireRateLevel;
    const delay = Tank.fireDelayFor(level);
    const nextDelay = Tank.fireDelayFor(level + 1);
    this.fireRateInfo.setText(
      maxed
        ? `ур. ${level}   ${this.formatDelay(delay)} (макс.)`
        : `ур. ${level}   ${this.formatDelay(delay)} → ${this.formatDelay(nextDelay)}`,
    );
    if (maxed) {
      this.fireRateCost.setText('максимум');
      this.fireRateCard.setFillStyle(0x3d2a12);
      this.fireRateCost.setColor('#f3d56a');
      this.fireRateCard.disableInteractive();
      return;
    }
    this.fireRateCost.setText(`цена  ${price}`);
    if (!this.fireRateCard.input?.enabled) {
      this.fireRateCard.setInteractive({ useHandCursor: true });
    }
    this.tintCard(this.fireRateCard, this.fireRateCost, coins >= price);
  }

  // Проволока покупается один раз. После установки карточка гаснет и больше не ловит клик.
  private showWire(coins: number, owned: boolean): void {
    if (owned) {
      this.wireInfo.setText('стоит перед танком, от верха до низа');
      this.wireCost.setText('установлена');
      this.wireCard.setFillStyle(0x3d2a12);
      this.wireCost.setColor('#f3d56a');
      this.wireCard.disableInteractive();
      return;
    }
    this.wireInfo.setText('не пускает пехоту · 1 урона / 3 с');
    this.wireCost.setText(`цена  ${BarbedWire.shop.cost}`);
    if (!this.wireCard.input?.enabled) {
      this.wireCard.setInteractive({ useHandCursor: true });
    }
    this.tintCard(this.wireCard, this.wireCost, coins >= BarbedWire.shop.cost);
  }

  private showAutoFire(coins: number, owned: boolean): void {
    if (owned) {
      this.autoFireInfo.setText('танк стреляет сам по кулдауну');
      this.autoFireCost.setText('куплено');
      this.autoFireCard.setFillStyle(0x3d2a12);
      this.autoFireCost.setColor('#f3d56a');
      this.autoFireCard.disableInteractive();
      return;
    }
    this.autoFireInfo.setText('не нужно держать ЛКМ');
    this.autoFireCost.setText(`цена  ${Tank.shop.autoFireCost}`);
    if (!this.autoFireCard.input?.enabled) {
      this.autoFireCard.setInteractive({ useHandCursor: true });
    }
    this.tintCard(this.autoFireCard, this.autoFireCost, coins >= Tank.shop.autoFireCost);
  }

  // Если монет не хватает, карточка темнеет и цена становится тусклой. Клик при этом всё равно приходит в сцену.
  private tintCard(
    card: Phaser.GameObjects.Rectangle,
    cost: Phaser.GameObjects.Text,
    canBuy: boolean,
  ): void {
    card.setFillStyle(canBuy ? 0x5a1210 : 0x2a1010);
    cost.setColor(canBuy ? '#f3d56a' : '#8a6a4a');
  }
}
