export const GAME = {
  width: 1280,
  height: 720,
  tankX: 76,
  tankY: 360,
  reachX: 115,
  fireDelay: 380,
  shellSpeed: 740,
  shellHitRadius: 46,
  shellDamage: 1,
  blastRadiusPerLevel: 1,
  baseHp: 100,
  infantryDamage: 12,
  infantryHpPerWave: 1,
  bannerY: 638,
  waveFirstCount: 6,
  waveExtra: 4,
  waveSpawnGap: 340,
  waveMinGap: 150,
  waveAnnounceMs: 1300,
  waveStartDelayMs: 700,
  killCoins: 1,
  shooterCoins: 2,
  shooterHoldX: 640,
  shooterFireDelay: 1500,
  shooterBulletSpeed: 420,
  shooterDamage: 8,
  upgradeBaseCost: 3,
  upgradeCostStep: 2,
} as const;

export function upgradeCost(level: number): number {
  return GAME.upgradeBaseCost + level * GAME.upgradeCostStep;
}
