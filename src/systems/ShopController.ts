// Покупки между волнами: прокачка, проволока и пауза боя.

import Phaser from 'phaser';
import { BarbedWire } from '../entities/BarbedWire';
import { Infantry } from '../entities/Infantry';
import { Tank } from '../entities/Tank';
import { ShopPanel } from '../ui/ShopPanel';
import type { GameHud } from '../ui/GameHud';

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
  shopOpen = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hud: GameHud,
    private readonly tank: Tank,
    private readonly economy: Economy,
    private readonly onContinue: () => void,
  ) {
    this.panel = new ShopPanel(scene, this);
  }

  reset(): void {
    this.blastLevel = 0;
    this.damageLevel = 0;
    this.fireRateLevel = 0;
    this.wireOwned = false;
    this.wire = undefined;
    this.shopOpen = false;
  }

  open(): void {
    this.shopOpen = true;
    this.scene.registry.set('combat', false);
    this.scene.physics.world.pause();
    this.panel.show(
      this.economy.getCoins(),
      this.blastLevel,
      this.damageLevel,
      this.fireRateLevel,
      this.wireOwned,
    );
  }

  closeAndContinue(): void {
    this.panel.hide();
    this.shopOpen = false;
    this.scene.registry.set('combat', true);
    this.scene.physics.world.resume();
    this.onContinue();
  }

  buyBlast(): void {
    const cost = ShopPanel.upgradeCost(this.blastLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.blastLevel += 1;
    this.refresh();
  }

  buyDamage(): void {
    const cost = ShopPanel.upgradeCost(this.damageLevel);
    if (!this.economy.spendCoins(cost)) {
      return;
    }
    this.damageLevel += 1;
    this.refresh();
  }

  buyFireRate(): void {
    if (this.fireRateLevel >= Tank.maxFireRateLevel) {
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

  buyWire(): void {
    if (this.wireOwned || this.economy.getCoins() < BarbedWire.shop.cost) {
      return;
    }
    if (!this.economy.spendCoins(BarbedWire.shop.cost)) {
      return;
    }
    this.wireOwned = true;
    this.wire = new BarbedWire(this.scene);
    this.refresh();
  }

  syncTankStats(): void {
    this.hud.setTankStats(
      Infantry.shellDamage + this.damageLevel,
      this.blastLevel * Tank.blastRadiusPerLevel,
      Tank.fireDelayFor(this.fireRateLevel),
    );
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
    );
  }
}
