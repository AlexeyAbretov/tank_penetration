// Покупки между волнами. Окно ShopPanel только рисует кнопки и зовёт методы ниже.
// Уровни живут здесь, пока жива партия. В localStorage их кладёт CombatSave через capture().
// Постоянные прибавки к урону, взрыву, пробиванию и монетам приходят снаружи и за партию не меняются.

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
  // Постоянное отталкивание снаряда из магазина после гибели. К пикселям партии прибавляется на карточке.
  knockback: number;
  // Постоянный шанс прошивания из магазина после гибели. К процентам партии прибавляется на карточке.
  pierce: number;
  coins: number;
  points: number;
  // Постоянный урон пули из магазина после гибели. К урону партии прибавляется на карточке.
  mg: number;
  // Постоянный урон ракеты, снаряда и мины. К урону партии прибавляется на карточке и в цене.
  salvo: number;
  artillery: number;
  mines: number;
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
  flightLevel = 0;
  knockbackLevel = 0;
  pierceLevel = 0;
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
  artilleryCooldownLevel = 0;
  minesOwned = false;
  minesCooldownLevel = 0;
  nuclearOwned = false;
  nuclearCooldownLevel = 0;
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
    ArtilleryStrike.setShopCooldownLevel(0);
    Mines.setShopCooldownLevel(0);
    NuclearStrike.setShopCooldownLevel(0);
  }

  // Снимок покупок для сохранения партии. Монеты и номер волны пишет сцена, не этот метод.
  capture(): ShopSave {
    return {
      blast: this.blastLevel,
      damage: this.damageLevel,
      fireRate: this.fireRateLevel,
      flight: this.flightLevel,
      knockback: this.knockbackLevel,
      pierce: this.pierceLevel,
      wire: this.wireOwned,
      machineGun: this.machineGunOwned,
      laser: this.laserOwned,
      flame: this.flameOwned,
      salvo: this.salvoOwned,
      artillery: this.artilleryOwned,
      artilleryCooldown: this.artilleryCooldownLevel,
      mines: this.minesOwned,
      minesCooldown: this.minesCooldownLevel,
      nuclear: this.nuclearOwned,
      nuclearCooldown: this.nuclearCooldownLevel,
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
    this.blastLevel = Math.min(saved.blast, Tank.maxShopBlastLevel);
    this.damageLevel = saved.damage;
    this.fireRateLevel = Math.min(saved.fireRate, Tank.maxFireRateLevel);
    this.flightLevel = Math.min(saved.flight, Tank.maxShopFlightLevel);
    this.knockbackLevel = Math.min(saved.knockback, Tank.maxShopKnockbackLevel);
    this.pierceLevel = Math.min(saved.pierce, Tank.maxShopPierceLevel);
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
    this.artilleryCooldownLevel = Math.min(saved.artilleryCooldown, ArtilleryStrike.maxShopCooldownLevel);
    ArtilleryStrike.setShopCooldownLevel(this.artilleryCooldownLevel);
    this.minesOwned = saved.mines;
    this.minesCooldownLevel = Math.min(saved.minesCooldown, Mines.maxShopCooldownLevel);
    Mines.setShopCooldownLevel(this.minesCooldownLevel);
    this.nuclearOwned = saved.nuclear;
    this.nuclearCooldownLevel = Math.min(saved.nuclearCooldown, NuclearStrike.maxShopCooldownLevel);
    NuclearStrike.setShopCooldownLevel(this.nuclearCooldownLevel);
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
    this.flightLevel = 0;
    this.knockbackLevel = 0;
    this.pierceLevel = 0;
    this.wireOwned = false;
    this.machineGunOwned = false;
    this.laserOwned = false;
    this.flameOwned = false;
    this.salvoOwned = false;
    this.artilleryOwned = false;
    this.artilleryCooldownLevel = 0;
    ArtilleryStrike.setShopCooldownLevel(0);
    this.minesOwned = false;
    this.minesCooldownLevel = 0;
    Mines.setShopCooldownLevel(0);
    this.nuclearOwned = false;
    this.nuclearCooldownLevel = 0;
    NuclearStrike.setShopCooldownLevel(0);
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

  // +1 к радиусу взрыва. Вместе с прогрессом не выше Tank.maxBlastLevel.
  // Цена считается от уже купленного уровня, включая прогресс.
  buyBlast(): void {
    if (this.isPaused() || this.blastOfferLevel() >= Tank.maxBlastLevel) {
      return;
    }
    const cost = ShopController.upgradeCost(this.blastOfferLevel());
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.blastLevel += 1;
    this.refresh();
  }

  // +1 к урону снаряда танка. Цена считается от уже купленного уровня, включая прогресс.
  buyDamage(): void {
    if (this.isPaused()) {
      return;
    }
    const cost = ShopController.upgradeCost(this.damageOfferLevel());
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.damageLevel += 1;
    this.refresh();
  }

  // Короче пауза между выстрелами. Выше Tank.maxFireRateLevel уровень не поднимается.
  // Цена от уровня этой кнопки. Прогресс секунды снимает, но лестницу цены не двигает:
  // его шаг 0,01 с, а у партии 0,02 с.
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

  // Короче полёт снаряда через поле. Выше Tank.maxShopFlightLevel уровень не поднимается.
  // Цена от уже купленного уровня этой кнопки: 300 × 1,15.
  buyFlight(): void {
    if (this.isPaused() || this.flightLevel >= Tank.maxShopFlightLevel) {
      return;
    }
    const cost = ShopController.flightCost(this.flightLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.flightLevel += 1;
    this.refresh();
  }

  // +3 px отталкивания снарядом. Вместе с прогрессом не выше Tank.maxKnockbackPx.
  // Цена от уже купленного уровня этой кнопки: 100 × 1,15.
  buyKnockback(): void {
    if (this.isPaused() || this.knockbackLevel >= Tank.maxShopKnockbackLevel) {
      return;
    }
    const cost = ShopController.knockbackCost(this.knockbackLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.knockbackLevel += 1;
    this.refresh();
  }

  // +1% шанса прошивания. Вместе с прогрессом не выше Tank.maxPierceChance.
  // Цена от уже купленного уровня этой кнопки: 100 × 1,15.
  buyPierce(): void {
    if (this.isPaused() || this.pierceLevel >= Tank.maxShopPierceLevel) {
      return;
    }
    const cost = ShopController.pierceCost(this.pierceLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.pierceLevel += 1;
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

  // −1 с к откату артиллерии. Партия снимает свои 20 с и останавливается на 40 с без очков.
  buyArtilleryCooldown(): void {
    if (this.isPaused() || !this.artilleryOwned) {
      return;
    }
    if (this.artilleryCooldownLevel >= ArtilleryStrike.maxShopCooldownLevel) {
      return;
    }
    const now = ArtilleryStrike.cooldownFor(this.artilleryCooldownLevel);
    if (ArtilleryStrike.cooldownFor(this.artilleryCooldownLevel + 1) >= now) {
      return;
    }
    const cost = ShopController.artilleryCooldownCost(this.artilleryCooldownLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.artilleryCooldownLevel += 1;
    ArtilleryStrike.setShopCooldownLevel(this.artilleryCooldownLevel);
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

  // −1 с к откату атомного взрыва. Партия добивает остаток до 2 минут.
  buyNuclearCooldown(): void {
    if (this.isPaused() || !this.nuclearOwned) {
      return;
    }
    if (this.nuclearCooldownLevel >= NuclearStrike.maxShopCooldownLevel) {
      return;
    }
    const now = NuclearStrike.cooldownFor(this.nuclearCooldownLevel);
    if (NuclearStrike.cooldownFor(this.nuclearCooldownLevel + 1) >= now) {
      return;
    }
    const cost = ShopController.nuclearCooldownCost(this.nuclearCooldownLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.nuclearCooldownLevel += 1;
    NuclearStrike.setShopCooldownLevel(this.nuclearCooldownLevel);
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

  // −1 с к откату мин. Партия снимает свои 20 с и останавливается на 40 с без очков.
  buyMinesCooldown(): void {
    if (this.isPaused() || !this.minesOwned) {
      return;
    }
    if (this.minesCooldownLevel >= Mines.maxShopCooldownLevel) {
      return;
    }
    const now = Mines.cooldownFor(this.minesCooldownLevel);
    if (Mines.cooldownFor(this.minesCooldownLevel + 1) >= now) {
      return;
    }
    const cost = ShopController.minesCooldownCost(this.minesCooldownLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.minesCooldownLevel += 1;
    Mines.setShopCooldownLevel(this.minesCooldownLevel);
    this.refresh();
  }

  // +1 к пуле. Пока ствола нет, уровень не растёт: прибавка не к чему.
  // Цена — от суммы с прогрессом, в сохранение пишется только покупка партии.
  buyMgDamage(): void {
    this.buyDamageLevel(this.machineGunOwned, this.mgDamageLevel, (level) => {
      this.mgDamageLevel = level;
    }, this.mgDamageOfferLevel());
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

  // Цена — от суммы с прогрессом, в сохранение пишется только покупка партии.
  buySalvoDamage(): void {
    this.buyDamageLevel(this.salvoOwned, this.salvoDamageLevel, (level) => {
      this.salvoDamageLevel = level;
    }, this.salvoDamageOfferLevel());
  }

  buyArtilleryDamage(): void {
    this.buyDamageLevel(this.artilleryOwned, this.artilleryDamageLevel, (level) => {
      this.artilleryDamageLevel = level;
    }, this.artilleryDamageOfferLevel());
  }

  buyMinesDamage(): void {
    this.buyDamageLevel(this.minesOwned, this.minesDamageLevel, (level) => {
      this.minesDamageLevel = level;
    }, this.minesDamageOfferLevel());
  }

  // Строка характеристик над полем: урон и взрыв партии плюс постоянные уровни.
  syncTankStats(): void {
    this.hud.setTankStats(
      Infantry.shellDamage + this.damageLevel + this.bonuses.damage,
      Tank.blastRadiusFor(this.blastLevel + this.bonuses.blast),
      Tank.pierceChanceFor(this.pierceLevel, this.bonuses.pierce),
      Tank.fireDelayFor(this.fireRateLevel),
      Tank.flightMsFor(this.flightLevel),
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

  // Первая покупка уровня стоит 3. Каждая следующая — на 15% дороже:
  // 3, 3, 4, 5, 5, 6, … К 20-му уровню около 50, к 30-му около 200.
  private static upgradeCost(level: number): number {
    return shopPrice(Math.round(3 * 1.15 ** Math.max(0, level)));
  }

  // Первая покупка отталкивания стоит 100. Дальше та же ступень 15%:
  // 100, 115, 132, 152, …
  private static knockbackCost(level: number): number {
    return shopPrice(Math.round(100 * 1.15 ** Math.max(0, level)));
  }

  // Первая покупка пробивания стоит 100. Дальше та же ступень 15%:
  // 100, 115, 132, 152, …
  private static pierceCost(level: number): number {
    return shopPrice(Math.round(100 * 1.15 ** Math.max(0, level)));
  }

  // Первая покупка полёта стоит 300. Дальше та же ступень 15%:
  // 300, 345, 397, 456, …
  private static flightCost(level: number): number {
    return shopPrice(Math.round(300 * 1.15 ** Math.max(0, level)));
  }

  // Первая секунда отката артиллерии стоит 1000. Дальше та же ступень 15%:
  // 1000, 1150, 1323, 1521, …
  private static artilleryCooldownCost(level: number): number {
    return shopPrice(Math.round(1000 * 1.15 ** Math.max(0, level)));
  }

  // Первая секунда отката мин стоит 1000. Дальше та же ступень 15%:
  // 1000, 1150, 1323, 1521, …
  private static minesCooldownCost(level: number): number {
    return shopPrice(Math.round(1000 * 1.15 ** Math.max(0, level)));
  }

  // Первая секунда отката атомного взрыва стоит 1000. Дальше та же ступень 15%:
  // 1000, 1150, 1323, 1521, …
  private static nuclearCooldownCost(level: number): number {
    return shopPrice(Math.round(1000 * 1.15 ** Math.max(0, level)));
  }

  // На карточке уровень партии и прогресса — одно число. От него же цена.
  private blastOfferLevel(): number {
    return this.blastLevel + this.bonuses.blast;
  }

  private damageOfferLevel(): number {
    return this.damageLevel + this.bonuses.damage;
  }

  private mgDamageOfferLevel(): number {
    return this.mgDamageLevel + this.bonuses.mg;
  }

  private salvoDamageOfferLevel(): number {
    return this.salvoDamageLevel + this.bonuses.salvo;
  }

  private artilleryDamageOfferLevel(): number {
    return this.artilleryDamageLevel + this.bonuses.artillery;
  }

  private minesDamageOfferLevel(): number {
    return this.minesDamageLevel + this.bonuses.mines;
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
          this.flightCard(coins),
          this.knockbackCard(coins),
          this.pierceCard(coins),
          this.gearCard('autoFire', coins),
        ]),
        this.tab('gun', 'Пулемёт', [
          this.gearCard('machineGun', coins),
          this.weaponDamageCard(
            this.mgDamageOfferLevel(),
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
            this.salvoDamageOfferLevel(),
            RocketSalvo.shop.damage + this.salvoDamageOfferLevel(),
            () => this.buySalvoDamage(),
            coins,
            this.salvoOwned,
            'после покупки',
          ),
        ]),
        this.tab('artillery', 'Артиллерия', [
          this.gearCard('artillery', coins),
          this.weaponDamageCard(
            this.artilleryDamageOfferLevel(),
            ArtilleryStrike.shop.damage + this.artilleryDamageOfferLevel(),
            () => this.buyArtilleryDamage(),
            coins,
            this.artilleryOwned,
            'после покупки',
          ),
          this.artilleryCooldownCard(coins),
        ]),
        this.tab('mines', 'Мина', [
          this.gearCard('mines', coins),
          this.weaponDamageCard(
            this.minesDamageOfferLevel(),
            Mines.shop.damage + this.minesDamageOfferLevel(),
            () => this.buyMinesDamage(),
            coins,
            this.minesOwned,
            'после покупки',
          ),
          this.minesCooldownCard(coins),
        ]),
        this.tab('nuclear', 'Атомный взрыв', [
          this.gearCard('nuclear', coins),
          this.nuclearCooldownCard(coins),
        ]),
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

  private buyDamageLevel(
    unlocked: boolean,
    level: number,
    put: (level: number) => void,
    priceLevel = level,
  ): void {
    if (this.isPaused() || !unlocked) {
      return;
    }
    const cost = ShopController.upgradeCost(priceLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    put(level + 1);
    this.refresh();
  }

  // 3 и 4 — «ракеты», с пяти — «ракет».
  private rocketLabel(count: number): string {
    const word = count % 10 >= 2 && count % 10 <= 4 ? 'ракеты' : 'ракет';
    return `${count} ${word}`;
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
          `${this.rocketLabel(RocketSalvo.rocketCount())} / ${RocketSalvo.shop.fireIntervalMs / 1000} с`,
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
    const level = this.blastOfferLevel();
    const price = ShopController.upgradeCost(level);
    const radius = Tank.blastRadiusFor(level);
    const nextRadius = Tank.blastRadiusFor(level + 1);
    const maxed = level >= Tank.maxBlastLevel;
    return {
      title: '+1 область взрыва',
      buy: () => this.buyBlast(),
      info: maxed ? `ур. ${level} · ${radius}` : `ур. ${level} · ${radius}→${nextRadius}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private damageCard(coins: number): ShopCardView {
    const level = this.damageOfferLevel();
    const price = ShopController.upgradeCost(level);
    const now = Infantry.shellDamage + level;
    return {
      title: '+1 урон',
      buy: () => this.buyDamage(),
      info: `ур. ${level} · ${now}→${now + 1}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private fireRateCard(coins: number): ShopCardView {
    const level = this.fireRateLevel;
    const price = ShopController.upgradeCost(level);
    const delay = this.formatSeconds(Tank.fireDelayFor(this.fireRateLevel));
    const next = this.formatSeconds(Tank.fireDelayFor(this.fireRateLevel + 1));
    const maxed = this.fireRateLevel >= Tank.maxFireRateLevel;
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

  private flightCard(coins: number): ShopCardView {
    const level = this.flightLevel;
    const price = ShopController.flightCost(level);
    const now = this.formatSeconds(Tank.flightMsFor(level));
    const next = this.formatSeconds(Tank.flightMsFor(level + 1));
    const maxed = level >= Tank.maxShopFlightLevel;
    return {
      title: '−0.10 с полёта',
      buy: () => this.buyFlight(),
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private knockbackCard(coins: number): ShopCardView {
    const level = this.knockbackLevel;
    const price = ShopController.knockbackCost(level);
    const now = Tank.knockbackPxFor(level, this.bonuses.knockback);
    const next = Tank.knockbackPxFor(level + 1, this.bonuses.knockback);
    const maxed = level >= Tank.maxShopKnockbackLevel;
    return {
      title: '+3 отталкивание',
      buy: () => this.buyKnockback(),
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private pierceCard(coins: number): ShopCardView {
    const level = this.pierceLevel;
    const price = ShopController.pierceCost(level);
    const now = Tank.pierceChanceFor(level, this.bonuses.pierce);
    const next = Tank.pierceChanceFor(level + 1, this.bonuses.pierce);
    const maxed = level >= Tank.maxShopPierceLevel;
    return {
      title: '+1% пробивание',
      buy: () => this.buyPierce(),
      info: maxed ? `ур. ${level} · ${now}%` : `ур. ${level} · ${now}%→${next}%`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private artilleryCard(coins: number): ShopCardView {
    const offer = ArtilleryStrike.shop;
    const price = shopPrice(offer.cost);
    const reload = ArtilleryStrike.cooldownLabel(ArtilleryStrike.cooldownFor(this.artilleryCooldownLevel));
    if (this.artilleryOwned) {
      return {
        title: 'Покупка',
        buy: () => this.buyArtillery(),
        info: `откат ${reload}`,
        cost: '',
        open: false,
        canBuy: false,
        owned: true,
      };
    }
    return {
      title: 'Покупка',
      buy: () => this.buyArtillery(),
      info: `${ArtilleryStrike.shellCount()}×${offer.damage + this.bonuses.artillery} · откат ${reload}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private artilleryCooldownCard(coins: number): ShopCardView {
    const buy = () => this.buyArtilleryCooldown();
    const level = this.artilleryCooldownLevel;
    const price = ShopController.artilleryCooldownCost(level);
    if (!this.artilleryOwned) {
      return {
        title: '−1 с перезарядки',
        buy,
        info: 'после покупки',
        cost: this.coin(price),
        open: false,
        canBuy: false,
        owned: false,
      };
    }
    const now = ArtilleryStrike.cooldownFor(level);
    const next = ArtilleryStrike.cooldownFor(level + 1);
    const maxed = level >= ArtilleryStrike.maxShopCooldownLevel || next >= now;
    return {
      title: '−1 с перезарядки',
      buy,
      info: maxed
        ? `ур. ${level} · ${ArtilleryStrike.cooldownLabel(now)}`
        : `ур. ${level} · ${ArtilleryStrike.cooldownLabel(now)}→${ArtilleryStrike.cooldownLabel(next)}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private minesCard(coins: number): ShopCardView {
    const offer = Mines.shop;
    const price = shopPrice(offer.cost);
    const reload = Mines.cooldownLabel(Mines.cooldownFor(this.minesCooldownLevel));
    if (this.minesOwned) {
      return {
        title: 'Покупка',
        buy: () => this.buyMines(),
        info: `откат ${reload}`,
        cost: '',
        open: false,
        canBuy: false,
        owned: true,
      };
    }
    return {
      title: 'Покупка',
      buy: () => this.buyMines(),
      info: `${Mines.mineCount()}×${offer.damage + this.bonuses.mines} · откат ${reload}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private minesCooldownCard(coins: number): ShopCardView {
    const buy = () => this.buyMinesCooldown();
    const level = this.minesCooldownLevel;
    const price = ShopController.minesCooldownCost(level);
    if (!this.minesOwned) {
      return {
        title: '−1 с перезарядки',
        buy,
        info: 'после покупки',
        cost: this.coin(price),
        open: false,
        canBuy: false,
        owned: false,
      };
    }
    const now = Mines.cooldownFor(level);
    const next = Mines.cooldownFor(level + 1);
    const maxed = level >= Mines.maxShopCooldownLevel || next >= now;
    return {
      title: '−1 с перезарядки',
      buy,
      info: maxed
        ? `ур. ${level} · ${Mines.cooldownLabel(now)}`
        : `ур. ${level} · ${Mines.cooldownLabel(now)}→${Mines.cooldownLabel(next)}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private nuclearCard(coins: number): ShopCardView {
    const offer = NuclearStrike.shop;
    const price = shopPrice(offer.cost);
    const reload = NuclearStrike.cooldownLabel(NuclearStrike.cooldownFor(this.nuclearCooldownLevel));
    if (this.nuclearOwned) {
      return {
        title: 'Покупка',
        buy: () => this.buyNuclear(),
        info: `откат ${reload}`,
        cost: '',
        open: false,
        canBuy: false,
        owned: true,
      };
    }
    return {
      title: 'Покупка',
      buy: () => this.buyNuclear(),
      info: `весь экран · ${reload}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private nuclearCooldownCard(coins: number): ShopCardView {
    const buy = () => this.buyNuclearCooldown();
    const level = this.nuclearCooldownLevel;
    const price = ShopController.nuclearCooldownCost(level);
    if (!this.nuclearOwned) {
      return {
        title: '−1 с перезарядки',
        buy,
        info: 'после покупки',
        cost: this.coin(price),
        open: false,
        canBuy: false,
        owned: false,
      };
    }
    const now = NuclearStrike.cooldownFor(level);
    const next = NuclearStrike.cooldownFor(level + 1);
    const maxed = level >= NuclearStrike.maxShopCooldownLevel || next >= now;
    return {
      title: '−1 с перезарядки',
      buy,
      info: maxed
        ? `ур. ${level} · ${NuclearStrike.cooldownLabel(now)}`
        : `ур. ${level} · ${NuclearStrike.cooldownLabel(now)}→${NuclearStrike.cooldownLabel(next)}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
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
