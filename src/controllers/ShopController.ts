// Покупки между волнами. Окно ShopPanel только рисует кнопки и зовёт методы ниже.
// Уровни живут здесь, пока жива партия. В localStorage их кладёт CombatSave через capture().
// Постоянные прибавки к урону, взрыву, пробиванию и монетам приходят снаружи и за партию не меняются.

import Phaser from 'phaser';
import { ArtilleryStrikeAbilityConfig, EmpFlashAbilityConfig, cooldownFor, cooldownLabel } from '../abilities';
import { BomberStrike } from '../entities/BomberStrike';
import { EnergyWall } from '../entities/EnergyWall';
import { IonCannon } from '../entities/IonCannon';
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
import {
  coinCostPrefix,
  ShopPanel,
  type ShopCardView,
  type ShopDelegate,
  type ShopTabView,
  type ShopView,
} from '../ui/shops/ShopPanel';
import type { GameHud } from '../ui/huds/GameHud';
import type { ShopSave } from '../saves/CombatSave';

type GearId = 'wire' | 'machineGun' | 'laser' | 'flame' | 'salvo' | 'artillery' | 'ion' | 'mines' | 'nuclear' | 'wall' | 'bomber' | 'emp';

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
  // Постоянный урон проволоки из магазина после гибели. К урону на карточке прибавляется, лестницу цены не двигает.
  wire: number;
  // Постоянный урон огнемёта. К струе и пятну на карточке прибавляется, лестницу цены не двигает.
  flame: number;
  // Постоянный урон ракеты, снаряда и мины. К урону на карточке прибавляется, лестницу цены не двигает.
  salvo: number;
  artillery: number;
  artilleryShells: number;
  artilleryCooldownLevel: number;
  empCooldownLevel: number;
  empStunLevel: number;
  mines: number;
  ion: number;
  // Постоянный урон авиабомбы. К урону на карточке прибавляется, лестницу цены не двигает.
  bomber: number;
};

type Economy = {
  getCoins: () => number;
  spendCoins: (amount: number) => boolean;
  addCoins: (amount: number) => void;
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
  ionOwned = false;
  ionCooldownLevel = 0;
  ionSweepLevel = 0;
  minesOwned = false;
  minesCooldownLevel = 0;
  nuclearOwned = false;
  nuclearCooldownLevel = 0;
  wallOwned = false;
  wallDurationLevel = 0;
  wallCooldownLevel = 0;
  mgDamageLevel = 0;
  mgFireRateLevel = 0;
  mgFlightLevel = 0;
  wireDamageLevel = 0;
  flameDamageLevel = 0;
  salvoDamageLevel = 0;
  artilleryDamageLevel = 0;
  ionDamageLevel = 0;
  minesDamageLevel = 0;
  bomberOwned = false;
  bomberCooldownLevel = 0;
  bomberDamageLevel = 0;
  empOwned = false;
  empCooldownLevel = 0;
  empStunLevel = 0;
  shopOpen = false;
  // Пауза сцены. Покупки и «следующая волна» ждут продолжения.
  private paused = false;
  // Пачка автопокупки. Пока true, каждая ступень не пишет партию и не перерисовывает окно.
  private batch = false;

  constructor(
    protected readonly scene: Phaser.Scene,
    private readonly hud: GameHud,
    private readonly tank: Tank,
    protected readonly economy: Economy,
    private readonly bonuses: PermanentBonuses,
    private readonly onContinue: () => void,
    private readonly onChanged: () => void,
    // Витрина. Дебаг передаёт наследника с кнопкой «+». Обычная партия — само окно.
    Panel: new (
      scene: Phaser.Scene,
      shop: ShopDelegate,
      screen: { width: number; height: number },
    ) => ShopPanel = ShopPanel,
  ) {
    this.panel = new Panel(scene, this, GAME);
    IonCannon.setShopCooldownLevel(0);
    IonCannon.setShopSweepLevel(0);
    Mines.setShopCooldownLevel(0);
    NuclearStrike.setShopCooldownLevel(0);
    EnergyWall.setShopDurationLevel(0);
    EnergyWall.setShopCooldownLevel(0);
    BomberStrike.setShopCooldownLevel(0);
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
      ion: this.ionOwned,
      ionCooldown: this.ionCooldownLevel,
      ionSweep: this.ionSweepLevel,
      mines: this.minesOwned,
      minesCooldown: this.minesCooldownLevel,
      nuclear: this.nuclearOwned,
      nuclearCooldown: this.nuclearCooldownLevel,
      wall: this.wallOwned,
      wallDuration: this.wallDurationLevel,
      wallCooldown: this.wallCooldownLevel,
      mgDamage: this.mgDamageLevel,
      mgFireRate: this.mgFireRateLevel,
      mgFlight: this.mgFlightLevel,
      wireDamage: this.wireDamageLevel,
      flameDamage: this.flameDamageLevel,
      salvoDamage: this.salvoDamageLevel,
      artilleryDamage: this.artilleryDamageLevel,
      ionDamage: this.ionDamageLevel,
      minesDamage: this.minesDamageLevel,
      bomber: this.bomberOwned,
      bomberCooldown: this.bomberCooldownLevel,
      bomberDamage: this.bomberDamageLevel,
      emp: this.empOwned,
      empCooldown: this.empCooldownLevel,
      empStun: this.empStunLevel,
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
    this.artilleryCooldownLevel = Math.min(saved.artilleryCooldown, ArtilleryStrikeAbilityConfig.maxShopCooldownLevel());
    this.ionOwned = saved.ion;
    this.ionCooldownLevel = Math.min(saved.ionCooldown, IonCannon.maxShopCooldownLevel);
    IonCannon.setShopCooldownLevel(this.ionCooldownLevel);
    this.ionSweepLevel = Math.min(saved.ionSweep, IonCannon.maxShopSweepLevel);
    IonCannon.setShopSweepLevel(this.ionSweepLevel);
    this.minesOwned = saved.mines;
    this.minesCooldownLevel = Math.min(saved.minesCooldown, Mines.maxShopCooldownLevel);
    Mines.setShopCooldownLevel(this.minesCooldownLevel);
    this.nuclearOwned = saved.nuclear;
    this.nuclearCooldownLevel = Math.min(saved.nuclearCooldown, NuclearStrike.maxShopCooldownLevel);
    NuclearStrike.setShopCooldownLevel(this.nuclearCooldownLevel);
    this.wallOwned = saved.wall;
    this.wallDurationLevel = Math.min(saved.wallDuration, EnergyWall.maxShopDurationLevel);
    EnergyWall.setShopDurationLevel(this.wallDurationLevel);
    this.wallCooldownLevel = Math.min(saved.wallCooldown, EnergyWall.maxShopCooldownLevel);
    EnergyWall.setShopCooldownLevel(this.wallCooldownLevel);
    this.mgDamageLevel = saved.mgDamage;
    this.mgFireRateLevel = Math.min(saved.mgFireRate, MachineGun.maxFireRateLevel);
    this.mgFlightLevel = Math.min(saved.mgFlight, MachineGun.maxShopFlightLevel);
    this.wireDamageLevel = saved.wireDamage;
    this.flameDamageLevel = saved.flameDamage;
    this.salvoDamageLevel = saved.salvoDamage;
    this.artilleryDamageLevel = saved.artilleryDamage;
    this.ionDamageLevel = saved.ionDamage;
    this.minesDamageLevel = saved.minesDamage;
    this.bomberOwned = saved.bomber;
    this.bomberCooldownLevel = Math.min(saved.bomberCooldown, BomberStrike.maxShopCooldownLevel);
    BomberStrike.setShopCooldownLevel(this.bomberCooldownLevel);
    this.bomberDamageLevel = saved.bomberDamage;
    this.empOwned = saved.emp;
    this.empCooldownLevel = Math.min(saved.empCooldown, EmpFlashAbilityConfig.maxShopCooldownLevel());
    this.empStunLevel = Math.min(saved.empStun, EmpFlashAbilityConfig.maxShopStunLevel());
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
    this.ionOwned = false;
    this.ionCooldownLevel = 0;
    IonCannon.setShopCooldownLevel(0);
    this.ionSweepLevel = 0;
    IonCannon.setShopSweepLevel(0);
    this.minesOwned = false;
    this.minesCooldownLevel = 0;
    Mines.setShopCooldownLevel(0);
    this.nuclearOwned = false;
    this.nuclearCooldownLevel = 0;
    NuclearStrike.setShopCooldownLevel(0);
    this.wallOwned = false;
    this.wallDurationLevel = 0;
    EnergyWall.setShopDurationLevel(0);
    this.wallCooldownLevel = 0;
    EnergyWall.setShopCooldownLevel(0);
    this.mgDamageLevel = 0;
    this.mgFireRateLevel = 0;
    this.mgFlightLevel = 0;
    this.wireDamageLevel = 0;
    this.flameDamageLevel = 0;
    this.salvoDamageLevel = 0;
    this.artilleryDamageLevel = 0;
    this.ionDamageLevel = 0;
    this.minesDamageLevel = 0;
    this.bomberOwned = false;
    this.bomberCooldownLevel = 0;
    BomberStrike.setShopCooldownLevel(0);
    this.bomberDamageLevel = 0;
    this.empOwned = false;
    this.empCooldownLevel = 0;
    this.empStunLevel = 0;
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

  // Тот же порядок кнопок, но после каждых трёх покупок танка — одна пулемёту, если ствол уже стоит.
  // Здоровья в этом магазине нет: после взрыва идут полёт, отталкивание и пробивание.
  // «Пуля» и «урон» пулемёта здесь одна кнопка «+1 урон», дальше перезарядка и полёт.
  // Окно и запись — один раз в конце.
  spendTankThenGun(): void {
    if (!this.shopOpen || this.isPaused()) {
      return;
    }
    const tank = [
      () => this.buyDamage(),
      () => this.buyFireRate(),
      () => this.buyBlast(),
      () => this.buyFlight(),
      () => this.buyKnockback(),
      () => this.buyPierce(),
    ];
    const gun = [
      () => this.buyMgDamage(),
      () => this.buyMgFireRate(),
      () => this.buyMgFlight(),
    ];
    this.batch = true;
    try {
      let tankBuys = 0;
      for (;;) {
        if (this.machineGunOwned && tankBuys >= 3 && this.buyFirst(gun)) {
          tankBuys = 0;
          continue;
        }
        if (this.buyFirst(tank)) {
          tankBuys += 1;
          continue;
        }
        if (this.machineGunOwned && this.buyFirst(gun)) {
          tankBuys = 0;
          continue;
        }
        break;
      }
    } finally {
      this.batch = false;
    }
    this.refresh();
  }

  // «Следующая волна». На паузе кнопка молчит: иначе бой стартовал бы под плашкой «ПАУЗА».
  closeAndContinue(): void {
    if (!this.shopOpen || this.isPaused()) {
      return;
    }
    this.revealField();
    this.onContinue();
  }

  // Спрятать витрину и вернуть физику, не начиная следующую волну.
  // Дебаг-перезапуск зовёт это: «дальше» само вызвало бы beginNextWave.
  dismiss(): void {
    if (!this.shopOpen) {
      return;
    }
    this.revealField();
  }

  // Витрина уходит, ствол снова стреляет, солдаты больше не стоят на паузе физики.
  private revealField(): void {
    this.panel.hide();
    this.shopOpen = false;
    this.scene.registry.set('combat', true);
    if (this.scene.physics.world.isPaused) {
      this.scene.physics.world.resume();
    }
  }

  // +1 к радиусу взрыва. Вместе с прогрессом не выше Tank.maxBlastLevel.
  // Цена — от уровня этой кнопки. Прогресс радиус поднимает, лестницу цены не двигает.
  buyBlast(): void {
    if (this.isPaused() || this.blastOfferLevel() >= Tank.maxBlastLevel) {
      return;
    }
    const cost = ShopController.upgradeCost(this.blastLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.blastLevel += 1;
    this.refresh();
  }

  // +1 к урону снаряда танка. Цена — от уровня этой кнопки.
  // Прогресс урон поднимает, лестницу цены не двигает.
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
    const cost = shopPrice(ArtilleryStrikeAbilityConfig.shop.cost);
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
    if (this.artilleryCooldownLevel >= ArtilleryStrikeAbilityConfig.maxShopCooldownLevel()) {
      return;
    }
    const now = cooldownFor(this.artilleryCooldownLevel,
      this.bonuses.artilleryCooldownLevel,
      ArtilleryStrikeAbilityConfig);
    if (cooldownFor(this.artilleryCooldownLevel + 1,
      this.bonuses.artilleryCooldownLevel,
      ArtilleryStrikeAbilityConfig) >= now) {
      return;
    }
    const cost = ShopController.artilleryCooldownCost(this.artilleryCooldownLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.artilleryCooldownLevel += 1;
    this.refresh();
  }

  // Открывает клавишу 7. Вспышку и глушение считает CombatSystem.
  buyEmp(): void {
    const cost = shopPrice(EmpFlashAbilityConfig.shop.cost);
    if (this.isPaused() || this.empOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.empOwned = true;
    this.refresh();
  }

  // −1 с к откату ЭМИ. Партия снимает свою минуту и останавливается на 2:00 без очков.
  buyEmpCooldown(): void {
    if (this.isPaused() || !this.empOwned) {
      return;
    }
    if (this.empCooldownLevel >= EmpFlashAbilityConfig.maxShopCooldownLevel()) {
      return;
    }
    const now = cooldownFor(this.empCooldownLevel, this.bonuses.empCooldownLevel, EmpFlashAbilityConfig);
    if (cooldownFor(this.empCooldownLevel + 1, this.bonuses.empCooldownLevel, EmpFlashAbilityConfig) >= now) {
      return;
    }
    const cost = ShopController.empCooldownCost(this.empCooldownLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.empCooldownLevel += 1;
    this.refresh();
  }

  // +0,1 с к глушению. Партия прибавляет свои 0,5 с и останавливается на 2,5 с без очков.
  buyEmpStun(): void {
    if (this.isPaused() || !this.empOwned) {
      return;
    }
    if (this.empStunLevel >= EmpFlashAbilityConfig.maxShopStunLevel()) {
      return;
    }
    const now = EmpFlashAbilityConfig.stunFor(this.empStunLevel, this.bonuses.empStunLevel);
    if (EmpFlashAbilityConfig.stunFor(this.empStunLevel + 1, this.bonuses.empStunLevel) <= now) {
      return;
    }
    const cost = ShopController.empStunCost(this.empStunLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.empStunLevel += 1;
    this.refresh();
  }

  // Открывает клавишу 4. Ход луча считает CombatSystem.
  buyIon(): void {
    const cost = shopPrice(IonCannon.shop.cost);
    if (this.isPaused() || this.ionOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.ionOwned = true;
    this.refresh();
  }

  // −1 с к откату ионной пушки. Партия снимает свои 20 с и останавливается на 40 с без очков.
  buyIonCooldown(): void {
    if (this.isPaused() || !this.ionOwned) {
      return;
    }
    if (this.ionCooldownLevel >= IonCannon.maxShopCooldownLevel) {
      return;
    }
    const now = IonCannon.cooldownFor(this.ionCooldownLevel);
    if (IonCannon.cooldownFor(this.ionCooldownLevel + 1) >= now) {
      return;
    }
    const cost = ShopController.ionCooldownCost(this.ionCooldownLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.ionCooldownLevel += 1;
    IonCannon.setShopCooldownLevel(this.ionCooldownLevel);
    this.refresh();
  }

  // −0,10 с к ходу ионной пушки. Партия снимает свою 1 с и останавливается на 4 с без очков.
  buyIonSweep(): void {
    if (this.isPaused() || !this.ionOwned) {
      return;
    }
    if (this.ionSweepLevel >= IonCannon.maxShopSweepLevel) {
      return;
    }
    const now = IonCannon.sweepFor(this.ionSweepLevel);
    if (IonCannon.sweepFor(this.ionSweepLevel + 1) >= now) {
      return;
    }
    const cost = ShopController.ionSweepCost(this.ionSweepLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.ionSweepLevel += 1;
    IonCannon.setShopSweepLevel(this.ionSweepLevel);
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

  // Открывает клавишу 5. Завесу и срок считает CombatSystem.
  buyWall(): void {
    const cost = shopPrice(EnergyWall.shop.cost);
    if (this.isPaused() || this.wallOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.wallOwned = true;
    this.refresh();
  }

  // +0,10 с к завесе. Партия прибавляет свою 1 с и останавливается на 2 с без очков.
  buyWallDuration(): void {
    if (this.isPaused() || !this.wallOwned) {
      return;
    }
    if (this.wallDurationLevel >= EnergyWall.maxShopDurationLevel) {
      return;
    }
    const now = EnergyWall.durationFor(this.wallDurationLevel);
    if (EnergyWall.durationFor(this.wallDurationLevel + 1) <= now) {
      return;
    }
    const cost = ShopController.wallDurationCost(this.wallDurationLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.wallDurationLevel += 1;
    EnergyWall.setShopDurationLevel(this.wallDurationLevel);
    this.refresh();
  }

  // −0,10 с к откату стены. Партия снимает свои 0,5 с и останавливается на 2:59,5 без очков.
  buyWallCooldown(): void {
    if (this.isPaused() || !this.wallOwned) {
      return;
    }
    if (this.wallCooldownLevel >= EnergyWall.maxShopCooldownLevel) {
      return;
    }
    const now = EnergyWall.cooldownFor(this.wallCooldownLevel);
    if (EnergyWall.cooldownFor(this.wallCooldownLevel + 1) >= now) {
      return;
    }
    const cost = ShopController.wallCooldownCost(this.wallCooldownLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.wallCooldownLevel += 1;
    EnergyWall.setShopCooldownLevel(this.wallCooldownLevel);
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
  // Цена — от уровня этой кнопки. Прогресс урон поднимает, лестницу не двигает.
  buyMgDamage(): void {
    this.buyDamageLevel(this.machineGunOwned, this.mgDamageLevel, (level) => {
      this.mgDamageLevel = level;
    });
  }

  // Короче пауза между очередями. Выше MachineGun.maxFireRateLevel уровень не поднимается.
  // Цена от уровня этой кнопки. Прогресс секунды снимает, но лестницу цены не двигает:
  // его шаг 0,01 с, а у партии 0,02 с.
  buyMgFireRate(): void {
    if (this.isPaused() || !this.machineGunOwned || this.mgFireRateLevel >= MachineGun.maxFireRateLevel) {
      return;
    }
    const cost = ShopController.upgradeCost(this.mgFireRateLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.mgFireRateLevel += 1;
    this.refresh();
  }

  // Короче полёт пули через поле. Выше MachineGun.maxShopFlightLevel уровень не поднимается.
  // Цена от уже купленного уровня этой кнопки: 300 × 1,15.
  buyMgFlight(): void {
    if (this.isPaused() || !this.machineGunOwned || this.mgFlightLevel >= MachineGun.maxShopFlightLevel) {
      return;
    }
    const cost = ShopController.flightCost(this.mgFlightLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.mgFlightLevel += 1;
    this.refresh();
  }

  // Цена — от уровня этой кнопки. Прогресс урон поднимает, лестницу не двигает.
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

  // Цена — от уровня этой кнопки. Прогресс урон поднимает, лестницу не двигает.
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

  buyIonDamage(): void {
    this.buyDamageLevel(this.ionOwned, this.ionDamageLevel, (level) => {
      this.ionDamageLevel = level;
    });
  }

  buyMinesDamage(): void {
    this.buyDamageLevel(this.minesOwned, this.minesDamageLevel, (level) => {
      this.minesDamageLevel = level;
    });
  }

  // Открывает клавишу 6. Пролёт и перезарядку считает CombatSystem.
  buyBomber(): void {
    const cost = shopPrice(BomberStrike.shop.cost);
    if (this.isPaused() || this.bomberOwned || this.economy.getCoins() < cost) {
      return;
    }
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.bomberOwned = true;
    this.refresh();
  }

  // −0,1 мин к откату бомбардировщика. Партия снимает свою минуту и останавливается на 2:00 без очков.
  buyBomberCooldown(): void {
    if (this.isPaused() || !this.bomberOwned) {
      return;
    }
    if (this.bomberCooldownLevel >= BomberStrike.maxShopCooldownLevel) {
      return;
    }
    const now = BomberStrike.cooldownFor(this.bomberCooldownLevel);
    if (BomberStrike.cooldownFor(this.bomberCooldownLevel + 1) >= now) {
      return;
    }
    const cost = ShopController.bomberCooldownCost(this.bomberCooldownLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.bomberCooldownLevel += 1;
    BomberStrike.setShopCooldownLevel(this.bomberCooldownLevel);
    this.refresh();
  }

  buyBomberDamage(): void {
    this.buyDamageLevel(this.bomberOwned, this.bomberDamageLevel, (level) => {
      this.bomberDamageLevel = level;
    });
  }

  // Строка характеристик над полем: урон и взрыв партии плюс постоянные уровни.
  syncTankStats(): void {
    this.hud.setTankStats(
      Infantry.shellDamage + this.damageLevel + this.bonuses.damage,
      Tank.blastRadiusFor(this.blastLevel + this.bonuses.blast),
      Tank.pierceChanceFor(this.pierceLevel, this.bonuses.pierce),
      Tank.fireDelayFor(this.fireRateLevel),
      Tank.flightMsFor(this.flightLevel),
      this.bonuses.coins,
      this.bonuses.points,
    );
  }

  private isPaused(): boolean {
    return this.paused;
  }

  // Первая кнопка списка, на которую хватает монет. false — ни одна не списала.
  private buyFirst(offers: ReadonlyArray<() => void>): boolean {
    const before = this.economy.getCoins();
    for (const offer of offers) {
      offer();
      if (this.economy.getCoins() < before) {
        return true;
      }
    }
    return false;
  }

  // Окно уже открыто: подпись и серые кнопки читают новое число монет.
  refreshCoins(): void {
    if (!this.shopOpen) {
      return;
    }
    this.panel.refresh(this.view());
  }

  private refresh(): void {
    if (this.batch) {
      return;
    }
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

  // Та же лестница, что у отката артиллерии: 1000, 1150, 1323…
  private static bomberCooldownCost(level: number): number {
    return shopPrice(Math.round(1000 * 1.15 ** Math.max(0, level)));
  }

  // Первая секунда отката ионной пушки стоит 1000. Дальше та же ступень 15%:
  // 1000, 1150, 1323, 1521, …
  private static ionCooldownCost(level: number): number {
    return shopPrice(Math.round(1000 * 1.15 ** Math.max(0, level)));
  }

  // Первый шаг хода ионной пушки стоит 500. Дальше та же ступень 15%:
  // 500, 575, 661, 760, …
  private static ionSweepCost(level: number): number {
    return shopPrice(Math.round(500 * 1.15 ** Math.max(0, level)));
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

  // Первый шаг длительности стены стоит 500. Дальше та же ступень 15%:
  // 500, 575, 661, 760, …
  private static wallDurationCost(level: number): number {
    return shopPrice(Math.round(500 * 1.15 ** Math.max(0, level)));
  }

  // Первый шаг отката стены стоит 1000. Дальше та же ступень 15%:
  // 1000, 1150, 1323, 1521, …
  private static wallCooldownCost(level: number): number {
    return shopPrice(Math.round(1000 * 1.15 ** Math.max(0, level)));
  }

  // Первая секунда отката ЭМИ стоит 1000. Дальше та же ступень 15%:
  // 1000, 1150, 1323, 1521, …
  private static empCooldownCost(level: number): number {
    return shopPrice(Math.round(1000 * 1.15 ** Math.max(0, level)));
  }

  // Первый шаг оглушения стоит 1000. Дальше та же ступень 15%:
  // 1000, 1150, 1323, 1521, …
  private static empStunCost(level: number): number {
    return shopPrice(Math.round(1000 * 1.15 ** Math.max(0, level)));
  }

  // Сумма партии и прогресса: число на карточке и потолок взрыва.
  // Номер кнопки и цена считают только покупки партии.
  private blastOfferLevel(): number {
    return this.blastLevel + this.bonuses.blast;
  }

  private damageOfferLevel(): number {
    return this.damageLevel + this.bonuses.damage;
  }

  private mgDamageOfferLevel(): number {
    return this.mgDamageLevel + this.bonuses.mg;
  }

  private wireDamageOfferLevel(): number {
    return this.wireDamageLevel + this.bonuses.wire;
  }

  private flameDamageOfferLevel(): number {
    return this.flameDamageLevel + this.bonuses.flame;
  }

  private salvoDamageOfferLevel(): number {
    return this.salvoDamageLevel + this.bonuses.salvo;
  }

  private artilleryDamageOfferLevel(): number {
    return this.artilleryDamageLevel + this.bonuses.artillery;
  }

  private ionDamageOfferLevel(): number {
    return this.ionDamageLevel + this.bonuses.ion;
  }

  private minesDamageOfferLevel(): number {
    return this.minesDamageLevel + this.bonuses.mines;
  }

  private bomberDamageOfferLevel(): number {
    return this.bomberDamageLevel + this.bonuses.bomber;
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
          this.mgFireRateCard(coins),
          this.mgFlightCard(coins),
        ]),
        this.tab('wire', 'Колючая проволока', [
          this.gearCard('wire', coins),
          this.weaponDamageCard(
            this.wireDamageLevel,
            BarbedWire.shop.damage + this.wireDamageOfferLevel(),
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
            this.artilleryDamageLevel,
            ArtilleryStrikeAbilityConfig.shop.damage + this.artilleryDamageOfferLevel(),
            () => this.buyArtilleryDamage(),
            coins,
            this.artilleryOwned,
            'после покупки',
          ),
          this.artilleryCooldownCard(coins),
        ]),
        this.tab('ion', 'Ионная пушка', [
          this.gearCard('ion', coins),
          this.weaponDamageCard(
            this.ionDamageLevel,
            IonCannon.shop.damage + this.ionDamageOfferLevel(),
            () => this.buyIonDamage(),
            coins,
            this.ionOwned,
            'после покупки',
          ),
          this.ionCooldownCard(coins),
          this.ionSweepCard(coins),
        ]),
        this.tab('mines', 'Мина', [
          this.gearCard('mines', coins),
          this.weaponDamageCard(
            this.minesDamageLevel,
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
        this.tab('wall', 'Энергетическая стена', [
          this.gearCard('wall', coins),
          this.wallDurationCard(coins),
          this.wallCooldownCard(coins),
        ]),
        this.tab('bomber', 'Бомбардировщик', [
          this.gearCard('bomber', coins),
          this.weaponDamageCard(
            this.bomberDamageLevel,
            BomberStrike.shop.damage + this.bomberDamageOfferLevel(),
            () => this.buyBomberDamage(),
            coins,
            this.bomberOwned,
            'после покупки',
          ),
          this.bomberCooldownCard(coins),
        ]),
        this.tab('emp', 'ЭМИ', [
          this.gearCard('emp', coins),
          this.empCooldownCard(coins),
          this.empStunCard(coins),
        ]),
      ],
    };
  }

  private tab(id: string, label: string, cards: ShopCardView[]): ShopTabView {
    return { id, label, cards };
  }

  private mgDamageNow(): number {
    return MachineGun.shop.damage + this.mgDamageOfferLevel();
  }

  // Струя и пятно на земле стартуют с одного числа и растут вместе.
  private flameDamageCard(coins: number): ShopCardView {
    const now = FlameTank.shop.streamDamage + this.flameDamageOfferLevel();
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
  ): void {
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
      case 'machineGun':
        return this.onceCard(
          'Установка',
          () => this.buyMachineGun(),
          coins,
          this.machineGunOwned,
          shopPrice(MachineGun.shop.cost),
          `очередь / ${this.formatSeconds(MachineGun.fireDelayFor(this.mgFireRateLevel))} с`,
          'вдоль прицела',
        );
      case 'laser':
        return this.onceCard(
          'Покупка',
          () => this.buyLaser(),
          coins,
          this.laserOwned,
          shopPrice(LaserDefense.shop.cost),
          `ракета / ${cooldownLabel(LaserDefense.fireIntervalFor())}`,
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
      case 'bomber':
        return this.bomberCard(coins);
      case 'ion':
        return this.ionCard(coins);
      case 'mines':
        return this.minesCard(coins);
      case 'nuclear':
        return this.nuclearCard(coins);
      case 'wall':
        return this.wallCard(coins);
      case 'emp':
        return this.empCard(coins);
    }
  }

  private blastCard(coins: number): ShopCardView {
    const level = this.blastLevel;
    const total = this.blastOfferLevel();
    const price = ShopController.upgradeCost(level);
    const radius = Tank.blastRadiusFor(total);
    const nextRadius = Tank.blastRadiusFor(total + 1);
    const maxed = total >= Tank.maxBlastLevel;
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
    const level = this.damageLevel;
    const price = ShopController.upgradeCost(level);
    const now = Infantry.shellDamage + this.damageOfferLevel();
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

  private mgFireRateCard(coins: number): ShopCardView {
    const buy = () => this.buyMgFireRate();
    const level = this.mgFireRateLevel;
    const price = ShopController.upgradeCost(level);
    if (!this.machineGunOwned) {
      return {
        title: '−0.02 с перезарядки',
        buy,
        info: 'после установки',
        cost: this.coin(price),
        open: false,
        canBuy: false,
        owned: false,
      };
    }
    const delay = this.formatSeconds(MachineGun.fireDelayFor(level));
    const next = this.formatSeconds(MachineGun.fireDelayFor(level + 1));
    const maxed = level >= MachineGun.maxFireRateLevel;
    return {
      title: '−0.02 с перезарядки',
      buy,
      info: maxed ? `ур. ${level} · ${delay}` : `ур. ${level} · ${delay}→${next}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private mgFlightCard(coins: number): ShopCardView {
    const buy = () => this.buyMgFlight();
    const level = this.mgFlightLevel;
    const price = ShopController.flightCost(level);
    if (!this.machineGunOwned) {
      return {
        title: '−0.10 с полёта',
        buy,
        info: 'после установки',
        cost: this.coin(price),
        open: false,
        canBuy: false,
        owned: false,
      };
    }
    const now = this.formatSeconds(MachineGun.flightMsFor(level));
    const next = this.formatSeconds(MachineGun.flightMsFor(level + 1));
    const maxed = level >= MachineGun.maxShopFlightLevel;
    return {
      title: '−0.10 с полёта',
      buy,
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
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
    const offer = ArtilleryStrikeAbilityConfig.shop;
    const price = shopPrice(offer.cost);
    const reload = cooldownLabel(cooldownFor(this.artilleryCooldownLevel,
      this.bonuses.artilleryCooldownLevel,
      ArtilleryStrikeAbilityConfig));
    if (this.artilleryOwned) {
      return {
        title: 'Покупка',
        buy: () => this.buyArtillery(),
        info: `${this.bonuses.artilleryShells}×${offer.damage + this.bonuses.artillery} · откат ${reload}`,
        cost: '',
        open: false,
        canBuy: false,
        owned: true,
      };
    }
    return {
      title: 'Покупка',
      buy: () => this.buyArtillery(),
      info: `${this.bonuses.artilleryShells}×${offer.damage + this.bonuses.artillery} · откат ${reload}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  // Та же плоскость, что у завесы в бою: карточка показывает, сколько бомб ляжет на текущую ширину поля.
  private bomberBombCount(): number {
    const pastX = EnergyWall.outerFace(BarbedWire.bounds.face + EnergyWall.ahead);
    return BomberStrike.impacts(pastX, 0).length;
  }

  private bomberCard(coins: number): ShopCardView {
    const offer = BomberStrike.shop;
    const price = shopPrice(offer.cost);
    const reload = cooldownLabel(BomberStrike.cooldownFor(this.bomberCooldownLevel));
    if (this.bomberOwned) {
      return {
        title: 'Покупка',
        buy: () => this.buyBomber(),
        info: `откат ${reload}`,
        cost: '',
        open: false,
        canBuy: false,
        owned: true,
      };
    }
    return {
      title: 'Покупка',
      buy: () => this.buyBomber(),
      info: `${this.bomberBombCount()}×${offer.damage + this.bonuses.bomber} · откат ${reload}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private empCard(coins: number): ShopCardView {
    const price = shopPrice(EmpFlashAbilityConfig.shop.cost);
    const stun = EmpFlashAbilityConfig.stunLabel(
      EmpFlashAbilityConfig.stunFor(this.empStunLevel, this.bonuses.empStunLevel),
    );
    const reload = cooldownLabel(
      cooldownFor(this.empCooldownLevel, this.bonuses.empCooldownLevel, EmpFlashAbilityConfig),
    );
    if (this.empOwned) {
      return {
        title: 'Покупка',
        buy: () => this.buyEmp(),
        info: `оглушение ${stun}`,
        cost: '',
        open: false,
        canBuy: false,
        owned: true,
      };
    }
    return {
      title: 'Покупка',
      buy: () => this.buyEmp(),
      info: `оглушение ${stun} · откат ${reload}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private empCooldownCard(coins: number): ShopCardView {
    const buy = () => this.buyEmpCooldown();
    const level = this.empCooldownLevel;
    const price = ShopController.empCooldownCost(level);
    if (!this.empOwned) {
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
    const now = cooldownFor(level, this.bonuses.empCooldownLevel, EmpFlashAbilityConfig);
    const next = cooldownFor(level + 1, this.bonuses.empCooldownLevel, EmpFlashAbilityConfig);
    const maxed = level >= EmpFlashAbilityConfig.maxShopCooldownLevel() || next >= now;
    return {
      title: '−1 с перезарядки',
      buy,
      info: maxed ? `ур. ${level} · ${cooldownLabel(now)}` : `ур. ${level} · ${cooldownLabel(now)}→${cooldownLabel(next)}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private empStunCard(coins: number): ShopCardView {
    const buy = () => this.buyEmpStun();
    const level = this.empStunLevel;
    const price = ShopController.empStunCost(level);
    if (!this.empOwned) {
      return {
        title: '+0.10 с оглушения',
        buy,
        info: 'после покупки',
        cost: this.coin(price),
        open: false,
        canBuy: false,
        owned: false,
      };
    }
    const now = EmpFlashAbilityConfig.stunFor(level, this.bonuses.empStunLevel);
    const next = EmpFlashAbilityConfig.stunFor(level + 1, this.bonuses.empStunLevel);
    const maxed = level >= EmpFlashAbilityConfig.maxShopStunLevel() || next <= now;
    return {
      title: '+0.10 с оглушения',
      buy,
      info: maxed
        ? `ур. ${level} · ${EmpFlashAbilityConfig.stunLabel(now)}`
        : `ур. ${level} · ${EmpFlashAbilityConfig.stunLabel(now)}→${EmpFlashAbilityConfig.stunLabel(next)}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private bomberCooldownCard(coins: number): ShopCardView {
    const buy = () => this.buyBomberCooldown();
    const level = this.bomberCooldownLevel;
    const price = ShopController.bomberCooldownCost(level);
    if (!this.bomberOwned) {
      return {
        title: '−0,1 мин перезарядки',
        buy,
        info: 'после покупки',
        cost: this.coin(price),
        open: false,
        canBuy: false,
        owned: false,
      };
    }
    const now = BomberStrike.cooldownFor(level);
    const next = BomberStrike.cooldownFor(level + 1);
    const maxed = level >= BomberStrike.maxShopCooldownLevel || next >= now;
    return {
      title: '−0,1 мин перезарядки',
      buy,
      info: maxed
        ? `ур. ${level} · ${cooldownLabel(now)}`
        : `ур. ${level} · ${cooldownLabel(now)}→${cooldownLabel(next)}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
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
    const now = cooldownFor(level,
      this.bonuses.artilleryCooldownLevel,
      ArtilleryStrikeAbilityConfig);
    const next = cooldownFor(level + 1,
      this.bonuses.artilleryCooldownLevel,
      ArtilleryStrikeAbilityConfig);
    const maxed = level >= ArtilleryStrikeAbilityConfig.maxShopCooldownLevel() || next >= now;
    return {
      title: '−1 с перезарядки',
      buy,
      info: maxed
        ? `ур. ${level} · ${cooldownLabel(now)}`
        : `ур. ${level} · ${cooldownLabel(now)}→${cooldownLabel(next)}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private ionCard(coins: number): ShopCardView {
    const offer = IonCannon.shop;
    const price = shopPrice(offer.cost);
    const reload = cooldownLabel(IonCannon.cooldownFor(this.ionCooldownLevel));
    if (this.ionOwned) {
      return {
        title: 'Покупка',
        buy: () => this.buyIon(),
        info: `откат ${reload}`,
        cost: '',
        open: false,
        canBuy: false,
        owned: true,
      };
    }
    return {
      title: 'Покупка',
      buy: () => this.buyIon(),
      info: `${offer.damage + this.bonuses.ion} · откат ${reload}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private ionCooldownCard(coins: number): ShopCardView {
    const buy = () => this.buyIonCooldown();
    const level = this.ionCooldownLevel;
    const price = ShopController.ionCooldownCost(level);
    if (!this.ionOwned) {
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
    const now = IonCannon.cooldownFor(level);
    const next = IonCannon.cooldownFor(level + 1);
    const maxed = level >= IonCannon.maxShopCooldownLevel || next >= now;
    return {
      title: '−1 с перезарядки',
      buy,
      info: maxed
        ? `ур. ${level} · ${cooldownLabel(now)}`
        : `ур. ${level} · ${cooldownLabel(now)}→${cooldownLabel(next)}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private ionSweepCard(coins: number): ShopCardView {
    const buy = () => this.buyIonSweep();
    const level = this.ionSweepLevel;
    const price = ShopController.ionSweepCost(level);
    if (!this.ionOwned) {
      return {
        title: '−0.10 с хода',
        buy,
        info: 'после покупки',
        cost: this.coin(price),
        open: false,
        canBuy: false,
        owned: false,
      };
    }
    const now = this.formatSeconds(IonCannon.sweepFor(level));
    const next = this.formatSeconds(IonCannon.sweepFor(level + 1));
    const maxed = level >= IonCannon.maxShopSweepLevel || IonCannon.sweepFor(level + 1) >= IonCannon.sweepFor(level);
    return {
      title: '−0.10 с хода',
      buy,
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private minesCard(coins: number): ShopCardView {
    const offer = Mines.shop;
    const price = shopPrice(offer.cost);
    const reload = cooldownLabel(Mines.cooldownFor(this.minesCooldownLevel));
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
        ? `ур. ${level} · ${cooldownLabel(now)}`
        : `ур. ${level} · ${cooldownLabel(now)}→${cooldownLabel(next)}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private nuclearCard(coins: number): ShopCardView {
    const offer = NuclearStrike.shop;
    const price = shopPrice(offer.cost);
    const reload = cooldownLabel(NuclearStrike.cooldownFor(this.nuclearCooldownLevel));
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
        ? `ур. ${level} · ${cooldownLabel(now)}`
        : `ур. ${level} · ${cooldownLabel(now)}→${cooldownLabel(next)}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private wallCard(coins: number): ShopCardView {
    const price = shopPrice(EnergyWall.shop.cost);
    const reload = cooldownLabel(EnergyWall.cooldownFor(this.wallCooldownLevel));
    const hold = EnergyWall.durationLabel(EnergyWall.durationFor(this.wallDurationLevel));
    if (this.wallOwned) {
      return {
        title: 'Покупка',
        buy: () => this.buyWall(),
        info: `откат ${reload}`,
        cost: '',
        open: false,
        canBuy: false,
        owned: true,
      };
    }
    return {
      title: 'Покупка',
      buy: () => this.buyWall(),
      info: `весь урон · ${hold} · ${reload}`,
      cost: this.coin(price),
      open: true,
      canBuy: coins >= price,
      owned: false,
    };
  }

  private wallDurationCard(coins: number): ShopCardView {
    const buy = () => this.buyWallDuration();
    const level = this.wallDurationLevel;
    const price = ShopController.wallDurationCost(level);
    if (!this.wallOwned) {
      return {
        title: '+0.10 с длительности',
        buy,
        info: 'после покупки',
        cost: this.coin(price),
        open: false,
        canBuy: false,
        owned: false,
      };
    }
    const now = EnergyWall.durationFor(level);
    const next = EnergyWall.durationFor(level + 1);
    const maxed = level >= EnergyWall.maxShopDurationLevel || next <= now;
    return {
      title: '+0.10 с длительности',
      buy,
      info: maxed
        ? `ур. ${level} · ${EnergyWall.durationLabel(now)}`
        : `ур. ${level} · ${EnergyWall.durationLabel(now)}→${EnergyWall.durationLabel(next)}`,
      cost: maxed ? 'максимум' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && coins >= price,
      owned: false,
    };
  }

  private wallCooldownCard(coins: number): ShopCardView {
    const buy = () => this.buyWallCooldown();
    const level = this.wallCooldownLevel;
    const price = ShopController.wallCooldownCost(level);
    if (!this.wallOwned) {
      return {
        title: '−0.10 с перезарядки',
        buy,
        info: 'после покупки',
        cost: this.coin(price),
        open: false,
        canBuy: false,
        owned: false,
      };
    }
    const now = EnergyWall.cooldownFor(level);
    const next = EnergyWall.cooldownFor(level + 1);
    const maxed = level >= EnergyWall.maxShopCooldownLevel || next >= now;
    return {
      title: '−0.10 с перезарядки',
      buy,
      info: maxed
        ? `ур. ${level} · ${cooldownLabel(now)}`
        : `ур. ${level} · ${cooldownLabel(now)}→${cooldownLabel(next)}`,
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

  // Метка монеты. Окно рисует вместо неё белый знак.
  private coin(price: number): string {
    return `${coinCostPrefix}${price}`;
  }

  private formatSeconds(ms: number): string {
    return (ms / 1000).toFixed(2);
  }
}
