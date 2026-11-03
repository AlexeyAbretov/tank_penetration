// Струя — лист из восьми кадров: выбросы с просветами, кладётся от среза и повторяется по лучу.
// Костёр на конце струи — свой лист. Языки на юните рисуются кодом и урона не наносят.

import Phaser from 'phaser';

type Point = { x: number; y: number };

type Body = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  displayHeight: number;
  active: boolean;
};

// Полуширина струи у среза и у дальнего конца.
const STREAM_MUZZLE = 16;
const STREAM_TIP = 34;
// Насколько далеко от дуги конца костёр ещё задевает.
const PATCH_REACH = 40;

// Лист public/assets/flame-patch.png: 8 кадров 48×76 в ряд. Основание у нижнего края.
export const campfire = {
  frame: { w: 48, h: 76 },
  frames: 8,
  holdMs: 130,
  animKey: 'flame-patch',
  sheetKey: 'flame-patch',
};

// Путь буквальный: singlefile-сборка подменяет его на data:.
export const campfireSheetPath = 'assets/flame-patch.png';

// Лист public/assets/flame-stream.png: 8 кадров 192×48 в ряд.
// inset — где начинается огонь. span — длина языка до следующего кадра:
// у части кадров язык короче холста, шаг берётся по ним, чтобы на стыке не было дыры.
export const flameStream = {
  frame: { w: 192, h: 48 },
  inset: 9,
  span: 158,
  frames: 8,
  holdMs: 80,
  animKey: 'flame-stream',
  sheetKey: 'flame-stream',
};

// Путь буквальный: singlefile-сборка подменяет его на data:.
export const flameStreamSheetPath = 'assets/flame-stream.png';

type Burn = {
  left: number;
  pen: Phaser.GameObjects.Graphics;
  unit: Body;
};

const burns: Burn[] = [];
const bound = new WeakSet<Phaser.Scene>();

function bindScene(scene: Phaser.Scene): void {
  if (bound.has(scene)) {
    return;
  }
  bound.add(scene);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    clearBurns();
  });
}

export function clearBurns(): void {
  for (const burn of burns) {
    burn.pen.destroy();
  }
  burns.length = 0;
}

export function tickBurns(scene: Phaser.Scene, delta: number): void {
  bindScene(scene);
  for (let i = burns.length - 1; i >= 0; i -= 1) {
    const burn = burns[i];
    burn.left -= delta;
    if (burn.left <= 0 || !burn.unit.active) {
      burn.pen.destroy();
      burns.splice(i, 1);
      continue;
    }
    paintBurn(burn.pen, burn.unit, burn.left);
  }
}

// Повторное попадание продлевает уже горящие языки.
export function ignite(scene: Phaser.Scene, unit: Body, lifeMs: number): void {
  bindScene(scene);
  const existing = burns.find((burn) => burn.unit === unit);
  if (existing) {
    existing.left = lifeMs;
    return;
  }
  const pen = scene.add.graphics().setDepth(14);
  pen.setBlendMode(Phaser.BlendModes.ADD);
  burns.push({ left: lifeMs, pen, unit });
  paintBurn(pen, unit, lifeMs);
}

export function preloadFlameStream(scene: Phaser.Scene): void {
  if (scene.textures.exists(flameStream.sheetKey)) {
    return;
  }
  scene.load.spritesheet(flameStream.sheetKey, flameStreamSheetPath, {
    frameWidth: flameStream.frame.w,
    frameHeight: flameStream.frame.h,
  });
}

function ensureFlameStream(scene: Phaser.Scene): void {
  if (!scene.textures.exists(flameStream.sheetKey)) {
    return;
  }
  scene.textures.get(flameStream.sheetKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  if (scene.anims.exists(flameStream.animKey)) {
    return;
  }
  scene.anims.create({
    key: flameStream.animKey,
    frames: scene.anims.generateFrameNumbers(flameStream.sheetKey, {
      start: 0,
      end: flameStream.frames - 1,
    }).map((frame) => ({
      ...frame,
      duration: flameStream.holdMs,
    })),
    repeat: -1,
  });
}

// Целые кадры от среза вдоль луча. Хвост не режется: лишний кусок остаётся целиком.
export function syncFlameStream(
  scene: Phaser.Scene,
  jets: Phaser.GameObjects.Sprite[],
  from: Point,
  angle: number,
  length: number,
): Phaser.GameObjects.Sprite[] {
  ensureFlameStream(scene);
  if (!scene.textures.exists(flameStream.sheetKey)) {
    jets.forEach((jet) => jet.destroy());
    return [];
  }
  const step = flameStream.span;
  const count = Math.max(1, Math.round(length / step));
  while (jets.length < count) {
    const sprite = scene.add
      .sprite(0, 0, flameStream.sheetKey, 0)
      .setOrigin(flameStream.inset / flameStream.frame.w, 0.5)
      .setDepth(27);
    sprite.play(flameStream.animKey);
    jets.push(sprite);
  }
  while (jets.length > count) {
    jets.pop()?.destroy();
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  jets.forEach((sprite, index) => {
    const dist = index * step;
    sprite.setPosition(from.x + cos * dist, from.y + sin * dist);
    sprite.setRotation(angle);
    if (sprite.isCropped) {
      sprite.setCrop();
    }
  });
  return jets;
}

export function preloadCampfire(scene: Phaser.Scene): void {
  if (scene.textures.exists(campfire.sheetKey)) {
    return;
  }
  scene.load.spritesheet(campfire.sheetKey, campfireSheetPath, {
    frameWidth: campfire.frame.w,
    frameHeight: campfire.frame.h,
  });
}

function ensureCampfire(scene: Phaser.Scene): void {
  if (!scene.textures.exists(campfire.sheetKey)) {
    return;
  }
  scene.textures.get(campfire.sheetKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  if (scene.anims.exists(campfire.animKey)) {
    return;
  }
  scene.anims.create({
    key: campfire.animKey,
    frames: scene.anims.generateFrameNumbers(campfire.sheetKey, {
      start: 0,
      end: campfire.frames - 1,
    }).map((frame) => ({
      ...frame,
      duration: campfire.holdMs,
    })),
    repeat: -1,
  });
}

// Костры стоят основанием на точках дуги. Пламя растёт вверх, цикл крутится, пока бой их не снимет.
export function placeCampfires(
  scene: Phaser.Scene,
  points: Point[],
  startIndex = 0,
): Phaser.GameObjects.Sprite[] {
  ensureCampfire(scene);
  if (!scene.textures.exists(campfire.sheetKey)) {
    return [];
  }
  return points.map((point, index) => {
    const sprite = scene.add
      .sprite(point.x, point.y, campfire.sheetKey, 0)
      .setOrigin(0.5, 1)
      .setDepth(26);
    // Соседние костры начинают с разных кадров, иначе вся дуга мигает разом.
    sprite.play({ key: campfire.animKey, startFrame: (startIndex + index) % campfire.frames });
    return sprite;
  });
}

export function inStream(px: number, py: number, from: Point, to: Point): boolean {
  const abx = to.x - from.x;
  const aby = to.y - from.y;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1) {
    return false;
  }
  const t = Phaser.Math.Clamp(((px - from.x) * abx + (py - from.y) * aby) / ab2, 0, 1);
  const x = from.x + abx * t;
  const y = from.y + aby * t;
  const reach = Phaser.Math.Linear(STREAM_MUZZLE, STREAM_TIP, t);
  const dx = px - x;
  const dy = py - y;
  return dx * dx + dy * dy <= reach * reach;
}

export function inPatch(px: number, py: number, points: Point[]): boolean {
  for (let i = 1; i < points.length; i += 1) {
    if (near(px, py, points[i - 1], points[i], PATCH_REACH)) {
      return true;
    }
  }
  return false;
}

function lick(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  height: number,
  half: number,
  color: number,
): void {
  g.fillStyle(color, 0.9);
  g.fillTriangle(x - half, y + 4, x + half, y + 4, x, y - height);
}

function paintBurn(g: Phaser.GameObjects.Graphics, unit: Body, left: number): void {
  g.clear();
  const x = unit.x;
  const y = unit.y - unit.displayHeight * 0.62;
  const flick = Math.sin(left * 0.04) * 3;
  lick(g, x - 6, y + 6, 12 + flick, 4, 0xc42e08);
  lick(g, x + 5, y + 4, 16 + flick, 5, 0xff8a18);
  lick(g, x, y + 2, 9, 3, 0xfff0a0);
}

function near(px: number, py: number, from: Point, to: Point, reach: number): boolean {
  const abx = to.x - from.x;
  const aby = to.y - from.y;
  const ab2 = abx * abx + aby * aby;
  const t = ab2 < 1 ? 0 : Phaser.Math.Clamp(((px - from.x) * abx + (py - from.y) * aby) / ab2, 0, 1);
  const dx = px - (from.x + abx * t);
  const dy = py - (from.y + aby * t);
  return dx * dx + dy * dy <= reach * reach;
}
