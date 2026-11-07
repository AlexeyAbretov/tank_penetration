// Базовое здоровье танка в обычной партии.
// Танк это число не читает: его берёт игрок.
// Свой ключ, не ключ партии: стирание боя это число не удаляет.
// Магазин очков пишет сюда купленный запас. «Новая игра» возвращает базу.

const STORAGE_KEY = 'tank-penetration-tank-hp';
const DEFAULT_HP = 100;
const MIN_HP = 100;
// Потолок покупки. Дебаг в openStore передаёт свой: поле настроек этим числом не зажато.
const SHOP_MAX_HP = 500;
const STEP = 10;

type TankHpStore = {
  storageKey: string;
  min: number;
  max: number;
  current: number;
  onApply: ((hp: number) => void) | null;
};

export class TankBaseHp {
  static readonly step = STEP;
  static readonly shopMax = SHOP_MAX_HP;

  static get min(): number {
    return this.store.min;
  }

  static get max(): number {
    return this.store.max;
  }

  // Сколько покупок отделяют базу от потолка магазина.
  static get maxLevel(): number {
    return (TankBaseHp.shopMax - MIN_HP) / TankBaseHp.step;
  }

  // Запас после level покупок. Уровень выше потолка число не поднимает.
  static hpForLevel(level: number): number {
    const steps = Math.min(TankBaseHp.maxLevel, Math.max(0, Math.round(level)));
    return MIN_HP + steps * TankBaseHp.step;
  }

  protected static store = openTankHpStore(STORAGE_KEY, DEFAULT_HP, SHOP_MAX_HP);

  // Дебаг-наследник открывает свой ключ, свой запас по умолчанию и свой потолок.
  protected static openStore(storageKey: string, defaultHp: number, maxHp: number): TankHpStore {
    return openTankHpStore(storageKey, defaultHp, maxHp);
  }

  static currentOf(): number {
    return this.store.current;
  }

  // Повтор того же числа не трогает танк: слушатель не зовётся и полоска не лечится.
  static set(hp: number): void {
    const whole = Math.trunc(hp);
    if (!Number.isFinite(whole)) {
      return;
    }
    const next = Math.min(this.store.max, Math.max(this.store.min, whole));
    if (next === this.store.current) {
      return;
    }
    this.store.current = next;
    writeTankHp(this.store.storageKey, this.store.current);
    this.store.onApply?.(this.store.current);
  }

  static watch(apply: (hp: number) => void): () => void {
    this.store.onApply = apply;
    return () => {
      if (this.store.onApply === apply) {
        this.store.onApply = null;
      }
    };
  }
}

function openTankHpStore(storageKey: string, defaultHp: number, maxHp: number): TankHpStore {
  return {
    storageKey,
    min: MIN_HP,
    max: maxHp,
    current: readTankHp(storageKey, defaultHp, maxHp),
    onApply: null,
  };
}

function readTankHp(storageKey: string, defaultHp: number, maxHp: number): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return defaultHp;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return defaultHp;
    }
    return Math.min(maxHp, Math.max(MIN_HP, Math.trunc(value)));
  } catch {
    return defaultHp;
  }
}

function writeTankHp(storageKey: string, hp: number): void {
  try {
    localStorage.setItem(storageKey, String(hp));
  } catch {
    // Приватный режим: число работает, пока открыта вкладка.
  }
}
