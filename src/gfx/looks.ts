// Цвета и размеры картинок сущностей.
// Игра рисует ими спрайты. Страница preview.html крутит те же значения
// и показывает результат, не запуская бой.
// Сброс в просмотре возвращает числа отсюда. Кнопка «Копировать» отдаёт
// блок, которым можно заменить константу в этом файле.

export const SOLDIER_FRAME = { w: 64, h: 80 };
export const PICKUP_FRAME = { w: 160, h: 80 };
// Ствол вырезан из кадра машины, чтобы в бою он мог отъезжать отдельно от кузова.
export const PICKUP_GUN_FRAME = { w: 104, h: 12 };
// Широкий веер у дула. Пуля узкая, вспышка заметно выше и ниже неё.
export const PICKUP_FLASH_FRAME = { w: 56, h: 64 };
export const TANK_HULL_FRAME = { w: 176, h: 110 };
export const TANK_TURRET_FRAME = { w: 168, h: 48 };
export const SHELL_FRAME = { w: 54, h: 22 };
export const MUZZLE_FRAME = { w: 48, h: 48 };
export const BULLET_FRAME = { w: 18, h: 8 };

// Набор цветов одного солдата. Числа — 0xRRGGBB.
export type SoldierLook = {
  pants: number;
  tunic: number;
  vest: number;
  helmet: number;
  helmetLight: number;
  longRifle: boolean;
  skin: number;
  outline: number;
  boots: number;
  belt: number;
  rifle: number;
  rifleWood: number;
  rifleWoodLight: number;
  rifleMetal: number;
  visor: number;
  emblem: number;
};

const soldierBase = {
  skin: 0xe8c49a,
  outline: 0x1a120c,
  boots: 0x2a1c12,
  belt: 0x5a3a18,
  rifle: 0x1a120c,
  rifleWood: 0x3a3228,
  rifleWoodLight: 0x6a6248,
  rifleMetal: 0x1a1c16,
  visor: 0x1a1e18,
  emblem: 0x8a9a58,
};

// Пустынный штурмовик: песочная форма, короткая винтовка.
export const ASSAULT_LOOK = {
  ...soldierBase,
  pants: 0x6a5238,
  tunic: 0xc4a36a,
  vest: 0x8a5a28,
  helmet: 0x4a5a30,
  helmetLight: 0xdde8a8,
  longRifle: false,
} satisfies SoldierLook;

// Стрелок темнее и в сине-сером, винтовка длиннее.
export const GUNNER_LOOK = {
  ...soldierBase,
  pants: 0x2a3a32,
  tunic: 0x4a5a52,
  vest: 0x1a2a22,
  helmet: 0x2a3a28,
  helmetLight: 0x8ab0c8,
  longRifle: true,
} satisfies SoldierLook;

export type TankPaint = {
  armor: number;
  armorLight: number;
  armorDark: number;
  nose: number;
  noseLight: number;
  hatch: number;
  rivet: number;
  grill: number;
  track: number;
  wheelOuter: number;
  wheelDisk: number;
  wheelHub: number;
  fender: number;
  turret: number;
  turretLight: number;
  turretRoof: number;
  hatchShine: number;
  mask: number;
  barrel: number;
  barrelLight: number;
  muzzleRing: number;
  bore: number;
};

export const TANK_PAINT = {
  armor: 0x3d4a28,
  armorLight: 0x556338,
  armorDark: 0x2a341c,
  nose: 0x2f3a22,
  noseLight: 0x4a5830,
  hatch: 0x1e2416,
  rivet: 0x6a4a22,
  grill: 0x0e120a,
  track: 0x1a1c16,
  wheelOuter: 0x2a2c24,
  wheelDisk: 0x4a4c42,
  wheelHub: 0x1a1c16,
  fender: 0x2a2e22,
  turret: 0x2c341c,
  turretLight: 0x556338,
  turretRoof: 0x3d4a28,
  hatchShine: 0x6a7a48,
  mask: 0x2a2e22,
  barrel: 0x1a1c16,
  barrelLight: 0x3a3e32,
  muzzleRing: 0x2a2e22,
  bore: 0x8a8e80,
} satisfies TankPaint;

export type ShellPaint = {
  outer: number;
  mid: number;
  core: number;
  tip: number;
};

export const SHELL_PAINT = {
  outer: 0xff2200,
  mid: 0xff6600,
  core: 0xffee66,
  tip: 0xffffff,
} satisfies ShellPaint;

export type MuzzlePaint = {
  outer: number;
  mid: number;
  core: number;
};

export const MUZZLE_PAINT = {
  outer: 0xffaa44,
  mid: 0xffee88,
  core: 0xffffff,
} satisfies MuzzlePaint;

export type PickupPaint = {
  body: number;
  bodyDark: number;
  bodyLight: number;
  metal: number;
  cabin: number;
  bumper: number;
  headlight: number;
  glass: number;
  glassLight: number;
  glassShine: number;
  driver: number;
  driverShirt: number;
  skin: number;
  mount: number;
  barrel: number;
  muzzleFace: number;
  muzzleTip: number;
  wheel: number;
  wheelDisk: number;
  spoke: number;
};

export const PICKUP_PAINT = {
  body: 0x5a6a38,
  bodyDark: 0x3a4a24,
  bodyLight: 0x4a5a30,
  metal: 0x2a2e22,
  cabin: 0x2a341c,
  bumper: 0x1a1c16,
  headlight: 0xd8d080,
  glass: 0x1a3040,
  glassLight: 0x88c8e0,
  glassShine: 0xffffff,
  driver: 0x2a2218,
  driverShirt: 0x6a5438,
  skin: 0xe8c49a,
  mount: 0x2a2a26,
  barrel: 0x1a1a16,
  muzzleFace: 0x4a4a42,
  muzzleTip: 0x6a6a60,
  wheel: 0x1a1a16,
  wheelDisk: 0x3a3a32,
  spoke: 0x8a8a80,
} satisfies PickupPaint;

export type BulletPaint = {
  body: number;
  tip: number;
};

export const BULLET_PAINT = {
  body: 0xffee88,
  tip: 0xffffff,
} satisfies BulletPaint;
