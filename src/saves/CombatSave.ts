// Партия в localStorage. Обновление и закрытие вкладки поднимают ту же волну,
// а не новую игру. Снаряды не пишем: после загрузки враги просто стреляют заново.
// Лежащие мины пишем: иначе поставленный заряд пропадает вместе с вкладкой.
// Стену огня пишем вместе с остатком срока: горение потом станет длиннее вкладки.
// Дебаг-партия — отдельный наследник: другой ключ и другая пустая запись.

import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { Mines } from '../entities/Mines';
import { NuclearStrike } from '../entities/NuclearStrike';
import { EnemyFactory } from '../entities/EnemyFactory';
import { Tank } from '../entities/Tank/Tank';
import { TankBaseHp } from '../entities/Tank/TankBaseHp';
import { ENEMY_HASTE, GAME } from '../gameConfig';
import {
  ENEMY_KINDS,
  type EnemySave,
  type EnemySaveKind,
  type WavePhase,
} from '../types/EnemySave';

export type { EnemySave, WavePhase } from '../types/EnemySave';

const CAMPAIGN_KEY = 'tank-penetration-combat:v1';

export type ShopSave = {
  blast: number;
  damage: number;
  fireRate: number;
  // Уровни отталкивания снарядом. Старые сохранения читают 0.
  knockback: number;
  // Уровни шанса прошивания. Старые сохранения читают 0.
  pierce: number;
  wire: boolean;
  machineGun: boolean;
  laser: boolean;
  flame: boolean;
  salvo: boolean;
  artillery: boolean;
  mines: boolean;
  nuclear: boolean;
  autoFire: boolean;
  autoFireOn: boolean;
  mgDamage: number;
  wireDamage: number;
  flameDamage: number;
  salvoDamage: number;
  artilleryDamage: number;
  minesDamage: number;
};

export type PlantedMineSave = {
  x: number;
  y: number;
};

export type FlameWallSave = {
  points: PlantedMineSave[];
  // Общий остаток: полное горение, сжатие костров и гашение земли.
  left: number;
};

export type SavedRun = {
  version: 1;
  score: number;
  coins: number;
  hp: number;
  haste: number;
  artilleryCooldownMs: number;
  minesCooldownMs: number;
  nuclearCooldownMs: number;
  flameCooldownMs: number;
  flameWall: FlameWallSave | null;
  wave: number;
  phase: WavePhase;
  spawned: number;
  enemies: EnemySave[];
  plantedMines: PlantedMineSave[];
  shop: ShopSave;
};

export class CombatSave {
  // Читает партию. null — начинать волну 1 с пустым магазином.
  // Битую запись стираем, чтобы следующий заход не спотыкался о неё снова.
  load(): SavedRun | null {
    let raw: string | null = null;
    try {
      // getItem бросает, если браузер запретил хранилище. Для игры это просто «сохранения нет».
      raw = localStorage.getItem(this.storageKey());
    } catch {
      return this.emptyRun();
    }
    if (!raw) {
      return this.emptyRun();
    }
    try {
      const parsed = parseRun(JSON.parse(raw), this.hpMax());
      if (!parsed) {
        this.clear();
        return this.emptyRun();
      }
      return parsed;
    } catch {
      this.clear();
      return this.emptyRun();
    }
  }

  save(data: SavedRun): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(data));
    } catch {
      // Приватный режим или переполненная квота: партия просто не переживёт закрытие вкладки.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.storageKey());
    } catch {
      // Хранилище недоступно — стирать нечего.
    }
  }

  // Обычная партия лежит отдельно от дебага, чтобы проверка юнитов её не затёрла.
  protected storageKey(): string {
    return CAMPAIGN_KEY;
  }

  // Потолок сохранённого здоровья. Дебаг подставляет свой.
  protected hpMax(): number {
    return TankBaseHp.max;
  }

  // Пустого сохранения нет: сцена сама запускает первую волну.
  protected emptyRun(): SavedRun | null {
    return null;
  }
}

function parseRun(value: unknown, hpMax: number): SavedRun | null {
  // version отсекает старый формат. Поле из будущего файла тоже не подойдёт: игра его не понимает.
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }
  const score = requiredInt(value.score, 0, 1_000_000);
  const coins = requiredInt(value.coins, 0, 1_000_000);
  const hp =
    typeof value.hp === 'number' && value.hp >= 1 ? requiredInt(value.hp, 1, hpMax) : null;
  const wave = requiredInt(value.wave, 1, 10_000);
  const phase = value.phase === 'combat' || value.phase === 'shop' ? value.phase : null;
  const shop = parseShop(value.shop);
  if (score === null || coins === null || hp === null || wave === null || phase === null || !shop) {
    return null;
  }

  const haste = requiredInt(value.haste, 1, ENEMY_HASTE.max) ?? 1;
  const artilleryCooldownMs =
    requiredInt(value.artilleryCooldownMs, 0, ArtilleryStrike.shop.cooldownMs) ?? 0;
  const minesCooldownMs = requiredInt(value.minesCooldownMs, 0, Mines.shop.cooldownMs) ?? 0;
  const nuclearCooldownMs =
    requiredInt(value.nuclearCooldownMs, 0, NuclearStrike.shop.cooldownMs) ?? 0;
  // Старые сохранения не писали перезарядку огнемёта: струя просто ждёт новый заход.
  const flameCooldownMs = requiredInt(value.flameCooldownMs, 0, 60 * 60 * 1000) ?? 0;
  // Старые сохранения не писали стену огня: на поле её не было.
  const flameWall = parseFlameWall(value.flameWall);
  // В магазине список врагов пустой по смыслу фазы, даже если в JSON они остались.
  const enemies = phase === 'shop' ? [] : parseEnemies(value.enemies);
  // Старые сохранения не писали лежащие мины: поля просто нет, зарядов на нём не было.
  const plantedMines = parsePlantedMines(value.plantedMines);
  const spawned =
    phase === 'shop'
      ? 0
      : Math.min(
          EnemyFactory.wave.maxCount,
          Math.max(enemies.length, requiredInt(value.spawned, 0, EnemyFactory.wave.maxCount) ?? 0),
        );

  return {
    version: 1,
    score,
    coins,
    hp,
    haste,
    artilleryCooldownMs,
    minesCooldownMs,
    nuclearCooldownMs,
    flameCooldownMs,
    flameWall,
    wave,
    phase,
    spawned,
    enemies,
    plantedMines,
    shop,
  };
}

function parseShop(value: unknown): ShopSave | null {
  if (!isRecord(value)) {
    return null;
  }
  const blast = requiredInt(value.blast, 0, Tank.maxShopBlastLevel);
  const damage = requiredInt(value.damage, 0, 500);
  const fireRate = requiredInt(value.fireRate, 0, Tank.maxFireRateLevel);
  // Старые сохранения не писали отталкивание: снаряд врагов не толкал.
  const knockback = requiredInt(value.knockback, 0, Tank.maxShopKnockbackLevel) ?? 0;
  // Старые сохранения не писали пробивание: снаряд всегда рвался о первого.
  const pierce = requiredInt(value.pierce, 0, Tank.maxPierceChance) ?? 0;
  const wire = flag(value.wire);
  const machineGun = flag(value.machineGun);
  const artillery = flag(value.artillery);
  // Старые сохранения не писали мины, атомный взрыв и лазер: этих покупок ещё не было.
  const mines = flag(value.mines) ?? false;
  const laser = flag(value.laser) ?? false;
  // Старые сохранения не писали огнемёт: этой покупки ещё не было.
  const flame = flag(value.flame) ?? false;
  // Старые сохранения не писали РСЗО: этой покупки ещё не было.
  const salvo = flag(value.salvo) ?? false;
  const nuclear = flag(value.nuclear) ?? false;
  const autoFire = flag(value.autoFire);
  // Старые сохранения не писали выключатель: купленная автострельба была всегда включена.
  const autoFireOn = flag(value.autoFireOn) ?? (autoFire === true);
  // Старые сохранения не писали урон партии у пулемёта, проволоки, огнемёта, РСЗО, артиллерии и мин.
  const mgDamage = requiredInt(value.mgDamage, 0, 500) ?? 0;
  const wireDamage = requiredInt(value.wireDamage, 0, 500) ?? 0;
  const flameDamage = requiredInt(value.flameDamage, 0, 500) ?? 0;
  const salvoDamage = requiredInt(value.salvoDamage, 0, 500) ?? 0;
  const artilleryDamage = requiredInt(value.artilleryDamage, 0, 500) ?? 0;
  const minesDamage = requiredInt(value.minesDamage, 0, 500) ?? 0;
  if (
    blast === null ||
    damage === null ||
    fireRate === null ||
    wire === null ||
    machineGun === null ||
    artillery === null ||
    autoFire === null
  ) {
    return null;
  }
  return {
    blast,
    damage,
    fireRate,
    knockback,
    pierce,
    wire,
    machineGun,
    laser,
    flame,
    salvo,
    artillery,
    mines,
    nuclear,
    autoFire,
    autoFireOn: autoFire && autoFireOn,
    mgDamage,
    wireDamage,
    flameDamage,
    salvoDamage,
    artilleryDamage,
    minesDamage,
  };
}

function parseFlameWall(value: unknown): FlameWallSave | null {
  if (!isRecord(value)) {
    return null;
  }
  const left = requiredInt(value.left, 1, 60 * 60 * 1000);
  if (left === null || !Array.isArray(value.points)) {
    return null;
  }
  const points: PlantedMineSave[] = [];
  for (const entry of value.points) {
    if (points.length >= 64 || !isRecord(entry)) {
      continue;
    }
    const x = finite(entry.x, -400, 8000);
    const y = finite(entry.y, -200, 2000);
    if (x === null || y === null) {
      continue;
    }
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  if (points.length === 0) {
    return null;
  }
  return { points, left };
}

function parsePlantedMines(value: unknown): PlantedMineSave[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const field = Mines.field;
  const mines: PlantedMineSave[] = [];
  for (const entry of value) {
    if (mines.length >= 48 || !isRecord(entry)) {
      continue;
    }
    const x = finite(entry.x, field.minX, field.maxX);
    const y = finite(entry.y, field.minY, field.maxY);
    if (x === null || y === null) {
      continue;
    }
    mines.push({ x: Math.round(x), y: Math.round(y) });
  }
  return mines;
}

function parseEnemies(value: unknown): EnemySave[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const enemies: EnemySave[] = [];
  for (const entry of value) {
    if (enemies.length >= EnemyFactory.wave.maxCount || !isRecord(entry)) {
      continue;
    }
    const kind = enemyKind(entry.kind);
    const x = finite(entry.x, -200, GAME.width + 400);
    const y = finite(entry.y, 0, GAME.height);
    const hp = requiredInt(entry.hp, 1, 100_000);
    const pace = requiredInt(entry.pace, 1, 10_000);
    if (!kind || x === null || y === null || hp === null || pace === null) {
      continue;
    }
    enemies.push({ kind, x, y, hp, pace });
  }
  return enemies;
}

function enemyKind(value: unknown): EnemySaveKind | null {
  if (typeof value !== 'string' || !(ENEMY_KINDS as readonly string[]).includes(value)) {
    return null;
  }
  return value as EnemySaveKind;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function flag(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function finite(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
}

function requiredInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
