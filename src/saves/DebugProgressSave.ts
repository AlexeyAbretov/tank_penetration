// Дебаг-прогресс. Тот же формат, что у обычного, но свой ключ в localStorage,
// чтобы проверка юнитов не затёрла улучшения игрока.

import { TankDebugBaseHp } from '../entities/Tank/TankDebugBaseHp';
import { TankBaseHp } from '../entities/Tank/TankBaseHp';
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

  // Покупка пишет дебаг-запас. Число уже не выше потолка магазина.
  // set режет только потолком настроек, он выше и поле не зажимает.
  override applyHp(level: number): void {
    TankDebugBaseHp.set(TankBaseHp.hpForLevel(level));
  }

  // Старт партии поле настроек не переписывает: иначе купленный потолок затёр бы введённое число.
  override syncHp(): void {}

  // «Новая игра» обнуляет уровень, но не число в настройках.
  protected override forgetHp(): void {}

  private grantAutoFire(progress: SavedProgress): void {
    if (progress.autoFire) {
      return;
    }
    progress.autoFire = true;
    progress.autoFireOn = true;
    this.save(progress);
  }
}
