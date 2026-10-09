// Громкость всего, кроме музыки: выстрел, попадания и следующие эффекты.
// 1 — как сведены файлы. 0 — эффектов нет, луп волны остаётся.

const STORAGE_KEY = 'tank-defense-effects:v1';
const DEFAULT_LEVEL = 1;

export class EffectsVolume {
  private level = readLevel();
  private readonly listeners = new Set<() => void>();

  get volume(): number {
    return this.level;
  }

  // Ползунок. Уже играющий хлопок тоже берёт новое число, не только следующий.
  setVolume(level: number): void {
    this.level = clamp01(level);
    writeLevel(this.level);
    for (const listener of this.listeners) {
      listener();
    }
  }

  follow(listener: () => void): void {
    this.listeners.add(listener);
  }
}

function readLevel(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return DEFAULT_LEVEL;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return DEFAULT_LEVEL;
    }
    return clamp01(value);
  } catch {
    return DEFAULT_LEVEL;
  }
}

function writeLevel(level: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(level));
  } catch {
    // Приватный режим: ползунок работает, пока открыта вкладка.
  }
}

function clamp01(level: number): number {
  return Math.min(1, Math.max(0, level));
}
