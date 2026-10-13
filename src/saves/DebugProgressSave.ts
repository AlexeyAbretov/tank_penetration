// Дебаг-прогресс. Тот же формат, что у обычного, но свой ключ в localStorage,
// чтобы проверка юнитов не затёрла улучшения игрока.

import { ProgressSave } from './ProgressSave';

const DEBUG_KEY = 'tank-penetration-progress:debug';

export class DebugProgressSave extends ProgressSave {
  protected storageKey(): string {
    return DEBUG_KEY;
  }
}
