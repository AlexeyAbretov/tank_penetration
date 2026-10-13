// Покупки после проигрыша. Score копится между партиями, уровни не сбрасываются.

import Phaser from 'phaser';
import { Infantry } from '../entities/Infantry';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import { ProgressShopPanel, type ProgressCardView, type ProgressShopView } from './ProgressShopPanel';
import { ProgressSave, type SavedProgress } from '../saves/ProgressSave';

const SCORE_MAX = 100_000_000;

type Stat = 'coins' | 'damage' | 'blast' | 'speed';

export class ProgressShopController {
  // Панель живёт только пока жива сцена. restart() её уничтожает, bind() собирает заново.
  private panel!: ProgressShopPanel;
  private readonly progress: SavedProgress;
  // Пауза сцены. Покупки очков ждут продолжения. «В бой» паузу не спрашивает.
  private paused = false;
  private onNewGame: () => void = () => {};

  // Сохранение приходит из фабрики: у дебага свой ключ, и restart() его не подменяет.
  constructor(private readonly progressSave: ProgressSave) {
    this.progress = this.progressSave.load();
  }

  // До create() нет scene.add. Сюда сцена приходит уже запущенной.
  bind(scene: Phaser.Scene, onNewGame: () => void): void {
    this.onNewGame = onNewGame;
    this.paused = false;
    this.panel = new ProgressShopPanel(scene, this, { width: GAME.width, height: GAME.height });
  }

  speedLevel(): number {
    return this.progress.speed;
  }

  damageBonus(): number {
    return this.progress.damage;
  }

  blastBonus(): number {
    return this.progress.blast;
  }

  coinBonus(): number {
    return this.progress.coins;
  }

  isAwaitingShop(): boolean {
    return this.progress.awaitingShop;
  }

  clearProgress(): void {
    this.progressSave.reset();
  }

  bank(runScore: number): void {
    if (this.progress.awaitingShop) {
      return;
    }
    const gained = Math.max(0, Math.round(runScore));
    this.progress.score = Math.min(SCORE_MAX, this.progress.score + gained);
    this.progress.awaitingShop = true;
    this.progressSave.save(this.progress);
  }

  open(): void {
    this.panel.show(this.view());
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  closeAndRestart(): void {
    this.progress.awaitingShop = false;
    this.progressSave.save(this.progress);
    this.panel.hide();
    this.onNewGame();
  }

  wipeAndRestart(): void {
    this.clearProgress();
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
    const cost = ProgressSave.cost(level);
    if (this.progress.score < cost) {
      return;
    }
    this.progress.score -= cost;
    this.progress[stat] += 1;
    if (stat === 'speed') {
      Tank.setProgressSpeedLevel(this.progress.speed);
    }
    this.progressSave.save(this.progress);
    this.panel.refresh(this.view());
  }

  private view(): ProgressShopView {
    const score = this.progress.score;
    return {
      score,
      coins: this.coinsCard(score),
      damage: this.damageCard(score),
      blast: this.blastCard(score),
      speed: this.speedCard(score),
    };
  }

  private coinsCard(score: number): ProgressCardView {
    const level = this.progress.coins;
    const price = ProgressSave.cost(level);
    return {
      info: `ур. ${level}   +${level} → +${level + 1} к монетам`,
      cost: `цена  ${price}`,
      open: true,
      canBuy: score >= price,
    };
  }

  private damageCard(score: number): ProgressCardView {
    const level = this.progress.damage;
    const price = ProgressSave.cost(level);
    const now = Infantry.shellDamage + level;
    return {
      info: `ур. ${level}   урон ${now} → ${now + 1}`,
      cost: `цена  ${price}`,
      open: true,
      canBuy: score >= price,
    };
  }

  private blastCard(score: number): ProgressCardView {
    const level = this.progress.blast;
    const price = ProgressSave.cost(level);
    const now = level * Tank.blastRadiusPerLevel;
    const next = (level + 1) * Tank.blastRadiusPerLevel;
    return {
      info: `ур. ${level}   радиус ${now} → ${next}`,
      cost: `цена  ${price}`,
      open: true,
      canBuy: score >= price,
    };
  }

  private speedCard(score: number): ProgressCardView {
    const level = this.progress.speed;
    const price = ProgressSave.cost(level);
    const now = Tank.fireDelayFor(0, level);
    const next = Tank.fireDelayFor(0, level + 1);
    const maxed = level >= Tank.maxProgressSpeedLevel || next >= now;
    const delay = this.formatDelay(now);
    return {
      info: maxed ? `ур. ${level}   ${delay} (макс.)` : `ур. ${level}   ${delay} → ${this.formatDelay(next)}`,
      cost: maxed ? 'максимум' : `цена  ${price}`,
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private formatDelay(ms: number): string {
    return `${(ms / 1000).toFixed(2)} с`;
  }

  private isPaused(): boolean {
    return this.paused;
  }
}
