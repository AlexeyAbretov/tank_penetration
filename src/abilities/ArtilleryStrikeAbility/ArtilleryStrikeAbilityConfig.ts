import { AbilityConfig } from '../Ability.types';

export const ArtilleryStrikeAbilityConfig: AbilityConfig & {
    blastRadius: number;
    gapMs: number;
    fallMs: number;
    afterShotMs: number;
    shellMax: number;
    shop: {
        cost: number;
        shells: number;
        damage: number;
    };
    maxShopCooldownLevel: () => number;
    maxProgressCooldownLevel: () => number;
    maxShellLevel: () => number;
} = {
    minCooldownMs: 20_000,
    cooldownStepMs: 1_000,
    shopCutMsMax: 20_000,
    progressCutMsMax: 20_000,
    cooldownMs: 60_000,

    // Залп из магазина после проигрыша. Без покупок три снаряда, каждая покупка добавляет ещё один.
    shellMax: 6,
    blastRadius: 74,
    gapMs: 180,
    fallMs: 480,
    // Пауза после конца хлопка, потом снаряды начинают падать.
    afterShotMs: 0,

    shop: {
        cost: 100,
        shells: 3,
        damage: 20,
    },

    maxShellLevel(): number {
        return ArtilleryStrikeAbilityConfig.shellMax - this.shop.shells;
    },

    maxShopCooldownLevel(): number {
        return this.shopCutMsMax / this.cooldownStepMs;
    },

    maxProgressCooldownLevel(): number {
        return this.progressCutMsMax / this.cooldownStepMs;
    }

} as const;
