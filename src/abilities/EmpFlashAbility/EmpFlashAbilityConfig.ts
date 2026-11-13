// Числа ЭМИ. Урона нет: вспышка только держит живых и рвёт уже летящие ракеты.
// Откат и длина глушения считаются здесь, магазины только покупают уровни.

import { t } from '../../locale';
import { AbilityConfig } from '../Ability.types';

export const EmpFlashAbilityConfig: AbilityConfig & {
  stunMs: number;
  stunStepMs: number;
  shopStunAddMsMax: number;
  progressStunAddMsMax: number;
  shop: { cost: number };
  maxShopCooldownLevel: () => number;
  maxProgressCooldownLevel: () => number;
  maxShopStunLevel: () => number;
  maxProgressStunLevel: () => number;
  stunFor: (shopLevel: number, progressLevel: number) => number;
  stunLabel: (ms: number) => string;
  progressStunGrows: (progressLevel: number) => boolean;
} = {
  minCooldownMs: 60_000,
  cooldownStepMs: 1_000,
  shopCutMsMax: 60_000,
  progressCutMsMax: 60_000,
  cooldownMs: 3 * 60_000,

  // Без покупок пехота и техника стоят две секунды. Вместе магазины не дольше трёх.
  stunMs: 2_000,
  stunStepMs: 100,
  shopStunAddMsMax: 500,
  progressStunAddMsMax: 500,

  shop: {
    cost: 100,
  },

  maxShopCooldownLevel(): number {
    return EmpFlashAbilityConfig.shopCutMsMax / EmpFlashAbilityConfig.cooldownStepMs;
  },

  maxProgressCooldownLevel(): number {
    return EmpFlashAbilityConfig.progressCutMsMax / EmpFlashAbilityConfig.cooldownStepMs;
  },

  maxShopStunLevel(): number {
    return EmpFlashAbilityConfig.shopStunAddMsMax / EmpFlashAbilityConfig.stunStepMs;
  },

  maxProgressStunLevel(): number {
    return EmpFlashAbilityConfig.progressStunAddMsMax / EmpFlashAbilityConfig.stunStepMs;
  },

  stunFor(shopLevel: number, progressLevel: number): number {
    const shopAdd = Math.min(
      EmpFlashAbilityConfig.shopStunAddMsMax,
      Math.max(0, Math.round(shopLevel)) * EmpFlashAbilityConfig.stunStepMs,
    );
    const progressAdd = Math.min(
      EmpFlashAbilityConfig.progressStunAddMsMax,
      Math.max(0, Math.round(progressLevel)) * EmpFlashAbilityConfig.stunStepMs,
    );
    return EmpFlashAbilityConfig.stunMs + shopAdd + progressAdd;
  },

  // 2.0 с, следующий шаг 2.1 с. Потолок обоих магазинов — 3.0 с.
  stunLabel(ms: number): string {
    return t().time.seconds((ms / 1000).toFixed(1));
  },

  // Свой запас прогресса уже выбран — следующий уровень глушение не удлиняет.
  progressStunGrows(progressLevel: number): boolean {
    return (
      EmpFlashAbilityConfig.stunFor(0, progressLevel + 1) >
      EmpFlashAbilityConfig.stunFor(0, progressLevel)
    );
  },
};
