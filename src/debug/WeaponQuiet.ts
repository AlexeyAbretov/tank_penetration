// Глушение стрельбы техники в дебаг-партии.
// Двойной щелчок пишет флаг. Бой читает его каждый кадр.
// Свой ключ, не ключ партии: «новая игра» стирает бой, а выключатели остаются.
// Пока ключа нет, вся техника стреляет.

const STORAGE_KEY = 'tank-penetration-weapon-quiet:debug';

const WEAPONS = ['tank', 'laser', 'flame', 'salvo'] as const;

export type QuietWeapon = (typeof WEAPONS)[number];

export class WeaponQuiet {
  private static silenced = readSilenced();

  static isQuiet(weapon: QuietWeapon): boolean {
    return this.silenced[weapon];
  }

  static toggle(weapon: QuietWeapon): boolean {
    this.silenced[weapon] = !this.silenced[weapon];
    writeSilenced(this.silenced);
    return this.silenced[weapon];
  }
}

function empty(): Record<QuietWeapon, boolean> {
  return { tank: false, laser: false, flame: false, salvo: false };
}

function readSilenced(): Record<QuietWeapon, boolean> {
  const flags = empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return flags;
    }
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) {
      return flags;
    }
    const record = data as Record<string, unknown>;
    for (const weapon of WEAPONS) {
      flags[weapon] = record[weapon] === true;
    }
    return flags;
  } catch {
    return empty();
  }
}

function writeSilenced(flags: Record<QuietWeapon, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch {
    // Приватный режим: флаги работают, пока открыта вкладка.
  }
}
