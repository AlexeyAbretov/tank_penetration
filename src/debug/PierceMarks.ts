// Подпись на снаряде в дебаг-партии: пробьёт врага или разорвётся о него.
// Кнопка в настройках пишет флаг. Отрисовка читает его каждый кадр.
// На шанс и попадание флаг не влияет.
// Свой ключ, не ключ партии: «новая игра» стирает бой, а выключатель остаётся.
// Пока ключа нет, подпись видна.

const STORAGE_KEY = 'tank-penetration-pierce-mark:debug';

export class PierceMarks {
  private static enabled = readEnabled();

  static get isEnabled(): boolean {
    return this.enabled;
  }

  static toggle(): boolean {
    this.enabled = !this.enabled;
    writeEnabled(this.enabled);
    return this.enabled;
  }
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Приватный режим: флаг работает, пока открыта вкладка.
  }
}
