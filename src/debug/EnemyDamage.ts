// Урон врагов по танку в дебаг-партии.
// Кнопка на плашке пишет флаг. Игрок читает его в момент удара.
// Свой ключ, не ключ партии: «новая игра» стирает бой, а выключатель остаётся.
// Пока ключа нет, урон идёт.

const STORAGE_KEY = 'tank-penetration-enemy-damage:debug';

export class EnemyDamage {
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
