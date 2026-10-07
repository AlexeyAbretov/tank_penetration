// Покупки между волнами: прокачка, проволока и пауза боя.

import Phaser from 'phaser';
import { BarbedWire } from '../entities/BarbedWire';
import { ShopPanel } from '../ui/ShopPanel';
import type { GameHud } from '../ui/GameHud';

type Economy = {
  getCoins: () => number;
  spendCoins: (amount: number) => boolean;
};

export class ShopController {
  blastLevel = 0;
  damageLevel = 0;
  wireOwned = false;
  wire?: BarbedWire;
  shopOpen = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hud: GameHud,
    private readonly economy: Economy,
    private readonly onContinue: () => void,
  ) {}

  reset(): void {
    this.blastLevel = 0;
    this.damageLevel = 0;
    this.wireOwned = false;
    this.wire = undefined;
    this.shopOpen = false;
  }

  open(): void {
    this.shopOpen = true;
    this.scene.registry.set('combat', false);
    this.scene.physics.world.pause();
    this.hud.shop.show(
      this.economy.getCoins(),
      this.blastLevel,
      this.damageLevel,
      this.wireOwned,
    );
  }

  closeAndContinue(): void {
    this.hud.shop.hide();
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

  private refresh(): void {
    this.hud.setCoins(this.economy.getCoins());
    this.hud.shop.refresh(
      this.economy.getCoins(),
      this.blastLevel,
      this.damageLevel,
      this.wireOwned,
    );
  }
}
