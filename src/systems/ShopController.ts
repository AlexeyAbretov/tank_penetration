// Покупки между волнами. Окно ShopPanel только рисует кнопки и зовёт методы ниже.
// Уровни живут здесь, пока жива партия. В localStorage их кладёт RunSave через capture().
// Постоянные улучшения после поражения сюда не входят: их держит MetaSave.

import Phaser from 'phaser';
import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { AutoFire } from '../entities/AutoFire';
import { PAUSED } from '../gameConfig';
import { BarbedWire } from '../entities/BarbedWire';
import { Infantry } from '../entities/Infantry';
import { MachineGun } from '../entities/MachineGun';
import { Tank } from '../entities/Tank';
import { ShopPanel } from '../ui/ShopPanel';
import type { GameHud } from '../ui/GameHud';
import { loadMeta } from './MetaSave';
import type { ShopSave } from './RunSave';

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
  readonly autoFire = new AutoFire();
  shopOpen = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hud: GameHud,
    private readonly tank: Tank,
    private readonly economy: Economy,
    private readonly onContinue: () => void,
    private readonly onChanged: () => void,
  ) {
    this.panel = new ShopPanel(scene, this);
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
  }

  // Чистая партия: уровни и постройки обнуляются. Предметы на поле убирает перезапуск сцены.
  reset(): void {
    this.blastLevel = 0;
    this.damageLevel = 0;
    this.fireRateLevel = 0;
    this.wireOwned = false;
    this.machineGunOwned = false;
    this.artilleryOwned = false;
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
    this.panel.show(
      this.economy.getCoins(),
      this.blastLevel,
      this.damageLevel,
      this.fireRateLevel,
      this.wireOwned,
      this.autoFire.isOwned,
      this.machineGunOwned,
      this.artilleryOwned,
    );
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

  // +1 к радиусу взрыва. Цена растёт от текущего уровня, см. ShopPanel.upgradeCost.
  buyBlast(): void {
    if (this.isPaused()) {
      return;
    }
    const cost = ShopPanel.upgradeCost(this.blastLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.blastLevel += 1;
    this.refresh();
  }

  // +1 к урону снаряда танка. Складывается с постоянным уроном из MetaSave.
  buyDamage(): void {
    if (this.isPaused()) {
      return;
    }
    const cost = ShopPanel.upgradeCost(this.damageLevel);
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
    const cost = ShopPanel.upgradeCost(this.fireRateLevel);
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

  // Строка характеристик над полем: урон и взрыв партии плюс постоянные уровни.
  syncTankStats(): void {
    const meta = loadMeta();
    this.hud.setTankStats(
      Infantry.shellDamage + this.damageLevel + meta.damage,
      (this.blastLevel + meta.blast) * Tank.blastRadiusPerLevel,
      Tank.fireDelayFor(this.fireRateLevel),
      this.autoFire.enabled,
      meta.coins,
    );
    this.hud.setAutoFireToggle(this.autoFire.isOwned, this.autoFire.enabled);
  }

  private isPaused(): boolean {
    return this.scene.registry.get(PAUSED) === true;
  }

  private refresh(): void {
    this.hud.setCoins(this.economy.getCoins());
    this.syncTankStats();
    this.panel.refresh(
      this.economy.getCoins(),
      this.blastLevel,
      this.damageLevel,
      this.fireRateLevel,
      this.wireOwned,
      this.autoFire.isOwned,
      this.machineGunOwned,
      this.artilleryOwned,
    );
    this.onChanged();
  }
}
