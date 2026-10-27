// Снаряды танка: выстрел, попадания, взрывы, проволока, арт удар, мины, атомный взрыв и контакт с базой.

import Phaser from 'phaser';
import { ArtilleryStrike, type ArtilleryFlight, type ArtilleryMark } from '../entities/ArtilleryStrike';
import { AssaultInfantry } from '../entities/AssaultInfantry';
import { BarbedWire } from '../entities/BarbedWire';
import { Infantry } from '../entities/Infantry';
import { MachineGun } from '../entities/MachineGun';
import { Mines, PlantedMine, type MineKeepOut } from '../entities/Mines';
import { NuclearStrike, type NuclearFlight } from '../entities/NuclearStrike';
import { PickupTruck } from '../entities/PickupTruck';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import { craterReach } from '../gfx/craters';
import { createShellBlast } from '../gfx/particles';
import { playArtilleryShot } from '../sounds/ArtillerySounds';
import type { BattleEffects } from '../sounds/BattleEffects';
import type { ShopController } from '../controllers/ShopController';
import type { CombatCallbacks } from '../types/CombatCallbacks';
import type { CombatSystem as Combat } from '../types/CombatSystem';

type ArtillerySpot = { x: number; y: number; mark: ArtilleryMark };

export class CombatSystem implements Combat {
  private readonly blast: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly shells: Phaser.Physics.Arcade.Group;
  private readonly mgShots: Phaser.Physics.Arcade.Group;
  private mgCooldown = 0;
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
    private readonly scene: Phaser.Scene,
    private readonly tank: Tank,
    private readonly infantry: Phaser.Physics.Arcade.Group,
    private readonly shop: ShopController,
    private readonly callbacks: CombatCallbacks,
    private readonly progressDamage: number,
    private readonly progressBlast: number,
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
  }

  get artilleryCooldown(): number {
    return this.artilleryCooldownMs;
  }

  setArtilleryCooldown(ms: number): void {
    this.artilleryCooldownMs = Math.max(0, ms);
  }

  get minesCooldown(): number {
    return this.minesCooldownMs;
  }

  setMinesCooldown(ms: number): void {
    this.minesCooldownMs = Math.max(0, ms);
  }

  get nuclearCooldown(): number {
    return this.nuclearCooldownMs;
  }

  setNuclearCooldown(ms: number): void {
    this.nuclearCooldownMs = Math.max(0, ms);
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
    this.mgShots.clear(true, true);
    this.cancelArtillery();
    this.cancelNuclear();
    this.clearMines();
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
        this.detonateShell(shell, unit);
      },
      undefined,
      this,
    );
  }

  shoot(): void {
    const shot = this.tank.tryFire();
    if (shot) {
      this.fireShell(shot.x, shot.y, shot.angle);
      this.effects.tankShot.play();
    }
  }

  // ЛКМ и автострельба — здесь, чтобы сцена не знала про покупки магазина.
  handleFireInput(pointer: Phaser.Input.Pointer): void {
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
    this.artilleryCooldownMs = Math.max(0, this.artilleryCooldownMs - delta);
    if (!this.strikePressed()) {
      return;
    }
    this.useArtillery(canFire);
  }

  protected useArtillery(canFire: boolean): void {
    if (!canFire || this.artilleryCooldownMs > 0) {
      return;
    }
    this.artilleryCooldownMs = ArtilleryStrike.shop.cooldownMs;
    this.launchArtillery();
  }

  // Перезарядка идёт и в магазине. Постановка — только в бою, по клавише 2 или по иконке.
  // Уже лежащие мины в магазине молчат: физика на паузе, пехота не шагает.
  tickMines(delta: number, canFire: boolean): void {
    if (!this.shop.minesOwned) {
      this.mineFromIcon = false;
      return;
    }
    this.minesCooldownMs = Math.max(0, this.minesCooldownMs - delta);
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
      this.minesCooldownMs = Mines.shop.cooldownMs;
    }
  }

  // Перезарядка идёт и в магазине. Взрыв — только в бою, по клавише 3 или по иконке.
  tickNuclear(delta: number, canFire: boolean): void {
    if (!this.shop.nuclearOwned) {
      this.nuclearFromIcon = false;
      return;
    }
    this.nuclearCooldownMs = Math.max(0, this.nuclearCooldownMs - delta);
    if (!this.nuclearPressed()) {
      return;
    }
    this.useNuclear(canFire);
  }

  protected useNuclear(canFire: boolean): void {
    if (!canFire || this.nuclearCooldownMs > 0) {
      return;
    }
    this.nuclearCooldownMs = NuclearStrike.shop.cooldownMs;
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
    this.effects.assaultExplosion.play();
    const radius = Mines.shop.blastRadius;
    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (!unit.active || unit.reachedWall) {
        return;
      }
      // Тот же зазор до корпуса. Иначе взрыв под бампером не достаёт до якоря, и машина без урона.
      const gap = this.hullGapX(unit, x);
      const torso = this.torsoPoint(unit);
      const nearFeet = Math.hypot(gap, unit.y - y) <= radius;
      const nearChest = Math.hypot(gap, torso.y - y) <= radius;
      if (nearFeet || nearChest) {
        this.hurtInfantry(unit, Mines.shop.damage);
      }
    });
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

  private clearMines(): void {
    for (const mine of this.mines) {
      mine.destroy();
    }
    this.mines = [];
  }

  // Сразу хлопок. Снаряды — через секунду после того, как он доиграл.
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

  // Три огня этого залпа. Уже горящие от прошлого вызова не трогаем.
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
      const torso = this.torsoPoint(unit);
      if (Phaser.Math.Distance.Between(x, y, torso.x, torso.y) <= radius) {
        this.hurtInfantry(unit, ArtilleryStrike.shop.damage);
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
    this.resolveMgHits();
    this.cleanupMgShots();
    this.snareOnWire(delta);
    this.checkBaseReach();
  }

  detonateShell(shell: Phaser.Physics.Arcade.Image, direct?: Infantry): void {
    if (!shell.active) {
      return;
    }

    const x = shell.x;
    const y = shell.y;
    shell.destroy();
    this.playBlast(x, y);
    // Один удар на снаряд. Осколки взрыва второй раз не звенят.
    this.effects.impacts.play();

    if (direct) {
      this.hurtInfantry(direct);
    }

    const blastRadius = this.blastRadius();
    if (blastRadius <= 0) {
      return;
    }

    (this.infantry.getChildren() as Infantry[]).forEach((unit) => {
      if (unit === direct || !unit.active || unit.reachedWall) {
        return;
      }
      const torso = this.torsoPoint(unit);
      if (Phaser.Math.Distance.Between(x, y, torso.x, torso.y) <= blastRadius) {
        this.hurtInfantry(unit);
      }
    });
  }

  private resolveShellHits(): void {
    const shells = this.shells.getChildren() as Phaser.Physics.Arcade.Image[];
    const units = this.infantry.getChildren() as Infantry[];

    for (const shell of shells) {
      if (!shell.active) {
        continue;
      }
      for (const unit of units) {
        if (!unit.active || unit.reachedWall) {
          continue;
        }
        if (this.shellHitsUnit(shell, unit)) {
          this.detonateShell(shell, unit);
          break;
        }
      }
    }
  }

  private cleanupShells(): void {
    this.shells.getChildren().forEach((obj) => {
      const shell = obj as Phaser.Physics.Arcade.Image;
      if (shell.x > GAME.width + 40 || shell.x < 0 || shell.y < 0 || shell.y > GAME.bannerY) {
        shell.destroy();
      }
    });
  }

  private tickMachineGun(delta: number): void {
    const mg = this.shop.machineGun;
    if (!mg) {
      return;
    }
    this.mgCooldown = Math.max(0, this.mgCooldown - delta);
    if (this.mgCooldown > 0) {
      return;
    }
    const shot = mg.muzzle();
    this.fireMgBullet(shot.x, shot.y, shot.angle);
    this.effects.tankMgShot.play();
    this.mgCooldown = MachineGun.shop.fireIntervalMs;
  }

  private fireMgBullet(x: number, y: number, angle: number): void {
    const bullet = this.scene.physics.add.image(x, y, MachineGun.textureKey);
    this.mgShots.add(bullet);
    bullet.setDepth(14);
    bullet.setBlendMode(Phaser.BlendModes.ADD);
    bullet.setRotation(angle);
    bullet.setVelocity(
      Math.cos(angle) * MachineGun.shop.bulletSpeed,
      Math.sin(angle) * MachineGun.shop.bulletSpeed,
    );
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
        const torso = this.torsoPoint(unit);
        if (Phaser.Math.Distance.Between(bullet.x, bullet.y, torso.x, torso.y) <= unit.hitRadius * 0.55) {
          bullet.destroy();
          // Тот же удар, что у снаряда: пуля долетела до солдата.
          this.effects.impacts.play();
          this.hurtInfantry(unit, MachineGun.shop.damage);
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
        this.hurtInfantry(unit, BarbedWire.shop.damage, true);
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
    const torso = this.torsoPoint(unit);
    return Phaser.Math.Distance.Between(shell.x, shell.y, torso.x, torso.y) <= unit.hitRadius;
  }

  private torsoPoint(unit: Infantry): { x: number; y: number } {
    return {
      x: unit.x,
      y: unit.y - unit.displayHeight * 0.42,
    };
  }

  private hurtInfantry(
    unit: Infantry,
    damage = this.shellDamage(),
    wire = false,
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
      unit.kill();
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
    this.callbacks.onBaseHit(unit.contactDamage);
  }

  private shellDamage(): number {
    return Infantry.shellDamage + this.shop.damageLevel + this.progressDamage;
  }

  private blastRadius(): number {
    return (this.shop.blastLevel + this.progressBlast) * Tank.blastRadiusPerLevel;
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
    shell.setDepth(15);
    shell.setBlendMode(Phaser.BlendModes.ADD);
    shell.setRotation(angle);
    shell.setVelocity(
      Math.cos(angle) * Tank.shellSpeed,
      Math.sin(angle) * Tank.shellSpeed,
    );
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
