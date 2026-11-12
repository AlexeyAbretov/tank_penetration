// Дебаг-магазин волны. M и «+» у знака досыпают монеты, пока витрина открыта.
// Очки сюда не входят: их досыпает магазин после гибели.
// Обычная партия этот класс не импортирует.

import Phaser from 'phaser';
import { DEBUG_COIN_EVENT } from '../gameConfig';
import { ShopController } from './ShopController';

const GRANT = 10000;

export class DebugShopController extends ShopController {
  private armed = false;
  private readonly onGrant = (): void => {
    if (!this.shopOpen) {
      return;
    }
    this.economy.addCoins(GRANT);
    this.refreshCoins();
  };

  override open(): void {
    this.arm();
    super.open();
  }

  private arm(): void {
    if (this.armed) {
      return;
    }
    this.armed = true;
    const keyboard = this.scene.input.keyboard;
    if (keyboard) {
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', this.onGrant);
    }
    this.scene.events.on(DEBUG_COIN_EVENT, this.onGrant);
    // restart() поднимает ту же сцену. Без снятия старый магазин досыплет ещё раз.
    this.scene.events.once('shutdown', () => {
      this.scene.events.off(DEBUG_COIN_EVENT, this.onGrant);
    });
  }
}
