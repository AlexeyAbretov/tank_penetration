// Дебаг-витрина после гибели. «+» слева от знака очков делает то же, что клавиша M.
// Обычная партия этот класс не импортирует.

import Phaser from 'phaser';
import { DEBUG_SCORE_EVENT } from '../../gameConfig';
import { mountPlusChip, plusChipSize } from '../militaryDialog';
import { ProgressShopPanel, type ProgressShopDelegate, type ProgressShopView } from './ProgressShopPanel';

const PLUS_GAP = 8;

export class DebugProgressShopPanel extends ProgressShopPanel {
  private readonly plus: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    shop: ProgressShopDelegate,
    screen: { width: number; height: number },
  ) {
    super(scene, shop, screen);
    this.plus = mountPlusChip(scene, () => {
      if (!this.container.visible) {
        return;
      }
      scene.events.emit(DEBUG_SCORE_EVENT);
    });
    // Не в конец: карточки встают перед «Новая игра» и «В бой», плюс остаётся у знака.
    this.container.addAt(this.plus, this.container.getIndex(this.scoreMark));
    this.placePlus();
  }

  override refresh(view: ProgressShopView): void {
    super.refresh(view);
    this.placePlus();
  }

  // Знак прижат правым краем к числу и уезжает влево, когда цифр больше. Плюс держится слева от него.
  private placePlus(): void {
    const mark = this.scoreMark;
    const left = mark.x - mark.displayWidth * mark.originX;
    this.plus.setPosition(left - PLUS_GAP - plusChipSize / 2, mark.y);
  }
}
