// Партия в localStorage. Обновление и закрытие вкладки поднимают ту же волну,
// а не новую игру. Снаряды не пишем: после загрузки враги просто стреляют заново.

import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { ENEMY_KINDS, EnemyFactory, type EnemySaveKind } from '../entities/EnemyFactory';
import { Tank } from '../entities/Tank';
import { ENEMY_HASTE, GAME } from '../gameConfig';

const STORAGE_KEY = 'tank-penetration-run:v1';

export type WavePhase = 'combat' | 'shop';

export type EnemySave = {
  kind: EnemySaveKind;
  x: number;
  y: number;
  hp: number;
  pace: number;
};

export type ShopSave = {
  blast: number;
  damage: number;
  fireRate: number;
  wire: boolean;
  machineGun: boolean;
  artillery: boolean;
  autoFire: boolean;
};

export type RunSave = {
  version: 1;
  score: number;
  coins: number;
  hp: number;
  haste: number;
  artilleryCooldownMs: number;
  wave: number;
  phase: WavePhase;
  spawned: number;
  enemies: EnemySave[];
  shop: ShopSave;
};

export function loadRun(): RunSave | null {
  let raw: string | null = null;
  try {
    // getItem бросает, если браузер запретил хранилище. Для игры это просто «сохранения нет».
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed = parseRun(JSON.parse(raw));
    if (!parsed) {
      // Битая или старая запись. Стираем, чтобы следующий заход начал чистую партию.
      clearRun();
    }
    return parsed;
  } catch {
    clearRun();
    return null;
  }
}

export function saveRun(data: RunSave): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Приватный режим или переполненная квота: партия просто не переживёт закрытие вкладки.
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Хранилище недоступно — стирать нечего.
  }
}

function parseRun(value: unknown): RunSave | null {
  // version отсекает старый формат. Поле из будущего файла тоже не подойдёт: игра его не понимает.
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }
  const score = requiredInt(value.score, 0, 1_000_000);
  const coins = requiredInt(value.coins, 0, 1_000_000);
  const hp =
    typeof value.hp === 'number' && value.hp >= 1 ? requiredInt(value.hp, 1, Tank.baseHp) : null;
  const wave = requiredInt(value.wave, 1, 10_000);
  const phase = value.phase === 'combat' || value.phase === 'shop' ? value.phase : null;
  const shop = parseShop(value.shop);
  if (score === null || coins === null || hp === null || wave === null || phase === null || !shop) {
    return null;
  }

  const haste = requiredInt(value.haste, 1, ENEMY_HASTE.max) ?? 1;
  const artilleryCooldownMs =
    requiredInt(value.artilleryCooldownMs, 0, ArtilleryStrike.shop.cooldownMs) ?? 0;
  // В магазине список врагов пустой по смыслу фазы, даже если в JSON они остались.
  const enemies = phase === 'shop' ? [] : parseEnemies(value.enemies);
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
    wave,
    phase,
    spawned,
    enemies,
    shop,
  };
}

function parseShop(value: unknown): ShopSave | null {
  if (!isRecord(value)) {
    return null;
  }
  const blast = requiredInt(value.blast, 0, 500);
  const damage = requiredInt(value.damage, 0, 500);
  const fireRate = requiredInt(value.fireRate, 0, Tank.maxFireRateLevel);
  const wire = flag(value.wire);
  const machineGun = flag(value.machineGun);
  const artillery = flag(value.artillery);
  const autoFire = flag(value.autoFire);
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
  return { blast, damage, fireRate, wire, machineGun, artillery, autoFire };
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
