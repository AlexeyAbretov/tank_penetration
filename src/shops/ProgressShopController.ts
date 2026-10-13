// Покупки после проигрыша. Score копится между партиями, уровни не сбрасываются.

import Phaser from 'phaser';
import { Tank } from '../entities/Tank';
import { ProgressShopPanel } from './ProgressShopPanel';
import { loadProgress, progressCost, resetProgress, saveProgress, type ProgressSave } from '../saves/ProgressSave';

const SCORE_MAX = 100_000_000;

type Stat = 'coins' | 'damage' | 'blast' | 'speed';

export class ProgressShopController {
  readonly panel: ProgressShopPanel;
  private readonly progress: ProgressSave;
  // Пауза сцены. Покупки очков ждут продолжения. «В бой» паузу не спрашивает.
  private paused = false;

  constructor(
    scene: Phaser.Scene,
    private readonly onNewGame: () => void,
  ) {
    this.progress = loadProgress();
    this.panel = new ProgressShopPanel(scene, this);
  }

  bank(runScore: number): void {
    if (this.progress.awaitingShop) {
      return;
    }
    const gained = Math.max(0, Math.round(runScore));
    this.progress.score = Math.min(SCORE_MAX, this.progress.score + gained);
    this.progress.awaitingShop = true;
    saveProgress(this.progress);
  }

  open(): void {
    this.panel.show(this.progress);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  closeAndRestart(): void {
    this.progress.awaitingShop = false;
    saveProgress(this.progress);
    this.panel.hide();
    this.onNewGame();
  }

  wipeAndRestart(): void {
    resetProgress();
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
    const level = this.progress[stat];
    if (stat === 'speed' && level >= Tank.maxProgressSpeedLevel) {
      return;
    }
    const cost = progressCost(level);
    if (this.progress.score < cost) {
      return;
    }
    this.progress.score -= cost;
    this.progress[stat] += 1;
    if (stat === 'speed') {
      Tank.setProgressSpeedLevel(this.progress.speed);
    }
    saveProgress(this.progress);
    this.panel.refresh(this.progress);
  }

  private isPaused(): boolean {
    return this.paused;
  }
}
