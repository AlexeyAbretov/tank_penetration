// Дебаг-витрина между волнами. «+» слева от знака монет делает то же, что клавиша M.
// Обычная партия этот класс не импортирует.

import Phaser from 'phaser';
import { DEBUG_COIN_EVENT } from '../../gameConfig';
import { mountPlusChip, plusChipSize } from '../militaryDialog';
import { ShopPanel, type ShopDelegate, type ShopView } from './ShopPanel';

const PLUS_GAP = 8;

export class DebugShopPanel extends ShopPanel {
  private readonly plus: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    shop: ShopDelegate,
    screen: { width: number; height: number },
  ) {
    super(scene, shop, screen);
    this.plus = mountPlusChip(scene, () => {
      if (!this.container.visible) {
        return;
      }
      scene.events.emit(DEBUG_COIN_EVENT);
    });
    // Не в конец: карточки встают перед «Следующая волна», плюс остаётся у знака.
    this.container.addAt(this.plus, this.container.getIndex(this.coinMark));
    this.placePlus();
  }

  override refresh(view: ShopView): void {
    super.refresh(view);
    this.placePlus();
  }

  // Знак прижат правым краем к числу и уезжает влево, когда цифр больше. Плюс держится слева от него.
  private placePlus(): void {
    const mark = this.coinMark;
    const left = mark.x - mark.displayWidth * mark.originX;
    this.plus.setPosition(left - PLUS_GAP - plusChipSize / 2, mark.y);
  }
}
