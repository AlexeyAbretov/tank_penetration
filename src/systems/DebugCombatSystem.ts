// Дебаг-бой. Те же выстрелы, но двойное нажатие кнопки способности сбрасывает перезарядку.
// Второе нажатие за короткое окно удар не вызывает. После сброса окно пустое.

import { CombatSystem } from './CombatSystem';

const DOUBLE_MS = 400;

type AbilityTap = 'artillery' | 'mines' | 'nuclear';

export class DebugCombatSystem extends CombatSystem {
  private readonly tappedAt: Record<AbilityTap, number> = {
    artillery: -1,
    mines: -1,
    nuclear: -1,
  };

  protected override useArtillery(canFire: boolean): void {
    if (this.resetsCooldown('artillery', this.artilleryCooldown > 0)) {
      this.setArtilleryCooldown(0);
      return;
    }
    super.useArtillery(canFire);
  }

  protected override useMines(canFire: boolean): void {
    if (this.resetsCooldown('mines', this.minesCooldown > 0)) {
      this.setMinesCooldown(0);
      return;
    }
    super.useMines(canFire);
  }

  protected override useNuclear(canFire: boolean): void {
    if (this.resetsCooldown('nuclear', this.nuclearCooldown > 0)) {
      this.setNuclearCooldown(0);
      return;
    }
    super.useNuclear(canFire);
  }

  private resetsCooldown(ability: AbilityTap, cooling: boolean): boolean {
    const now = performance.now();
    const last = this.tappedAt[ability];
    const doubled = last >= 0 && now - last <= DOUBLE_MS;
    if (doubled && cooling) {
      this.tappedAt[ability] = -1;
      return true;
    }
    this.tappedAt[ability] = now;
    return false;
  }
}
