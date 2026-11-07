// Пауза, когда страница теряет фокус: вкладка спряталась или окно свернули.
// По умолчанию включена. Окно только показывает флаг, ставит паузу ScreenPause.
// Запись партии при уходе от этого флага не зависит.

const STORAGE_KEY = 'tank-penetration-focus-pause:v1';

let enabled = readEnabled();

export class FocusPause {
  static get enabled(): boolean {
    return enabled;
  }

  static setEnabled(on: boolean): void {
    enabled = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {
      // Приватный режим: переключатель работает, пока открыта вкладка.
    }
  }
}

function readEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw !== '0';
  } catch {
    return true;
  }
}
