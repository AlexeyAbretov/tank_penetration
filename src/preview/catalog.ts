// Список сущностей просмотра. Рисование — те же методы, что вызывает игра.

import Phaser from 'phaser';
import { AssaultInfantry } from '../entities/AssaultInfantry';
import { EnemyShot } from '../entities/EnemyShot';
import { GunnerInfantry } from '../entities/GunnerInfantry';
import { Infantry } from '../entities/Infantry';
import { PickupTruck } from '../entities/PickupTruck';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
import {
  ASSAULT_LOOK,
  BULLET_FRAME,
  BULLET_PAINT,
  GUNNER_LOOK,
  MUZZLE_FRAME,
  MUZZLE_PAINT,
  PICKUP_FRAME,
  PICKUP_PAINT,
  SHELL_FRAME,
  SHELL_PAINT,
  SOLDIER_FRAME,
  TANK_GUN_FRAME,
  TANK_HULL_FRAME,
  TANK_PAINT,
  TANK_TURRET_FRAME,
  type BulletPaint,
  type MuzzlePaint,
  type PickupPaint,
  type ShellPaint,
  type SoldierLook,
  type TankPaint,
} from '../gfx/looks';
import { bake } from '../gfx/textures';
import type { Paint } from './format';

export type Field = {
  key: string;
  label: string;
  kind: 'color' | 'boolean';
  group: string;
};

export type PreviewEntity = {
  id: string;
  title: string;
  hint: string;
  exportName: string;
  kind: 'frames' | 'tank' | 'shot';
  frameCount: number;
  animFps?: number;
  // Подпись под крутящимся спрайтом. У солдат это шаг, у пикапа — колёса.
  motion?: string;
  gameScale: number;
  originX: number;
  originY: number;
  texW: number;
  texH: number;
  defaults: Paint;
  fields: Field[];
  hitbox?: { w: number; h: number; ox: number; oy: number };
  muzzle?: { x: number; y: number };
  hpColor?: number;
  addBlend?: boolean;
  // Галочка «Смерть»: труп солдата или взрыв и обломки пикапа.
  death?: 'corpse' | 'wreck';
  // Если задано, в просмотре есть галочка «Стрельба»: темп, снаряд и вспышка как в бою.
  shot?: {
    delay: number;
    speed: number;
    projectile: 'shell' | 'bullet';
    flash?: 'muzzle' | 'pickup' | 'gunner';
  };
  bake: (scene: Phaser.Scene, paint: Paint, keys: string[]) => void;
};

function asPaint(source: object): Paint {
  return { ...(source as Paint) };
}

function colors(group: string, rows: Array<[string, string]>): Field[] {
  return rows.map(([key, label]) => ({ key, label, kind: 'color', group }));
}

function soldierFields(): Field[] {
  return [
    ...colors('Форма', [
      ['tunic', 'Гимнастёрка'],
      ['pants', 'Штаны'],
      ['vest', 'Разгрузка'],
      ['helmet', 'Каска'],
      ['helmetLight', 'Блик каски'],
      ['emblem', 'Знак'],
      ['visor', 'Ремешок'],
    ]),
    ...colors('Тело', [
      ['skin', 'Кожа'],
      ['boots', 'Ботинки'],
      ['belt', 'Ремень'],
      ['outline', 'Контур'],
    ]),
    ...colors('Винтовка', [
      ['rifle', 'Оружие'],
      ['rifleWood', 'Ложа'],
      ['rifleWoodLight', 'Цевьё'],
      ['rifleMetal', 'Дуло'],
    ]),
    { key: 'longRifle', label: 'Длинная винтовка', kind: 'boolean', group: 'Винтовка' },
  ];
}

function stamp(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  bake(scene, key, width, height, draw);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

const soldierHit = {
  w: Infantry.placed.bodyW,
  h: Infantry.placed.bodyH,
  ox: Infantry.placed.bodyX,
  oy: Infantry.placed.bodyY,
};

export const ENTITIES: PreviewEntity[] = [
  {
    id: 'tank',
    title: 'Танк',
    hint: 'Корпус и башня собраны как в бою. Башня и ствол крутятся вместе вокруг днища башни.',
    exportName: 'TANK_PAINT',
    kind: 'tank',
    frameCount: 1,
    gameScale: 1,
    originX: 0.5,
    originY: 0.5,
    texW: TANK_HULL_FRAME.w,
    texH: TANK_HULL_FRAME.h,
    defaults: asPaint(TANK_PAINT),
    fields: [
      ...colors('Корпус', [
        ['armor', 'Броня'],
        ['armorLight', 'Свет брони'],
        ['armorDark', 'Тень брони'],
        ['nose', 'Нос'],
        ['noseLight', 'Вставка носа'],
        ['hatch', 'Люк'],
        ['rivet', 'Заклёпки'],
        ['grill', 'Решётка'],
        ['fender', 'Щитки'],
      ]),
      ...colors('Гусеница', [
        ['track', 'Траки'],
        ['wheelOuter', 'Каток'],
        ['wheelDisk', 'Диск'],
        ['wheelHub', 'Ось'],
      ]),
      ...colors('Башня', [
        ['turret', 'Башня'],
        ['turretLight', 'Свет башни'],
        ['turretRoof', 'Крыша'],
        ['hatchShine', 'Блик люка'],
        ['mask', 'Маска'],
        ['barrel', 'Ствол'],
        ['barrelLight', 'Грань ствола'],
        ['muzzleRing', 'Утолщение'],
        ['bore', 'Срез канала'],
      ]),
    ],
    shot: {
      delay: GAME.fireDelay,
      speed: GAME.shellSpeed,
      projectile: 'shell',
      flash: 'muzzle',
    },
    bake: (scene, paint, keys) => {
      const colors = paint as TankPaint;
      stamp(scene, keys[0], TANK_HULL_FRAME.w, TANK_HULL_FRAME.h, (g) => Tank.renderHull(g, colors));
      stamp(scene, keys[1], TANK_TURRET_FRAME.w, TANK_TURRET_FRAME.h, (g) =>
        Tank.renderTurret(g, colors),
      );
      stamp(scene, keys[2], TANK_GUN_FRAME.w, TANK_GUN_FRAME.h, (g) => Tank.renderGun(g, colors));
    },
  },
  {
    id: 'assault',
    title: 'Штурмовик',
    hint: 'Два кадра шага. Полоска HP в игре рисуется отдельно от текстуры — здесь она для сверки места. «Смерть» кладёт тело в кровь.',
    exportName: 'ASSAULT_LOOK',
    kind: 'frames',
    frameCount: 2,
    animFps: AssaultInfantry.walkFps,
    gameScale: Infantry.placed.scale,
    originX: Infantry.placed.originX,
    originY: Infantry.placed.originY,
    texW: SOLDIER_FRAME.w,
    texH: SOLDIER_FRAME.h,
    defaults: asPaint(ASSAULT_LOOK),
    fields: soldierFields(),
    hitbox: soldierHit,
    hpColor: 0xd42a2a,
    death: 'corpse',
    bake: (scene, paint, keys) => {
      const look = paint as SoldierLook;
      stamp(scene, keys[0], SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) => Infantry.drawSoldier(g, 0, look));
      stamp(scene, keys[1], SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) => Infantry.drawSoldier(g, 1, look));
    },
  },
  {
    id: 'gunner',
    title: 'Стрелок',
    hint: 'То же тело, другие цвета и длинная винтовка. Жёлтая точка — откуда вылетает пуля. При выстреле ствол откатывается и вспыхивает. «Смерть» кладёт тело в кровь.',
    exportName: 'GUNNER_LOOK',
    kind: 'frames',
    frameCount: 2,
    animFps: GunnerInfantry.walkFps,
    gameScale: Infantry.placed.scale,
    originX: Infantry.placed.originX,
    originY: Infantry.placed.originY,
    texW: SOLDIER_FRAME.w,
    texH: SOLDIER_FRAME.h,
    defaults: asPaint(GUNNER_LOOK),
    fields: soldierFields(),
    hitbox: soldierHit,
    muzzle: GunnerInfantry.muzzleOffset,
    hpColor: 0x3a8ad4,
    death: 'corpse',
    shot: {
      delay: GunnerInfantry.shotInterval,
      speed: GunnerInfantry.shotSpeed,
      projectile: 'bullet',
      flash: 'gunner',
    },
    bake: (scene, paint, keys) => {
      const look = paint as SoldierLook;
      stamp(scene, keys[0], SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) => Infantry.drawSoldier(g, 0, look));
      stamp(scene, keys[1], SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) => Infantry.drawSoldier(g, 1, look));
    },
  },
  {
    id: 'pickup',
    title: 'Пикап',
    hint: 'Шесть кадров прокрутки колёс. Масштаб, опора и хитбокс — как у машины на поле. «Смерть» взрывает кузов и оставляет обломки.',
    exportName: 'PICKUP_PAINT',
    kind: 'frames',
    frameCount: PickupTruck.wheelFrames,
    animFps: PickupTruck.driveFps,
    motion: 'колёса',
    gameScale: PickupTruck.placed.scale,
    originX: PickupTruck.placed.originX,
    originY: PickupTruck.placed.originY,
    texW: PICKUP_FRAME.w,
    texH: PICKUP_FRAME.h,
    defaults: asPaint(PICKUP_PAINT),
    fields: [
      ...colors('Кузов', [
        ['body', 'Борт'],
        ['bodyDark', 'Тень борта'],
        ['bodyLight', 'Свет борта'],
        ['cabin', 'Кабина'],
        ['metal', 'Рама'],
        ['bumper', 'Бампер'],
        ['headlight', 'Фара'],
      ]),
      ...colors('Стекло', [
        ['glass', 'Стекло'],
        ['glassLight', 'Блик стекла'],
        ['glassShine', 'Блик'],
      ]),
      ...colors('Экипаж', [
        ['driver', 'Каска'],
        ['skin', 'Лицо'],
        ['driverShirt', 'Форма'],
      ]),
      ...colors('Оружие', [
        ['mount', 'Станок'],
        ['barrel', 'Ствол'],
        ['muzzleFace', 'Дульный срез'],
        ['muzzleTip', 'Наконечник'],
      ]),
      ...colors('Колёса', [
        ['wheel', 'Покрышка'],
        ['wheelDisk', 'Диск'],
        ['spoke', 'Спицы'],
      ]),
    ],
    hitbox: {
      w: PickupTruck.placed.bodyW,
      h: PickupTruck.placed.bodyH,
      ox: PickupTruck.placed.bodyX,
      oy: PickupTruck.placed.bodyY,
    },
    muzzle: PickupTruck.muzzleOffset,
    hpColor: 0xe0a020,
    death: 'wreck',
    shot: {
      delay: PickupTruck.shotInterval,
      speed: PickupTruck.shotSpeed,
      projectile: 'bullet',
      flash: 'pickup',
    },
    bake: (scene, paint, keys) => {
      const colors = paint as PickupPaint;
      keys.forEach((key, phase) => {
        stamp(scene, key, PICKUP_FRAME.w, PICKUP_FRAME.h, (g) => PickupTruck.render(g, phase, colors));
      });
    },
  },
  {
    id: 'shell',
    title: 'Снаряд',
    hint: 'В бою картинка включена в режиме ADD и поэтому светится. Галочку можно снять и увидеть саму текстуру.',
    exportName: 'SHELL_PAINT',
    kind: 'shot',
    frameCount: 1,
    gameScale: 1,
    originX: 0.5,
    originY: 0.5,
    texW: SHELL_FRAME.w,
    texH: SHELL_FRAME.h,
    defaults: asPaint(SHELL_PAINT),
    fields: colors('Свечение', [
      ['outer', 'Ореол'],
      ['mid', 'Середина'],
      ['core', 'Ядро'],
      ['tip', 'Кончик'],
    ]),
    addBlend: true,
    bake: (scene, paint, keys) => {
      stamp(scene, keys[0], SHELL_FRAME.w, SHELL_FRAME.h, (g) => Tank.renderShell(g, paint as ShellPaint));
    },
  },
  {
    id: 'muzzle',
    title: 'Вспышка',
    hint: 'Вспышка выстрела и взрыва. В игре тоже рисуется режимом ADD.',
    exportName: 'MUZZLE_PAINT',
    kind: 'shot',
    frameCount: 1,
    gameScale: 1,
    originX: 0.5,
    originY: 0.5,
    texW: MUZZLE_FRAME.w,
    texH: MUZZLE_FRAME.h,
    defaults: asPaint(MUZZLE_PAINT),
    fields: colors('Вспышка', [
      ['outer', 'Ореол'],
      ['mid', 'Середина'],
      ['core', 'Центр'],
    ]),
    addBlend: true,
    bake: (scene, paint, keys) => {
      stamp(scene, keys[0], MUZZLE_FRAME.w, MUZZLE_FRAME.h, (g) =>
        Tank.renderMuzzle(g, paint as MuzzlePaint),
      );
    },
  },
  {
    id: 'bullet',
    title: 'Пуля',
    hint: 'Общая пуля стрелка и пикапа. Зелёная рамка — хитбокс 14×8 по центру текстуры.',
    exportName: 'BULLET_PAINT',
    kind: 'shot',
    frameCount: 1,
    gameScale: 1,
    originX: 0.5,
    originY: 0.5,
    texW: BULLET_FRAME.w,
    texH: BULLET_FRAME.h,
    defaults: asPaint(BULLET_PAINT),
    fields: colors('Пуля', [
      ['body', 'Тело'],
      ['tip', 'Носик'],
    ]),
    hitbox: {
      w: EnemyShot.bodySize.w,
      h: EnemyShot.bodySize.h,
      ox: (BULLET_FRAME.w - EnemyShot.bodySize.w) / 2,
      oy: (BULLET_FRAME.h - EnemyShot.bodySize.h) / 2,
    },
    bake: (scene, paint, keys) => {
      stamp(scene, keys[0], BULLET_FRAME.w, BULLET_FRAME.h, (g) =>
        EnemyShot.render(g, paint as BulletPaint),
      );
    },
  },
];
