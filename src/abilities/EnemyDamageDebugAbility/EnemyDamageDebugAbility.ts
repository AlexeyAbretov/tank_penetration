// Урон врагов по танку в дебаг-партии.
// Свой ключ, не ключ партии: «новая игра» стирает бой, а выключатель остаётся.
// Пока ключа нет, урон идёт. Картинка — assets/enemy-damage-icon.png.

export class EnemyDamageDebugAbility {
  protected static storageKey = 'tank-penetration-enemy-damage:debug';

  private static enabled = this.readEnabled();

  static get isEnabled(): boolean {
    return this.enabled;
  }

  static toggle(): boolean {
    this.enabled = !this.enabled;

    this.writeEnabled(this.enabled);

    return this.enabled;
  }

  protected static readEnabled(): boolean {
    try {
      return localStorage.getItem(this.storageKey) !== '0';
    } catch {
      return true;
    }
  }

  protected static writeEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(this.storageKey, enabled ? '1' : '0');
    } catch {
      // Приватный режим: флаг работает, пока открыта вкладка.
    }
  }
}
