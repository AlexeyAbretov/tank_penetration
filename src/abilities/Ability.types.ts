export type AbilityConfig = {
    minCooldownMs: number;
    cooldownStepMs: number;
    shopCutMsMax: number;
    progressCutMsMax: number;
    cooldownMs: number;
}

export type Ability = {
    id: string;
    texture: string;
    cooldownMs: number;
    iconRadius: number;
    path: string;
}
