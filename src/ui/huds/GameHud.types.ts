// Размер холста и линия баннера. Сцена передаёт их сама, HUD не читает gameConfig.
export type HudFrame = {
    width: number;
    height: number;
    bannerY: number;
};

// Строка списка способностей. Картинка и откат лежат в AbilityList. Подпись — в locale.
export type HudAbility = {
    id: string;
    texture: string;
    cooldownMs: number;
    iconRadius: number;
};

// Иконка покупки над баннером: картинка, затемнение перезарядки и цифра секунд.
export type AbilityIcon = {
    id: string;
    root: Phaser.GameObjects.Container;
    glow: Phaser.GameObjects.Image;
    sweep: Phaser.GameObjects.Graphics;
    time: Phaser.GameObjects.Text;
    lit: boolean;
    owned: boolean;
    cooldownMs: number;
    iconRadius: number;
    request?: () => void;
};

// Знак питания на ободе иконки удара или мин. Покупка в прогрессе, включение — здесь.
export type AutoApplyBadge = {
    id: string;
    root: Phaser.GameObjects.Container;
    disc: Phaser.GameObjects.Graphics;
    shown: boolean;
    enabled: boolean;
    request?: () => void;
};