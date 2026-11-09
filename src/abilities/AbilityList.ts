import { ArtilleryStrike } from "../entities/ArtilleryStrike";
import { BomberStrike } from "../entities/BomberStrike";
import { EnergyWall } from "../entities/EnergyWall";
import { IonCannon } from "../entities/IonCannon";
import { Mines } from "../entities/Mines";
import { NuclearStrike } from "../entities/NuclearStrike";

export const AbilityList = [
    {
        id: 'artillery',
        texture: ArtilleryStrike.iconKey,
        hint: '1 — удар',
        cooldownMs: ArtilleryStrike.shop.cooldownMs,
        iconRadius: ArtilleryStrike.iconRadius,
    },
    {
        id: 'mines',
        texture: Mines.iconKey,
        hint: '2 — мины',
        cooldownMs: Mines.shop.cooldownMs,
        iconRadius: Mines.iconRadius,
    },
    {
        id: 'nuclear',
        texture: NuclearStrike.iconKey,
        hint: '3 — атом',
        cooldownMs: NuclearStrike.shop.cooldownMs,
        iconRadius: NuclearStrike.iconRadius,
    },
    {
        id: 'ion',
        texture: IonCannon.iconKey,
        hint: '4 — луч',
        cooldownMs: IonCannon.shop.cooldownMs,
        iconRadius: IonCannon.iconRadius,
    },
    {
        id: 'wall',
        texture: EnergyWall.iconKey,
        hint: '5 — стена',
        cooldownMs: EnergyWall.shop.cooldownMs,
        iconRadius: EnergyWall.iconRadius,
    },
    {
        id: 'bomber',
        texture: BomberStrike.iconKey,
        hint: '6 — бомбы',
        cooldownMs: BomberStrike.shop.cooldownMs,
        iconRadius: BomberStrike.iconRadius,
    },
];