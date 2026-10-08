// Покупки после проигрыша. Score копится между партиями, уровни не сбрасываются.

import Phaser from 'phaser';
import { Tank } from '../entities/Tank';
import { MetaShopPanel } from '../ui/MetaShopPanel';
import { PAUSED } from '../gameConfig';
import { loadMeta, metaCost, resetMeta, saveMeta, type MetaSave } from './MetaSave';

const SCORE_MAX = 100_000_000;

type Stat = 'coins' | 'damage' | 'blast' | 'speed';

export class MetaShopController {
  readonly panel: MetaShopPanel;
  private readonly meta: MetaSave;

  constructor(
    scene: Phaser.Scene,
    private readonly onNewGame: () => void,
  ) {
    this.meta = loadMeta();
    this.panel = new MetaShopPanel(scene, this);
  }

  bank(runScore: number): void {
    if (this.meta.awaitingShop) {
      return;
    }
    const gained = Math.max(0, Math.round(runScore));
    this.meta.score = Math.min(SCORE_MAX, this.meta.score + gained);
    this.meta.awaitingShop = true;
    saveMeta(this.meta);
  }

  open(): void {
    this.panel.show(this.meta);
  }

  closeAndRestart(): void {
    this.meta.awaitingShop = false;
    saveMeta(this.meta);
    this.panel.hide();
    this.onNewGame();
  }

  wipeAndRestart(): void {
    resetMeta();
    this.panel.hide();
    this.onNewGame();
  }

  buyCoins(): void {
    this.buy('coins');
  }

  buyDamage(): void {
    this.buy('damage');
  }

  buyBlast(): void {
    this.buy('blast');
  }

  buySpeed(): void {
    this.buy('speed');
  }

  private buy(stat: Stat): void {
    if (this.isPaused()) {
      return;
    }
    const level = this.meta[stat];
    if (stat === 'speed' && level >= Tank.maxMetaSpeedLevel) {
      return;
    }
    const cost = metaCost(level);
    if (this.meta.score < cost) {
      return;
    }
    this.meta.score -= cost;
    this.meta[stat] += 1;
    if (stat === 'speed') {
      Tank.setMetaSpeedLevel(this.meta.speed);
    }
    saveMeta(this.meta);
    this.panel.refresh(this.meta);
  }

  private isPaused(): boolean {
    return this.panel.container.scene.registry.get(PAUSED) === true;
  }
}
