// Улучшения между проигрышами. Партия стирается со смертью базы,
// а эти уровни и непотраченный score остаются в localStorage.

import { Tank } from '../entities/Tank/Tank';

const CAMPAIGN_KEY = 'tank-penetration-progress:v1';
const SCORE_MAX = 100_000_000;
const LEVEL_MAX = 500;

export type SavedProgress = {
  version: 1;
  score: number;
  awaitingShop: boolean;
  coins: number;
  damage: number;
  blast: number;
  speed: number;
};

export class ProgressSave {
  // Одна запись на экземпляр. Магазин держит её и меняет поля, сцена читает те же числа.
  private current: SavedProgress | null = null;

  // Первая покупка стоит 500. Каждая следующая — на 500 × уже купленный уровень дороже:
  // 500, 1000, 1500, …
  static cost(level: number): number {
    return 500 + Math.max(0, level) * 500;
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
    progress.damage = 0;
    progress.blast = 0;
    progress.speed = 0;
    this.save(progress);
    Tank.setProgressSpeedLevel(0);
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

  private empty(): SavedProgress {
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
    damage: requiredInt(value.damage, 0, LEVEL_MAX) ?? 0,
    blast: requiredInt(value.blast, 0, LEVEL_MAX) ?? 0,
    speed: requiredInt(value.speed, 0, Tank.maxProgressSpeedLevel) ?? 0,
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
