// Танк игрока. Это не один спрайт, а контейнер: корпус едет сам.
// Башня и ствол крутятся вместе вокруг точки, где башня стоит на крыше.

import Phaser, { GameObjects } from 'phaser';
import {
  paintQuiet,
  SHELL_FRAME,
  SHELL_PAINT,
  TANK_GUN_FRAME,
  TANK_HULL_FRAME,
  TANK_TURRET_FRAME,
  TANK_WRECK_FRAME,
  type ShellPaint,
} from '../../gfx/looks';
import { ejectCasing } from '../../gfx/casing';
import { exhaustAt, idleShift } from '../../gfx/engine';
import { tankBoomAt } from '../../gfx/tankBoom';
import { bake } from '../../gfx/textures';

// Прямоугольник части в координатах её родителя, до поворота башни.
export type PartBox = { x: number; y: number; w: number; h: number };

export class Tank extends GameObjects.Container {
  static readonly spawn = { x: 76, y: 360 };
  static readonly baseFireDelay = 1000;
  static readonly minFireDelay = 200;
  // Прогресс-магазин снимает перезарядку только до 0.50 с.
  static readonly minProgressFireDelay = 500;
  static readonly fireRateStep = 20;
  // Постоянная скорость из магазина между проигрышами: −0.01 с за уровень.
  static readonly progressSpeedStepMs = 10;
  static progressSpeedLevel = 0;

  static get maxProgressSpeedLevel(): number {
    return (Tank.baseFireDelay - Tank.minProgressFireDelay) / Tank.progressSpeedStepMs;
  }

  static setProgressSpeedLevel(level: number): void {
    Tank.progressSpeedLevel = Math.min(Tank.maxProgressSpeedLevel, Math.max(0, Math.round(level)));
  }

  // Прогресс не уводит перезарядку ниже 0.50 с, даже если в сохранении уровень выше нового потолка.
  private static progressCutMs(progressSpeed: number): number {
    const cut = Math.max(0, Math.round(progressSpeed)) * Tank.progressSpeedStepMs;
    return Math.min(cut, Tank.baseFireDelay - Tank.minProgressFireDelay);
  }

  // Магазин между волнами добивает остаток до 0.20 с. Прогресс сам останавливается на 0.50 с.
  static get maxFireRateLevel(): number {
    const room = Tank.baseFireDelay - Tank.progressCutMs(Tank.progressSpeedLevel) - Tank.minFireDelay;
    return Math.max(0, Math.floor(room / Tank.fireRateStep));
  }

  static fireDelayFor(level: number, progressSpeed = Tank.progressSpeedLevel): number {
    const progressCut = Tank.progressCutMs(progressSpeed);
    const room = Tank.baseFireDelay - progressCut - Tank.minFireDelay;
    const maxShop = Math.max(0, Math.floor(room / Tank.fireRateStep));
    const capped = Math.min(Math.max(0, Math.round(level)), maxShop);
    // Шаг партии 0,02 с, шаг прогресса 0,01 с. На потолке остаток короче шага
    // всё равно добирается до 0,20 с, иначе кнопка пишет «максимум» на 0,21 с.
    if (maxShop > 0 && capped >= maxShop) {
      return Tank.minFireDelay;
    }
    return Math.max(Tank.minFireDelay, Tank.baseFireDelay - capped * Tank.fireRateStep - progressCut);
  }
  // Полёт до правого края поля 1280 при ровном стволе. Без покупок это 2 с.
  static readonly baseFlightMs = 2000;
  // Магазин партии добивает полёт до 0,40 с. Прогресс сам останавливается на 0,60 с.
  static readonly minFlightMs = 400;
  static readonly minProgressFlightMs = 600;
  // Оба магазина снимают по 0,10 с за уровень.
  static readonly flightStepMs = 100;
  static progressFlightLevel = 0;

  static get maxProgressFlightLevel(): number {
    return (Tank.baseFlightMs - Tank.minProgressFlightMs) / Tank.flightStepMs;
  }

  static setProgressFlightLevel(level: number): void {
    Tank.progressFlightLevel = Math.min(
      Tank.maxProgressFlightLevel,
      Math.max(0, Math.round(level)),
    );
  }

  // Прогресс не уводит полёт ниже 0,60 с, даже если в сохранении уровень выше нового потолка.
  private static progressFlightCutMs(progressLevel: number): number {
    const cut = Math.max(0, Math.round(progressLevel)) * Tank.flightStepMs;
    return Math.min(cut, Tank.baseFlightMs - Tank.minProgressFlightMs);
  }

  // Магазин между волнами добивает остаток до 0,40 с. Прогресс сам останавливается на 0,60 с.
  static get maxShopFlightLevel(): number {
    const room =
      Tank.baseFlightMs - Tank.progressFlightCutMs(Tank.progressFlightLevel) - Tank.minFlightMs;
    return Math.max(0, Math.floor(room / Tank.flightStepMs));
  }

  static flightMsFor(level: number, progressLevel = Tank.progressFlightLevel): number {
    const progressCut = Tank.progressFlightCutMs(progressLevel);
    const room = Tank.baseFlightMs - progressCut - Tank.minFlightMs;
    const maxShop = Math.max(0, Math.floor(room / Tank.flightStepMs));
    const capped = Math.min(Math.max(0, Math.round(level)), maxShop);
    return Math.max(Tank.minFlightMs, Tank.baseFlightMs - capped * Tank.flightStepMs - progressCut);
  }

  // Пиксели в секунду за тот же отрезок, что shellCrossPx, за время flightMsFor.
  static shellSpeedFor(level: number, progressLevel = Tank.progressFlightLevel): number {
    return (Tank.shellCrossPx() * 1000) / Tank.flightMsFor(level, progressLevel);
  }
  // Радиус взрыва снаряда без покупок. Уровень магазина и прогресса прибавляет blastRadiusPerLevel.
  static readonly baseBlastRadius = 10;
  static readonly blastRadiusPerLevel = 1;
  // Сумма уровней магазина и прогресса не выше 100. Прогресс сам не выше 50.
  static readonly maxBlastLevel = 100;
  static readonly maxProgressBlastLevel = 50;
  static progressBlastLevel = 0;

  static setProgressBlastLevel(level: number): void {
    Tank.progressBlastLevel = Math.min(Tank.maxProgressBlastLevel, Math.max(0, Math.round(level)));
  }

  // Магазин между волнами добивает остаток до общего потолка.
  static get maxShopBlastLevel(): number {
    return Math.max(0, Tank.maxBlastLevel - Tank.progressBlastLevel);
  }

  static blastRadiusFor(level: number): number {
    const capped = Math.min(Math.max(0, Math.round(level)), Tank.maxBlastLevel);
    return Tank.baseBlastRadius + capped * Tank.blastRadiusPerLevel;
  }

  // Снаряд без покупок врагов не толкает. Магазин волны даёт +3 px за уровень, прогресс — +1.
  // Сумма не выше 100. Прогресс сам не выше 50.
  static readonly shopKnockbackPerLevel = 3;
  static readonly progressKnockbackPerLevel = 1;
  static readonly maxKnockbackPx = 100;
  static readonly maxProgressKnockbackLevel = 50;
  static progressKnockbackLevel = 0;

  static setProgressKnockbackLevel(level: number): void {
    Tank.progressKnockbackLevel = Math.min(
      Tank.maxProgressKnockbackLevel,
      Math.max(0, Math.round(level)),
    );
  }

  // Магазин между волнами добивает остаток до общего потолка шагами по 3 px.
  static get maxShopKnockbackLevel(): number {
    const room =
      Tank.maxKnockbackPx - Tank.progressKnockbackLevel * Tank.progressKnockbackPerLevel;
    return Math.max(0, Math.floor(room / Tank.shopKnockbackPerLevel));
  }

  static knockbackPxFor(
    shopLevel: number,
    progressLevel = Tank.progressKnockbackLevel,
  ): number {
    const shop = Math.max(0, Math.round(shopLevel)) * Tank.shopKnockbackPerLevel;
    const progress = Math.max(0, Math.round(progressLevel)) * Tank.progressKnockbackPerLevel;
    return Math.min(Tank.maxKnockbackPx, shop + progress);
  }

  // Шанс прошивания в процентах. Без покупок снаряд всегда рвётся о первого врага.
  // Уровень партии и прогресса дают по 1%. Вместе не выше 70. Прогресс сам не выше 50.
  static readonly maxPierceChance = 70;
  static readonly maxProgressPierceLevel = 50;
  static progressPierceLevel = 0;

  static setProgressPierceLevel(level: number): void {
    Tank.progressPierceLevel = Math.min(
      Tank.maxProgressPierceLevel,
      Math.max(0, Math.round(level)),
    );
  }

  // Магазин между волнами добивает остаток до общего потолка.
  static get maxShopPierceLevel(): number {
    return Math.max(0, Tank.maxPierceChance - Tank.progressPierceLevel);
  }

  static pierceChanceFor(
    shopLevel: number,
    progressLevel = Tank.progressPierceLevel,
  ): number {
    const shop = Math.max(0, Math.round(shopLevel));
    const progress = Math.max(0, Math.round(progressLevel));
    return Math.min(Tank.maxPierceChance, shop + progress);
  }

  // Шанс поглотить чужой патрон или снаряд, в процентах. 0 — каждый наносит урон.
  // Один уровень — один процент, выше 30 прогресс не ставит.
  // Очередь не делит один бросок: шанс кидают на каждый выстрел отдельно.
  static readonly maxAbsorbChance = 30;
  static absorbLevel = 0;

  static setAbsorbLevel(level: number): void {
    Tank.absorbLevel = Tank.absorbChanceFor(level);
  }

  static absorbChance(): number {
    return Tank.absorbLevel;
  }

  static absorbChanceFor(level: number): number {
    return Math.min(Tank.maxAbsorbChance, Math.max(0, Math.round(level)));
  }

  // Точка прицеливания врагов: чуть правее носа танка.
  static aimPoint(): { x: number; y: number } {
    return { x: Tank.spawn.x + 24, y: Tank.spawn.y };
  }

  // Сборка корпуса и башни. Просмотр спрайтов берёт те же числа, что и конструктор.
  static readonly layout = {
    hullX: 8,
    hullY: 34,
    turretX: -7,
    turretY: 14,
    // Днище башни в её кадре. Вокруг этой точки крутится вся башня.
    turretOriginX: 48 / TANK_TURRET_FRAME.w,
    turretOriginY: 30 / TANK_TURRET_FRAME.h,
    // Корень ствола, где труба выходит из лба башни.
    gunX: 39,
    gunY: 7,
    gunOriginX: 1 / TANK_GUN_FRAME.w,
    gunOriginY: 6 / TANK_GUN_FRAME.h,
    // Середина днища башни. Вокруг неё крутится вся башня, поэтому низ не сходит с крыши.
    seatX: -7,
    seatY: 14,
    muzzleLength: 54,
  };
  // Крыша кормы башни, в пикселях кадра. Дуло справа, корма слева от оси.
  static readonly shellPort = { x: 16, y: 9 };
  // Гильза снаряда. Картинка 8×4, множитель читаемости 1.5: scale 3 даёт 36×18.
  // Снаряд 54×22, башня 99×32. Короче снаряда и чуть тоньше, калибр всё ещё его.
  // heft 2: та же дуга, что у пули, но вдвое ленивее. Пульная гильза здесь была бы точкой.
  static readonly shellCasing = { scale: 2, heft: 2 };

  // Картинка с origin занимает прямоугольник (x, y, w, h) в системе своего родителя.
  private static boxAround(
    x: number,
    y: number,
    originX: number,
    originY: number,
    frame: { w: number; h: number },
  ): PartBox {
    return {
      x: x - originX * frame.w,
      y: y - originY * frame.h,
      w: frame.w,
      h: frame.h,
    };
  }

  // Корпус в координатах танка. Тряску сюда не кладём: её вычитает containsPoint.
  static hullBox(): PartBox {
    const layout = Tank.layout;
    return Tank.boxAround(layout.hullX, layout.hullY, 0.5, 0.5, TANK_HULL_FRAME);
  }

  // Башня в координатах контейнера прицеливания, ещё без поворота.
  static turretBox(): PartBox {
    const layout = Tank.layout;
    return Tank.boxAround(
      layout.turretX - layout.seatX,
      layout.turretY - layout.seatY,
      layout.turretOriginX,
      layout.turretOriginY,
      TANK_TURRET_FRAME,
    );
  }

  // Ствол в координатах контейнера прицеливания. imageX/imageY — где сейчас стоит картинка,
  // вместе с откатом.
  static gunBox(imageX: number, imageY: number): PartBox {
    const layout = Tank.layout;
    return Tank.boxAround(imageX, imageY, layout.gunOriginX, layout.gunOriginY, TANK_GUN_FRAME);
  }

  static inBox(x: number, y: number, box: PartBox): boolean {
    return x > box.x && x < box.x + box.w && y > box.y && y < box.y + box.h;
  }

  // Точка танка → точка в контейнере прицеливания, обратный поворот башни.
  static intoAim(x: number, y: number, angle: number): { x: number; y: number } {
    const seat = Tank.layout;
    const dx = x - seat.seatX;
    const dy = y - seat.seatY;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: dx * cos + dy * sin,
      y: -dx * sin + dy * cos,
    };
  }

  // Откат ствола назад по его картинке, в пикселях. Башня при выстреле не сдвигается.
  static readonly recoilSlide = { kick: 8, ms: 40 };

  // Точка в системе танка: localX/localY заданы от сиденья башни, angle её поворот.
  static mounted(angle: number, localX: number, localY: number): { x: number; y: number } {
    const seat = Tank.layout;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: seat.seatX + localX * cos - localY * sin,
      y: seat.seatY + localX * sin + localY * cos,
    };
  }

  // Конец ствола в системе танка, без учёта отката.
  static muzzleAt(angle: number): { x: number; y: number } {
    const layout = Tank.layout;
    return Tank.mounted(
      angle,
      layout.gunX - layout.seatX + layout.muzzleLength,
      layout.gunY - layout.seatY,
    );
  }

  // Дуло при ровном стволе до правого края нарисованного поля.
  // Широкое окно холст растягивает, а скорость снаряда от этого не растёт.
  static shellCrossPx(): number {
    return 1280 - (Tank.spawn.x + Tank.muzzleAt(0).x);
  }
  // Круглая вспышка у дула раздувается и гаснет.
  static readonly muzzleFlash = { scale: 1.6, ms: 90 };

  static readonly wreckKey = 'tank-wreck';

  // Пути в public/. Строки буквальные: singlefile-сборка подменяет их на data:.
  static readonly images = {
    'tank-hull': 'assets/tank-hull.png',
    'tank-turret': 'assets/tank-turret.png',
    'tank-gun': 'assets/tank-gun.png',
    'tank-wreck': 'assets/tank-wreck.png',
  } as const;

  // GameScene и студия зовут до create.
  static preload(scene: Phaser.Scene): void {
    for (const [key, path] of Object.entries(this.images)) {
      scene.load.image(key, path);
    }
  }

  // Башня и ствол внутри. Крутится целиком, откат двигает только ствол.
  private readonly aim: Phaser.GameObjects.Container;
  private readonly hull: Phaser.GameObjects.Image;
  private readonly turret: Phaser.GameObjects.Image;
  private readonly gun: Phaser.GameObjects.Image;
  // После гибели корпус уже спрятан, повторный die ничего не делает.
  private dead = false;
  // Редкий выхлоп, пока мотор работает. Гаснет в момент гибели.
  private engine?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Столбы дыма над очагами. Живут, пока контейнер танка на сцене.
  private smokes: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  // Несколько очагов пламени над проломами. Тоже живут вместе с обломками.
  private fires: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  // Сколько миллисекунд танк уже тарахтит. Из этого времени считается тряска.
  private engineMs = 0;
  // Дополнительные прямоугольники башни. Пуля в такую деталь тоже бьёт по танку.
  private turretHits: PartBox[] = [];
  // Миллисекунды до следующего выстрела. 0 — можно стрелять.
  private cooldown = 0;
  private fireRateLevel = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    Tank.ensureTextures(scene);

    // Контейнер сам стоит в (x, y). Дети внутри задаются уже относительно этой точки.
    super(scene, x, y);
    
    const layout = Tank.layout;
    // Корпус чуть правее и ниже центра контейнера.
    this.hull = scene.add.image(layout.hullX, layout.hullY, 'tank-hull');
    // Ось на днище башни. Дети заданы относительно неё, поэтому при наклоне низ стоит на месте.
    this.aim = scene.add.container(layout.seatX, layout.seatY);
    this.turret = scene.add.image(layout.turretX - layout.seatX, layout.turretY - layout.seatY, 'tank-turret');
    this.turret.setOrigin(layout.turretOriginX, layout.turretOriginY);
    this.gun = scene.add.image(layout.gunX - layout.seatX, layout.gunY - layout.seatY, 'tank-gun');
    this.gun.setOrigin(layout.gunOriginX, layout.gunOriginY);
    // Ствол последним: маска на нём перекрывает лоб башни.
    this.aim.add([this.turret, this.gun]);

    this.add([this.hull, this.aim]);
    scene.add.existing(this);
    // Танк рисуется поверх солдат, снарядов и вспышек выстрела врага.
    this.setDepth(25);
    // Размер контейнера для вёрстки. Попадания пуль смотрят части в containsPoint, не этот прямоугольник.
    this.setSize(160, 96);
    const exhaust = Tank.exhaustAnchor();
    this.engine = Tank.engineAt(scene, x + exhaust.x, y + exhaust.y);
    // preupdate идёт каждый кадр, даже когда сцена боя сама стоит на паузе магазина.
    const onIdle = (_time: number, delta: number) => this.idle(delta);
    scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, onIdle);
    this.once('destroy', () => {
      scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, onIdle);
      this.stopEngine();
      for (const smoke of this.smokes) {
        smoke.destroy();
      }
      this.smokes = [];
      for (const fire of this.fires) {
        fire.destroy();
      }
      this.fires = [];
    });
  }

  // Лёгкая тряска всего живого танка и выхлоп, который едет вместе с кормой.
  private idle(delta: number): void {
    if (this.dead || !this.engine) {
      return;
    }
    this.engineMs += delta;
    const shift = Tank.idleShift(this.engineMs);
    const layout = Tank.layout;
    this.hull.setPosition(layout.hullX + shift.x, layout.hullY + shift.y);
    this.aim.setPosition(layout.seatX + shift.x, layout.seatY + shift.y);
    const exhaust = Tank.exhaustAnchor();
    this.engine.setPosition(this.x + exhaust.x + shift.x, this.y + exhaust.y + shift.y);
  }

  // Тот же сдвиг, что у лазера: попадание и картинка делят одну формулу.
  static idleShift(ms: number, gain = 1): { x: number; y: number } {
    return idleShift(ms, gain);
  }

  private stopEngine(): void {
    this.engine?.destroy();
    this.engine = undefined;
  }

  // Верх картинки в мире: середина корпуса, макушка башни. Цифра урона стартует отсюда.
  topPoint(): { x: number; y: number } {
    const layout = Tank.layout;
    return {
      x: this.x + layout.hullX,
      y: this.y + layout.seatY - layout.turretOriginY * TANK_TURRET_FRAME.h,
    };
  }

  // Попала ли точка (пуля) в корпус, башню или ствол. Пустота между ними не считается.
  // Башня и ствол крутятся вместе с прицелом, ствол ещё отъезжает при откате.
  // Мёртвый танк пуль уже не ловит: на его месте только обломки.
  containsPoint(x: number, y: number): boolean {
    if (this.dead) {
      return false;
    }
    const shift = Tank.idleShift(this.engineMs);
    const localX = x - this.x - shift.x;
    const localY = y - this.y - shift.y;
    if (Tank.inBox(localX, localY, Tank.hullBox())) {
      return true;
    }
    const aim = Tank.intoAim(localX, localY, this.aim.rotation);
    if (Tank.inBox(aim.x, aim.y, Tank.turretBox())) {
      return true;
    }
    if (Tank.inBox(aim.x, aim.y, Tank.gunBox(this.gun.x, this.gun.y))) {
      return true;
    }
    return this.turretHits.some((box) => Tank.inBox(aim.x, aim.y, box));
  }

  // Сдвиг картинки от тряски. Попадание вычитает его, иначе точка не совпадает с корпусом.
  get shake(): { x: number; y: number } {
    return Tank.idleShift(this.engineMs);
  }

  // Поворот башни. Ствол и навеска крутятся вместе с ней.
  get aimAngle(): number {
    return this.aim.rotation;
  }

  // Где сейчас картинка ствола, вместе с откатом. Координаты контейнера прицеливания.
  get gunPlace(): { x: number; y: number } {
    return { x: this.gun.x, y: this.gun.y };
  }

  // Дополнительные прямоугольники башни. Пуля в такую деталь тоже попадает в танк.
  get turretHitBoxes(): readonly PartBox[] {
    return this.turretHits;
  }

  // Серый корпус, башня и ствол. Пулемёт на башне красится отдельно: это другой объект.
  setQuiet(quiet: boolean): void {
    if (this.dead) {
      return;
    }
    paintQuiet(this.hull, quiet);
    paintQuiet(this.turret, quiet);
    paintQuiet(this.gun, quiet);
  }

  // Наводит башню и ствол на точку, обычно на курсор.
  aimAt(x: number, y: number): void {
    const layout = Tank.layout;
    // Ствол не проходит через сиденье: он выше днища на gunY - seatY.
    // Угол считается так, чтобы линия ствола, а не ось, смотрела в цель.
    const along = layout.gunX - layout.seatX;
    const above = layout.gunY - layout.seatY;
    const vx = x - (this.x + layout.seatX);
    const vy = y - (this.y + layout.seatY);
    const rise = -above;
    const reach = Math.hypot(vx, vy);
    let angle = Math.atan2(vy, vx);
    if (reach > rise) {
      const phi = Math.atan2(-vy, vx);
      const base = Math.asin(rise / reach);
      const forward = (turn: number) => {
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        const rx = along * c - above * s;
        const ry = along * s + above * c;
        return (vx - rx) * c + (vy - ry) * s;
      };
      const straight = base - phi;
      const other = Math.PI - base - phi;
      angle = forward(straight) >= forward(other) ? straight : other;
    }
    // Не смотрит назад и не в пол: угол зажат примерно от -49° до +49°.
    this.aim.setRotation(Phaser.Math.Clamp(angle, -0.85, 0.85));
  }

  setFireRateLevel(level: number): void {
    this.fireRateLevel = Math.min(level, Tank.maxFireRateLevel);
  }

  // Деталь под основным стволом: крутится вместе с башней, ствол рисуется поверх.
  // hit — прямоугольник в координатах башни, ещё без поворота.
  attachToTurret(part: Phaser.GameObjects.GameObject, hit: PartBox): void {
    const gunIndex = this.aim.getIndex(this.gun);
    this.aim.addAt(part, gunIndex);
    this.turretHits.push(hit);
  }

  // Сцена зовёт это каждый кадр, чтобы кулдаун уменьшался даже без выстрела.
  tick(delta: number): void {
    this.cooldown = Math.max(0, this.cooldown - delta);
  }

  // Пытается выстрелить. null — ещё рано. Иначе координаты дула и угол ствола для снаряда.
  tryFire(): { x: number; y: number; angle: number } | null {
    if (this.cooldown > 0) {
      return null;
    }
    // Сразу занимаем кулдаун, чтобы зажатая кнопка мыши не выпускала снаряд каждый кадр.
    this.cooldown = Tank.fireDelayFor(this.fireRateLevel);
    const shot = this.getMuzzle();
    // Откат в координатах башни: минус X — назад вдоль ствола, угол башни уже учтён.
    const layout = Tank.layout;
    const restX = layout.gunX - layout.seatX;
    const restY = layout.gunY - layout.seatY;
    this.scene.tweens.killTweensOf(this.gun);
    this.gun.setPosition(restX, restY);
    this.scene.tweens.add({
      targets: this.gun,
      x: restX - Tank.recoilSlide.kick,
      duration: Tank.recoilSlide.ms,
      yoyo: true,
    });
    this.dropShellCasing(shot.angle);
    return shot;
  }

  // Гибель базы: живой танк гаснет, на его месте остаётся куча обломков,
  // а над ней на секунду встаёт ядерный гриб.
  die(): void {
    if (this.dead) {
      return;
    }
    this.dead = true;
    this.stopEngine();
    this.scene.tweens.killTweensOf(this.gun);
    for (const child of [...this.list]) {
      const node = child as unknown as Phaser.GameObjects.Components.Visible;
      node.setVisible(false);
    }
    const layout = Tank.layout;

    const wreck = this.scene.add.image(layout.hullX, layout.hullY, Tank.wreckKey);
    this.add(wreck);

    // Взрыв чуть выше середины корпуса: оттуда растут кадры спрайта.
    tankBoomAt(this.scene, this.x + layout.hullX, this.y + layout.hullY - 12);
    // Сначала огонь, поверх него — дым от тех же очагов.
    this.fires = Tank.firesAt(this.scene, this.x, this.y);
    this.smokes = Tank.smokesAt(this.scene, this.x, this.y);
  }

  // Гильза с крыши кормы. Башня уже повёрнута, откат ствола её не увозит: корма стоит.
  private dropShellCasing(angle: number): void {
    const layout = Tank.layout;
    const matrix = this.turret.getWorldTransformMatrix();
    const localX = Tank.shellPort.x - layout.turretOriginX * TANK_TURRET_FRAME.w;
    const localY = Tank.shellPort.y - layout.turretOriginY * TANK_TURRET_FRAME.h;
    const port = new Phaser.Math.Vector2();
    matrix.transformPoint(localX, localY, port);
    const brass = Tank.shellCasing;
    ejectCasing(this.scene, port.x, port.y, angle, this.depth, brass.scale, brass.heft);
  }

  // Мировые координаты конца ствола.
  private getMuzzle(): { x: number; y: number; angle: number } {
    const angle = this.aim.rotation;
    const point = Tank.mounted(angle, this.gun.x + Tank.layout.muzzleLength, this.gun.y);
    return {
      x: this.x + point.x,
      y: this.y + point.y,
      angle,
    };
  }

  // Корпус, башня, ствол, снаряд и вспышка. Сцена берёт их по именам
  // 'shell'
  protected static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('shell')) {
      this.createShell(scene);
    }
  }

  // Снаряд танка — вытянутое свечение, не металлическая болванка. 54×22.
  private static createShell(scene: Phaser.Scene): void {
    bake(scene, 'shell', SHELL_FRAME.w, SHELL_FRAME.h, (g) => this.renderShell(g));
  }

  static renderShell(g: Phaser.GameObjects.Graphics, paint: ShellPaint = SHELL_PAINT): void {
    g.fillStyle(paint.outer, 0.35); // внешнее красное гало
    g.fillEllipse(27, 11, 54, 22);
    g.fillStyle(paint.mid, 0.8); // оранжевая середина, чуть смещена вправо — туда летит снаряд
    g.fillEllipse(30, 11, 40, 14);
    g.fillStyle(paint.core); // жёлтое ядро
    g.fillEllipse(34, 11, 26, 8);
    g.fillStyle(paint.tip); // белый кончик
    g.fillEllipse(40, 11, 12, 4);
  }

  

  // Решётка моторного отсека на корме крыши, в координатах контейнера танка.
  static exhaustAnchor(): { x: number; y: number } {
    const deckX = 18;
    const deckY = 8;
    return {
      x: Tank.layout.hullX + (deckX - TANK_HULL_FRAME.w / 2),
      y: Tank.layout.hullY + (deckY - TANK_HULL_FRAME.h / 2),
    };
  }

  // Редкий серый выхлоп. Тоньше и ниже столба над обломками.
  static engineAt(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale = 1,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    return exhaustAt(scene, x, y, scale);
  }

  // Главный очаг: студия двигает по нему старый одиночный якорь дыма.
  static smokeAnchor(): { x: number; y: number } {
    const focus = Tank.fireFoci()[0];
    return { x: focus.x, y: focus.y - 36 };
  }

  // Очаги в координатах кадра обломков → контейнера танка.
  // Главный в проломе, ещё два по бокам, маленький у ствола.
  static fireFoci(): ReadonlyArray<{ x: number; y: number; power: number }> {
    const ground = TANK_WRECK_FRAME.h / 2 + 24;
    const toTank = (tx: number, ty: number, power: number) => ({
      x: Tank.layout.hullX + (tx - TANK_WRECK_FRAME.w / 2),
      y: Tank.layout.hullY + (ty - TANK_WRECK_FRAME.h / 2),
      power,
    });
    return [
      toTank(102, ground - 22, 1.15),
      toTank(68, ground - 18, 0.75),
      toTank(148, ground - 16, 0.85),
      toTank(118, ground - 10, 0.55),
    ];
  }

  // Мягкое пятно для обоих дымов: выхлопа на ходу и столба над обломками.
  private static puffKey(scene: Phaser.Scene): string {
    const key = 'smoke-puff';
    if (!scene.textures.exists(key)) {
      bake(scene, key, 32, 32, (g) => {
        g.fillStyle(0xffffff, 0.18);
        g.fillCircle(16, 16, 15);
        g.fillStyle(0xffffff, 0.4);
        g.fillCircle(16, 16, 9);
        g.fillStyle(0xffffff, 0.75);
        g.fillCircle(16, 16, 4);
      });
    }
    return key;
  }

  // Белое мягкое пятно: цвет пламени задаёт tint частиц.
  private static flameKey(scene: Phaser.Scene): string {
    const key = 'flame-puff';
    if (!scene.textures.exists(key)) {
      bake(scene, key, 32, 32, (g) => {
        g.fillStyle(0xffffff, 0.12);
        g.fillCircle(16, 16, 15);
        g.fillStyle(0xffffff, 0.35);
        g.fillCircle(16, 16, 10);
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(16, 16, 5);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(16, 16, 2);
      });
    }
    return key;
  }

  // Один столб — для студии, когда нужен старый API с якорем.
  // Над большим пламенем лучше брать smokesAt: дым от каждого очага.
  static smokeAt(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale = 1,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    return Tank.plumeAt(scene, x, y, 1.1 * scale);
  }

  // Плотный тёмный дым над пламенем: от каждого очага и общий широкий столб.
  // originX/Y — мировые координаты контейнера танка.
  static smokesAt(
    scene: Phaser.Scene,
    originX: number,
    originY: number,
    scale = 1,
  ): Phaser.GameObjects.Particles.ParticleEmitter[] {
    const made: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
    for (const focus of Tank.fireFoci()) {
      const power = focus.power * scale;
      // Старт чуть выше языков огня, чтобы столб читался над пламенем.
      const x = originX + focus.x * scale;
      const y = originY + (focus.y - 30 * focus.power) * scale;
      made.push(Tank.plumeAt(scene, x, y, power));
    }
    // Общий широкий шлейф над всей кучей.
    const mid = Tank.fireFoci()[0];
    const haze = scene.add.particles(
      originX + mid.x * scale,
      originY + (mid.y - 48) * scale,
      Tank.puffKey(scene),
      {
        x: { min: -42 * scale, max: 42 * scale },
        y: { min: -6 * scale, max: 10 * scale },
        lifespan: { min: 1800, max: 3200 },
        frequency: 55,
        quantity: 2,
        speedX: { min: -16 * scale, max: 20 * scale },
        speedY: { min: -55 * scale, max: -22 * scale },
        scale: { start: 1.1 * scale, end: 3.8 * scale },
        alpha: { start: 0.55, end: 0 },
        color: [0x5a5348, 0x3e3830, 0x2a2620, 0x181410],
        gravityY: -18 * scale,
      },
    );
    haze.setDepth(31);
    made.push(haze);
    return made;
  }

  // Один столб копоти. power — сила очага (и масштаб студии).
  private static plumeAt(
    scene: Phaser.Scene,
    x: number,
    y: number,
    power: number,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const smoke = scene.add.particles(x, y, Tank.puffKey(scene), {
      x: { min: -16 * power, max: 16 * power },
      y: { min: -4 * power, max: 8 * power },
      lifespan: { min: 1200, max: 2400 },
      frequency: Math.max(36, Math.round(58 / Math.max(0.4, power))),
      quantity: 2,
      speedX: { min: -20 * power, max: 24 * power },
      speedY: { min: -78 * power, max: -32 * power },
      scale: { start: 0.75 * power, end: 3.0 * power },
      alpha: { start: 0.82, end: 0 },
      color: [0x6e665c, 0x4c463e, 0x322e28, 0x1c1814],
      gravityY: -26 * power,
    });
    // Выше пламени (27–29), иначе ADD-огонь съедает светлый дым.
    smoke.setDepth(30);
    return smoke;
  }

  // Живое пламя над обломками: несколько очагов, выше и шире статичной картинки.
  // originX/Y — мировые координаты контейнера танка; scale — увеличение в студии.
  static firesAt(
    scene: Phaser.Scene,
    originX: number,
    originY: number,
    scale = 1,
  ): Phaser.GameObjects.Particles.ParticleEmitter[] {
    const texture = Tank.flameKey(scene);
    const made: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
    for (const focus of Tank.fireFoci()) {
      const power = focus.power * scale;
      const x = originX + focus.x * scale;
      const y = originY + focus.y * scale;
      // Широкое мягкое пламя: языки вверх, колышутся в стороны.
      const flame = scene.add.particles(x, y, texture, {
        x: { min: -17 * power, max: 17 * power },
        y: { min: 0, max: 8 * power },
        lifespan: { min: 380, max: 820 },
        frequency: Math.max(28, Math.round(48 / focus.power)),
        quantity: 2,
        speedX: { min: -28 * power, max: 28 * power },
        speedY: { min: -110 * power, max: -48 * power },
        scale: { start: 0.85 * power, end: 2.6 * power },
        alpha: { start: 0.95, end: 0 },
        color: [0xfff6c8, 0xffcc44, 0xff7a18, 0xe03808, 0x6a1408],
        blendMode: Phaser.BlendModes.ADD,
        gravityY: -40 * power,
      });
      flame.setDepth(27);
      made.push(flame);
      // Яркое ядро у земли очага — меньше и горячее.
      const core = scene.add.particles(x, y + 2 * scale, texture, {
        x: { min: -8 * power, max: 8 * power },
        y: { min: -2 * power, max: 4 * power },
        lifespan: { min: 180, max: 360 },
        frequency: Math.max(36, Math.round(60 / focus.power)),
        quantity: 1,
        speedX: { min: -12 * power, max: 12 * power },
        speedY: { min: -50 * power, max: -18 * power },
        scale: { start: 0.45 * power, end: 1.1 * power },
        alpha: { start: 1, end: 0.15 },
        color: [0xffffff, 0xfff0a0, 0xffaa33],
        blendMode: Phaser.BlendModes.ADD,
      });
      core.setDepth(28);
      made.push(core);
    }
    // Искры-угольки над всей кучей.
    const mid = Tank.fireFoci()[0];
    const embers = scene.add.particles(originX + mid.x * scale, originY + mid.y * scale, texture, {
      x: { min: -35 * scale, max: 35 * scale },
      y: { min: -4 * scale, max: 10 * scale },
      lifespan: { min: 700, max: 1400 },
      frequency: 70,
      quantity: 1,
      speedX: { min: -40 * scale, max: 40 * scale },
      speedY: { min: -130 * scale, max: -60 * scale },
      scale: { start: 0.22 * scale, end: 0.05 * scale },
      alpha: { start: 1, end: 0 },
      color: [0xffe080, 0xff6010, 0xc03008],
      blendMode: Phaser.BlendModes.ADD,
      gravityY: -10 * scale,
    });
    embers.setDepth(29);
    made.push(embers);
    return made;
  }
}
