// Снаряды танка: выстрел, попадания, взрывы, проволока, лазер, огнемёт, РСЗО, арт удар, мины, атомный взрыв и контакт с базой.

import Phaser from 'phaser';
import { ArtilleryStrike, type ArtilleryFlight, type ArtilleryMark } from '../entities/ArtilleryStrike';
import { AssaultInfantry } from '../entities/AssaultInfantry';
import { BarbedWire } from '../entities/BarbedWire';
import { FlameTank } from '../entities/FlameTank';
import { Infantry } from '../entities/Infantry';
import { LaserDefense } from '../entities/LaserDefense';
import { MachineGun } from '../entities/MachineGun';
import { Mines, PlantedMine, type MineKeepOut } from '../entities/Mines';
import { NuclearStrike, type NuclearFlight } from '../entities/NuclearStrike';
import { PickupTruck } from '../entities/PickupTruck';
import { Rocket } from '../entities/Rocket';
import { RocketSalvo } from '../entities/RocketSalvo';
import { Tank } from '../entities/Tank/Tank';
import { GAME } from '../gameConfig';
import { airBurstAt } from '../gfx/airBurst';
import { craterReach } from '../gfx/craters';
import { clearBurns, ignite, inPatch, inStream, placeCampfires, syncFlameStream, syncScorchedEarth, tickBurns } from '../gfx/flame';
import { createShellBlast } from '../gfx/particles';
import { playArtilleryShot } from '../sounds/BoomSounds';
import type { BattleEffects } from '../sounds/BattleEffects';
import type { ShopController } from '../controllers/ShopController';
import type { CombatCallbacks } from '../types/CombatCallbacks';
import type { CombatSystem as Combat } from '../types/CombatSystem';
import type { WorldPoint } from '../types/WorldPoint';

type ArtillerySpot = { x: number; y: number; mark: ArtilleryMark };

// pierce — ближайший враг получит урон без взрыва, снаряд полетит дальше.
// passed — кого этот снаряд уже прошил. Повторно его не бьём и осколками того же разрыва не задеваем.
type ShellFlight = {
  pierce: boolean;
  passed: Infantry | null;
};

type FlamePoint = { x: number; y: number };

type FlameSweep = {
  elapsed: number;
  from: number;
  to: number;
  // Сколько костров дуги уже поставлено. Следующий встаёт, когда струя доходит до его места.
  placed: number;
  jets: Phaser.GameObjects.Sprite[];
  hit: Set<Infantry>;
};

type FlameMark = {
  point: FlamePoint;
  fire: Phaser.GameObjects.Sprite;
};

type FlamePatch = {
  marks: FlameMark[];
  // Основания дуги. Остаются, когда костры уже сжались и гаснет только земля.
  points: FlamePoint[];
  hit: Set<Infantry>;
  earth: Phaser.GameObjects.Container;
  // Общий остаток всей дуги. Пока струя идёт, поле пустое и костры не стареют.
  left?: number;
};

export class CombatSystem implements Combat {
  private readonly blast: Phaser.GameObjects.Particles.ParticleEmitter;
  protected readonly shells: Phaser.Physics.Arcade.Group;
  private readonly shellFlights = new Map<Phaser.Physics.Arcade.Image, ShellFlight>();
  private readonly mgShots: Phaser.Physics.Arcade.Group;
  private mgCooldown = 0;
  // Сколько пуль ещё осталось в текущей очереди. 0 — очередь не начата.
  private mgBurstLeft = 0;
  private laserCooldown = 0;
  // Сколько лучей ещё осталось в текущей очереди. 0 — очередь не начата.
  private laserBurstLeft = 0;
  private salvoCooldown = 0;
  private flameCooldownMs = 0;
  private flameAngle = 0;
  private flameSweep?: FlameSweep;
  private flamePatch?: FlamePatch;
  private artilleryCooldownMs = 0;
  private readonly strikeKeys: Phaser.Input.Keyboard.Key[] = [];
  // Клик по иконке на HUD. Сбрасывается в том же кадре, даже если удар ещё на перезарядке.
  private strikeFromIcon = false;
  private flights: ArtilleryFlight[] = [];
  private salvoTimers: Phaser.Time.TimerEvent[] = [];
  // Огни всех ещё летящих залпов. Новый залп старые не гасит: каждый тухнет в свой удар.
  private spots: ArtillerySpot[] = [];
  // Сброс отменяет залп, который ещё ждёт конца хлопка.
  private artilleryToken = 0;
  private minesCooldownMs = 0;
  private readonly mineKeys: Phaser.Input.Keyboard.Key[] = [];
  // Клик по иконке мин. Сбрасывается в том же кадре, даже если постановка ещё на перезарядке.
  private mineFromIcon = false;
  private mines: PlantedMine[] = [];
  private nuclearCooldownMs = 0;
  private readonly nuclearKeys: Phaser.Input.Keyboard.Key[] = [];
  // Клик по иконке атомного взрыва. Сбрасывается в том же кадре, даже если удар ещё на перезарядке.
  private nuclearFromIcon = false;
  private nuclearFlight?: NuclearFlight;
  // Сброс отменяет бомбу, которая ещё падает.
  private nuclearToken = 0;
  // Момент, когда гриб атомного удара уже погас. 0 — облака на поле нет.
  private nuclearCloudUntil = 0;

  constructor(
    protected readonly scene: Phaser.Scene,
    protected readonly tank: Tank,
    protected readonly infantry: Phaser.Physics.Arcade.Group,
    protected readonly shop: ShopController,
    private readonly enemyShots: Phaser.Physics.Arcade.Group,
    private readonly callbacks: CombatCallbacks,
    private readonly progressDamage: number,
    private readonly progressBlast: number,
    private readonly progressKnockback: number,
    private readonly progressPierce: number,
    private readonly mgBullets: number,
    private readonly progressMgDamage: number,
    private readonly progressSalvoDamage: number,
    private readonly progressArtilleryDamage: number,
    private readonly progressMinesDamage: number,
    private readonly progressWireDamage: number,
    private readonly laserShots: number,
    private readonly effects: BattleEffects,
  ) {
    this.blast = createShellBlast(scene);
    this.shells = scene.physics.add.group();
    this.mgShots = scene.physics.add.group();
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.strikeKeys.push(
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE),
      );
      this.mineKeys.push(
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO),
      );
      this.nuclearKeys.push(
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_THREE),
      );
    }
    // Дебаг-наследник здесь включает рамки хитбоксов. В обычной партии метод пуст.
    this.afterConstruct();
  }

  protected afterConstruct(): void { }

  get artilleryCooldown(): number {
    return this.artilleryCooldownMs;
  }

  setArtilleryCooldown(ms: number): void {
    this.artilleryCooldownMs = Math.min(this.artillerySpan(), Math.max(0, ms));
  }

  get minesCooldown(): number {
    return this.minesCooldownMs;
  }

  setMinesCooldown(ms: number): void {
    this.minesCooldownMs = Math.min(this.minesSpan(), Math.max(0, ms));
  }

  get nuclearCooldown(): number {
    return this.nuclearCooldownMs;
  }

  get flameCooldown(): number {
    return this.flameCooldownMs;
  }

  setFlameCooldown(ms: number): void {
    this.flameCooldownMs = Math.max(0, ms);
  }

  setNuclearCooldown(ms: number): void {
    this.nuclearCooldownMs = Math.min(this.nuclearSpan(), Math.max(0, ms));
  }

  // Купленный откат. Круг на иконке и следующий вызов берут одно число.
  private artillerySpan(): number {
    return ArtilleryStrike.cooldownFor(this.shop.artilleryCooldownLevel);
  }

  private minesSpan(): number {
    return Mines.cooldownFor(this.shop.minesCooldownLevel);
  }

  private nuclearSpan(): number {
    return NuclearStrike.cooldownFor(this.shop.nuclearCooldownLevel);
  }

  // Сколько миллисекунд гриб ещё будет на поле. Магазин волны ждёт это, чтобы не закрыть взрыв.
  nuclearCloudLeft(): number {
    return Math.max(0, this.nuclearCloudUntil - this.scene.time.now);
  }

  // Иконка на HUD просит удар. Сработает в tickArtillery, если бой идёт и перезарядка кончилась.
  requestArtillery(): void {
    this.strikeFromIcon = true;
  }

  // Иконка мин на HUD. Сработает в tickMines, если бой идёт и перезарядка кончилась.
  requestMines(): void {
    this.mineFromIcon = true;
  }

  // Иконка атомного взрыва на HUD. Сработает в tickNuclear, если бой идёт и перезарядка кончилась.
  requestNuclear(): void {
    this.nuclearFromIcon = true;
  }

  clearProjectiles(): void {
    this.strikeFromIcon = false;
    this.mineFromIcon = false;
    this.nuclearFromIcon = false;
    this.shells.clear(true, true);
    this.shellFlights.clear();
    this.mgShots.clear(true, true);
    this.mgBurstLeft = 0;
    this.cancelArtillery();
    this.cancelNuclear();
    this.clearMines();
    this.stopFlame();
    clearBurns();
  }

  setupOverlap(): void {
    this.scene.physics.add.overlap(
      this.shells,
      this.infantry,
      (shellObj, infObj) => {
        const shell = this.asImage(shellObj);
        const unit = this.asInfantry(infObj);
        if (!shell || !unit) {
          return;
        }
        this.deliverShell(shell, unit);
      },
      undefined,
      this,
    );
  }

  // Дебаг глушит пушку с пулемётом, лазер, огнемёт или РСЗО. В обычной партии все стреляют.
  protected weaponLive(kind: 'tank' | 'laser' | 'flame' | 'salvo'): boolean {
    const live = { tank: true, laser: true, flame: true, salvo: true };
    return live[kind];
  }

  shoot(): void {
    if (!this.weaponLive('tank')) {
      return;
    }
    const shot = this.tank.tryFire();
    if (shot) {
      this.fireShell(shot.x, shot.y, shot.angle);
      this.effects.tankShot.play();
    }
  }

  // ЛКМ и автострельба — здесь, чтобы сцена не знала про покупки магазина.
  protected handleFireInput(pointer: Phaser.Input.Pointer): void {
    if (this.shop.autoFire.enabled || pointer.leftButtonDown()) {
      this.shoot();
    }
  }

  // Перезарядка идёт и в магазине. Выстрел — только в бою, по клавише 1 или по иконке.
  tickArtillery(delta: number, canFire: boolean): void {
    if (!this.shop.artilleryOwned) {
      this.strikeFromIcon = false;
      return;
    }
    // Покупка короче текущего ожидания: дольше нового отката ждать не нужно.
    const artillerySpan = this.artillerySpan();
    this.artilleryCooldownMs = Math.min(artillerySpan, Math.max(0, this.artilleryCooldownMs - delta));
    if (!this.strikePressed()) {
      return;
    }
    this.useArtillery(canFire);
  }

  protected useArtillery(canFire: boolean): void {
    if (!canFire || this.artilleryCooldownMs > 0) {
      return;
    }
    this.artilleryCooldownMs = this.artillerySpan();
    this.launchArtillery();
  }

  // Перезарядка идёт и в магазине. Постановка — только в бою, по клавише 2 или по иконке.
  // Уже лежащие мины в магазине молчат: физика на паузе, пехота не шагает.
  tickMines(delta: number, canFire: boolean): void {
    if (!this.shop.minesOwned) {
      this.mineFromIcon = false;
      return;
    }
    // Покупка короче текущего ожидания: дольше нового отката ждать не нужно.
    const minesSpan = this.minesSpan();
    this.minesCooldownMs = Math.min(minesSpan, Math.max(0, this.minesCooldownMs - delta));
    const pressed = this.minePressed();
    if (canFire) {
      this.touchMines();
    }
    if (!pressed) {
      return;
    }
    this.useMines(canFire);
  }

  protected useMines(canFire: boolean): void {
    if (!canFire || this.minesCooldownMs > 0) {
      return;
    }
    if (this.layMines()) {
      this.minesCooldownMs = this.minesSpan();
    }
  }

  // Перезарядка идёт и в магазине. Взрыв — только в бою, по клавише 3 или по иконке.
  tickNuclear(delta: number, canFire: boolean): void {
    if (!this.shop.nuclearOwned) {
      this.nuclearFromIcon = false;
      return;
    }
    // Покупка короче текущего ожидания: дольше нового отката ждать не нужно.
    const span = this.nuclearSpan();
    this.nuclearCooldownMs = Math.min(span, Math.max(0, this.nuclearCooldownMs - delta));
    if (!this.nuclearPressed()) {
      return;
    }
    this.useNuclear(canFire);
  }

  protected useNuclear(canFire: boolean): void {
    if (!canFire || this.nuclearCooldownMs > 0) {
      return;
    }
    this.nuclearCooldownMs = this.nuclearSpan();
    this.launchNuclear();
  }

  private strikePressed(): boolean {
    const fromIcon = this.strikeFromIcon;
    this.strikeFromIcon = false;
    return fromIcon || this.strikeKeys.some((key) => Phaser.Input.Keyboard.JustDown(key));
  }

  private minePressed(): boolean {
    const fromIcon = this.mineFromIcon;
    this.mineFromIcon = false;
    return fromIcon || this.mineKeys.some((key) => Phaser.Input.Keyboard.JustDown(key));
  }

  private nuclearPressed(): boolean {
    const fromIcon = this.nuclearFromIcon;
    this.nuclearFromIcon = false;
    return fromIcon || this.nuclearKeys.some((key) => Phaser.Input.Keyboard.JustDown(key));
  }

  // true — хотя бы одна мина встала. Пустое поле кулдаун не тратит.
  private layMines(): boolean {
    const occupied = this.mines.map((mine) => ({ x: mine.x, y: mine.y }));
    const spots = Mines.spots(this.mineKeepOut(), occupied);
    if (spots.length === 0) {
      return false;
    }
    for (const spot of spots) {
      this.mines.push(Mines.plant(this.scene, spot.x, spot.y));
    }
    return true;
  }

  private touchMines(): void {
    for (const mine of [...this.mines]) {
      if (!mine.isArmed || !this.stepsOn(mine)) {
        continue;
      }
      this.detonateMine(mine);
    }
  }

  // Полоса корпуса на всю высоту поля: мина не садится ни на танк, ни выше или ниже него.
  // Проволока добавляется, только когда она уже куплена. Отступ — половина корпуса мины.
  private mineKeepOut(): MineKeepOut[] {
    const pad = Mines.footprint;
    const hull = Tank.hullBox();
    const left = this.tank.x + hull.x;
    const field = Mines.field;
    const zones: MineKeepOut[] = [
      {
        minX: left - pad,
        maxX: left + hull.w + pad,
        minY: field.minY,
        maxY: field.maxY,
      },
    ];
    if (this.shop.wire) {
      const bounds = BarbedWire.bounds;
      // Центр мины так, чтобы общая чаша не ушла за проволоку.
      zones.push({
        minX: bounds.x - pad,
        maxX: Math.ceil(bounds.face + craterReach()),
        minY: bounds.top - pad,
        maxY: bounds.bottom + pad,
      });
    }
    return zones;
  }

  // Ширина хитбокса, не доля картинки. У пикапа нос далеко впереди якоря:
  // мина под бампером уже на корпусе, пока точка ног ещё в стороне.
  private stepsOn(mine: PlantedMine): boolean {
    const pad = Mines.footprint;
    return (this.infantry.getChildren() as Infantry[]).some((unit) => {
      if (!unit.active || unit.reachedWall) {
        return false;
      }
      const dx = this.hullGapX(unit, mine.x);
      const dy = Math.abs(unit.y - mine.y);
      return dx <= pad && dy <= 22 + pad;
    });
  }

  private detonateMine(mine: PlantedMine): void {
    this.mines = this.mines.filter((item) => item !== mine);
    const { x, y } = mine;
    mine.destroy();
    Mines.boom(this.scene, x, y);
    const radius = Mines.shop.blastRadius;
    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (!unit.active || unit.reachedWall) {
        return;
      }
      if (this.inBlast(unit, x, y, radius)) {
        this.hurtInfantry(unit, this.minesDamage(), false, { x, y });
      }
    });
  }

  // Круг до корпуса, не до одной точки торса. Нос пикапа впереди якоря и иначе выпадает из взрыва.
  private inBlast(unit: Infantry, x: number, y: number, radius: number): boolean {
    const gap = this.hullGapX(unit, x);
    const torso = this.torsoPoint(unit);
    return Math.hypot(gap, unit.y - y) <= radius || Math.hypot(gap, torso.y - y) <= radius;
  }

  // 0 — вертикаль точки уже над силуэтом. Иначе расстояние до ближайшего края хитбокса.
  // Ширину берём из setSize и масштаба спрайта: body.width до первого шага физики ещё без масштаба.
  private hullGapX(unit: Infantry, x: number): number {
    const body = unit.body as Phaser.Physics.Arcade.Body;
    const left = unit.x + unit.scaleX * (body.offset.x - unit.displayOriginX);
    const right = left + body.sourceWidth * Math.abs(unit.scaleX);
    if (x < left) {
      return left - x;
    }
    if (x > right) {
      return x - right;
    }
    return 0;
  }

  captureMines(): { x: number; y: number }[] {
    return this.mines.map((mine) => ({ x: Math.round(mine.x), y: Math.round(mine.y) }));
  }

  restoreMines(spots: { x: number; y: number }[]): void {
    this.clearMines();
    for (const spot of spots) {
      this.mines.push(Mines.restore(this.scene, spot.x, spot.y));
    }
  }

  private clearMines(): void {
    for (const mine of this.mines) {
      mine.destroy();
    }
    this.mines = [];
  }

  // Сразу хлопок. Снаряды падают, когда он доиграл: пауза afterShotMs сейчас нулевая.
  private launchArtillery(): void {
    const token = this.artilleryToken;
    const spots = this.armSpots();
    const armed = playArtilleryShot(this.scene, () => this.queueShells(token, spots));
    if (!armed) {
      this.queueShells(token, spots);
    }
  }

  private queueShells(token: number, spots: ArtillerySpot[]): void {
    if (token !== this.artilleryToken) {
      return;
    }
    const timer = this.scene.time.delayedCall(ArtilleryStrike.shop.afterShotMs, () => {
      this.salvoTimers = this.salvoTimers.filter((item) => item !== timer);
      if (token !== this.artilleryToken) {
        return;
      }
      this.releaseShells(spots);
    });
    this.salvoTimers.push(timer);
  }

  // Огни этого залпа. Уже горящие от прошлого вызова не трогаем.
  private armSpots(): ArtillerySpot[] {
    const minX = Math.ceil(BarbedWire.bounds.face + craterReach());
    const spots = ArtilleryStrike.impacts(minX).map((point) => ({
      x: point.x,
      y: point.y,
      mark: ArtilleryStrike.mark(this.scene, point.x, point.y),
    }));
    this.spots.push(...spots);
    return spots;
  }

  private releaseShells(spots: ArtillerySpot[]): void {
    const gap = ArtilleryStrike.shop.gapMs;
    spots.forEach((spot, index) => {
      const timer = this.scene.time.delayedCall(index * gap, () => {
        this.salvoTimers = this.salvoTimers.filter((item) => item !== timer);
        const flight = ArtilleryStrike.drop(this.scene, spot.x, spot.y, () => {
          this.flights = this.flights.filter((item) => item !== flight);
          this.retireSpot(spot);
          this.detonateArtillery(spot.x, spot.y);
        });
        this.flights.push(flight);
      });
      this.salvoTimers.push(timer);
    });
  }

  private retireSpot(spot: ArtillerySpot): void {
    spot.mark.clear();
    this.spots = this.spots.filter((item) => item !== spot);
  }

  private detonateArtillery(x: number, y: number): void {
    ArtilleryStrike.boom(this.scene, x, y);
    const radius = ArtilleryStrike.shop.blastRadius;
    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (!unit.active || unit.reachedWall) {
        return;
      }
      if (this.inBlast(unit, x, y, radius)) {
        this.hurtInfantry(unit, this.artilleryDamage(), false, { x, y });
      }
    });
  }

  private launchNuclear(): void {
    const token = this.nuclearToken;
    this.nuclearFlight = NuclearStrike.drop(this.scene, () => {
      this.nuclearFlight = undefined;
      if (token !== this.nuclearToken) {
        return;
      }
      this.detonateNuclear();
    });
  }

  private detonateNuclear(): void {
    NuclearStrike.boom(this.scene);
    this.nuclearCloudUntil = this.scene.time.now + NuclearStrike.cloudMs;
    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (!this.onScreen(unit)) {
        return;
      }
      // Крик на каждого солдата забил бы взрыв. Монеты всё равно начисляются.
      if (unit.hit(1_000_000)) {
        this.callbacks.onKill(unit.coinReward);
        unit.kill();
      }
    });
  }

  // Правее кадра враг ещё не вошёл: взрыв его не берёт. Труп уже не боец.
  private onScreen(unit: Infantry): boolean {
    if (!unit.active || unit.reachedWall) {
      return false;
    }
    const left = unit.x - unit.displayWidth * unit.originX;
    const right = left + unit.displayWidth;
    const top = unit.y - unit.displayHeight * unit.originY;
    const bottom = top + unit.displayHeight;
    return right > 0 && left < GAME.width && bottom > 0 && top < GAME.bannerY;
  }

  private cancelNuclear(): void {
    this.nuclearToken += 1;
    this.nuclearFlight?.cancel();
    this.nuclearFlight = undefined;
  }

  private cancelArtillery(): void {
    this.artilleryToken += 1;
    for (const timer of this.salvoTimers) {
      timer.remove(false);
    }
    this.salvoTimers = [];
    for (const flight of this.flights) {
      flight.cancel();
    }
    this.flights = [];
    for (const spot of this.spots) {
      spot.mark.clear();
    }
    this.spots = [];
  }

  tick(delta: number, allowFire = true): void {
    if (allowFire) {
      this.handleFireInput(this.scene.input.activePointer);
    }
    this.resolveShellHits();
    this.cleanupShells();
    this.tickMachineGun(delta);
    this.tickLaser(delta);
    this.tickFlame(delta);
    this.tickSalvo(delta);
    this.resolveMgHits();
    this.cleanupMgShots();
    this.snareOnWire(delta);
    this.checkBaseReach();
  }

  detonateShell(shell: Phaser.Physics.Arcade.Image, direct?: Infantry): void {
    if (!shell.active) {
      return;
    }

    const passed = this.shellFlights.get(shell)?.passed ?? null;
    this.shellFlights.delete(shell);
    const x = shell.x;
    const y = shell.y;
    shell.destroy();
    this.playBlast(x, y);
    // Один удар на снаряд. Осколки взрыва второй раз не звенят.
    this.effects.impacts.play();

    if (direct) {
      this.shellHit(direct);
    }

    const blastRadius = this.blastRadius();
    if (blastRadius <= 0) {
      return;
    }

    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (unit === direct || unit === passed || !unit.active || unit.reachedWall) {
        return;
      }
      const torso = this.torsoPoint(unit);
      if (Phaser.Math.Distance.Between(x, y, torso.x, torso.y) <= blastRadius) {
        this.shellHit(unit);
      }
    });
  }

  // Урон снаряда и отталкивание из магазинов. Мёртвого уже не двигаем.
  private shellHit(unit: Infantry): void {
    this.hurtInfantry(unit);
    if (!unit.active || unit.reachedWall) {
      return;
    }
    const push = this.shellKnockback();
    if (push > 0) {
      unit.knockBack(push);
    }
  }

  private resolveShellHits(): void {
    const shells = this.shells.getChildren() as Phaser.Physics.Arcade.Image[];
    const units = this.infantry.getChildren() as Infantry[];

    for (const shell of shells) {
      if (!shell.active) {
        continue;
      }
      const flight = this.shellFlights.get(shell);
      const hit: Infantry[] = [];
      for (const unit of units) {
        if (!unit.active || unit.reachedWall) {
          continue;
        }
        if (flight?.passed === unit) {
          continue;
        }
        if (!this.shellHitsUnit(shell, unit)) {
          continue;
        }
        hit.push(unit);
      }
      // Ближний забирает прошивку, следующий по дистанции — разрыв.
      hit.sort((a, b) => this.hitDistance(shell, a) - this.hitDistance(shell, b));
      for (const unit of hit) {
        if (!shell.active) {
          break;
        }
        this.deliverShell(shell, unit);
      }
    }
  }

  // Прошивка тратит заряд и не рвёт снаряд. Обычное касание взрывается как раньше.
  private deliverShell(shell: Phaser.Physics.Arcade.Image, unit: Infantry): void {
    if (!shell.active || !unit.active || unit.reachedWall) {
      return;
    }
    if (!this.shellHitsUnit(shell, unit)) {
      return;
    }
    const flight = this.shellFlights.get(shell);
    if (flight?.passed === unit) {
      return;
    }
    if (flight?.pierce) {
      flight.pierce = false;
      flight.passed = unit;
      this.hurtInfantry(unit);
      return;
    }
    this.detonateShell(shell, unit);
  }

  private cleanupShells(): void {
    this.shells.getChildren().forEach((obj) => {
      const shell = obj as Phaser.Physics.Arcade.Image;
      if (shell.x > GAME.width + 40 || shell.x < 0 || shell.y < 0 || shell.y > GAME.bannerY) {
        this.shellFlights.delete(shell);
        shell.destroy();
      }
    });
  }

  // Очередь вдоль ствола. Между пулями короткая пауза, после последней — перезарядка.
  // Без покупок это 3 с. Магазины укорачивают её до 0,20 с.
  private tickMachineGun(delta: number): void {
    const mg = this.shop.machineGun;
    if (!mg) {
      return;
    }
    this.mgCooldown = Math.max(0, this.mgCooldown - delta);
    if (this.mgCooldown > 0 || !this.weaponLive('tank')) {
      return;
    }
    if (this.mgBurstLeft <= 0) {
      this.mgBurstLeft = this.mgBullets;
    }
    this.mgBurstLeft -= 1;
    const shot = mg.muzzle();
    this.fireMgBullet(shot.x, shot.y, shot.angle);
    mg.dropCasing();
    this.effects.tankMgShot.play();
    this.mgCooldown =
      this.mgBurstLeft > 0 ? MachineGun.burstGap : MachineGun.fireDelayFor(this.shop.mgFireRateLevel);
  }

  // Очередь лучей. Между лучами короткая пауза, после последнего — перезарядка установки.
  // Магазин очков укорачивает её до 1 с.
  // Каждый луч берёт другую ракету, которая уже летит minFlightMs: предыдущая уже сбита.
  // Пока очередь не начата, пустое небо перезарядку не тратит. Пустой слот уже начатой очереди проходит молча.
  private tickLaser(delta: number): void {
    const laser = this.shop.laser;
    if (!laser) {
      return;
    }
    this.laserCooldown = Math.max(0, this.laserCooldown - delta);
    if (this.laserCooldown > 0 || !this.weaponLive('laser')) {
      return;
    }
    const rocket = this.randomRocket();
    if (this.laserBurstLeft <= 0) {
      if (!rocket) {
        return;
      }
      this.laserBurstLeft = this.laserShots;
    }
    if (rocket) {
      this.shootLaser(laser, rocket);
    }
    this.laserBurstLeft -= 1;
    this.laserCooldown = this.laserBurstLeft > 0 ? LaserDefense.burstGap : LaserDefense.fireIntervalFor();
  }

  private shootLaser(laser: LaserDefense, rocket: Rocket): void {
    const x = rocket.x;
    const y = rocket.y;
    laser.fireAt(x, y);
    this.effects.laserShot.play();
    rocket.destroy();
    airBurstAt(this.scene, x, y);
    this.effects.rocketBurst.play();
  }

  // Раз в 10 секунд башня ведёт струю сверху вниз на четверть длины поля.
  // Струя бьёт один раз и поджигает картинку. Костры дуги гаснут вместе через две секунды, сжимаясь к основанию.
  private tickFlame(delta: number): void {
    tickBurns(this.scene, delta);
    const flame = this.shop.flame;
    if (!flame) {
      this.stopFlame();
      return;
    }
    this.flameCooldownMs = Math.max(0, this.flameCooldownMs - delta);
    if (this.flameSweep) {
      this.advanceSweep(flame, delta);
    } else {
      this.easeAim(flame, delta);
      if (this.flameCooldownMs <= 0 && this.weaponLive('flame')) {
        this.flameCooldownMs = FlameTank.shop.fireIntervalMs;
        this.beginSweep(flame);
      }
    }
    this.tickPatch(delta);
  }

  private beginSweep(flame: FlameTank): void {
    const length = GAME.width * FlameTank.shop.reach;
    const muzzle = flame.muzzle();
    const from = this.aimAt(muzzle.y, length, 16);
    const to = this.aimAt(muzzle.y, length, GAME.bannerY - 8);
    this.clearPatch();
    this.flameSweep = { elapsed: 0, from, to, placed: 0, jets: [], hit: new Set() };
    this.advanceSweep(flame, 0);
  }

  private advanceSweep(flame: FlameTank, delta: number): void {
    const sweep = this.flameSweep;
    if (!sweep) {
      return;
    }
    sweep.elapsed += delta;
    const span = Math.max(1, FlameTank.shop.sweepMs);
    const along = Math.min(1, sweep.elapsed / span);
    this.dropFires(flame, sweep, along);
    const angle = Phaser.Math.Linear(sweep.from, sweep.to, along);
    this.flameAngle = angle;
    flame.setAim(angle);
    const from = flame.muzzle();
    const to = this.flameTip(from, angle);
    const length = GAME.width * FlameTank.shop.reach;
    sweep.jets = syncFlameStream(this.scene, sweep.jets, from, angle, length);
    this.scorchStream(from, to, sweep.hit);
    if (along < 1) {
      return;
    }
    sweep.jets.forEach((jet) => jet.destroy());
    this.flameSweep = undefined;
  }

  // Костёр встаёт на конце струи в момент, когда она доходит до этой точки дуги.
  private dropFires(flame: FlameTank, sweep: FlameSweep, along: number): void {
    const steps = 12;
    while (sweep.placed <= steps && along >= sweep.placed / steps) {
      const angle = Phaser.Math.Linear(sweep.from, sweep.to, sweep.placed / steps);
      flame.setAim(angle);
      const tip = this.flameTip(flame.muzzle(), angle);
      const [fire] = placeCampfires(this.scene, [tip], sweep.placed);
      if (fire) {
        if (!this.flamePatch) {
          this.flamePatch = {
            marks: [],
            points: [],
            hit: new Set(),
            earth: this.scene.add.container(0, 0).setDepth(1),
          };
        }
        this.flamePatch.marks.push({ point: tip, fire });
        this.flamePatch.points.push(tip);
        syncScorchedEarth(this.scene, this.flamePatch.earth, this.flamePatch.points);
      }
      sweep.placed += 1;
    }
  }

  private tickPatch(delta: number): void {
    const patch = this.flamePatch;
    if (!patch) {
      return;
    }
    if (this.flameSweep) {
      this.scorchPatch(patch);
      return;
    }
    const fade = FlameTank.shop.patchFadeMs;
    const earthFade = FlameTank.shop.earthFadeMs;
    if (patch.left === undefined) {
      patch.left = FlameTank.shop.patchMs + fade + earthFade;
    }
    patch.left -= delta;
    if (patch.left <= 0) {
      this.clearPatch();
      return;
    }
    if (patch.left > fade + earthFade) {
      this.scorchPatch(patch);
      return;
    }
    this.applyPatchLook();
  }

  // Сжатие костров и гашение земли по общему остатку. Восстановление из сохранения зовёт то же.
  private applyPatchLook(): void {
    const patch = this.flamePatch;
    if (!patch || patch.left === undefined) {
      return;
    }
    const fade = FlameTank.shop.patchFadeMs;
    const earthFade = FlameTank.shop.earthFadeMs;
    if (patch.left > earthFade) {
      const scale = Math.min(1, (patch.left - earthFade) / fade);
      for (const mark of patch.marks) {
        mark.fire.setScale(scale);
      }
      return;
    }
    for (const mark of patch.marks) {
      mark.fire.destroy();
    }
    patch.marks = [];
    patch.earth.setAlpha(Math.max(0, patch.left) / earthFade);
  }

  // Точки дуги и остаток срока. Пока струя ещё идёт, срок ещё не начат — пишем полный.
  captureFlameWall(): { points: FlamePoint[]; left: number } | null {
    const patch = this.flamePatch;
    if (!patch || patch.points.length === 0) {
      return null;
    }
    const full = FlameTank.shop.patchMs + FlameTank.shop.patchFadeMs + FlameTank.shop.earthFadeMs;
    const left = patch.left ?? full;
    if (left <= 0) {
      return null;
    }
    return {
      points: patch.points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })),
      left: Math.round(left),
    };
  }

  restoreFlameWall(saved: { points: FlamePoint[]; left: number } | null): void {
    this.clearPatch();
    if (!saved || saved.points.length === 0 || saved.left <= 0) {
      return;
    }
    const earth = this.scene.add.container(0, 0).setDepth(1);
    const marks: FlameMark[] = [];
    if (saved.left > FlameTank.shop.earthFadeMs) {
      const fires = placeCampfires(this.scene, saved.points);
      saved.points.forEach((point, index) => {
        const fire = fires[index];
        if (fire) {
          marks.push({ point, fire });
        }
      });
    }
    this.flamePatch = {
      marks,
      points: saved.points.map((point) => ({ x: point.x, y: point.y })),
      hit: new Set(),
      earth,
      left: saved.left,
    };
    syncScorchedEarth(this.scene, earth, this.flamePatch.points);
    this.applyPatchLook();
  }

  private easeAim(flame: FlameTank, delta: number): void {
    const step = (delta / 1000) * 2.4;
    if (this.flameAngle > 0) {
      this.flameAngle = Math.max(0, this.flameAngle - step);
    } else if (this.flameAngle < 0) {
      this.flameAngle = Math.min(0, this.flameAngle + step);
    }
    flame.setAim(this.flameAngle);
  }

  private scorchStream(
    from: { x: number; y: number },
    to: { x: number; y: number },
    hit: Set<Infantry>,
  ): void {
    for (const unit of this.infantry.getChildren() as Infantry[]) {
      if (!this.flameTarget(unit) || hit.has(unit)) {
        continue;
      }
      const center = unit.hitCenter();
      if (!inStream(center.x, center.y, from, to)) {
        continue;
      }
      hit.add(unit);
      this.hurtInfantry(unit, FlameTank.shop.streamDamage + this.shop.flameDamageLevel);
      if (unit.active) {
        ignite(this.scene, unit, FlameTank.shop.burnMs);
      }
    }
  }

  private scorchPatch(patch: FlamePatch): void {
    for (const unit of this.infantry.getChildren() as Infantry[]) {
      if (!this.flameTarget(unit) || patch.hit.has(unit)) {
        continue;
      }
      const center = unit.hitCenter();
      if (!inPatch(center.x, center.y, patch.points)) {
        continue;
      }
      patch.hit.add(unit);
      this.hurtInfantry(unit, FlameTank.shop.patchDamage + this.shop.flameDamageLevel);
    }
  }

  private flameTarget(unit: Infantry): boolean {
    return unit.active && !unit.reachedWall;
  }

  private flameTip(from: { x: number; y: number }, angle: number): { x: number; y: number } {
    const length = GAME.width * FlameTank.shop.reach;
    return {
      x: from.x + Math.cos(angle) * length,
      y: from.y + Math.sin(angle) * length,
    };
  }

  private aimAt(muzzleY: number, length: number, y: number): number {
    const dy = Phaser.Math.Clamp(y - muzzleY, -length, length);
    const angle = Math.asin(dy / Math.max(length, 1));
    return Phaser.Math.Clamp(angle, -FlameTank.aimLimit, FlameTank.aimLimit);
  }

  private clearPatch(): void {
    this.flamePatch?.marks.forEach((mark) => mark.fire.destroy());
    this.flamePatch?.earth.destroy();
    this.flamePatch = undefined;
  }

  private stopFlame(): void {
    this.flameSweep?.jets.forEach((jet) => jet.destroy());
    this.flameSweep = undefined;
    this.clearPatch();
    this.flameAngle = 0;
    this.shop.flame?.setAim(0);
  }

  // Раз в fireIntervalMs три ракеты в случайные точки. Сейчас это 5 с. Дуга и огонь в шахтах — у установки.
  private tickSalvo(delta: number): void {
    const salvo = this.shop.salvo;
    if (!salvo) {
      return;
    }
    this.salvoCooldown = Math.max(0, this.salvoCooldown - delta);
    if (this.salvoCooldown > 0 || !this.weaponLive('salvo')) {
      return;
    }
    salvo.fire(RocketSalvo.impacts(), (x, y) => this.detonateSalvo(x, y));
    this.salvoCooldown = RocketSalvo.shop.fireIntervalMs;
  }

  // Тот же разрыв, что у артиллерии: кадры, воронка, звук и тряска камеры.
  private detonateSalvo(x: number, y: number): void {
    ArtilleryStrike.boom(this.scene, x, y);
    const radius = RocketSalvo.shop.blastRadius;
    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (!unit.active || unit.reachedWall) {
        return;
      }
      if (this.inBlast(unit, x, y, radius)) {
        this.hurtInfantry(unit, this.salvoDamage(), false, { x, y });
      }
    });
  }

  private randomRocket(): Rocket | null {
    const flying: Rocket[] = [];
    for (const obj of this.enemyShots.getChildren()) {
      if (obj instanceof Rocket && obj.active && obj.flownMs(this.scene.time.now) >= LaserDefense.shop.minFlightMs) {
        flying.push(obj);
      }
    }
    if (flying.length === 0) {
      return null;
    }
    return flying[Phaser.Math.Between(0, flying.length - 1)];
  }

  private fireMgBullet(x: number, y: number, angle: number): void {
    const bullet = this.scene.physics.add.image(x, y, MachineGun.textureKey);
    this.mgShots.add(bullet);
    bullet.setDepth(14);
    bullet.setBlendMode(Phaser.BlendModes.ADD);
    bullet.setRotation(angle);
    const speed = MachineGun.bulletSpeedFor(this.shop.mgFlightLevel);
    bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(6);
  }

  private resolveMgHits(): void {
    const bullets = this.mgShots.getChildren() as Phaser.Physics.Arcade.Image[];
    const units = this.infantry.getChildren() as Infantry[];
    for (const bullet of bullets) {
      if (!bullet.active) {
        continue;
      }
      for (const unit of units) {
        if (!unit.active || unit.reachedWall) {
          continue;
        }
        const center = unit.hitCenter();
        if (Phaser.Math.Distance.Between(bullet.x, bullet.y, center.x, center.y) <= unit.mgReach()) {
          bullet.destroy();
          // Пуля долетела до круга попадания.
          this.effects.impacts.play();
          this.hurtInfantry(unit, this.mgDamage());
          break;
        }
      }
    }
  }

  private cleanupMgShots(): void {
    this.mgShots.getChildren().forEach((obj) => {
      const bullet = obj as Phaser.Physics.Arcade.Image;
      if (bullet.x > GAME.width + 40 || bullet.x < 0 || bullet.y < 0 || bullet.y > GAME.bannerY) {
        bullet.destroy();
      }
    });
  }

  private snareOnWire(delta: number): void {
    const wire = this.shop.wire;
    if (!wire) {
      return;
    }
    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (!wire.blocks(unit)) {
        return;
      }
      if (unit.snare(BarbedWire.bounds.face, delta, BarbedWire.shop.hurtIntervalMs)) {
        this.hurtInfantry(unit, this.wireDamage(), true);
      }
    });
  }

  private checkBaseReach(): void {
    this.infantry.getChildren().forEach((obj) => {
      const unit = obj as Infantry;
      if (!unit.active || unit.reachedWall || !unit.reachesBase) {
        return;
      }
      if (this.meetsTank(unit) || unit.x <= Infantry.baseReachX) {
        this.hitBase(unit);
      }
    });
  }

  // Нос спрайта смотрит к танку. Взрыв в момент, когда он входит в хитбокс,
  // а не когда центр солдата доходит до середины корпуса.
  private meetsTank(unit: Infantry): boolean {
    const nose = unit.x - unit.displayWidth * unit.originX;
    const top = unit.y - unit.displayHeight * unit.originY;
    const chest = unit.y - unit.displayHeight * 0.45;
    return (
      this.tank.containsPoint(nose, top) ||
      this.tank.containsPoint(nose, chest) ||
      this.tank.containsPoint(nose, unit.y)
    );
  }

  private shellHitsUnit(shell: Phaser.Physics.Arcade.Image, unit: Infantry): boolean {
    const center = unit.hitCenter();
    return Phaser.Math.Distance.Between(shell.x, shell.y, center.x, center.y) <= unit.shellRadius();
  }

  private torsoPoint(unit: Infantry): { x: number; y: number } {
    return {
      x: unit.x,
      y: unit.y - unit.displayHeight * 0.42,
    };
  }

  // blastAt — центр мины, артиллерии или залпа. Пуля, огонь и проволока точку не передают:
  // от них солдат ложится целиком.
  private hurtInfantry(
    unit: Infantry,
    damage = this.shellDamage(),
    wire = false,
    blastAt?: WorldPoint,
  ): void {
    if (unit.hit(damage, wire)) {
      this.callbacks.onKill(unit.coinReward);
      // Пикап — техника: свой взрыв, не крик пехоты.
      // Дошедший до базы сюда не попадает: его убивает hitBase.
      if (unit instanceof PickupTruck) {
        this.effects.pickupExplosion.play();
      } else {
        this.effects.infantryDeath.play();
      }
      unit.kill(blastAt);
    }
  }

  private hitBase(unit: Infantry): void {
    if (!unit.reachesBase) {
      return;
    }
    if (unit instanceof AssaultInfantry) {
      this.effects.assaultExplosion.play();
    }
    unit.kill();
    this.callbacks.onBaseHit(unit.touchDamage());
  }

  private shellDamage(): number {
    return Infantry.shellDamage + this.shop.damageLevel + this.progressDamage;
  }

  private mgDamage(): number {
    return MachineGun.shop.damage + this.shop.mgDamageLevel + this.progressMgDamage;
  }

  // База ракеты плюс покупки партии и постоянный урон из магазина очков.
  private salvoDamage(): number {
    return RocketSalvo.shop.damage + this.shop.salvoDamageLevel + this.progressSalvoDamage;
  }

  private artilleryDamage(): number {
    return ArtilleryStrike.shop.damage + this.shop.artilleryDamageLevel + this.progressArtilleryDamage;
  }

  private minesDamage(): number {
    return Mines.shop.damage + this.shop.minesDamageLevel + this.progressMinesDamage;
  }

  // База проволоки плюс покупки партии и постоянный урон из магазина очков.
  private wireDamage(): number {
    return BarbedWire.shop.damage + this.shop.wireDamageLevel + this.progressWireDamage;
  }

  protected blastRadius(): number {
    return Tank.blastRadiusFor(this.shop.blastLevel + this.progressBlast);
  }

  private shellKnockback(): number {
    return Tank.knockbackPxFor(this.shop.knockbackLevel, this.progressKnockback);
  }

  // Шанс берётся один раз, в момент выстрела. Прошитый враг заряд тратит.
  private rollPierce(): boolean {
    const chance = Tank.pierceChanceFor(this.shop.pierceLevel, this.progressPierce);
    if (chance <= 0) {
      return false;
    }
    return Math.random() * 100 < chance;
  }

  // Дебаг читает это, чтобы подписать снаряд. На попадание подпись не влияет.
  protected shellPierces(shell: Phaser.Physics.Arcade.Image): boolean {
    return this.shellFlights.get(shell)?.pierce === true;
  }

  private hitDistance(shell: Phaser.Physics.Arcade.Image, unit: Infantry): number {
    const center = unit.hitCenter();
    return Phaser.Math.Distance.Between(shell.x, shell.y, center.x, center.y);
  }

  private playBlast(x: number, y: number): void {
    const radius = this.blastRadius();
    this.blast.emitParticleAt(x, y, radius > 0 ? 16 : 8);
    const flash = this.scene.add.image(x, y, 'muzzle').setDepth(16).setBlendMode(Phaser.BlendModes.ADD);
    flash.setScale(radius > 0 ? 1 : 0.55);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: radius > 0 ? 2.2 : 1.1,
      duration: radius > 0 ? 160 : 90,
      onComplete: () => flash.destroy(),
    });
  }

  private fireShell(x: number, y: number, angle: number): void {
    const shell = this.scene.physics.add.image(x, y, 'shell');
    this.shells.add(shell);
    this.shellFlights.set(shell, { pierce: this.rollPierce(), passed: null });
    shell.setDepth(15);
    shell.setBlendMode(Phaser.BlendModes.ADD);
    shell.setRotation(angle);
    const speed = Tank.shellSpeedFor(this.shop.flightLevel);
    shell.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    const body = shell.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(18);

    const flash = this.scene.add.image(x, y, 'muzzle').setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    flash.setRotation(angle);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: Tank.muzzleFlash.scale,
      duration: Tank.muzzleFlash.ms,
      onComplete: () => flash.destroy(),
    });
  }

  private asImage(
    obj:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): Phaser.Physics.Arcade.Image | null {
    const go = 'gameObject' in obj && obj.gameObject ? obj.gameObject : obj;
    if (!(go instanceof Phaser.Physics.Arcade.Image) || !go.active) {
      return null;
    }
    return go;
  }

  private asInfantry(
    obj:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): Infantry | null {
    const go = 'gameObject' in obj && obj.gameObject ? obj.gameObject : obj;
    if (!(go instanceof Infantry) || !go.active || go.reachedWall) {
      return null;
    }
    return go;
  }
}
