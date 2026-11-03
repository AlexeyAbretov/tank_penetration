// Покупки между волнами. Окно ShopPanel только рисует кнопки и зовёт методы ниже.
// Уровни живут здесь, пока жива партия. В localStorage их кладёт CombatSave через capture().
// Постоянные прибавки к урону, взрыву и монетам приходят снаружи и за партию не меняются.

import Phaser from 'phaser';
import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { AutoFire } from '../entities/AutoFire';
import { BarbedWire } from '../entities/BarbedWire';
import { FlameTank } from '../entities/FlameTank';
import { Infantry } from '../entities/Infantry';
import { LaserDefense } from '../entities/LaserDefense';
import { MachineGun } from '../entities/MachineGun';
import { Mines } from '../entities/Mines';
import { NuclearStrike } from '../entities/NuclearStrike';
import { RocketSalvo } from '../entities/RocketSalvo';
import { Tank } from '../entities/Tank/Tank';
import { GAME } from '../gameConfig';
import { shopPrice } from '../shopPrice';
import { ShopPanel, type ShopCardView, type ShopTabView, type ShopView } from '../ui/shops/ShopPanel';
import type { GameHud } from '../ui/huds/GameHud';
import type { ShopSave } from '../saves/CombatSave';

type GearId = 'wire' | 'autoFire' | 'machineGun' | 'laser' | 'flame' | 'salvo' | 'artillery' | 'mines' | 'nuclear';

type PermanentBonuses = {
  damage: number;
  blast: number;
  coins: number;
  points: number;
  // Постоянный урон пули из магазина после гибели. К урону партии прибавляется на карточке.
  mg: number;
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
  laserOwned = false;
  laser?: LaserDefense;
  flameOwned = false;
  flame?: FlameTank;
  salvoOwned = false;
  salvo?: RocketSalvo;
  artilleryOwned = false;
  minesOwned = false;
  nuclearOwned = false;
  mgDamageLevel = 0;
  wireDamageLevel = 0;
  flameDamageLevel = 0;
  salvoDamageLevel = 0;
  artilleryDamageLevel = 0;
  minesDamageLevel = 0;
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
    this.panel = new ShopPanel(scene, this, GAME);
  }

  // Снимок покупок для сохранения партии. Монеты и номер волны пишет сцена, не этот метод.
  capture(): ShopSave {
    return {
      blast: this.blastLevel,
      damage: this.damageLevel,
      fireRate: this.fireRateLevel,
      wire: this.wireOwned,
      machineGun: this.machineGunOwned,
      laser: this.laserOwned,
      flame: this.flameOwned,
      salvo: this.salvoOwned,
      artillery: this.artilleryOwned,
      mines: this.minesOwned,
      nuclear: this.nuclearOwned,
      autoFire: this.autoFire.isOwned,
      autoFireOn: this.autoFire.enabled,
      mgDamage: this.mgDamageLevel,
      wireDamage: this.wireDamageLevel,
      flameDamage: this.flameDamageLevel,
      salvoDamage: this.salvoDamageLevel,
      artilleryDamage: this.artilleryDamageLevel,
      minesDamage: this.minesDamageLevel,
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
    this.laserOwned = saved.laser;
    if (saved.laser) {
      this.laser = this.installLaser();
    }
    this.flameOwned = saved.flame;
    if (saved.flame) {
      this.flame = this.installFlame();
    }
    this.salvoOwned = saved.salvo;
    if (saved.salvo) {
      this.salvo = this.installSalvo();
    }
    this.artilleryOwned = saved.artillery;
    this.minesOwned = saved.mines;
    this.nuclearOwned = saved.nuclear;
    this.mgDamageLevel = saved.mgDamage;
    this.wireDamageLevel = saved.wireDamage;
    this.flameDamageLevel = saved.flameDamage;
    this.salvoDamageLevel = saved.salvoDamage;
    this.artilleryDamageLevel = saved.artilleryDamage;
    this.minesDamageLevel = saved.minesDamage;
  }

  // Чистая партия: уровни и постройки обнуляются. Предметы на поле убирает перезапуск сцены.
  reset(): void {
    this.blastLevel = 0;
    this.damageLevel = 0;
    this.fireRateLevel = 0;
    this.wireOwned = false;
    this.machineGunOwned = false;
    this.laserOwned = false;
    this.flameOwned = false;
    this.salvoOwned = false;
    this.artilleryOwned = false;
    this.minesOwned = false;
    this.nuclearOwned = false;
    this.mgDamageLevel = 0;
    this.wireDamageLevel = 0;
    this.flameDamageLevel = 0;
    this.salvoDamageLevel = 0;
    this.artilleryDamageLevel = 0;
    this.minesDamageLevel = 0;
    this.autoFire.clear();
    this.wire = undefined;
    this.machineGun = undefined;
    this.laser = undefined;
    this.flame = undefined;
    this.salvo = undefined;
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
    const cost = shopPrice(BarbedWire.shop.cost);
    if (this.isPaused() || this.wireOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.wireOwned = true;
    this.wire = new BarbedWire(this.scene);
    this.refresh();
  }

  // Танк стреляет сам, пока курсор на поле. Покупка одна на партию.
  buyAutoFire(): void {
    const cost = shopPrice(AutoFire.shop.cost);
    if (this.isPaused() || this.autoFire.isOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
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
    const cost = shopPrice(MachineGun.shop.cost);
    if (this.isPaused() || this.machineGunOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.machineGunOwned = true;
    this.machineGun = this.installMachineGun();
    this.refresh();
  }

  // Установка под днищем танка. Стрельбу по таймеру считает CombatSystem.
  buyLaser(): void {
    const cost = shopPrice(LaserDefense.shop.cost);
    if (this.isPaused() || this.laserOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.laserOwned = true;
    this.laser = this.installLaser();
    this.refresh();
  }

  // Машина между крышей танка и РСЗО. Струю по таймеру считает CombatSystem.
  buyFlame(): void {
    const cost = shopPrice(FlameTank.shop.cost);
    if (this.isPaused() || this.flameOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.flameOwned = true;
    this.flame = this.installFlame();
    this.refresh();
  }

  // Ствол садится на башню здесь, при покупке.
  private installMachineGun(): MachineGun {
    const gun = new MachineGun(this.scene);
    this.tank.attachToTurret(gun, MachineGun.aimBox());
    return gun;
  }

  // Установка над крышей танка. Стрельбу по таймеру считает CombatSystem.
  buySalvo(): void {
    const cost = shopPrice(RocketSalvo.shop.cost);
    if (this.isPaused() || this.salvoOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.salvoOwned = true;
    this.salvo = this.installSalvo();
    this.refresh();
  }

  // Корпус ниже днища танка, башня смотрит вправо. Танк рисуется поверх стыка.
  private installLaser(): LaserDefense {
    const hull = Tank.hullBox();
    const laser = new LaserDefense(this.scene);
    laser.setPosition(hull.x + hull.w / 2, hull.y + hull.h + LaserDefense.mount.belowBelly);
    this.tank.add(laser);
    this.tank.sendToBack(laser);
    return laser;
  }

  // Гусеницы выше крыши танка и ниже колёс РСЗО. РСЗО остаётся верхним слоем.
  private installFlame(): FlameTank {
    const hull = Tank.hullBox();
    const flame = new FlameTank(this.scene);
    flame.setPosition(
      hull.x + hull.w / 2,
      hull.y - FlameTank.mount.aboveRoof - FlameTank.layout.trackY,
    );
    this.tank.add(flame);
    if (this.salvo) {
      this.tank.bringToTop(this.salvo);
    }
    return flame;
  }

  // Колёса выше крыши танка. Картинка рисуется поверх башни: машина стоит в воздухе над ней.
  private installSalvo(): RocketSalvo {
    const hull = Tank.hullBox();
    const salvo = new RocketSalvo(this.scene);
    salvo.setPosition(
      hull.x + hull.w / 2,
      hull.y - RocketSalvo.mount.aboveRoof - RocketSalvo.layout.wheelY,
    );
    this.tank.add(salvo);
    return salvo;
  }

  // Открывает клавишу 1. Залп и перезарядку считает CombatSystem.
  buyArtillery(): void {
    const cost = shopPrice(ArtilleryStrike.shop.cost);
    if (this.isPaused() || this.artilleryOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.artilleryOwned = true;
    this.refresh();
  }

  // Открывает клавишу 3. Падение и взрыв считает CombatSystem.
  buyNuclear(): void {
    const cost = shopPrice(NuclearStrike.shop.cost);
    if (this.isPaused() || this.nuclearOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.nuclearOwned = true;
    this.refresh();
  }

  // Открывает клавишу 2. Постановку и подрыв считает CombatSystem.
  buyMines(): void {
    const cost = shopPrice(Mines.shop.cost);
    if (this.isPaused() || this.minesOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.minesOwned = true;
    this.refresh();
  }

  // +1 к пуле. Пока ствола нет, уровень не растёт: прибавка не к чему.
  buyMgDamage(): void {
    this.buyDamageLevel(this.machineGunOwned, this.mgDamageLevel, (level) => {
      this.mgDamageLevel = level;
    });
  }

  buyWireDamage(): void {
    this.buyDamageLevel(this.wireOwned, this.wireDamageLevel, (level) => {
      this.wireDamageLevel = level;
    });
  }

  // Струя и пятно на земле получают одну и ту же прибавку.
  buyFlameDamage(): void {
    this.buyDamageLevel(this.flameOwned, this.flameDamageLevel, (level) => {
      this.flameDamageLevel = level;
    });
  }

  buySalvoDamage(): void {
    this.buyDamageLevel(this.salvoOwned, this.salvoDamageLevel, (level) => {
      this.salvoDamageLevel = level;
    });
  }

  buyArtilleryDamage(): void {
    this.buyDamageLevel(this.artilleryOwned, this.artilleryDamageLevel, (level) => {
      this.artilleryDamageLevel = level;
    });
  }

  buyMinesDamage(): void {
    this.buyDamageLevel(this.minesOwned, this.minesDamageLevel, (level) => {
      this.minesDamageLevel = level;
    });
  }

  // Строка характеристик над полем: урон и взрыв партии плюс постоянные уровни.
  syncTankStats(): void {
    this.hud.setTankStats(
      Infantry.shellDamage + this.damageLevel + this.bonuses.damage,
      (this.blastLevel + this.bonuses.blast) * Tank.blastRadiusPerLevel,
      Tank.fireDelayFor(this.fireRateLevel),
      this.autoFire.enabled,
      this.bonuses.coins,
      this.bonuses.points,
    );
    this.hud.setAutoFireToggle(this.autoFire.isOwned, this.autoFire.enabled);
  }

  private isPaused(): boolean {
    return this.paused;
  }

  // Окно уже открыто: подпись и серые кнопки читают новое число монет.
  refreshCoins(): void {
    if (!this.shopOpen) {
      return;
    }
    this.panel.refresh(this.view());
  }

  private refresh(): void {
    this.hud.setCoins(this.economy.getCoins());
    this.syncTankStats();
    this.panel.refresh(this.view());
    this.onChanged();
  }

  // Первая покупка уровня стоит 3. Каждая следующая — на 2 дороже.
  private static upgradeCost(level: number): number {
    return shopPrice(3 + level * 2);
  }

  private view(): ShopView {
    const coins = this.economy.getCoins();
    return {
      coins,
      tabs: [
        this.tab('tank', 'Танк', [
          this.damageCard(coins),
          this.blastCard(coins),
          this.fireRateCard(coins),
          this.gearCard('autoFire', coins),
        ]),
        this.tab('gun', 'Пулемёт', [
          this.gearCard('machineGun', coins),
          this.weaponDamageCard(
            this.mgDamageLevel,
            this.mgDamageNow(),
            () => this.buyMgDamage(),
            coins,
            this.machineGunOwned,
            'после установки',
          ),
        ]),
        this.tab('wire', 'Колючая проволока', [
          this.gearCard('wire', coins),
          this.weaponDamageCard(
            this.wireDamageLevel,
            BarbedWire.shop.damage + this.wireDamageLevel,
            () => this.buyWireDamage(),
            coins,
            this.wireOwned,
            'после установки',
          ),
        ]),
        this.tab('flame', 'Огнемёт', [this.gearCard('flame', coins), this.flameDamageCard(coins)]),
        // У лазера нет числа урона: он снимает ракету. Карточка одна — покупка.
        this.tab('laser', 'Лазерная установка', [this.gearCard('laser', coins)]),
        this.tab('salvo', 'РСЗО', [
          this.gearCard('salvo', coins),
          this.weaponDamageCard(
            this.salvoDamageLevel,
            RocketSalvo.shop.damage + this.salvoDamageLevel,
            () => this.buySalvoDamage(),
            coins,
            this.salvoOwned,
            'после покупки',
          ),
        ]),
        this.tab('artillery', 'Артиллерия', [
          this.gearCard('artillery', coins),
          this.weaponDamageCard(
            this.artilleryDamageLevel,
            ArtilleryStrike.shop.damage + this.artilleryDamageLevel,
            () => this.buyArtilleryDamage(),
            coins,
            this.artilleryOwned,
            'после покупки',
          ),
        ]),
        this.tab('mines', 'Мина', [
          this.gearCard('mines', coins),
          this.weaponDamageCard(
            this.minesDamageLevel,
            Mines.shop.damage + this.minesDamageLevel,
            () => this.buyMinesDamage(),
            coins,
            this.minesOwned,
            'после покупки',
          ),
        ]),
        this.tab('nuclear', 'Атомный взрыв', [this.gearCard('nuclear', coins)]),
      ],
    };
  }

  private tab(id: string, label: string, cards: ShopCardView[]): ShopTabView {
    return { id, label, cards };
  }

  private mgDamageNow(): number {
    return MachineGun.shop.damage + this.mgDamageLevel + this.bonuses.mg;
  }

  // Струя и пятно на земле стартуют с одного числа и растут вместе.
  private flameDamageCard(coins: number): ShopCardView {
    const now = FlameTank.shop.streamDamage + this.flameDamageLevel;
    const card = this.weaponDamageCard(
      this.flameDamageLevel,
      now,
      () => this.buyFlameDamage(),
      coins,
      this.flameOwned,
      'после покупки',
    );
    if (this.flameOwned) {
      card.info = `ур. ${this.flameDamageLevel} · струя и пятно ${now}→${now + 1}`;
    }
    return card;
  }

  // Первая покупка закрыта, пока вещи нет на поле. Цена та же, что у урона танка.
  private weaponDamageCard(
    level: number,
    now: number,
    buy: () => void,
    coins: number,
    unlocked: boolean,
    locked: string,
  ): ShopCardView {
    const price = ShopController.upgradeCost(level);
    if (!unlocked) {
      return {
        title: '+1 урон',
        buy,
        info: locked,
        cost: this.coin(price),
        open: false,
        canBuy: false,
        owned: false,
      };
    }
    return {
      title: '+1 урон',
      buy,
      info: `ур. ${level} · ${now}→${now + 1}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private buyDamageLevel(unlocked: boolean, level: number, put: (level: number) => void): void {
    if (this.isPaused() || !unlocked) {
      return;
    }
    const cost = ShopController.upgradeCost(level);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    put(level + 1);
    this.refresh();
  }

  private gearCard(id: GearId, coins: number): ShopCardView {
    switch (id) {
      case 'wire':
        return this.onceCard(
          'Установка',
          () => this.buyWire(),
          coins,
          this.wireOwned,
          shopPrice(BarbedWire.shop.cost),
          'перед танком',
          'держит пехоту',
        );
      case 'autoFire':
        return this.onceCard(
          'Автострельба',
          () => this.buyAutoFire(),
          coins,
          this.autoFire.isOwned,
          shopPrice(AutoFire.shop.cost),
          'стреляет сам',
          'стреляет сам',
        );
      case 'machineGun':
        return this.onceCard(
          'Установка',
          () => this.buyMachineGun(),
          coins,
          this.machineGunOwned,
          shopPrice(MachineGun.shop.cost),
          'очередь / 3 с',
          'вдоль прицела',
        );
      case 'laser':
        return this.onceCard(
          'Покупка',
          () => this.buyLaser(),
          coins,
          this.laserOwned,
          shopPrice(LaserDefense.shop.cost),
          'ракета / 3 с',
          'сбивает РПГ',
        );
      case 'flame':
        return this.onceCard(
          'Покупка',
          () => this.buyFlame(),
          coins,
          this.flameOwned,
          shopPrice(FlameTank.shop.cost),
          'струя / 10 с',
          'четверть поля',
        );
      case 'salvo':
        return this.onceCard(
          'Покупка',
          () => this.buySalvo(),
          coins,
          this.salvoOwned,
          shopPrice(RocketSalvo.shop.cost),
          '3 ракеты / 3 с',
          'залп по полю',
        );
      case 'artillery':
        return this.artilleryCard(coins);
      case 'mines':
        return this.minesCard(coins);
      case 'nuclear':
        return this.nuclearCard(coins);
    }
  }

  private blastCard(coins: number): ShopCardView {
    const price = ShopController.upgradeCost(this.blastLevel);
    const radius = (this.blastLevel + this.bonuses.blast) * Tank.blastRadiusPerLevel;
    const nextRadius = (this.blastLevel + 1 + this.bonuses.blast) * Tank.blastRadiusPerLevel;
    return {
      title: '+1 область взрыва',
      buy: () => this.buyBlast(),
      info: `ур. ${this.blastLevel} · ${radius}→${nextRadius}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private damageCard(coins: number): ShopCardView {
    const price = ShopController.upgradeCost(this.damageLevel);
    const now = Infantry.shellDamage + this.damageLevel + this.bonuses.damage;
    return {
      title: '+1 урон',
      buy: () => this.buyDamage(),
      info: `ур. ${this.damageLevel} · ${now}→${now + 1}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private fireRateCard(coins: number): ShopCardView {
    const level = this.fireRateLevel;
    const price = ShopController.upgradeCost(level);
    const delay = this.formatSeconds(Tank.fireDelayFor(level));
    const next = this.formatSeconds(Tank.fireDelayFor(level + 1));
    const maxed = level >= Tank.maxFireRateLevel;
    return {
      title: '−0.02 с перезарядки',
      buy: () => this.buyFireRate(),
      info: maxed ? `ур. ${level} · ${delay}` : `ур. ${level} · ${delay}→${next}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private artilleryCard(coins: number): ShopCardView {
    const offer = ArtilleryStrike.shop;
    const price = shopPrice(offer.cost);
    const reload = offer.cooldownMs / 1000;
    if (this.artilleryOwned) {
      return {
        title: 'Покупка',
        buy: () => this.buyArtillery(),
        info: `откат ${reload} с`,
        cost: '',
        open: false,
        canBuy: false,
        owned: true,
      };
    }
    return {
      title: 'Покупка',
      buy: () => this.buyArtillery(),
      info: `${offer.shells}×${offer.damage} · откат ${reload} с`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private minesCard(coins: number): ShopCardView {
    const offer = Mines.shop;
    const price = shopPrice(offer.cost);
    const reload = offer.cooldownMs / 1000;
    if (this.minesOwned) {
      return {
        title: 'Покупка',
        buy: () => this.buyMines(),
        info: `откат ${reload} с`,
        cost: '',
        open: false,
        canBuy: false,
        owned: true,
      };
    }
    return {
      title: 'Покупка',
      buy: () => this.buyMines(),
      info: `${offer.count}×${offer.damage} · откат ${reload} с`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private nuclearCard(coins: number): ShopCardView {
    const offer = NuclearStrike.shop;
    const price = shopPrice(offer.cost);
    const reload = offer.cooldownMs / 60_000;
    if (this.nuclearOwned) {
      return {
        title: 'Покупка',
        buy: () => this.buyNuclear(),
        info: `откат ${reload} мин`,
        cost: '',
        open: false,
        canBuy: false,
        owned: true,
      };
    }
    return {
      title: 'Покупка',
      buy: () => this.buyNuclear(),
      info: `весь экран · ${reload} мин`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private onceCard(
    title: string,
    buy: () => void,
    coins: number,
    owned: boolean,
    price: number,
    ownedInfo: string,
    offerInfo: string,
  ): ShopCardView {
    if (owned) {
      return { title, buy, info: ownedInfo, cost: '', open: false, canBuy: false, owned: true };
    }
    return {
      title,
      buy,
      info: offerInfo,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  // Знак валюты вместо слова «цена».
  private coin(price: number): string {
    return `¤ ${price}`;
  }

  private formatSeconds(ms: number): string {
    return (ms / 1000).toFixed(2);
  }
}
