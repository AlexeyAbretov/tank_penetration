// Покупки после проигрыша. Score копится между партиями, уровни не сбрасываются.

import Phaser from 'phaser';
import { Infantry } from '../entities/Infantry';
import { LaserDefense } from '../entities/LaserDefense';
import { MachineGun } from '../entities/MachineGun';
import { Tank } from '../entities/Tank/Tank';
import { GAME } from '../gameConfig';
import { shopPrice } from '../shopPrice';
import {
  ProgressShopPanel,
  type ProgressCardView,
  type ProgressShopView,
  type ProgressTabView,
} from '../ui/shops/ProgressShopPanel';
import { ProgressSave, type SavedProgress } from '../saves/ProgressSave';

const SCORE_MAX = 100_000_000;

type Stat = 'coins' | 'points' | 'damage' | 'blast' | 'speed' | 'bullets' | 'mgDamage' | 'laserShots';

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
    this.panel = new ProgressShopPanel(scene, this, GAME);
  }

  layout(): void {
    this.panel.layout();
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

  pointBonus(): number {
    return this.progress.points;
  }

  bulletCount(): number {
    return MachineGun.bulletCount(this.progress.bullets);
  }

  mgDamageBonus(): number {
    return this.progress.mgDamage;
  }

  laserShotCount(): number {
    return LaserDefense.shotCount(this.progress.laserShots);
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

  // Дебаг досыпает очки, пока витрина открыта. Иначе кнопки остаются по старому числу.
  addScore(amount: number): void {
    const gained = Math.max(0, Math.round(amount));
    this.progress.score = Math.min(SCORE_MAX, this.progress.score + gained);
    this.progressSave.save(this.progress);
    this.panel.refresh(this.view());
  }

  open(): void {
    this.panel.show(this.view());
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.panel.setPaused(paused);
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

  private buyCoins(): void {
    this.buy('coins');
  }

  private buyPoints(): void {
    this.buy('points');
  }

  private buyDamage(): void {
    this.buy('damage');
  }

  private buyBlast(): void {
    this.buy('blast');
  }

  private buySpeed(): void {
    this.buy('speed');
  }

  private buyBullets(): void {
    this.buy('bullets');
  }

  private buyMgDamage(): void {
    this.buy('mgDamage');
  }

  private buyLaserShots(): void {
    this.buy('laserShots');
  }

  private buy(stat: Stat): void {
    if (this.isPaused()) {
      return;
    }
    const level = this.progress[stat];
    if (stat === 'blast' && level >= Tank.maxProgressBlastLevel) {
      return;
    }
    if (stat === 'speed' && level >= Tank.maxProgressSpeedLevel) {
      return;
    }
    if (stat === 'bullets' && level >= MachineGun.maxBulletLevel) {
      return;
    }
    if (stat === 'laserShots' && level >= LaserDefense.maxShotLevel) {
      return;
    }
    const cost = this.costFor(stat, level);
    if (this.progress.score < cost) {
      return;
    }
    this.progress.score -= cost;
    this.progress[stat] += 1;
    if (stat === 'speed') {
      Tank.setProgressSpeedLevel(this.progress.speed);
    }
    if (stat === 'blast') {
      Tank.setProgressBlastLevel(this.progress.blast);
    }
    this.progressSave.save(this.progress);
    this.panel.refresh(this.view());
  }

  private view(): ProgressShopView {
    const score = this.progress.score;
    return {
      score,
      tabs: [
        this.tab('tank', 'Танк', [this.damageCard(score), this.blastCard(score), this.speedCard(score)]),
        this.tab('gun', 'Пулемёт', [this.bulletsCard(score), this.mgDamageCard(score)]),
        this.tab('laser', 'Лазерная установка', [this.laserCard(score)]),
        this.tab('resources', 'Ресурсы', [this.coinsCard(score), this.pointsCard(score)]),
      ],
    };
  }

  private tab(id: string, label: string, cards: ProgressCardView[]): ProgressTabView {
    return { id, label, cards };
  }

  private coinsCard(score: number): ProgressCardView {
    const level = this.progress.coins;
    const price = this.price(level);
    return {
      title: '+1 монета',
      buy: () => this.buyCoins(),
      info: `ур. ${level} · +${level}→+${level + 1}`,
      cost: this.coin(price),
      open: true,
      canBuy: score >= price,
    };
  }

  private pointsCard(score: number): ProgressCardView {
    const level = this.progress.points;
    const price = this.price(level);
    return {
      title: '+1 очко',
      buy: () => this.buyPoints(),
      info: `ур. ${level} · +${level}→+${level + 1}`,
      cost: this.coin(price),
      open: true,
      canBuy: score >= price,
    };
  }

  private damageCard(score: number): ProgressCardView {
    const level = this.progress.damage;
    const price = this.price(level);
    const now = Infantry.shellDamage + level;
    return {
      title: '+1 урон',
      buy: () => this.buyDamage(),
      info: `ур. ${level} · ${now}→${now + 1}`,
      cost: this.coin(price),
      open: true,
      canBuy: score >= price,
    };
  }

  private blastCard(score: number): ProgressCardView {
    const level = this.progress.blast;
    const price = this.price(level);
    const now = Tank.blastRadiusFor(level);
    const next = Tank.blastRadiusFor(level + 1);
    const maxed = level >= Tank.maxProgressBlastLevel;
    return {
      title: '+1 взрыв',
      buy: () => this.buyBlast(),
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private speedCard(score: number): ProgressCardView {
    const level = this.progress.speed;
    const price = this.price(level);
    const now = Tank.fireDelayFor(0, level);
    const next = Tank.fireDelayFor(0, level + 1);
    const maxed = level >= Tank.maxProgressSpeedLevel || next >= now;
    const delay = this.formatSeconds(now);
    const ahead = this.formatSeconds(next);
    return {
      title: '−0.01 с перезарядки',
      buy: () => this.buySpeed(),
      info: maxed ? `ур. ${level} · ${delay}` : `ур. ${level} · ${delay}→${ahead}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private bulletsCard(score: number): ProgressCardView {
    const level = this.progress.bullets;
    const price = this.bulletPrice(level);
    const now = MachineGun.bulletCount(level);
    const next = MachineGun.bulletCount(level + 1);
    const maxed = level >= MachineGun.maxBulletLevel;
    return {
      title: '+1 пуля',
      buy: () => this.buyBullets(),
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private laserCard(score: number): ProgressCardView {
    const level = this.progress.laserShots;
    const price = this.price(level);
    const now = LaserDefense.shotCount(level);
    const next = LaserDefense.shotCount(level + 1);
    const maxed = level >= LaserDefense.maxShotLevel;
    return {
      title: '+1 луч',
      buy: () => this.buyLaserShots(),
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private mgDamageCard(score: number): ProgressCardView {
    const level = this.progress.mgDamage;
    const price = this.mgDamagePrice(level);
    const now = MachineGun.shop.damage + level;
    return {
      title: '+1 урон пули',
      buy: () => this.buyMgDamage(),
      info: `ур. ${level} · ${now}→${now + 1}`,
      cost: this.coin(price),
      open: true,
      canBuy: score >= price,
    };
  }

  // Формула остаётся в ProgressSave. Здесь только подмена для сборки племянника.
  private price(level: number): number {
    return shopPrice(ProgressSave.cost(level));
  }

  private bulletPrice(level: number): number {
    return shopPrice(ProgressSave.bulletCost(level));
  }

  private mgDamagePrice(level: number): number {
    return shopPrice(ProgressSave.mgDamageCost(level));
  }

  private costFor(stat: Stat, level: number): number {
    if (stat === 'bullets') {
      return this.bulletPrice(level);
    }
    if (stat === 'mgDamage') {
      return this.mgDamagePrice(level);
    }
    return this.price(level);
  }

  private coin(price: number): string {
    return `¤ ${price}`;
  }

  private formatSeconds(ms: number): string {
    return (ms / 1000).toFixed(2);
  }

  private isPaused(): boolean {
    return this.paused;
  }
}
