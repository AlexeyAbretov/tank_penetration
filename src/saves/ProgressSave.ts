// Улучшения между проигрышами. Партия стирается со смертью базы,
// а эти уровни и непотраченный score остаются в localStorage.

import { LaserDefense } from '../entities/LaserDefense';
import { MachineGun } from '../entities/MachineGun';
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
  // Сколько раз докуплена пуля пулемёта. 0 — одна пуля, 9 — десять.
  bullets: number;
  // Сколько раз докуплен урон пули пулемёта. 0 — базовый урон пули.
  mgDamage: number;
  // Сколько раз докуплен луч лазера. 0 — один луч, 2 — три. Цена — общая, 500 + 500 × уровень.
  laserShots: number;
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
    progress.bullets = 0;
    progress.mgDamage = 0;
    progress.laserShots = 0;
    this.save(progress);
    Tank.setProgressSpeedLevel(0);
    Tank.setProgressBlastLevel(0);
    Tank.setProgressKnockbackLevel(0);
    Tank.setProgressPierceLevel(0);
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
      points: 0,
      damage: 0,
      blast: 0,
      knockback: 0,
      pierce: 0,
      speed: 0,
      bullets: 0,
      mgDamage: 0,
      laserShots: 0,
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
    bullets: requiredInt(value.bullets, 0, MachineGun.maxBulletLevel) ?? 0,
    mgDamage: requiredInt(value.mgDamage, 0, MG_DAMAGE_LEVEL_MAX) ?? 0,
    laserShots: requiredInt(value.laserShots, 0, LaserDefense.maxShotLevel) ?? 0,
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
