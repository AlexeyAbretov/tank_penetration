// Базовое здоровье танка в обычной партии.
// Танк это число не читает: его берёт игрок.
// Свой ключ, не ключ партии: «новая игра» стирает бой, а запас остаётся.
// Менять запас будет покупка в магазине.

const STORAGE_KEY = 'tank-penetration-tank-hp';
const DEFAULT_HP = 100;
const MIN_HP = 100;
const MAX_HP = 10_000;

type TankHpStore = {
  storageKey: string;
  min: number;
  max: number;
  current: number;
  onApply: ((hp: number) => void) | null;
};

export class TankBaseHp {
  static get min(): number {
    return this.store.min;
  }

  static get max(): number {
    return this.store.max;
  }

  protected static store = openTankHpStore(STORAGE_KEY, DEFAULT_HP);

  // Дебаг-наследник открывает свой ключ и свой запас по умолчанию.
  protected static openStore(storageKey: string, defaultHp: number): TankHpStore {
    return openTankHpStore(storageKey, defaultHp);
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

function openTankHpStore(storageKey: string, defaultHp: number): TankHpStore {
  return {
    storageKey,
    min: MIN_HP,
    max: MAX_HP,
    current: readTankHp(storageKey, defaultHp),
    onApply: null,
  };
}

function readTankHp(storageKey: string, defaultHp: number): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return defaultHp;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return defaultHp;
    }
    return Math.min(MAX_HP, Math.max(MIN_HP, Math.trunc(value)));
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
