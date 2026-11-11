// Струя — лист из восьми кадров: выбросы с просветами, кладётся от среза и повторяется по лучу.
// Костёр на конце струи — свой лист. Под дугой костров фотографическая выжженная полоса.
// Огонь на юните — уменьшенные костры по контуру.
// Полную секунду горения gfx отдаёт бою, урон считает бой.
// У пехоты они идут по задней части, у машины — по капоту. Над ними поднимается дым.

import Phaser from 'phaser';
import { bake } from './textures';

type Point = { x: number; y: number };

type Body = Phaser.GameObjects.Sprite & {
  active: boolean;
  // Машина помечает капот. У пехоты поля нет: огонь садится на задний контур.
  flameSeat?: 'hood';
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
  // Мс текущей секунды. Полная секунда уходит в список тиков.
  pending: number;
  unit: Body;
  tongues: Phaser.GameObjects.Sprite[];
  smoke: Phaser.GameObjects.Particles.ParticleEmitter;
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
    dropBurn(burn);
  }
  burns.length = 0;
}

export function isBurning(unit: Body): boolean {
  return burns.some((burn) => burn.unit === unit);
}

// Юниты, у которых в этом кадре кончилась секунда горения. Бой снимает с них урон.
export function tickBurns(scene: Phaser.Scene, delta: number, tickMs: number): Body[] {
  bindScene(scene);
  const step = Math.max(1, tickMs);
  const due: Body[] = [];
  for (let i = burns.length - 1; i >= 0; i -= 1) {
    const burn = burns[i];
    if (!burn.unit.active) {
      dropBurn(burn);
      burns.splice(i, 1);
      continue;
    }
    const lived = Math.min(delta, burn.left);
    burn.left -= lived;
    burn.pending += lived;
    while (burn.pending >= step) {
      burn.pending -= step;
      due.push(burn.unit);
    }
    if (burn.left <= 0) {
      dropBurn(burn);
      burns.splice(i, 1);
      continue;
    }
    followBurn(burn);
  }
  return due;
}

// Повторное попадание продлевает уже горящие языки.
export function ignite(scene: Phaser.Scene, unit: Body, lifeMs: number): void {
  bindScene(scene);
  const existing = burns.find((burn) => burn.unit === unit);
  if (existing) {
    existing.left = lifeMs;
    return;
  }
  const hood = unit.flameSeat === 'hood';
  const burn: Burn = {
    left: lifeMs,
    pending: 0,
    unit,
    tongues: tonguesAt(scene, hood ? 3 : 4),
    smoke: burnSmokeAt(scene, unit.x, unit.y, hood),
  };
  burns.push(burn);
  followBurn(burn);
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

// Лист public/assets/flame-scorch.png: 4 кадра 460×230. Уголь в середине, край прозрачный.
export const scorchedEarth = {
  frame: { w: 460, h: 230 },
  frames: 4,
  // Высота кадра на поле. Видимый ожог уже: сверху и снизу кадра пусто.
  thick: 108,
  // Доля ширины между центрами кусков. Стык попадает в прозрачный край.
  along: 0.48,
  sheetKey: 'flame-scorch',
};

// Путь буквальный: singlefile-сборка подменяет его на data:.
export const scorchedEarthPath = 'assets/flame-scorch.png';

export function preloadScorchedEarth(scene: Phaser.Scene): void {
  if (scene.textures.exists(scorchedEarth.sheetKey)) {
    return;
  }
  scene.load.spritesheet(scorchedEarth.sheetKey, scorchedEarthPath, {
    frameWidth: scorchedEarth.frame.w,
    frameHeight: scorchedEarth.frame.h,
  });
}

function ensureScorchedEarth(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(scorchedEarth.sheetKey)) {
    return false;
  }
  scene.textures.get(scorchedEarth.sheetKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return true;
}

// Куски фотографии по дуге костров. Дуга уже вся на поле, поэтому куски ставятся заново.
export function syncScorchedEarth(
  scene: Phaser.Scene,
  earth: Phaser.GameObjects.Container,
  points: Point[],
): void {
  const samples = scorchSamples(points);
  if (!ensureScorchedEarth(scene)) {
    earth.removeAll(true);
    return;
  }
  const scale = scorchedEarth.thick / scorchedEarth.frame.h;
  while (earth.length < samples.length) {
    const sprite = scene.add
      .sprite(0, 0, scorchedEarth.sheetKey, earth.length % scorchedEarth.frames)
      .setOrigin(0.5);
    earth.add(sprite);
  }
  while (earth.length > samples.length) {
    earth.getAt(earth.length - 1)?.destroy();
  }
  samples.forEach((sample, index) => {
    const sprite = earth.getAt(index) as Phaser.GameObjects.Sprite;
    sprite.setFrame(index % scorchedEarth.frames);
    sprite.setPosition(sample.x, sample.y);
    sprite.setRotation(sample.angle);
    sprite.setScale(scale);
  });
}

function scorchSamples(points: Point[]): Array<Point & { angle: number }> {
  if (points.length < 2) {
    return [];
  }
  const span = scorchedEarth.frame.w * (scorchedEarth.thick / scorchedEarth.frame.h) * scorchedEarth.along;
  const samples: Array<Point & { angle: number }> = [];
  const firstAngle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
  samples.push({ x: points[0].x, y: points[0].y, angle: firstAngle });
  let cursor = 0;
  let traveled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const next = points[index];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const seg = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    while (cursor + span <= traveled + seg) {
      cursor += span;
      const t = seg < 1 ? 1 : (cursor - traveled) / seg;
      samples.push({ x: prev.x + dx * t, y: prev.y + dy * t, angle });
    }
    traveled += seg;
  }
  const last = points[points.length - 1];
  const tail = samples[samples.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > span * 0.4) {
    const prev = points[points.length - 2];
    samples.push({
      x: last.x,
      y: last.y,
      angle: Math.atan2(last.y - prev.y, last.x - prev.x),
    });
  }
  return samples;
}

let scorchPathSeq = 0;

type ScorchStrip = {
  src: Uint8ClampedArray;
  frame: ImageData;
  width: number;
  height: number;
  texture: Phaser.Textures.CanvasTexture;
};

// Прямая полоса на весь ход. На экран попадает только пройденная часть, передний край рваный.
export function layScorchedPath(
  scene: Phaser.Scene,
  earth: Phaser.GameObjects.Container,
  from: Point,
  to: Point,
): void {
  if (!ensureScorchedEarth(scene)) {
    return;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const pathLength = Math.hypot(dx, dy);
  if (pathLength < 1) {
    return;
  }
  const source = scene.textures.get(scorchedEarth.sheetKey).getSourceImage() as CanvasImageSource;
  const width = Math.ceil(pathLength);
  const height = scorchedEarth.thick;
  const baked = document.createElement('canvas');
  baked.width = width;
  baked.height = height;
  const bakedCtx = baked.getContext('2d', { willReadFrequently: true });
  if (!bakedCtx) {
    return;
  }
  const scale = height / scorchedEarth.frame.h;
  const drawW = scorchedEarth.frame.w * scale;
  const step = drawW * scorchedEarth.along;
  bakedCtx.imageSmoothingEnabled = true;
  let x = 0;
  let frame = 0;
  while (x < width) {
    const sx = (frame % scorchedEarth.frames) * scorchedEarth.frame.w;
    bakedCtx.drawImage(
      source,
      sx,
      0,
      scorchedEarth.frame.w,
      scorchedEarth.frame.h,
      x,
      0,
      drawW,
      height,
    );
    x += step;
    frame += 1;
  }
  const key = `scorch-path-${scorchPathSeq}`;
  scorchPathSeq += 1;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    return;
  }
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const strip: ScorchStrip = {
    src: bakedCtx.getImageData(0, 0, width, height).data,
    frame: texture.context.createImageData(width, height),
    width,
    height,
    texture,
  };
  earth.setData('strip', strip);
  const image = scene.add.image(from.x, from.y, key).setOrigin(0, 0.5);
  image.setRotation(Math.atan2(dy, dx));
  earth.add(image);
  earth.once(Phaser.GameObjects.Events.DESTROY, () => {
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
  });
}

// Открывает полосу до пятна. Кромка короче у краёв полосы и гуляет по ширине, уже открытое не сдвигается.
export function revealScorchedPath(earth: Phaser.GameObjects.Container, traveled: number): void {
  const strip = earth.getData('strip') as ScorchStrip | undefined;
  if (!strip || traveled < 1) {
    return;
  }
  const src = strip.src;
  const dst = strip.frame.data;
  const width = strip.width;
  const height = strip.height;
  const fade = 14;
  const limit = Math.min(width, traveled);
  for (let y = 0; y < height; y += 1) {
    const reach = limit - scorchFront(y, height);
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const index = (row + x) * 4;
      const srcAlpha = src[index + 3] ?? 0;
      if (srcAlpha === 0 || x >= reach) {
        dst[index + 3] = 0;
        continue;
      }
      const remain = reach - x;
      const keep = remain >= fade ? 1 : remain / fade;
      dst[index] = src[index] ?? 0;
      dst[index + 1] = src[index + 1] ?? 0;
      dst[index + 2] = src[index + 2] ?? 0;
      dst[index + 3] = srcAlpha * keep;
    }
  }
  strip.texture.context.putImageData(strip.frame, 0, 0);
  strip.texture.refresh();
}

// Насколько эта строка отстаёт от пятна. Середина почти доходит, края и отдельные зубцы отстают.
function scorchFront(y: number, height: number): number {
  const mid = (height - 1) * 0.5;
  const side = Math.abs(y - mid) / Math.max(1, mid);
  const lobe = Math.sin(y * 0.23) * 0.6 + Math.sin(y * 0.71 + 1.7) * 0.4;
  const grain = Math.sin(y * 12.9898) * 43758.5453;
  const tear = grain - Math.floor(grain);
  return side * side * 34 + (lobe * 0.5 + 0.5) * 20 + tear * 14;
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

function dropBurn(burn: Burn): void {
  for (const tongue of burn.tongues) {
    tongue.destroy();
  }
  burn.smoke.destroy();
}

// Костры по числу языков. Соседи начинают с разных кадров, чтобы пламя не мигало разом.
function tonguesAt(scene: Phaser.Scene, count: number): Phaser.GameObjects.Sprite[] {
  ensureCampfire(scene);
  if (!scene.textures.exists(campfire.sheetKey)) {
    return [];
  }
  const tongues: Phaser.GameObjects.Sprite[] = [];
  for (let index = 0; index < count; index += 1) {
    const tongue = scene.add.sprite(0, 0, campfire.sheetKey, 0).setOrigin(0.5, 1).setDepth(14);
    tongue.play({ key: campfire.animKey, startFrame: index % campfire.frames });
    tongues.push(tongue);
  }
  return tongues;
}

function burnSmokeAt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  hood: boolean,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const smoke = scene.add.particles(x, y, puffKey(scene), {
    lifespan: { min: 700, max: 1400 },
    frequency: 80,
    quantity: 1,
    speed: { min: 12, max: 28 },
    angle: hood ? { min: -100, max: -80 } : { min: -80, max: -45 },
    scale: { start: 0.28, end: 1.15 },
    alpha: { start: 0.62, end: 0 },
    color: [0x6e6862, 0x4a453f, 0x2c2926],
    gravityY: -36,
  });
  smoke.setDepth(15);
  return smoke;
}

function puffKey(scene: Phaser.Scene): string {
  const key = 'smoke-puff';
  if (!scene.textures.exists(key)) {
    bake(scene, key, 32, 32, (g) => {
      g.fillStyle(0xffffff, 0.18);
      g.fillCircle(16, 16, 15);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(16, 16, 9);
      g.fillStyle(0xffffff, 0.75);
      g.fillCircle(16, 16, 4);
    });
  }
  return key;
}

// Языки едут вместе с юнитом: основание на контуре, верх клонится наружу.
function followBurn(burn: Burn): void {
  const hood = burn.unit.flameSeat === 'hood';
  const seats = pick(contour(burn.unit, hood ? 'hood' : 'back'), Math.max(1, burn.tongues.length));
  burn.tongues.forEach((tongue, index) => {
    const seat = seats[Math.min(index, seats.length - 1)];
    const scale = (hood ? 0.58 : 0.46) + (index % 3) * 0.08 + Math.sin(burn.left * 0.02 + index * 1.7) * 0.04;
    tongue.setPosition(seat.x, seat.y);
    tongue.setRotation(hood ? -0.12 : 0.4);
    tongue.setScale(scale);
  });
  const anchor = seats[Math.min(hood ? 1 : 0, seats.length - 1)];
  burn.smoke.setPosition(anchor.x + (hood ? 0 : 8), anchor.y - (hood ? 16 : 6));
}

function pick(points: Point[], count: number): Point[] {
  if (points.length === 0 || count < 1) {
    return points;
  }
  if (points.length <= count) {
    return points;
  }
  const chosen: Point[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = Math.round(((points.length - 1) * index) / (count - 1));
    chosen.push(points[at]);
  }
  return chosen;
}

const contourCache = new Map<string, Point[]>();
const imageCache = new Map<string, ImageData>();

// Точки контура в мире. Спина — правый край фигуры, капот — верх переда.
function contour(unit: Body, seat: 'back' | 'hood'): Point[] {
  const key = `${unit.texture.key}:${unit.frame.name}:${seat}`;
  let local = contourCache.get(key);
  if (!local) {
    local = seat === 'hood' ? hoodEdge(unit) : backEdge(unit);
    contourCache.set(key, local);
  }
  if (local.length === 0) {
    return [{ x: unit.x, y: unit.y - unit.displayHeight * 0.55 }];
  }
  const outward = seat === 'hood' ? 0 : 4;
  const lift = seat === 'hood' ? 3 : 0;
  return local.map((point) => ({
    x: worldX(unit, point.x) + outward,
    y: worldY(unit, point.y) - lift,
  }));
}

function backEdge(unit: Body): Point[] {
  const pixels = framePixels(unit);
  if (!pixels) {
    return [];
  }
  const { data, width, height } = pixels;
  let minY = height;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 32) {
        if (y < minY) {
          minY = y;
        }
        if (y > maxY) {
          maxY = y;
        }
      }
    }
  }
  if (maxY <= minY) {
    return [];
  }
  const rows = 7;
  const edge: Point[] = [];
  for (let index = 0; index < rows; index += 1) {
    const y = Math.round(minY + (maxY - minY) * (0.04 + (0.82 * index) / (rows - 1)));
    let right = -1;
    for (let x = width - 1; x >= 0; x -= 1) {
      if (data[(y * width + x) * 4 + 3] > 32) {
        right = x;
        break;
      }
    }
    if (right >= 0) {
      edge.push({ x: right, y });
    }
  }
  return edge;
}

function hoodEdge(unit: Body): Point[] {
  const pixels = framePixels(unit);
  if (!pixels) {
    return [];
  }
  const { data, width, height } = pixels;
  let minX = width;
  let maxX = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 32) {
        if (x < minX) {
          minX = x;
        }
        if (x > maxX) {
          maxX = x;
        }
      }
    }
  }
  if (maxX <= minX) {
    return [];
  }
  const front = minX + (maxX - minX) * 0.3;
  const tops: Point[] = [];
  for (let x = minX; x <= front; x += 1) {
    for (let y = 0; y < height; y += 1) {
      if (data[(y * width + x) * 4 + 3] > 32) {
        tops.push({ x, y });
        break;
      }
    }
  }
  if (tops.length === 0) {
    return [];
  }
  const crown = Math.min(...tops.map((point) => point.y));
  const hood = tops.filter((point) => point.y <= crown + 8);
  const picks = 4;
  const edge: Point[] = [];
  for (let index = 0; index < picks; index += 1) {
    const at = Math.round(((hood.length - 1) * index) / (picks - 1));
    edge.push(hood[at]);
  }
  return edge;
}

function framePixels(unit: Body): { data: Uint8ClampedArray; width: number; height: number } | null {
  const image = sourceImage(unit.texture);
  if (!image) {
    return null;
  }
  const frame = unit.frame;
  const width = frame.cutWidth;
  const height = frame.cutHeight;
  if (width < 1 || height < 1) {
    return null;
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const from = ((frame.cutY + y) * image.width + frame.cutX) * 4;
    data.set(image.data.subarray(from, from + width * 4), y * width * 4);
  }
  return { data, width, height };
}

function sourceImage(texture: Phaser.Textures.Texture): ImageData | null {
  const cached = imageCache.get(texture.key);
  if (cached) {
    return cached;
  }
  const source = texture.getSourceImage() as CanvasImageSource & { width?: number; height?: number };
  if (!source || !source.width || !source.height) {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  imageCache.set(texture.key, image);
  return image;
}

function worldX(unit: Body, pixel: number): number {
  return unit.x + (pixel - unit.originX * unit.frame.width) * unit.scaleX;
}

function worldY(unit: Body, pixel: number): number {
  return unit.y + (pixel - unit.originY * unit.frame.height) * unit.scaleY;
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
