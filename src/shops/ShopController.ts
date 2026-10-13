// Покупки между волнами. Окно ShopPanel только рисует кнопки и зовёт методы ниже.
// Уровни живут здесь, пока жива партия. В localStorage их кладёт CombatSave через capture().
// Постоянные прибавки к урону, взрыву и монетам приходят снаружи и за партию не меняются.

import Phaser from 'phaser';
import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { AutoFire } from '../entities/AutoFire';
import { BarbedWire } from '../entities/BarbedWire';
import { Infantry } from '../entities/Infantry';
import { MachineGun } from '../entities/MachineGun';
import { Mines } from '../entities/Mines';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import { ShopPanel, type ShopCardView, type ShopView } from './ShopPanel';
import type { GameHud } from '../ui/GameHud';
import type { ShopSave } from '../saves/CombatSave';

type PermanentBonuses = {
  damage: number;
  blast: number;
  coins: number;
};

type Economy = {
  getCoins: () => number;
  spendCoins: (amount: number) => boolean;
};

export class ShopController {
  readonly panel: ShopPanel;

  blastLevel = 0;
  damageLevel = 0;
  fireRateLevel = 0;
  wireOwned = false;
  wire?: BarbedWire;
  machineGunOwned = false;
  machineGun?: MachineGun;
  artilleryOwned = false;
  minesOwned = false;
  readonly autoFire = new AutoFire();
  shopOpen = false;
  // Пауза сцены. Покупки и «следующая волна» ждут продолжения.
  private paused = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hud: GameHud,
    private readonly tank: Tank,
    private readonly economy: Economy,
    private readonly bonuses: PermanentBonuses,
    private readonly onContinue: () => void,
    private readonly onChanged: () => void,
  ) {
    this.panel = new ShopPanel(scene, this, { width: GAME.width, height: GAME.height });
  }

  // Снимок покупок для сохранения партии. Монеты и номер волны пишет сцена, не этот метод.
  capture(): ShopSave {
    return {
      blast: this.blastLevel,
      damage: this.damageLevel,
      fireRate: this.fireRateLevel,
      wire: this.wireOwned,
      machineGun: this.machineGunOwned,
      artillery: this.artilleryOwned,
      mines: this.minesOwned,
      autoFire: this.autoFire.isOwned,
      autoFireOn: this.autoFire.enabled,
    };
  }

  // Покупки уже оплачены в прошлой сессии: монеты не списываем, вещи сразу ставим на поле.
  restore(saved: ShopSave): void {
    this.blastLevel = saved.blast;
    this.damageLevel = saved.damage;
    this.fireRateLevel = Math.min(saved.fireRate, Tank.maxFireRateLevel);
    this.tank.setFireRateLevel(this.fireRateLevel);
    this.autoFire.restore(saved.autoFire, saved.autoFireOn);
    this.wireOwned = saved.wire;
    if (saved.wire) {
      this.wire = new BarbedWire(this.scene);
    }
    this.machineGunOwned = saved.machineGun;
    if (saved.machineGun) {
      this.machineGun = this.installMachineGun();
    }
    this.artilleryOwned = saved.artillery;
    this.minesOwned = saved.mines;
  }

  // Чистая партия: уровни и постройки обнуляются. Предметы на поле убирает перезапуск сцены.
  reset(): void {
    this.blastLevel = 0;
    this.damageLevel = 0;
    this.fireRateLevel = 0;
    this.wireOwned = false;
    this.machineGunOwned = false;
    this.artilleryOwned = false;
    this.minesOwned = false;
    this.autoFire.clear();
    this.wire = undefined;
    this.machineGun = undefined;
    this.shopOpen = false;
  }

  open(): void {
    this.shopOpen = true;
    // combat читает стрельба танка: в магазине ствол молчит.
    this.scene.registry.set('combat', false);
    // pause замораживает скорости. Враги остаются на тех же координатах.
    this.scene.physics.world.pause();
    this.panel.show(this.view());
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.panel.setPaused(paused);
  }

  // «Следующая волна». На паузе кнопка молчит: иначе бой стартовал бы под плашкой «ПАУЗА».
  closeAndContinue(): void {
    if (this.isPaused()) {
      return;
    }
    this.panel.hide();
    this.shopOpen = false;
    this.scene.registry.set('combat', true);
    this.scene.physics.world.resume();
    this.onContinue();
  }

  // +1 к радиусу взрыва. Цена растёт от текущего уровня.
  buyBlast(): void {
    if (this.isPaused()) {
      return;
    }
    const cost = ShopController.upgradeCost(this.blastLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.blastLevel += 1;
    this.refresh();
  }

  // +1 к урону снаряда танка. Складывается с постоянной прибавкой, которую передала сцена.
  buyDamage(): void {
    if (this.isPaused()) {
      return;
    }
    const cost = ShopController.upgradeCost(this.damageLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.damageLevel += 1;
    this.refresh();
  }

  // Короче пауза между выстрелами. Выше Tank.maxFireRateLevel уровень не поднимается.
  buyFireRate(): void {
    if (this.isPaused() || this.fireRateLevel >= Tank.maxFireRateLevel) {
      return;
    }
    const cost = ShopController.upgradeCost(this.fireRateLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.fireRateLevel += 1;
    this.tank.setFireRateLevel(this.fireRateLevel);
    this.refresh();
  }

  // Одна полоса проволоки на партию. Повторный вызов ничего не ставит.
  buyWire(): void {
    if (this.isPaused() || this.wireOwned || this.economy.getCoins() < BarbedWire.shop.cost) {
      return;
    }
    if (!this.economy.spendCoins(BarbedWire.shop.cost)) {
      return;
    }
    this.wireOwned = true;
    this.wire = new BarbedWire(this.scene);
    this.refresh();
  }

  // Танк стреляет сам, пока курсор на поле. Покупка одна на партию.
  buyAutoFire(): void {
    if (this.isPaused() || this.autoFire.isOwned || this.economy.getCoins() < AutoFire.shop.cost) {
      return;
    }
    if (!this.economy.spendCoins(AutoFire.shop.cost)) {
      return;
    }
    this.autoFire.grant();
    this.refresh();
  }

  // Кнопка у шестерёнки. Покупку не отменяет: следующий клик снова включает огонь.
  toggleAutoFire(): void {
    if (this.isPaused() || !this.autoFire.isOwned) {
      return;
    }
    this.autoFire.toggle();
    this.refresh();
  }

  // Ствол на башне. Стрельбу по таймеру считает CombatSystem, здесь только факт покупки.
  buyMachineGun(): void {
    if (this.isPaused() || this.machineGunOwned || this.economy.getCoins() < MachineGun.shop.cost) {
      return;
    }
    if (!this.economy.spendCoins(MachineGun.shop.cost)) {
      return;
    }
    this.machineGunOwned = true;
    this.machineGun = this.installMachineGun();
    this.refresh();
  }

  // Ствол садится на башню здесь, при покупке.
  private installMachineGun(): MachineGun {
    const gun = new MachineGun(this.scene);
    this.tank.attachToTurret(gun, MachineGun.aimBox());
    return gun;
  }

  // Открывает клавишу 1. Залп и перезарядку считает CombatSystem.
  buyArtillery(): void {
    if (this.isPaused() || this.artilleryOwned || this.economy.getCoins() < ArtilleryStrike.shop.cost) {
      return;
    }
    if (!this.economy.spendCoins(ArtilleryStrike.shop.cost)) {
      return;
    }
    this.artilleryOwned = true;
    this.refresh();
  }

  // Открывает клавишу 2. Постановку и подрыв считает CombatSystem.
  buyMines(): void {
    if (this.isPaused() || this.minesOwned || this.economy.getCoins() < Mines.shop.cost) {
      return;
    }
    if (!this.economy.spendCoins(Mines.shop.cost)) {
      return;
    }
    this.minesOwned = true;
    this.refresh();
  }

  // Строка характеристик над полем: урон и взрыв партии плюс постоянные уровни.
  syncTankStats(): void {
    this.hud.setTankStats(
      Infantry.shellDamage + this.damageLevel + this.bonuses.damage,
      (this.blastLevel + this.bonuses.blast) * Tank.blastRadiusPerLevel,
      Tank.fireDelayFor(this.fireRateLevel),
      this.autoFire.enabled,
      this.bonuses.coins,
    );
    this.hud.setAutoFireToggle(this.autoFire.isOwned, this.autoFire.enabled);
  }

  private isPaused(): boolean {
    return this.paused;
  }

  private refresh(): void {
    this.hud.setCoins(this.economy.getCoins());
    this.syncTankStats();
    this.panel.refresh(this.view());
    this.onChanged();
  }

  // Первая покупка уровня стоит 3. Каждая следующая — на 2 дороже.
  private static upgradeCost(level: number): number {
    return 3 + level * 2;
  }

  private view(): ShopView {
    const coins = this.economy.getCoins();
    return {
      coins,
      cards: [
        this.blastCard(coins),
        this.damageCard(coins),
        this.fireRateCard(coins),
        this.onceCard(
          'Колючая проволока',
          () => this.buyWire(),
          coins,
          this.wireOwned,
          BarbedWire.shop.cost,
          'стоит перед танком, от верха до низа',
          'установлена',
          'не пускает пехоту · 1 урона / 3 с',
        ),
        this.onceCard(
          'Автострельба',
          () => this.buyAutoFire(),
          coins,
          this.autoFire.isOwned,
          AutoFire.shop.cost,
          'кнопка слева от шестерёнки — вкл и выкл',
          'куплено',
          'не нужно держать ЛКМ',
        ),
        this.onceCard(
          'Пулемёт',
          () => this.buyMachineGun(),
          coins,
          this.machineGunOwned,
          MachineGun.shop.cost,
          'перед люком башни · 1 урона / 3 с',
          'установлен',
          'стреляет вдоль прицела башни',
        ),
        this.artilleryCard(coins),
        this.minesCard(coins),
      ],
    };
  }

  private blastCard(coins: number): ShopCardView {
    const price = ShopController.upgradeCost(this.blastLevel);
    const radius = (this.blastLevel + this.bonuses.blast) * Tank.blastRadiusPerLevel;
    const nextRadius = (this.blastLevel + 1 + this.bonuses.blast) * Tank.blastRadiusPerLevel;
    return {
      title: '+1 область взрыва',
      buy: () => this.buyBlast(),
      info: `ур. ${this.blastLevel}   радиус ${radius} → ${nextRadius}`,
      cost: `цена  ${price}`,
      open: true,
      canBuy: coins >= price,
    };
  }

  private damageCard(coins: number): ShopCardView {
    const price = ShopController.upgradeCost(this.damageLevel);
    const now = Infantry.shellDamage + this.damageLevel + this.bonuses.damage;
    return {
      title: '+1 урон',
      buy: () => this.buyDamage(),
      info: `ур. ${this.damageLevel}   урон ${now} → ${now + 1}`,
      cost: `цена  ${price}`,
      open: true,
      canBuy: coins >= price,
    };
  }

  private fireRateCard(coins: number): ShopCardView {
    const level = this.fireRateLevel;
    const price = ShopController.upgradeCost(level);
    const delay = this.formatDelay(Tank.fireDelayFor(level));
    const next = this.formatDelay(Tank.fireDelayFor(level + 1));
    const maxed = level >= Tank.maxFireRateLevel;
    return {
      title: '−0.02 с перезарядки',
      buy: () => this.buyFireRate(),
      info: maxed ? `ур. ${level}   ${delay} (макс.)` : `ур. ${level}   ${delay} → ${next}`,
      cost: maxed ? 'максимум' : `цена  ${price}`,
      open: !maxed,
      canBuy: !maxed && coins >= price,
    };
  }

  private artilleryCard(coins: number): ShopCardView {
    const offer = ArtilleryStrike.shop;
    const reload = offer.cooldownMs / 1000;
    const crater = offer.craterMs / 1000;
    if (this.artilleryOwned) {
      return {
        title: 'Артиллерийский удар',
        buy: () => this.buyArtillery(),
        info: `клавиша 1 или иконка · перезарядка ${reload} с`,
        cost: 'куплено',
        open: false,
        canBuy: false,
      };
    }
    return {
      title: 'Артиллерийский удар',
      buy: () => this.buyArtillery(),
      info: `${offer.shells} снаряда в случайные точки · ${offer.damage} урона\nвзрыв и воронка ${crater} с · клавиша 1 или иконка · перезарядка ${reload} с`,
      cost: `цена  ${offer.cost}`,
      open: true,
      canBuy: coins >= offer.cost,
    };
  }

  private minesCard(coins: number): ShopCardView {
    const offer = Mines.shop;
    const reload = offer.cooldownMs / 1000;
    const crater = offer.craterMs / 1000;
    if (this.minesOwned) {
      return {
        title: 'Мины',
        buy: () => this.buyMines(),
        info: `клавиша 2 или иконка · перезарядка ${reload} с`,
        cost: 'куплено',
        open: false,
        canBuy: false,
      };
    }
    return {
      title: 'Мины',
      buy: () => this.buyMines(),
      info: `${offer.count} мины в случайные точки · ${offer.damage} урона\nвзрыв и воронка ${crater} с · клавиша 2 или иконка · перезарядка ${reload} с`,
      cost: `цена  ${offer.cost}`,
      open: true,
      canBuy: coins >= offer.cost,
    };
  }

  private onceCard(
    title: string,
    buy: () => void,
    coins: number,
    owned: boolean,
    price: number,
    ownedInfo: string,
    ownedCost: string,
    offerInfo: string,
  ): ShopCardView {
    if (owned) {
      return { title, buy, info: ownedInfo, cost: ownedCost, open: false, canBuy: false };
    }
    return { title, buy, info: offerInfo, cost: `цена  ${price}`, open: true, canBuy: coins >= price };
  }

  private formatDelay(ms: number): string {
    return `${(ms / 1000).toFixed(2)} с`;
  }
}
