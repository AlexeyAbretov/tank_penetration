// Цвета и размеры картинок сущностей.

// Руки вместе с винтовкой. Правый край — плечо, вокруг него картинка крутится.
export const GUNNER_RIFLE_FRAME = { w: 88, h: 88 };
// Короткая вспышка у среза. Уже и ниже веера пикапа.
export const GUNNER_FLASH_FRAME = { w: 26, h: 18 };
// Руки вместе с гранатомётом. Нос слева, раструб справа, правый край рукава — плечо.
export const LAUNCHER_FRAME = { w: 50, h: 25 };
// Выхлоп за казёнником. Левый край — срез раструба, струя растёт вправо.
export const ROCKET_FLASH_FRAME = { w: 48, h: 40 };
// Ракета: носик справа, как у пули, чтобы поворот картинки совпал с углом полёта.
export const ROCKET_FRAME = { w: 26, h: 10 };
// Хлопок у дула. Выше и шире пули, но короче кузова.
export const PICKUP_FLASH_FRAME = { w: 56, h: 64 };
export const TANK_HULL_FRAME = { w: 170, h: 50 };
// Обломки шире корпуса: сорванная башня и ствол лежат рядом, дым — над кучей.
// Низ гусеницы на той же глубине от центра, что у живого корпуса, чтобы куча села на ту же землю.
export const TANK_WRECK_FRAME = { w: 240, h: 140 };
// Башня без ствола. Маска нарисована на стволе и крутится вместе с ним.
export const TANK_TURRET_FRAME = { w: 99, h: 32 };
export const TANK_GUN_FRAME = { w: 57, h: 13 };
export const SHELL_FRAME = { w: 54, h: 22 };
export const MUZZLE_FRAME = { w: 48, h: 48 };
export const BULLET_FRAME = { w: 18, h: 8 };

// Ошмётки штурмовика при взрыве о броню.
export const ASSAULT_LOOK = {
  pants: 0x6a5238,
  tunic: 0xc4a36a,
  vest: 0x8a5a28,
  helmet: 0x4a5a30,
  boots: 0x2a1c12,
  rifle: 0x1a120c,
};

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

export type BulletPaint = {
  body: number;
  tip: number;
};

export const BULLET_PAINT = {
  body: 0xffee88,
  tip: 0xffffff,
} satisfies BulletPaint;

// Пулемёт на опоре: ствол вправо, цапфа на оси ствола.
export const MG_MOUNT_FRAME = { w: 72, h: 25 };

export const MG_BULLET_PAINT = {
  body: 0xc9e86a,
  tip: 0xf8ffd0,
} satisfies BulletPaint;

// Серый тинт выключенной стрельбы: машина на месте, только приглушена.
export const QUIET_TINT = 0x8aa0b4;

type Tintable = {
  setTint(tint: number): unknown;
  clearTint(): unknown;
};

export function paintQuiet(image: Tintable, quiet: boolean): void {
  if (quiet) {
    image.setTint(QUIET_TINT);
    return;
  }
  image.clearTint();
}
