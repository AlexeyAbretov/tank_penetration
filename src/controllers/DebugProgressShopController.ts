// Дебаг-магазин после гибели. M и «+» у знака досыпают очки, пока витрина открыта.
// Монеты сюда не входят: их досыпает магазин волны.
// Контроллер переживает restart(), поэтому слушатель снимается вместе со сценой.
// Обычная партия этот класс не импортирует.

import Phaser from 'phaser';
import { DEBUG_SCORE_EVENT } from '../gameConfig';
import { DebugProgressSave } from '../saves/DebugProgressSave';
import { DebugProgressShopPanel } from '../ui/shops/DebugProgressShopPanel';
import { ProgressShopController } from './ProgressShopController';

const GRANT = 10000;

export class DebugProgressShopController extends ProgressShopController {
  constructor() {
    super(new DebugProgressSave(), DebugProgressShopPanel);
  }

  private listening?: Phaser.Scene;
  private fundsKey?: Phaser.Input.Keyboard.Key;
  private readonly onGrant = (): void => {
    if (!this.isShown()) {
      return;
    }
    this.addScore(GRANT);
  };

  override bind(
    scene: Phaser.Scene & { paintAutoFire: () => void },
    onContinue: () => void,
    onNewGame: () => void,
  ): void {
    this.drop();
    super.bind(scene, onContinue, onNewGame);
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.fundsKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
      this.fundsKey.on('down', this.onGrant);
    }
    scene.events.on(DEBUG_SCORE_EVENT, this.onGrant);
    this.listening = scene;
    scene.events.once('shutdown', () => this.drop());
  }

  private drop(): void {
    this.fundsKey?.off('down', this.onGrant);
    this.fundsKey = undefined;
    this.listening?.events.off(DEBUG_SCORE_EVENT, this.onGrant);
    this.listening = undefined;
  }
}
