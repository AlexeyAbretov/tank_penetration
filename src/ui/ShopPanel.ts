// Окно магазина между волнами: улучшения, колючая проволока и кнопка «дальше».
// Панель сама ничего не покупает — она вызывает функции, которые передала сцена.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import { BarbedWire } from '../entities/BarbedWire';
import { Tank } from '../entities/Tank';

// Три действия, которые сцена вешает на кнопки.
type ShopHandlers = {
  onBuyBlast: () => void; // купить радиус взрыва
  onBuyDamage: () => void; // купить урон снаряда
  onBuyWire: () => void; // поставить колючую проволоку перед танком
  onContinue: () => void; // закрыть магазин и начать следующую волну
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
  private readonly wireInfo: Phaser.GameObjects.Text;
  private readonly wireCost: Phaser.GameObjects.Text;
  // Карточки — невидимые для логики прямоугольники, но именно они ловят клик.
  private readonly blastCard: Phaser.GameObjects.Rectangle;
  private readonly damageCard: Phaser.GameObjects.Rectangle;
  private readonly wireCard: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, handlers: ShopHandlers) {
    // Затемнение на весь экран. Координаты детей контейнера считаются от его центра,
    // поэтому (0, 0) здесь — середина экрана, а не левый верхний угол.
    const dim = scene.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.62);
    // Тёмно-красная плашка окна. Последний аргумент 0.96 — почти непрозрачная заливка.
    const panel = scene.add.rectangle(0, 16, 660, 560, 0x3a0c0c, 0.96);
    // Золотая обводка толщиной 4 пикселя.
    panel.setStrokeStyle(4, 0xc9a227);

    const title = scene.add
      .text(0, -228, 'МАГАЗИН', {
        fontFamily: 'Cinzel, Georgia, serif', // если Cinzel не загрузился, берётся Georgia, затем любой serif
        fontSize: '40px',
        color: '#f3d56a',
        stroke: '#4a1208', // тёмная обводка букв, чтобы текст читался на красном
        strokeThickness: 6,
      })
      .setOrigin(0.5); // якорь текста в центре, а не в левом верхнем углу букв

    this.coinsText = scene.add
      .text(0, -182, 'Монеты  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);

    // Две карточки рядом: взрыв слева, урон справа.
    this.blastCard = scene.add.rectangle(-160, -48, 270, 150, 0x5a1210).setStrokeStyle(2, 0xf0d56a);
    this.damageCard = scene.add.rectangle(160, -48, 270, 150, 0x5a1210).setStrokeStyle(2, 0xf0d56a);
    this.wireCard = scene.add.rectangle(0, 108, 580, 118, 0x5a1210).setStrokeStyle(2, 0xf0d56a);
    // setInteractive включает попадание курсором. useHandCursor меняет стрелку на «руку».
    this.blastCard.setInteractive({ useHandCursor: true });
    this.damageCard.setInteractive({ useHandCursor: true });
    this.wireCard.setInteractive({ useHandCursor: true });
    // pointerup — отпускание кнопки мыши над карточкой, чтобы клик не срабатывал при нажатии «проездом».
    this.blastCard.on('pointerup', handlers.onBuyBlast);
    this.damageCard.on('pointerup', handlers.onBuyDamage);
    this.wireCard.on('pointerup', handlers.onBuyWire);

    // Заголовки карточек нарисованы один раз: их текст не меняется.
    const blastTitle = scene.add
      .text(-160, -100, '+1 область взрыва', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    // Уровень и радиус подставляются в refresh, поэтому стартовая строка пустая.
    this.blastInfo = scene.add
      .text(-160, -60, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f0dcc0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.blastCost = scene.add
      .text(-160, -10, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    const damageTitle = scene.add
      .text(160, -100, '+1 урон', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    this.damageInfo = scene.add
      .text(160, -60, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f0dcc0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.damageCost = scene.add
      .text(160, -10, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    const wireTitle = scene.add
      .text(0, 72, 'Колючая проволока', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    this.wireInfo = scene.add
      .text(0, 100, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#f0dcc0',
        align: 'center',
      })
      .setOrigin(0.5);
    this.wireCost = scene.add
      .text(0, 140, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    // Кнопка продолжения под карточками.
    const next = scene.add.rectangle(0, 230, 280, 52, 0x8a1810).setStrokeStyle(2, 0xf0d56a);
    next.setInteractive({ useHandCursor: true });
    next.on('pointerup', handlers.onContinue);
    const nextLabel = scene.add
      .text(0, 230, 'СЛЕДУЮЩАЯ ВОЛНА', {
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
      blastTitle,
      this.blastInfo,
      this.blastCost,
      damageTitle,
      this.damageInfo,
      this.damageCost,
      this.wireCard,
      wireTitle,
      this.wireInfo,
      this.wireCost,
      next,
      nextLabel,
    ]);
    // Выше игрового UI (51–60), ниже плашки поражения (80).
    this.container.setDepth(70).setVisible(false);
  }

  // Показывает магазин и сразу пишет актуальные цены.
  show(coins: number, blastLevel: number, damageLevel: number, wireOwned: boolean): void {
    this.refresh(coins, blastLevel, damageLevel, wireOwned);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  // Перерисовывает цифры. Сцена зовёт это после каждой покупки, не закрывая окно.
  refresh(coins: number, blastLevel: number, damageLevel: number, wireOwned: boolean): void {
    this.coinsText.setText(`Монеты  ${coins}`);

    // Цена зависит от того, сколько раз ЭТО улучшение уже брали. Уровни копируются независимо.
    const blastPrice = ShopPanel.upgradeCost(blastLevel);
    const damagePrice = ShopPanel.upgradeCost(damageLevel);
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
    this.showWire(coins, wireOwned);
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
