// Бой с точки зрения сцены: кадр, способности и перезарядка.
// Класс CombatSystem сюда не входит.

export type CombatSystem = {
  readonly artilleryCooldown: number;
  readonly minesCooldown: number;
  readonly nuclearCooldown: number;
  setArtilleryCooldown(ms: number): void;
  setMinesCooldown(ms: number): void;
  setNuclearCooldown(ms: number): void;
  nuclearCloudLeft(): number;
  requestArtillery(): void;
  requestMines(): void;
  requestNuclear(): void;
  clearProjectiles(): void;
  setupOverlap(): void;
  tickArtillery(delta: number, canFire: boolean): void;
  tickMines(delta: number, canFire: boolean): void;
  tickNuclear(delta: number, canFire: boolean): void;
  tick(delta: number, allowFire?: boolean): void;
};
