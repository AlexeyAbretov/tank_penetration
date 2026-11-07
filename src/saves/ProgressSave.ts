// Улучшения между проигрышами. Партия стирается со смертью базы,
// а эти уровни и непотраченный score остаются в localStorage.

import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { IonCannon } from '../entities/IonCannon';
import { LaserDefense } from '../entities/LaserDefense';
import { MachineGun } from '../entities/MachineGun';
import { Mines } from '../entities/Mines';
import { NuclearStrike } from '../entities/NuclearStrike';
import { RocketSalvo } from '../entities/RocketSalvo';
import { Tank } from '../entities/Tank/Tank';

const CAMPAIGN_KEY = 'tank-penetration-progress:v1';
const SCORE_MAX = 100_000_000;
const LEVEL_MAX = 500;
// Потолка в магазине нет. Число только держит запись в целом.
const MG_DAMAGE_LEVEL_MAX = 1_000_000;

export type SavedProgress = {
  version: 1;
  score: number;
  awaitingShop: boolean;
  coins: number;
  // Сколько лишних очков даёт каждое убийство. 0 — только базовые 10.
  points: number;
  damage: number;
  blast: number;
  // Пиксели отталкивания снарядом танка. 0 — снаряд не толкает.
  knockback: number;
  // Проценты шанса прошивания снарядом. 0 — снаряд всегда рвётся о первого.
  pierce: number;
  speed: number;
  // Сколько раз укорочен полёт снаряда. 0 — базовые 2 с через поле.
  flight: number;
  // Сколько раз докуплена пуля пулемёта. 0 — одна пуля, 9 — десять.
  bullets: number;
  // Сколько раз докуплен урон пули пулемёта. 0 — базовый урон пули.
  mgDamage: number;
  // Сколько раз укорочена пауза пулемёта. 0 — базовые 3 с. Прогресс сам останавливается на 0,50 с.
  mgSpeed: number;
  // Сколько раз укорочен полёт пули. 0 — базовые 2 с. Прогресс сам останавливается на 0,60 с.
  mgFlight: number;
  // Сколько раз докуплен луч лазера. 0 — один луч, 2 — три. Цена — общая, 500 + 500 × уровень.
  laserShots: number;
  // Сколько раз укорочен откат лазера. 0 — базовые 3 с. Прогресс сам останавливается на 1 с.
  laserCooldown: number;
  // Сколько раз докуплена ракета РСЗО. 0 — три ракеты, 5 — восемь. Цена — 1000 + 1000 × уровень.
  salvoRockets: number;
  // Сколько раз докуплен снаряд артиллерии. 0 — три снаряда, 3 — шесть. Цена — 1000 + 1000 × уровень.
  artilleryShells: number;
  // Сколько раз докуплена мина. 0 — три мины, 3 — шесть. Цена — 1000 + 1000 × уровень.
  minesCount: number;
  // Сколько раз докуплен урон ракеты РСЗО. 0 — базовый урон. Потолка нет. Цена как у урона пули.
  salvoDamage: number;
  // Сколько раз докуплен урон снаряда артиллерии. 0 — базовый урон. Потолка нет. Цена как у урона пули.
  artilleryDamage: number;
  // Сколько раз докуплен урон ионной пушки. 0 — базовый урон. Потолка нет. Цена как у урона пули.
  ionDamage: number;
  // Сколько раз докуплен урон мины. 0 — базовый урон. Потолка нет. Цена как у урона пули.
  minesDamage: number;
  // Сколько раз докуплен урон колючей проволоки. 0 — базовый урон. Потолка нет. Цена как у урона пули.
  wireDamage: number;
  // Сколько раз укорочен откат артиллерии. 0 — базовая минута. Прогресс сам останавливается на 40 с.
  artilleryCooldown: number;
  // Сколько раз укорочен откат ионной пушки. 0 — базовая минута. Прогресс сам останавливается на 40 с.
  ionCooldown: number;
  // Сколько раз укорочен откат мин. 0 — базовая минута. Прогресс сам останавливается на 40 с.
  minesCooldown: number;
  // Сколько раз укорочен откат атомного взрыва. 0 — базовые 3 минуты. Прогресс сам останавливается на 2:30.
  nuclearCooldown: number;
  // Куплена ли автострельба. Танк стреляет сам, пока включена иконка справа.
  autoFire: boolean;
  // Выключатель уже купленной автострельбы. Пока false, танк ждёт левую кнопку.
  autoFireOn: boolean;
  // Куплено ли автонаведение. Башня сама держит одну цель, пока та жива.
  autoAim: boolean;
  // Выключатель уже купленного автонаведения. Пока false, башню ведёт курсор.
  autoAimOn: boolean;
  // Куплено ли автоприменение артиллерии. Удар сам через секунду после готовности.
  autoArtillery: boolean;
  // Выключатель уже купленного автоприменения. Пока false, удар ждёт клавишу или иконку.
  autoArtilleryOn: boolean;
  // Куплено ли автоприменение мин. Постановка сама через секунду после готовности.
  autoMines: boolean;
  // Выключатель уже купленного автоприменения. Пока false, мины ждут клавишу или иконку.
  autoMinesOn: boolean;
  // Куплено ли автоприменение ионной пушки. Луч сам через секунду после готовности.
  autoIon: boolean;
  // Выключатель уже купленного автоприменения. Пока false, луч ждёт клавишу или иконку.
  autoIonOn: boolean;
};

export class ProgressSave {
  // Одна запись на экземпляр. Магазин держит её и меняет поля, сцена читает те же числа.
  private current: SavedProgress | null = null;

  // Первая покупка стоит 500. Каждая следующая — на 500 × уже купленный уровень дороже:
  // 500, 1000, 1500, …
  static cost(level: number): number {
    return 500 + Math.max(0, level) * 500;
  }

  // Первая дополнительная пуля стоит 100. Каждая следующая — на 100 × уже купленный уровень дороже:
  // 100, 200, 300, …
  static bulletCost(level: number): number {
    return 100 + Math.max(0, level) * 100;
  }

  // Первая прибавка урона пули стоит 300. Каждая следующая — на 300 × уже купленный уровень дороже:
  // 300, 600, 900, …
  static mgDamageCost(level: number): number {
    return 300 + Math.max(0, level) * 300;
  }

  // Первый пиксель отталкивания стоит 300. Каждая следующая — на 300 × уже купленный уровень дороже:
  // 300, 600, 900, …
  static knockbackCost(level: number): number {
    return 300 + Math.max(0, level) * 300;
  }

  // Первый процент пробивания стоит 300. Каждая следующая — на 300 × уже купленный уровень дороже:
  // 300, 600, 900, …
  static pierceCost(level: number): number {
    return 300 + Math.max(0, level) * 300;
  }

  // Одна покупка. Танк стреляет сам, пока включена иконка справа.
  static autoFireCost(): number {
    return 5_000;
  }

  // Одна покупка. Башня сама держит ближайшего врага и не бросает его, пока он жив.
  static autoAimCost(): number {
    return 50_000;
  }

  // Одна покупка. Артиллерия сама бьёт через секунду после готовности, пока включён выключатель на иконке.
  static autoArtilleryCost(): number {
    return 20_000;
  }

  // Одна покупка. Мины сами встают через секунду после готовности, пока включён выключатель на иконке.
  static autoMinesCost(): number {
    return 20_000;
  }

  // Одна покупка. Ионная пушка сама бьёт через секунду после готовности, пока включён выключатель на иконке.
  static autoIonCost(): number {
    return 20_000;
  }

  // Первая секунда перезарядки лазера стоит 5000, вторая — 50000.
  static laserCooldownCost(level: number): number {
    return Math.max(0, level) < 1 ? 5_000 : 50_000;
  }

  // Первая лишняя ракета, снаряд или мина стоит 1000.
  // Каждая следующая того же улучшения — на 1000 × уже купленный уровень дороже:
  // 1000, 2000, 3000, …
  static countCost(level: number): number {
    return 1000 + Math.max(0, level) * 1000;
  }

  load(): SavedProgress {
    if (this.current) {
      return this.current;
    }
    this.current = this.read() ?? this.empty();
    return this.current;
  }

  // Чистая партия: ни score, ни купленных уровней.
  reset(): void {
    const progress = this.load();
    progress.score = 0;
    progress.awaitingShop = false;
    progress.coins = 0;
    progress.points = 0;
    progress.damage = 0;
    progress.blast = 0;
    progress.knockback = 0;
    progress.pierce = 0;
    progress.speed = 0;
    progress.flight = 0;
    progress.bullets = 0;
    progress.mgDamage = 0;
    progress.mgSpeed = 0;
    progress.mgFlight = 0;
    progress.laserShots = 0;
    progress.laserCooldown = 0;
    progress.salvoRockets = 0;
    progress.artilleryShells = 0;
    progress.minesCount = 0;
    progress.salvoDamage = 0;
    progress.artilleryDamage = 0;
    progress.ionDamage = 0;
    progress.minesDamage = 0;
    progress.wireDamage = 0;
    progress.artilleryCooldown = 0;
    progress.ionCooldown = 0;
    progress.minesCooldown = 0;
    progress.nuclearCooldown = 0;
    progress.autoFire = false;
    progress.autoFireOn = false;
    progress.autoAim = false;
    progress.autoAimOn = false;
    progress.autoArtillery = false;
    progress.autoArtilleryOn = false;
    progress.autoMines = false;
    progress.autoMinesOn = false;
    progress.autoIon = false;
    progress.autoIonOn = false;
    this.save(progress);
    Tank.setProgressSpeedLevel(0);
    Tank.setProgressFlightLevel(0);
    MachineGun.setProgressSpeedLevel(0);
    MachineGun.setProgressFlightLevel(0);
    Tank.setProgressBlastLevel(0);
    Tank.setProgressKnockbackLevel(0);
    Tank.setProgressPierceLevel(0);
    RocketSalvo.setProgressRocketLevel(0);
    ArtilleryStrike.setProgressShellLevel(0);
    Mines.setProgressMineLevel(0);
    ArtilleryStrike.setProgressCooldownLevel(0);
    IonCannon.setProgressCooldownLevel(0);
    Mines.setProgressCooldownLevel(0);
    NuclearStrike.setProgressCooldownLevel(0);
    LaserDefense.setProgressCooldownLevel(0);
  }

  save(data: SavedProgress): void {
    this.current = data;
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(data));
    } catch {
      // Приватный режим или переполненная квота: улучшения живут до закрытия вкладки.
    }
  }

  // Обычный прогресс лежит отдельно от дебага, чтобы проверка юнитов его не затёрла.
  protected storageKey(): string {
    return CAMPAIGN_KEY;
  }

  protected empty(): SavedProgress {
    return {
      version: 1,
      score: 0,
      awaitingShop: false,
      coins: 0,
      points: 0,
      damage: 0,
      blast: 0,
      knockback: 0,
      pierce: 0,
      speed: 0,
      flight: 0,
      bullets: 0,
      mgDamage: 0,
      mgSpeed: 0,
      mgFlight: 0,
      laserShots: 0,
      laserCooldown: 0,
      salvoRockets: 0,
      artilleryShells: 0,
      minesCount: 0,
      salvoDamage: 0,
      artilleryDamage: 0,
      ionDamage: 0,
      minesDamage: 0,
      wireDamage: 0,
      artilleryCooldown: 0,
      ionCooldown: 0,
      minesCooldown: 0,
      nuclearCooldown: 0,
      autoFire: false,
      autoFireOn: false,
      autoAim: false,
      autoAimOn: false,
      autoArtillery: false,
      autoArtilleryOn: false,
      autoMines: false,
      autoMinesOn: false,
      autoIon: false,
      autoIonOn: false,
    };
  }

  private read(): SavedProgress | null {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(this.storageKey());
    } catch {
      return null;
    }
    if (!raw) {
      return null;
    }
    try {
      const parsed = parseProgress(JSON.parse(raw));
      if (!parsed) {
        localStorage.removeItem(this.storageKey());
      }
      return parsed;
    } catch {
      try {
        localStorage.removeItem(this.storageKey());
      } catch {
        // Хранилище недоступно — стирать нечего.
      }
      return null;
    }
  }
}

function parseProgress(value: unknown): SavedProgress | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }
  return {
    version: 1,
    score: requiredInt(value.score, 0, SCORE_MAX) ?? 0,
    awaitingShop: value.awaitingShop === true,
    coins: requiredInt(value.coins, 0, LEVEL_MAX) ?? 0,
    points: requiredInt(value.points, 0, LEVEL_MAX) ?? 0,
    damage: requiredInt(value.damage, 0, LEVEL_MAX) ?? 0,
    blast: requiredInt(value.blast, 0, Tank.maxProgressBlastLevel) ?? 0,
    // Старые сохранения не писали отталкивание: снаряд врагов не толкал.
    knockback: requiredInt(value.knockback, 0, Tank.maxProgressKnockbackLevel) ?? 0,
    // Старые сохранения не писали пробивание: снаряд всегда рвался о первого.
    pierce: requiredInt(value.pierce, 0, Tank.maxProgressPierceLevel) ?? 0,
    speed: requiredInt(value.speed, 0, Tank.maxProgressSpeedLevel) ?? 0,
    // Старые сохранения не писали полёт: снаряд шёл базовые 2 с.
    flight: requiredInt(value.flight, 0, Tank.maxProgressFlightLevel) ?? 0,
    bullets: requiredInt(value.bullets, 0, MachineGun.maxBulletLevel) ?? 0,
    mgDamage: requiredInt(value.mgDamage, 0, MG_DAMAGE_LEVEL_MAX) ?? 0,
    // Старые сохранения не писали перезарядку и полёт пулемёта: пауза 3 с, полёт 2 с.
    mgSpeed: requiredInt(value.mgSpeed, 0, MachineGun.maxProgressSpeedLevel) ?? 0,
    mgFlight: requiredInt(value.mgFlight, 0, MachineGun.maxProgressFlightLevel) ?? 0,
    laserShots: requiredInt(value.laserShots, 0, LaserDefense.maxShotLevel) ?? 0,
    // Старые сохранения не писали откат лазера: луч ждал базовые 3 с.
    laserCooldown: requiredInt(value.laserCooldown, 0, LaserDefense.maxProgressCooldownLevel) ?? 0,
    // Старые сохранения не писали число ракет, снарядов и мин: залп оставался базовым.
    salvoRockets: requiredInt(value.salvoRockets, 0, RocketSalvo.maxRocketLevel) ?? 0,
    artilleryShells: requiredInt(value.artilleryShells, 0, ArtilleryStrike.maxShellLevel) ?? 0,
    minesCount: requiredInt(value.minesCount, 0, Mines.maxMineLevel) ?? 0,
    // Старые сохранения не писали урон ракет, снарядов и мин: бил базовый урон.
    salvoDamage: requiredInt(value.salvoDamage, 0, MG_DAMAGE_LEVEL_MAX) ?? 0,
    artilleryDamage: requiredInt(value.artilleryDamage, 0, MG_DAMAGE_LEVEL_MAX) ?? 0,
    // Старые сохранения не писали урон ионной пушки: бил базовый урон.
    ionDamage: requiredInt(value.ionDamage, 0, MG_DAMAGE_LEVEL_MAX) ?? 0,
    minesDamage: requiredInt(value.minesDamage, 0, MG_DAMAGE_LEVEL_MAX) ?? 0,
    // Старые сохранения не писали урон проволоки: рана оставалась базовой.
    wireDamage: requiredInt(value.wireDamage, 0, MG_DAMAGE_LEVEL_MAX) ?? 0,
    // Старые сохранения не писали откат артиллерии и мин: залп и постановка ждали базовую минуту.
    artilleryCooldown: requiredInt(value.artilleryCooldown, 0, ArtilleryStrike.maxProgressCooldownLevel) ?? 0,
    // Старые сохранения не писали откат ионной пушки: луч ждал базовую минуту.
    ionCooldown: requiredInt(value.ionCooldown, 0, IonCannon.maxProgressCooldownLevel) ?? 0,
    minesCooldown: requiredInt(value.minesCooldown, 0, Mines.maxProgressCooldownLevel) ?? 0,
    // Старые сохранения не писали откат атомного взрыва: бомба ждала базовые 3 минуты.
    nuclearCooldown: requiredInt(value.nuclearCooldown, 0, NuclearStrike.maxProgressCooldownLevel) ?? 0,
    // Старые сохранения не писали автострельбу: она жила в партии и умирала с базой.
    autoFire: value.autoFire === true,
    autoFireOn: value.autoFire === true && value.autoFireOn !== false,
    // Старые сохранения не писали автонаведение: башню вёл курсор.
    autoAim: value.autoAim === true,
    autoAimOn: value.autoAim === true && value.autoAimOn !== false,
    // Старые сохранения не писали автоприменение: удар и мины ждали клавишу.
    autoArtillery: value.autoArtillery === true,
    autoArtilleryOn: value.autoArtillery === true && value.autoArtilleryOn !== false,
    autoMines: value.autoMines === true,
    autoMinesOn: value.autoMines === true && value.autoMinesOn !== false,
    // Старые сохранения не писали автоприменение луча: он ждал клавишу.
    autoIon: value.autoIon === true,
    autoIonOn: value.autoIon === true && value.autoIonOn !== false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
