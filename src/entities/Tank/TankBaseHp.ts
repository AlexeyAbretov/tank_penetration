// Базовое здоровье танка в обычной партии.
// Танк это число не читает: его берёт игрок.
// Свой ключ, не ключ партии: стирание боя это число не удаляет.
// Магазин очков пишет сюда купленный запас. «Новая игра» возвращает базу.

type TankHpStore = {
  storageKey: string;
  min: number;
  max: number;
  current: number;
  onApply: ((hp: number) => void) | null;
};

export class TankBaseHp {
  protected static storageKey = 'tank-penetration-tank-hp';
  
  static readonly step = 10;
  // Потолок покупки. Дебаг в openStore передаёт свой: поле настроек этим числом не зажато.
  protected static shopMax = 500;
  protected static defaultHp = 100;
  static readonly minHp = 100;

  protected static store = this.openTankHpStore(this.storageKey, this.defaultHp, this.shopMax);
  
  static get min(): number {
    return this.store.min;
  }

  static get max(): number {
    return this.store.max;
  }

  // Сколько покупок отделяют базу от потолка магазина.
  static get maxLevel(): number {
    return (TankBaseHp.shopMax - this.minHp) / TankBaseHp.step;
  }

  // Запас после level покупок. Уровень выше потолка число не поднимает.
  static hpForLevel(level: number): number {
    const steps = Math.min(TankBaseHp.maxLevel, Math.max(0, Math.round(level)));
    return this.minHp + steps * TankBaseHp.step;
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
    this.writeTankHp(this.store.storageKey, this.store.current);
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

  protected static openTankHpStore(storageKey: string, defaultHp: number, maxHp: number): TankHpStore {
    return {
      storageKey,
      min: this.minHp,
      max: maxHp,
      current: this.readTankHp(storageKey, defaultHp, maxHp),
      onApply: null,
    };
  }

  protected static readTankHp(storageKey: string, defaultHp: number, maxHp: number): number {
    try {
      const raw = localStorage.getItem(storageKey);

      if (raw === null) {
        return defaultHp;
      }

      const value = Number(raw);

      if (!Number.isFinite(value)) {
        return defaultHp;
      }
      
      return Math.min(maxHp, Math.max(this.minHp, Math.trunc(value)));
    } catch {
      return defaultHp;
    }
  }

  protected static writeTankHp(storageKey: string, hp: number): void {
    try {
      localStorage.setItem(storageKey, String(hp));
    } catch {
      // Приватный режим: число работает, пока открыта вкладка.
    }
  }
}
