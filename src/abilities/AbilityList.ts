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
        cooldownMs: ArtilleryStrikeAbilityConfig.cooldownMs,
        iconRadius: ArtilleryStrikeAbilityIcon.iconRadius,
        path: ArtilleryStrikeAbilityIcon.iconPath,
    },
    {
        id: 'mines',
        texture: Mines.iconKey,
        cooldownMs: Mines.shop.cooldownMs,
        iconRadius: Mines.iconRadius,
        path: Mines.iconPath,
    },
    {
        id: 'nuclear',
        texture: NuclearStrike.iconKey,
        cooldownMs: NuclearStrike.shop.cooldownMs,
        iconRadius: NuclearStrike.iconRadius,
        path: NuclearStrike.iconPath,
    },
    {
        id: 'ion',
        texture: IonCannon.iconKey,
        cooldownMs: IonCannon.shop.cooldownMs,
        iconRadius: IonCannon.iconRadius,
        path: IonCannon.iconPath,
    },
    {
        id: 'wall',
        texture: EnergyWall.iconKey,
        cooldownMs: EnergyWall.shop.cooldownMs,
        iconRadius: EnergyWall.iconRadius,
        path: EnergyWall.iconPath,
    },
    {
        id: 'bomber',
        texture: BomberStrike.iconKey,
        cooldownMs: BomberStrike.shop.cooldownMs,
        iconRadius: BomberStrike.iconRadius,
        path: BomberStrike.iconPath,
    },
    {
        id: 'emp',
        texture: EmpFlashAbilityIcon.iconKey,
        cooldownMs: EmpFlashAbilityConfig.cooldownMs,
        iconRadius: EmpFlashAbilityIcon.iconRadius,
        path: EmpFlashAbilityIcon.iconPath,
    },
];