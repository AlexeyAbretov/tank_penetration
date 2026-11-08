// Покупки после проигрыша. Score копится между партиями, уровни не сбрасываются.

import Phaser from 'phaser';
import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { BomberStrike } from '../entities/BomberStrike';
import { EnergyWall } from '../entities/EnergyWall';
import { IonCannon } from '../entities/IonCannon';
import { BarbedWire } from '../entities/BarbedWire';
import { Infantry } from '../entities/Infantry';
import { LaserDefense } from '../entities/LaserDefense';
import { MachineGun } from '../entities/MachineGun';
import { Mines } from '../entities/Mines';
import { NuclearStrike } from '../entities/NuclearStrike';
import { RocketSalvo } from '../entities/RocketSalvo';
import { Tank } from '../entities/Tank/Tank';
import { TankBaseHp } from '../entities/Tank/TankBaseHp';
import { GAME } from '../gameConfig';
import { shopPrice } from '../shopPrice';
import {
  ProgressShopPanel,
  type ProgressCardView,
  type ProgressShopView,
  type ProgressTabView,
} from '../ui/shops/ProgressShopPanel';
import { GameHud } from '../ui/huds/GameHud';
import { ProgressSave, type SavedProgress } from '../saves/ProgressSave';

const SCORE_MAX = 100_000_000;

type Stat =
  | 'coins'
  | 'points'
  | 'damage'
  | 'blast'
  | 'knockback'
  | 'pierce'
  | 'absorb'
  | 'hp'
  | 'speed'
  | 'flight'
  | 'bullets'
  | 'mgDamage'
  | 'mgSpeed'
  | 'mgFlight'
  | 'laserShots'
  | 'laserCooldown'
  | 'salvoRockets'
  | 'artilleryShells'
  | 'minesCount'
  | 'salvoDamage'
  | 'artilleryDamage'
  | 'ionDamage'
  | 'minesDamage'
  | 'wireDamage'
  | 'artilleryCooldown'
  | 'ionCooldown'
  | 'ionSweep'
  | 'ionWidth'
  | 'minesCooldown'
  | 'nuclearCooldown'
  | 'wallDuration'
  | 'wallCooldown'
  | 'bomberDamage'
  | 'bomberCooldown';

export class ProgressShopController {
  // Панель и интерфейс живут только пока жива сцена. restart() их уничтожает, bind() собирает заново.
  private panel!: ProgressShopPanel;
  private hud?: GameHud;
  private readonly progress: SavedProgress;
  // Пауза сцены. Покупки очков ждут продолжения. «В бой» паузу не спрашивает.
  private paused = false;
  private onNewGame: () => void = () => {};

  // Сохранение приходит из фабрики: у дебага свой ключ, и restart() его не подменяет.
  constructor(private readonly progressSave: ProgressSave) {
    this.progress = this.progressSave.load();
  }

  // До create() нет scene.add. Сюда сцена приходит уже запущенной и отдаёт свежий интерфейс.
  bind(scene: Phaser.Scene, onNewGame: () => void, hud: GameHud): void {
    this.onNewGame = onNewGame;
    this.paused = false;
    this.panel = new ProgressShopPanel(scene, this, GAME);
    this.hud = hud;
    this.paintAutoFireMode();
  }

  layout(): void {
    this.panel.layout();
  }

  speedLevel(): number {
    return this.progress.speed;
  }

  flightLevel(): number {
    return this.progress.flight;
  }

  damageBonus(): number {
    return this.progress.damage;
  }

  blastBonus(): number {
    return this.progress.blast;
  }

  knockbackBonus(): number {
    return this.progress.knockback;
  }

  pierceBonus(): number {
    return this.progress.pierce;
  }

  absorbBonus(): number {
    return this.progress.absorb;
  }

  // Старт партии подставляет купленный запас до полоски и игрока.
  syncTankHp(): void {
    this.progressSave.syncHp();
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

  mgSpeedLevel(): number {
    return this.progress.mgSpeed;
  }

  mgFlightLevel(): number {
    return this.progress.mgFlight;
  }

  laserShotCount(): number {
    return LaserDefense.shotCount(this.progress.laserShots);
  }

  laserCooldownLevel(): number {
    return this.progress.laserCooldown;
  }

  salvoRocketLevel(): number {
    return this.progress.salvoRockets;
  }

  artilleryShellLevel(): number {
    return this.progress.artilleryShells;
  }

  minesCountLevel(): number {
    return this.progress.minesCount;
  }

  salvoDamageBonus(): number {
    return this.progress.salvoDamage;
  }

  artilleryDamageBonus(): number {
    return this.progress.artilleryDamage;
  }

  ionDamageBonus(): number {
    return this.progress.ionDamage;
  }

  minesDamageBonus(): number {
    return this.progress.minesDamage;
  }

  wireDamageBonus(): number {
    return this.progress.wireDamage;
  }

  bomberDamageBonus(): number {
    return this.progress.bomberDamage;
  }

  bomberCooldownLevel(): number {
    return this.progress.bomberCooldown;
  }

  artilleryCooldownLevel(): number {
    return this.progress.artilleryCooldown;
  }

  ionCooldownLevel(): number {
    return this.progress.ionCooldown;
  }

  ionSweepLevel(): number {
    return this.progress.ionSweep;
  }

  ionWidthLevel(): number {
    return this.progress.ionWidth;
  }

  minesCooldownLevel(): number {
    return this.progress.minesCooldown;
  }

  nuclearCooldownLevel(): number {
    return this.progress.nuclearCooldown;
  }

  wallDurationLevel(): number {
    return this.progress.wallDuration;
  }

  wallCooldownLevel(): number {
    return this.progress.wallCooldown;
  }

  autoFireOwned(): boolean {
    return this.progress.autoFire;
  }

  // Куплено и не выключено иконкой справа.
  autoFireEnabled(): boolean {
    return this.progress.autoFire && this.progress.autoFireOn;
  }

  // Строка над полем. Магазин волны эту надпись не собирает.
  private paintAutoFireMode(): void {
    this.hud?.setAutoFireMode(this.autoFireEnabled());
  }

  toggleAutoFire(): void {
    if (this.paused || !this.progress.autoFire) {
      return;
    }
    this.progress.autoFireOn = !this.progress.autoFireOn;
    this.progressSave.save(this.progress);
    this.paintAutoFireMode();
  }

  autoAimOwned(): boolean {
    return this.progress.autoAim;
  }

  // Куплено и не выключено кнопкой над лентой.
  autoAimEnabled(): boolean {
    return this.progress.autoAim && this.progress.autoAimOn;
  }

  toggleAutoAim(): void {
    if (this.paused || !this.progress.autoAim) {
      return;
    }
    this.progress.autoAimOn = !this.progress.autoAimOn;
    this.progressSave.save(this.progress);
  }

  autoShopOwned(): boolean {
    return this.progress.autoShop;
  }

  // Куплено и не выключено иконкой справа. Магазин волны тогда тратит монеты сам.
  autoShopEnabled(): boolean {
    return this.progress.autoShop && this.progress.autoShopOn;
  }

  toggleAutoShop(): void {
    if (this.paused || !this.progress.autoShop) {
      return;
    }
    this.progress.autoShopOn = !this.progress.autoShopOn;
    this.progressSave.save(this.progress);
  }

  autoArtilleryOwned(): boolean {
    return this.progress.autoArtillery;
  }

  // Куплено и включено выключателем на иконке удара.
  autoArtilleryEnabled(): boolean {
    return this.progress.autoArtillery && this.progress.autoArtilleryOn;
  }

  toggleAutoArtillery(): void {
    if (this.paused || !this.progress.autoArtillery) {
      return;
    }
    this.progress.autoArtilleryOn = !this.progress.autoArtilleryOn;
    this.progressSave.save(this.progress);
  }

  autoMinesOwned(): boolean {
    return this.progress.autoMines;
  }

  // Куплено и включено выключателем на иконке мин.
  autoMinesEnabled(): boolean {
    return this.progress.autoMines && this.progress.autoMinesOn;
  }

  toggleAutoMines(): void {
    if (this.paused || !this.progress.autoMines) {
      return;
    }
    this.progress.autoMinesOn = !this.progress.autoMinesOn;
    this.progressSave.save(this.progress);
  }

  autoIonOwned(): boolean {
    return this.progress.autoIon;
  }

  // Куплено и включено выключателем на иконке луча.
  autoIonEnabled(): boolean {
    return this.progress.autoIon && this.progress.autoIonOn;
  }

  toggleAutoIon(): void {
    if (this.paused || !this.progress.autoIon) {
      return;
    }
    this.progress.autoIonOn = !this.progress.autoIonOn;
    this.progressSave.save(this.progress);
  }

  autoBomberOwned(): boolean {
    return this.progress.autoBomber;
  }

  // Куплено и включено выключателем на иконке бомбардировщика.
  autoBomberEnabled(): boolean {
    return this.progress.autoBomber && this.progress.autoBomberOn;
  }

  toggleAutoBomber(): void {
    if (this.paused || !this.progress.autoBomber) {
      return;
    }
    this.progress.autoBomberOn = !this.progress.autoBomberOn;
    this.progressSave.save(this.progress);
  }

  autoWallOwned(): boolean {
    return this.progress.autoWall;
  }

  // Куплено и включено выключателем на иконке стены.
  autoWallEnabled(): boolean {
    return this.progress.autoWall && this.progress.autoWallOn;
  }

  toggleAutoWall(): void {
    if (this.paused || !this.progress.autoWall) {
      return;
    }
    this.progress.autoWallOn = !this.progress.autoWallOn;
    this.progressSave.save(this.progress);
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

  private buyKnockback(): void {
    this.buy('knockback');
  }

  private buyPierce(): void {
    this.buy('pierce');
  }

  private buyAbsorb(): void {
    this.buy('absorb');
  }

  private buyHp(): void {
    this.buy('hp');
  }

  private buySpeed(): void {
    this.buy('speed');
  }

  private buyFlight(): void {
    this.buy('flight');
  }

  private buyBullets(): void {
    this.buy('bullets');
  }

  private buyMgDamage(): void {
    this.buy('mgDamage');
  }

  private buyMgSpeed(): void {
    this.buy('mgSpeed');
  }

  private buyMgFlight(): void {
    this.buy('mgFlight');
  }

  private buyLaserShots(): void {
    this.buy('laserShots');
  }

  private buyLaserCooldown(): void {
    this.buy('laserCooldown');
  }

  private buySalvoRockets(): void {
    this.buy('salvoRockets');
  }

  private buyArtilleryShells(): void {
    this.buy('artilleryShells');
  }

  private buyMinesCount(): void {
    this.buy('minesCount');
  }

  private buySalvoDamage(): void {
    this.buy('salvoDamage');
  }

  private buyArtilleryDamage(): void {
    this.buy('artilleryDamage');
  }

  private buyBomberDamage(): void {
    this.buy('bomberDamage');
  }

  private buyBomberCooldown(): void {
    this.buy('bomberCooldown');
  }

  private buyIonDamage(): void {
    this.buy('ionDamage');
  }

  private buyMinesDamage(): void {
    this.buy('minesDamage');
  }

  private buyWireDamage(): void {
    this.buy('wireDamage');
  }

  private buyArtilleryCooldown(): void {
    this.buy('artilleryCooldown');
  }

  private buyIonCooldown(): void {
    this.buy('ionCooldown');
  }

  private buyIonSweep(): void {
    this.buy('ionSweep');
  }

  private buyIonWidth(): void {
    this.buy('ionWidth');
  }

  private buyMinesCooldown(): void {
    this.buy('minesCooldown');
  }

  private buyNuclearCooldown(): void {
    this.buy('nuclearCooldown');
  }

  private buyWallDuration(): void {
    this.buy('wallDuration');
  }

  private buyWallCooldown(): void {
    this.buy('wallCooldown');
  }

  private buyAutoFire(): void {
    if (this.isPaused() || this.progress.autoFire) {
      return;
    }
    const cost = shopPrice(ProgressSave.autoFireCost());
    if (this.progress.score < cost) {
      return;
    }
    this.progress.score -= cost;
    this.progress.autoFire = true;
    this.progress.autoFireOn = true;
    this.progressSave.save(this.progress);
    this.paintAutoFireMode();
    this.panel.refresh(this.view());
  }

  private buyAutoAim(): void {
    if (this.isPaused() || this.progress.autoAim) {
      return;
    }
    const cost = shopPrice(ProgressSave.autoAimCost());
    if (this.progress.score < cost) {
      return;
    }
    this.progress.score -= cost;
    this.progress.autoAim = true;
    this.progress.autoAimOn = true;
    this.progressSave.save(this.progress);
    this.panel.refresh(this.view());
  }

  private buyAutoShop(): void {
    if (this.isPaused() || this.progress.autoShop) {
      return;
    }
    const cost = shopPrice(ProgressSave.autoShopCost());
    if (this.progress.score < cost) {
      return;
    }
    this.progress.score -= cost;
    this.progress.autoShop = true;
    this.progress.autoShopOn = true;
    this.progressSave.save(this.progress);
    this.panel.refresh(this.view());
  }

  private buyAutoArtillery(): void {
    if (this.isPaused() || this.progress.autoArtillery) {
      return;
    }
    const cost = shopPrice(ProgressSave.autoArtilleryCost());
    if (this.progress.score < cost) {
      return;
    }
    this.progress.score -= cost;
    this.progress.autoArtillery = true;
    this.progress.autoArtilleryOn = true;
    this.progressSave.save(this.progress);
    this.panel.refresh(this.view());
  }

  private buyAutoMines(): void {
    if (this.isPaused() || this.progress.autoMines) {
      return;
    }
    const cost = shopPrice(ProgressSave.autoMinesCost());
    if (this.progress.score < cost) {
      return;
    }
    this.progress.score -= cost;
    this.progress.autoMines = true;
    this.progress.autoMinesOn = true;
    this.progressSave.save(this.progress);
    this.panel.refresh(this.view());
  }

  private buyAutoIon(): void {
    if (this.isPaused() || this.progress.autoIon) {
      return;
    }
    const cost = shopPrice(ProgressSave.autoIonCost());
    if (this.progress.score < cost) {
      return;
    }
    this.progress.score -= cost;
    this.progress.autoIon = true;
    this.progress.autoIonOn = true;
    this.progressSave.save(this.progress);
    this.panel.refresh(this.view());
  }

  private buyAutoBomber(): void {
    if (this.isPaused() || this.progress.autoBomber) {
      return;
    }
    const cost = shopPrice(ProgressSave.autoBomberCost());
    if (this.progress.score < cost) {
      return;
    }
    this.progress.score -= cost;
    this.progress.autoBomber = true;
    this.progress.autoBomberOn = true;
    this.progressSave.save(this.progress);
    this.panel.refresh(this.view());
  }

  private buyAutoWall(): void {
    if (this.isPaused() || this.progress.autoWall) {
      return;
    }
    const cost = shopPrice(ProgressSave.autoWallCost());
    if (this.progress.score < cost) {
      return;
    }
    this.progress.score -= cost;
    this.progress.autoWall = true;
    this.progress.autoWallOn = true;
    this.progressSave.save(this.progress);
    this.panel.refresh(this.view());
  }

  private buy(stat: Stat): void {
    if (this.isPaused()) {
      return;
    }
    const level = this.progress[stat];
    if (stat === 'blast' && level >= Tank.maxProgressBlastLevel) {
      return;
    }
    if (stat === 'knockback' && level >= Tank.maxProgressKnockbackLevel) {
      return;
    }
    if (stat === 'pierce' && level >= Tank.maxProgressPierceLevel) {
      return;
    }
    if (stat === 'absorb' && level >= Tank.maxAbsorbChance) {
      return;
    }
    if (stat === 'hp' && level >= TankBaseHp.maxLevel) {
      return;
    }
    if (stat === 'speed' && level >= Tank.maxProgressSpeedLevel) {
      return;
    }
    if (stat === 'flight' && level >= Tank.maxProgressFlightLevel) {
      return;
    }
    if (stat === 'bullets' && level >= MachineGun.maxBulletLevel) {
      return;
    }
    if (stat === 'mgSpeed' && level >= MachineGun.maxProgressSpeedLevel) {
      return;
    }
    if (stat === 'mgFlight' && level >= MachineGun.maxProgressFlightLevel) {
      return;
    }
    if (stat === 'laserShots' && level >= LaserDefense.maxShotLevel) {
      return;
    }
    if (stat === 'laserCooldown' && !LaserDefense.progressCooldownShortens(level)) {
      return;
    }
    if (stat === 'salvoRockets' && level >= RocketSalvo.maxRocketLevel) {
      return;
    }
    if (stat === 'artilleryShells' && level >= ArtilleryStrike.maxShellLevel) {
      return;
    }
    if (stat === 'minesCount' && level >= Mines.maxMineLevel) {
      return;
    }
    if (stat === 'artilleryCooldown' && !ArtilleryStrike.progressCooldownShortens(level)) {
      return;
    }
    if (stat === 'ionCooldown' && !IonCannon.progressCooldownShortens(level)) {
      return;
    }
    if (stat === 'ionSweep' && !IonCannon.progressSweepShortens(level)) {
      return;
    }
    if (stat === 'ionWidth' && !IonCannon.progressWidthGrows(level)) {
      return;
    }
    if (stat === 'minesCooldown' && !Mines.progressCooldownShortens(level)) {
      return;
    }
    if (stat === 'nuclearCooldown' && !NuclearStrike.progressCooldownShortens(level)) {
      return;
    }
    if (stat === 'wallDuration' && !EnergyWall.progressDurationLengthens(level)) {
      return;
    }
    if (stat === 'wallCooldown' && !EnergyWall.progressCooldownShortens(level)) {
      return;
    }
    if (stat === 'bomberCooldown' && !BomberStrike.progressCooldownShortens(level)) {
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
    if (stat === 'flight') {
      Tank.setProgressFlightLevel(this.progress.flight);
    }
    if (stat === 'mgSpeed') {
      MachineGun.setProgressSpeedLevel(this.progress.mgSpeed);
    }
    if (stat === 'mgFlight') {
      MachineGun.setProgressFlightLevel(this.progress.mgFlight);
    }
    if (stat === 'blast') {
      Tank.setProgressBlastLevel(this.progress.blast);
    }
    if (stat === 'knockback') {
      Tank.setProgressKnockbackLevel(this.progress.knockback);
    }
    if (stat === 'pierce') {
      Tank.setProgressPierceLevel(this.progress.pierce);
    }
    if (stat === 'absorb') {
      Tank.setAbsorbLevel(this.progress.absorb);
    }
    if (stat === 'hp') {
      this.progressSave.applyHp(this.progress.hp);
    }
    if (stat === 'salvoRockets') {
      RocketSalvo.setProgressRocketLevel(this.progress.salvoRockets);
    }
    if (stat === 'artilleryShells') {
      ArtilleryStrike.setProgressShellLevel(this.progress.artilleryShells);
    }
    if (stat === 'minesCount') {
      Mines.setProgressMineLevel(this.progress.minesCount);
    }
    if (stat === 'artilleryCooldown') {
      ArtilleryStrike.setProgressCooldownLevel(this.progress.artilleryCooldown);
    }
    if (stat === 'ionCooldown') {
      IonCannon.setProgressCooldownLevel(this.progress.ionCooldown);
    }
    if (stat === 'ionSweep') {
      IonCannon.setProgressSweepLevel(this.progress.ionSweep);
    }
    if (stat === 'ionWidth') {
      IonCannon.setProgressWidthLevel(this.progress.ionWidth);
    }
    if (stat === 'minesCooldown') {
      Mines.setProgressCooldownLevel(this.progress.minesCooldown);
    }
    if (stat === 'nuclearCooldown') {
      NuclearStrike.setProgressCooldownLevel(this.progress.nuclearCooldown);
    }
    if (stat === 'wallDuration') {
      EnergyWall.setProgressDurationLevel(this.progress.wallDuration);
    }
    if (stat === 'wallCooldown') {
      EnergyWall.setProgressCooldownLevel(this.progress.wallCooldown);
    }
    if (stat === 'bomberCooldown') {
      BomberStrike.setProgressCooldownLevel(this.progress.bomberCooldown);
    }
    if (stat === 'laserCooldown') {
      LaserDefense.setProgressCooldownLevel(this.progress.laserCooldown);
    }
    this.progressSave.save(this.progress);
    this.panel.refresh(this.view());
  }

  private view(): ProgressShopView {
    const score = this.progress.score;
    return {
      score,
      tabs: [
        this.tab('tank', 'Танк', [
          this.damageCard(score),
          this.blastCard(score),
          this.speedCard(score),
          this.flightCard(score),
          this.knockbackCard(score),
          this.pierceCard(score),
          this.absorbCard(score),
          this.hpCard(score),
          this.autoFireCard(score),
          this.autoAimCard(score),
        ]),
        this.tab('gun', 'Пулемёт', [
          this.bulletsCard(score),
          this.mgDamageCard(score),
          this.mgSpeedCard(score),
          this.mgFlightCard(score),
        ]),
        this.tab('wire', 'Колючая проволока', [this.wireDamageCard(score)]),
        this.tab('laser', 'Лазерная установка', [this.laserCard(score), this.laserCooldownCard(score)]),
        this.tab('salvo', 'РСЗО', [this.salvoRocketsCard(score), this.salvoDamageCard(score)]),
        this.tab('artillery', 'Артиллерия', [
          this.artilleryShellsCard(score),
          this.artilleryDamageCard(score),
          this.artilleryCooldownCard(score),
          this.autoArtilleryCard(score),
        ]),
        this.tab('ion', 'Ионная пушка', [
          this.ionDamageCard(score),
          this.ionCooldownCard(score),
          this.ionSweepCard(score),
          this.ionWidthCard(score),
          this.autoIonCard(score),
        ]),
        this.tab('mines', 'Мина', [
          this.minesCountCard(score),
          this.minesDamageCard(score),
          this.minesCooldownCard(score),
          this.autoMinesCard(score),
        ]),
        this.tab('nuclear', 'Атомный взрыв', [this.nuclearCooldownCard(score)]),
        this.tab('wall', 'Энергетическая стена', [
          this.wallDurationCard(score),
          this.wallCooldownCard(score),
          this.autoWallCard(score),
        ]),
        this.tab('bomber', 'Бомбардировщик', [
          this.bomberDamageCard(score),
          this.bomberCooldownCard(score),
          this.autoBomberCard(score),
        ]),
        this.tab('resources', 'Ресурсы', [
          this.coinsCard(score),
          this.pointsCard(score),
          this.autoShopCard(score),
        ]),
      ],
    };
  }

  private tab(id: string, label: string, cards: ProgressCardView[]): ProgressTabView {
    return { id, label, cards };
  }

  private autoFireCard(score: number): ProgressCardView {
    const owned = this.progress.autoFire;
    const price = shopPrice(ProgressSave.autoFireCost());
    return {
      title: 'автострельба',
      buy: () => this.buyAutoFire(),
      info: 'танк стреляет сам',
      cost: this.coin(price),
      open: !owned,
      owned,
      canBuy: !owned && score >= price,
    };
  }

  private autoAimCard(score: number): ProgressCardView {
    const owned = this.progress.autoAim;
    const price = shopPrice(ProgressSave.autoAimCost());
    return {
      title: 'автонаведение',
      buy: () => this.buyAutoAim(),
      info: owned ? 'держит одну цель' : 'башня сама держит врага',
      cost: this.coin(price),
      open: !owned,
      owned,
      canBuy: !owned && score >= price,
    };
  }

  private autoShopCard(score: number): ProgressCardView {
    const owned = this.progress.autoShop;
    const price = shopPrice(ProgressSave.autoShopCost());
    return {
      title: 'автопокупка',
      buy: () => this.buyAutoShop(),
      info: owned ? 'через 1 с на следующую волну' : 'магазин волны тратит монеты',
      cost: this.coin(price),
      open: !owned,
      owned,
      canBuy: !owned && score >= price,
    };
  }

  private autoArtilleryCard(score: number): ProgressCardView {
    const owned = this.progress.autoArtillery;
    const price = shopPrice(ProgressSave.autoArtilleryCost());
    return {
      title: 'автоприменение',
      buy: () => this.buyAutoArtillery(),
      info: 'удар сам через 1 с',
      cost: this.coin(price),
      open: !owned,
      owned,
      canBuy: !owned && score >= price,
    };
  }

  private autoIonCard(score: number): ProgressCardView {
    const owned = this.progress.autoIon;
    const price = shopPrice(ProgressSave.autoIonCost());
    return {
      title: 'автоприменение',
      buy: () => this.buyAutoIon(),
      info: 'луч сам через 1 с',
      cost: this.coin(price),
      open: !owned,
      owned,
      canBuy: !owned && score >= price,
    };
  }

  private autoBomberCard(score: number): ProgressCardView {
    const owned = this.progress.autoBomber;
    const price = shopPrice(ProgressSave.autoBomberCost());
    return {
      title: 'автоприменение',
      buy: () => this.buyAutoBomber(),
      info: 'пролёт сам через 1 с',
      cost: this.coin(price),
      open: !owned,
      owned,
      canBuy: !owned && score >= price,
    };
  }

  private autoWallCard(score: number): ProgressCardView {
    const owned = this.progress.autoWall;
    const price = shopPrice(ProgressSave.autoWallCost());
    return {
      title: 'автоприменение',
      buy: () => this.buyAutoWall(),
      info: 'гасит входящий выстрел',
      cost: this.coin(price),
      open: !owned,
      owned,
      canBuy: !owned && score >= price,
    };
  }

  private autoMinesCard(score: number): ProgressCardView {
    const owned = this.progress.autoMines;
    const price = shopPrice(ProgressSave.autoMinesCost());
    return {
      title: 'автоприменение',
      buy: () => this.buyAutoMines(),
      info: 'мины сами через 1 с',
      cost: this.coin(price),
      open: !owned,
      owned,
      canBuy: !owned && score >= price,
    };
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

  private flightCard(score: number): ProgressCardView {
    const level = this.progress.flight;
    const price = this.price(level);
    const now = Tank.flightMsFor(0, level);
    const next = Tank.flightMsFor(0, level + 1);
    const maxed = level >= Tank.maxProgressFlightLevel || next >= now;
    const flight = this.formatSeconds(now);
    const ahead = this.formatSeconds(next);
    return {
      title: '−0.10 с полёта',
      buy: () => this.buyFlight(),
      info: maxed ? `ур. ${level} · ${flight}` : `ур. ${level} · ${flight}→${ahead}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private knockbackCard(score: number): ProgressCardView {
    const level = this.progress.knockback;
    const price = this.knockbackPrice(level);
    const now = Tank.knockbackPxFor(0, level);
    const next = Tank.knockbackPxFor(0, level + 1);
    const maxed = level >= Tank.maxProgressKnockbackLevel;
    return {
      title: '+1 отталкивание',
      buy: () => this.buyKnockback(),
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private pierceCard(score: number): ProgressCardView {
    const level = this.progress.pierce;
    const price = this.piercePrice(level);
    const now = Tank.pierceChanceFor(0, level);
    const next = Tank.pierceChanceFor(0, level + 1);
    const maxed = level >= Tank.maxProgressPierceLevel;
    return {
      title: '+1% пробивание',
      buy: () => this.buyPierce(),
      info: maxed ? `ур. ${level} · ${now}%` : `ур. ${level} · ${now}%→${next}%`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private absorbCard(score: number): ProgressCardView {
    const level = this.progress.absorb;
    const price = this.absorbPrice(level);
    const now = Tank.absorbChanceFor(level);
    const next = Tank.absorbChanceFor(level + 1);
    const maxed = level >= Tank.maxAbsorbChance;
    return {
      title: '+1% поглощение урона',
      buy: () => this.buyAbsorb(),
      info: maxed ? `ур. ${level} · ${now}%` : `ур. ${level} · ${now}%→${next}%`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private hpCard(score: number): ProgressCardView {
    const level = this.progress.hp;
    const price = this.hpPrice(level);
    const now = TankBaseHp.hpForLevel(level);
    const next = TankBaseHp.hpForLevel(level + 1);
    const maxed = level >= TankBaseHp.maxLevel;
    return {
      title: '+10 здоровья',
      buy: () => this.buyHp(),
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
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

  private mgSpeedCard(score: number): ProgressCardView {
    const level = this.progress.mgSpeed;
    const price = this.price(level);
    const now = MachineGun.fireDelayFor(0, level);
    const next = MachineGun.fireDelayFor(0, level + 1);
    const maxed = level >= MachineGun.maxProgressSpeedLevel || next >= now;
    const delay = this.formatSeconds(now);
    const ahead = this.formatSeconds(next);
    return {
      title: '−0.01 с перезарядки',
      buy: () => this.buyMgSpeed(),
      info: maxed ? `ур. ${level} · ${delay}` : `ур. ${level} · ${delay}→${ahead}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private mgFlightCard(score: number): ProgressCardView {
    const level = this.progress.mgFlight;
    const price = this.price(level);
    const now = MachineGun.flightMsFor(0, level);
    const next = MachineGun.flightMsFor(0, level + 1);
    const maxed = level >= MachineGun.maxProgressFlightLevel || next >= now;
    const flight = this.formatSeconds(now);
    const ahead = this.formatSeconds(next);
    return {
      title: '−0.10 с полёта',
      buy: () => this.buyMgFlight(),
      info: maxed ? `ур. ${level} · ${flight}` : `ур. ${level} · ${flight}→${ahead}`,
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

  private laserCooldownCard(score: number): ProgressCardView {
    const level = this.progress.laserCooldown;
    const price = this.laserCooldownPrice(level);
    const now = LaserDefense.fireIntervalFor(level);
    const next = LaserDefense.fireIntervalFor(level + 1);
    const maxed = !LaserDefense.progressCooldownShortens(level);
    return {
      title: '−1 с перезарядки',
      buy: () => this.buyLaserCooldown(),
      info: maxed
        ? `ур. ${level} · ${LaserDefense.cooldownLabel(now)}`
        : `ур. ${level} · ${LaserDefense.cooldownLabel(now)}→${LaserDefense.cooldownLabel(next)}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private salvoRocketsCard(score: number): ProgressCardView {
    const level = this.progress.salvoRockets;
    const price = this.countPrice(level);
    const now = RocketSalvo.rocketCount(level);
    const next = RocketSalvo.rocketCount(level + 1);
    const maxed = level >= RocketSalvo.maxRocketLevel;
    return {
      title: '+1 ракета',
      buy: () => this.buySalvoRockets(),
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private salvoDamageCard(score: number): ProgressCardView {
    return this.damageCardFor(
      this.progress.salvoDamage,
      RocketSalvo.shop.damage,
      score,
      () => this.buySalvoDamage(),
    );
  }

  private bomberDamageCard(score: number): ProgressCardView {
    return this.damageCardFor(
      this.progress.bomberDamage,
      BomberStrike.shop.damage,
      score,
      () => this.buyBomberDamage(),
    );
  }

  private bomberCooldownCard(score: number): ProgressCardView {
    const level = this.progress.bomberCooldown;
    const price = this.bomberCooldownPrice(level);
    const now = BomberStrike.cooldownFor(BomberStrike.shopCooldownLevel, level);
    const next = BomberStrike.cooldownFor(BomberStrike.shopCooldownLevel, level + 1);
    const maxed = !BomberStrike.progressCooldownShortens(level);
    return {
      title: '−0,1 мин перезарядки',
      buy: () => this.buyBomberCooldown(),
      info: maxed
        ? `ур. ${level} · ${BomberStrike.cooldownLabel(now)}`
        : `ур. ${level} · ${BomberStrike.cooldownLabel(now)}→${BomberStrike.cooldownLabel(next)}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private artilleryDamageCard(score: number): ProgressCardView {
    return this.damageCardFor(
      this.progress.artilleryDamage,
      ArtilleryStrike.shop.damage,
      score,
      () => this.buyArtilleryDamage(),
    );
  }

  private ionDamageCard(score: number): ProgressCardView {
    return this.damageCardFor(
      this.progress.ionDamage,
      IonCannon.shop.damage,
      score,
      () => this.buyIonDamage(),
    );
  }

  private minesDamageCard(score: number): ProgressCardView {
    return this.damageCardFor(this.progress.minesDamage, Mines.shop.damage, score, () => this.buyMinesDamage());
  }

  private wireDamageCard(score: number): ProgressCardView {
    return this.damageCardFor(this.progress.wireDamage, BarbedWire.shop.damage, score, () => this.buyWireDamage());
  }

  // Потолка нет. Лестница та же, что у урона пули: 300, 600, 900…
  private damageCardFor(level: number, base: number, score: number, buy: () => void): ProgressCardView {
    const price = this.mgDamagePrice(level);
    const now = base + level;
    return {
      title: '+1 урон',
      buy,
      info: `ур. ${level} · ${now}→${now + 1}`,
      cost: this.coin(price),
      open: true,
      canBuy: score >= price,
    };
  }

  private artilleryShellsCard(score: number): ProgressCardView {
    const level = this.progress.artilleryShells;
    const price = this.countPrice(level);
    const now = ArtilleryStrike.shellCount(level);
    const next = ArtilleryStrike.shellCount(level + 1);
    const maxed = level >= ArtilleryStrike.maxShellLevel;
    return {
      title: '+1 снаряд',
      buy: () => this.buyArtilleryShells(),
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private minesCountCard(score: number): ProgressCardView {
    const level = this.progress.minesCount;
    const price = this.countPrice(level);
    const now = Mines.mineCount(level);
    const next = Mines.mineCount(level + 1);
    const maxed = level >= Mines.maxMineLevel;
    return {
      title: '+1 мина',
      buy: () => this.buyMinesCount(),
      info: maxed ? `ур. ${level} · ${now}` : `ур. ${level} · ${now}→${next}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private artilleryCooldownCard(score: number): ProgressCardView {
    const level = this.progress.artilleryCooldown;
    const price = this.artilleryCooldownPrice(level);
    const now = ArtilleryStrike.cooldownFor(ArtilleryStrike.shopCooldownLevel, level);
    const next = ArtilleryStrike.cooldownFor(ArtilleryStrike.shopCooldownLevel, level + 1);
    const maxed = !ArtilleryStrike.progressCooldownShortens(level);
    return {
      title: '−1 с перезарядки',
      buy: () => this.buyArtilleryCooldown(),
      info: maxed
        ? `ур. ${level} · ${ArtilleryStrike.cooldownLabel(now)}`
        : `ур. ${level} · ${ArtilleryStrike.cooldownLabel(now)}→${ArtilleryStrike.cooldownLabel(next)}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private ionCooldownCard(score: number): ProgressCardView {
    const level = this.progress.ionCooldown;
    const price = this.ionCooldownPrice(level);
    const now = IonCannon.cooldownFor(IonCannon.shopCooldownLevel, level);
    const next = IonCannon.cooldownFor(IonCannon.shopCooldownLevel, level + 1);
    const maxed = !IonCannon.progressCooldownShortens(level);
    return {
      title: '−1 с перезарядки',
      buy: () => this.buyIonCooldown(),
      info: maxed
        ? `ур. ${level} · ${IonCannon.cooldownLabel(now)}`
        : `ур. ${level} · ${IonCannon.cooldownLabel(now)}→${IonCannon.cooldownLabel(next)}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private ionSweepCard(score: number): ProgressCardView {
    const level = this.progress.ionSweep;
    const price = this.price(level);
    const now = IonCannon.sweepFor(IonCannon.shopSweepLevel, level);
    const next = IonCannon.sweepFor(IonCannon.shopSweepLevel, level + 1);
    const maxed = !IonCannon.progressSweepShortens(level);
    const sweep = this.formatSeconds(now);
    const ahead = this.formatSeconds(next);
    return {
      title: '−0.20 с хода',
      buy: () => this.buyIonSweep(),
      info: maxed ? `ур. ${level} · ${sweep}` : `ур. ${level} · ${sweep}→${ahead}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private ionWidthCard(score: number): ProgressCardView {
    const level = this.progress.ionWidth;
    const price = this.ionWidthPrice(level);
    const now = IonCannon.widthScale(level).toFixed(1);
    const next = IonCannon.widthScale(level + 1).toFixed(1);
    const maxed = !IonCannon.progressWidthGrows(level);
    return {
      title: '+10% ширины',
      buy: () => this.buyIonWidth(),
      info: maxed ? `ур. ${level} · ×${now}` : `ур. ${level} · ×${now}→×${next}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private minesCooldownCard(score: number): ProgressCardView {
    const level = this.progress.minesCooldown;
    const price = this.minesCooldownPrice(level);
    const now = Mines.cooldownFor(Mines.shopCooldownLevel, level);
    const next = Mines.cooldownFor(Mines.shopCooldownLevel, level + 1);
    const maxed = !Mines.progressCooldownShortens(level);
    return {
      title: '−1 с перезарядки',
      buy: () => this.buyMinesCooldown(),
      info: maxed
        ? `ур. ${level} · ${Mines.cooldownLabel(now)}`
        : `ур. ${level} · ${Mines.cooldownLabel(now)}→${Mines.cooldownLabel(next)}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private nuclearCooldownCard(score: number): ProgressCardView {
    const level = this.progress.nuclearCooldown;
    const price = this.nuclearCooldownPrice(level);
    const now = NuclearStrike.cooldownFor(NuclearStrike.shopCooldownLevel, level);
    const next = NuclearStrike.cooldownFor(NuclearStrike.shopCooldownLevel, level + 1);
    const maxed = !NuclearStrike.progressCooldownShortens(level);
    return {
      title: '−1 с перезарядки',
      buy: () => this.buyNuclearCooldown(),
      info: maxed
        ? `ур. ${level} · ${NuclearStrike.cooldownLabel(now)}`
        : `ур. ${level} · ${NuclearStrike.cooldownLabel(now)}→${NuclearStrike.cooldownLabel(next)}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private wallDurationCard(score: number): ProgressCardView {
    const level = this.progress.wallDuration;
    const price = this.wallDurationPrice(level);
    const now = EnergyWall.durationFor(EnergyWall.shopDurationLevel, level);
    const next = EnergyWall.durationFor(EnergyWall.shopDurationLevel, level + 1);
    const maxed = !EnergyWall.progressDurationLengthens(level);
    return {
      title: '+0.10 с длительности',
      buy: () => this.buyWallDuration(),
      info: maxed
        ? `ур. ${level} · ${EnergyWall.durationLabel(now)}`
        : `ур. ${level} · ${EnergyWall.durationLabel(now)}→${EnergyWall.durationLabel(next)}`,
      cost: maxed ? 'макс.' : this.coin(price),
      open: !maxed,
      canBuy: !maxed && score >= price,
    };
  }

  private wallCooldownCard(score: number): ProgressCardView {
    const level = this.progress.wallCooldown;
    const price = this.wallCooldownPrice(level);
    const now = EnergyWall.cooldownFor(EnergyWall.shopCooldownLevel, level);
    const next = EnergyWall.cooldownFor(EnergyWall.shopCooldownLevel, level + 1);
    const maxed = !EnergyWall.progressCooldownShortens(level);
    return {
      title: '−0.10 с перезарядки',
      buy: () => this.buyWallCooldown(),
      info: maxed
        ? `ур. ${level} · ${EnergyWall.cooldownLabel(now)}`
        : `ур. ${level} · ${EnergyWall.cooldownLabel(now)}→${EnergyWall.cooldownLabel(next)}`,
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

  private knockbackPrice(level: number): number {
    return shopPrice(ProgressSave.knockbackCost(level));
  }

  private piercePrice(level: number): number {
    return shopPrice(ProgressSave.pierceCost(level));
  }

  private absorbPrice(level: number): number {
    return shopPrice(ProgressSave.absorbCost(level));
  }

  private hpPrice(level: number): number {
    return shopPrice(ProgressSave.hpCost(level));
  }

  private countPrice(level: number): number {
    return shopPrice(ProgressSave.countCost(level));
  }

  private artilleryCooldownPrice(level: number): number {
    return shopPrice(ProgressSave.cost(level));
  }

  // Та же лестница, что у отката артиллерии: 500, 1000, 1500…
  private bomberCooldownPrice(level: number): number {
    return shopPrice(ProgressSave.cost(level));
  }

  private ionCooldownPrice(level: number): number {
    return shopPrice(ProgressSave.cost(level));
  }

  private ionWidthPrice(level: number): number {
    return shopPrice(ProgressSave.ionWidthCost(level));
  }

  private minesCooldownPrice(level: number): number {
    return shopPrice(ProgressSave.cost(level));
  }

  private nuclearCooldownPrice(level: number): number {
    return shopPrice(ProgressSave.cost(level));
  }

  private wallDurationPrice(level: number): number {
    return shopPrice(ProgressSave.wallDurationCost(level));
  }

  private wallCooldownPrice(level: number): number {
    return shopPrice(ProgressSave.wallCooldownCost(level));
  }

  private laserCooldownPrice(level: number): number {
    return shopPrice(ProgressSave.laserCooldownCost(level));
  }

  private costFor(stat: Stat, level: number): number {
    if (stat === 'bullets') {
      return this.bulletPrice(level);
    }
    if (
      stat === 'mgDamage' ||
      stat === 'salvoDamage' ||
      stat === 'artilleryDamage' ||
      stat === 'ionDamage' ||
      stat === 'minesDamage' ||
      stat === 'wireDamage' ||
      stat === 'bomberDamage'
    ) {
      return this.mgDamagePrice(level);
    }
    if (stat === 'knockback') {
      return this.knockbackPrice(level);
    }
    if (stat === 'pierce') {
      return this.piercePrice(level);
    }
    if (stat === 'absorb') {
      return this.absorbPrice(level);
    }
    if (stat === 'hp') {
      return this.hpPrice(level);
    }
    if (stat === 'salvoRockets' || stat === 'artilleryShells' || stat === 'minesCount') {
      return this.countPrice(level);
    }
    if (stat === 'artilleryCooldown') {
      return this.artilleryCooldownPrice(level);
    }
    if (stat === 'bomberCooldown') {
      return this.bomberCooldownPrice(level);
    }
    if (stat === 'ionCooldown') {
      return this.ionCooldownPrice(level);
    }
    if (stat === 'ionSweep') {
      return this.price(level);
    }
    if (stat === 'ionWidth') {
      return this.ionWidthPrice(level);
    }
    if (stat === 'minesCooldown') {
      return this.minesCooldownPrice(level);
    }
    if (stat === 'nuclearCooldown') {
      return this.nuclearCooldownPrice(level);
    }
    if (stat === 'wallDuration') {
      return this.wallDurationPrice(level);
    }
    if (stat === 'wallCooldown') {
      return this.wallCooldownPrice(level);
    }
    if (stat === 'laserCooldown') {
      return this.laserCooldownPrice(level);
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
