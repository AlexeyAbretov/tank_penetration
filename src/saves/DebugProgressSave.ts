// Дебаг-прогресс. Тот же формат, что у обычного, но свой ключ в localStorage,
// чтобы проверка юнитов не затёрла улучшения игрока.

import { ProgressSave, type SavedProgress } from './ProgressSave';

const DEBUG_KEY = 'tank-penetration-progress:debug';

export class DebugProgressSave extends ProgressSave {
  protected storageKey(): string {
    return DEBUG_KEY;
  }

  // Уже записанный дебаг-прогресс поля не имел: пустая партия раньше включала автострельбу сама.
  override load(): SavedProgress {
    const progress = super.load();
    this.grantAutoFire(progress);
    return progress;
  }

  // «Новая игра» стирает прогресс. В дебаге автострельба снова куплена, как в пустой партии.
  override reset(): void {
    super.reset();
    this.grantAutoFire(this.load());
  }

  private grantAutoFire(progress: SavedProgress): void {
    if (progress.autoFire) {
      return;
    }
    progress.autoFire = true;
    progress.autoFireOn = true;
    this.save(progress);
  }
}
