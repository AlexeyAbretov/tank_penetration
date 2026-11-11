import { ArtilleryStrikeAbilityConfig, ArtilleryStrikeAbilityIcon } from "./ArtilleryStrikeAbility";
import { EmpFlashAbilityConfig, EmpFlashAbilityIcon } from "./EmpFlashAbility";
import { BomberStrike } from "../entities/BomberStrike";
import { EnergyWall } from "../entities/EnergyWall";
import { IonCannon } from "../entities/IonCannon";
import { Mines } from "../entities/Mines";
import { NuclearStrike } from "../entities/NuclearStrike";
import { Ability } from "./Ability.types";

export const AbilityList: Ability[] = [
    {
        id: 'artillery',
        texture: ArtilleryStrikeAbilityIcon.iconKey,
        hint: '1 — удар',
        cooldownMs: ArtilleryStrikeAbilityConfig.cooldownMs,
        iconRadius: ArtilleryStrikeAbilityIcon.iconRadius,
        path: ArtilleryStrikeAbilityIcon.iconPath,
    },
    {
        id: 'mines',
        texture: Mines.iconKey,
        hint: '2 — мины',
        cooldownMs: Mines.shop.cooldownMs,
        iconRadius: Mines.iconRadius,
        path: Mines.iconPath,
    },
    {
        id: 'nuclear',
        texture: NuclearStrike.iconKey,
        hint: '3 — атом',
        cooldownMs: NuclearStrike.shop.cooldownMs,
        iconRadius: NuclearStrike.iconRadius,
        path: NuclearStrike.iconPath,
    },
    {
        id: 'ion',
        texture: IonCannon.iconKey,
        hint: '4 — луч',
        cooldownMs: IonCannon.shop.cooldownMs,
        iconRadius: IonCannon.iconRadius,
        path: IonCannon.iconPath,
    },
    {
        id: 'wall',
        texture: EnergyWall.iconKey,
        hint: '5 — стена',
        cooldownMs: EnergyWall.shop.cooldownMs,
        iconRadius: EnergyWall.iconRadius,
        path: EnergyWall.iconPath,
    },
    {
        id: 'bomber',
        texture: BomberStrike.iconKey,
        hint: '6 — бомбы',
        cooldownMs: BomberStrike.shop.cooldownMs,
        iconRadius: BomberStrike.iconRadius,
        path: BomberStrike.iconPath,
    },
    {
        id: 'emp',
        texture: EmpFlashAbilityIcon.iconKey,
        hint: '7 — ЭМИ',
        cooldownMs: EmpFlashAbilityConfig.cooldownMs,
        iconRadius: EmpFlashAbilityIcon.iconRadius,
        path: EmpFlashAbilityIcon.iconPath,
    },
];