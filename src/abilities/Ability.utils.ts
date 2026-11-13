import { t } from "../locale";
import { AbilityConfig } from "./Ability.types";

// Карточка магазина держит десятую: шаг завесы 0,1 с. Кружок на поле считает целые секунды.
export const cooldownLabel = (ms: number, withSeconds = true, withTenths = true): string => {
    const totalSec = withTenths ? ms / 1000 : Math.ceil(ms / 1000);

    if (totalSec < 60) {
        const text = Number.isInteger(totalSec) ? String(totalSec) : totalSec.toFixed(1);

        return withSeconds ? t().time.seconds(text) : text;
    }

    const min = Math.floor(totalSec / 60);
    const sec = totalSec - min * 60;
    const secText = Number.isInteger(sec) ? String(sec).padStart(2, '0') : sec.toFixed(1).padStart(4, '0');

    return `${min}:${secText}`;
};


export const cooldownFor = (
    shopLevel: number,
    progressLevel: number,
    config: AbilityConfig
): number => {
    const progressCut = Math.min(
        config.progressCutMsMax,
        Math.max(0, Math.round(progressLevel)) * config.cooldownStepMs,
    );
    const shopCut = Math.min(
        config.shopCutMsMax,
        Math.max(0, Math.round(shopLevel)) * config.cooldownStepMs,
    );

    return Math.max(config.minCooldownMs, config.cooldownMs - progressCut - shopCut);
}