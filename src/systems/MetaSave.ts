// Улучшения между проигрышами. Партия стирается со смертью базы,
// а эти уровни и непотраченный score остаются в localStorage.

import { Tank } from '../entities/Tank';

const STORAGE_KEY = 'tank-penetration-meta:v1';
const SCORE_MAX = 100_000_000;
const LEVEL_MAX = 500;

export type MetaSave = {
  version: 1;
  score: number;
  awaitingShop: boolean;
  coins: number;
  damage: number;
  blast: number;
  speed: number;
};

// Первая покупка стоит 500. Каждая следующая — на 500 × уже купленный уровень дороже:
// 500, 1000, 1500, …
export function metaCost(level: number): number {
  return 500 + Math.max(0, level) * 500;
}

let current: MetaSave | null = null;

export function loadMeta(): MetaSave {
  if (current) {
    return current;
  }
  current = read() ?? emptyMeta();
  return current;
}

// Чистая партия: ни score, ни купленных уровней.
export function resetMeta(): void {
  const meta = loadMeta();
  meta.score = 0;
  meta.awaitingShop = false;
  meta.coins = 0;
  meta.damage = 0;
  meta.blast = 0;
  meta.speed = 0;
  saveMeta(meta);
  Tank.setMetaSpeedLevel(0);
}

export function saveMeta(data: MetaSave): void {
  current = data;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Приватный режим или переполненная квота: улучшения живут до закрытия вкладки.
  }
}

function emptyMeta(): MetaSave {
  return {
    version: 1,
    score: 0,
    awaitingShop: false,
    coins: 0,
    damage: 0,
    blast: 0,
    speed: 0,
  };
}

function read(): MetaSave | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed = parseMeta(JSON.parse(raw));
    if (!parsed) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Хранилище недоступно — стирать нечего.
    }
    return null;
  }
}

function parseMeta(value: unknown): MetaSave | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }
  return {
    version: 1,
    score: requiredInt(value.score, 0, SCORE_MAX) ?? 0,
    awaitingShop: value.awaitingShop === true,
    coins: requiredInt(value.coins, 0, LEVEL_MAX) ?? 0,
    damage: requiredInt(value.damage, 0, LEVEL_MAX) ?? 0,
    blast: requiredInt(value.blast, 0, LEVEL_MAX) ?? 0,
    speed: requiredInt(value.speed, 0, Tank.maxMetaSpeedLevel) ?? 0,
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
