// Куски пехоты после разрыва мины, артиллерии или залпа.
// Прямоугольники режутся из уже загруженного кадра: отдельную картинку рисовать не нужно.
// Искры так не лежат: у эмиттера частица гаснет, а здесь те же куски падают на линию ног и ждут срок трупа.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';
import type { WorldPoint } from '../types/WorldPoint';
import { bake } from './textures';

// Прямоугольник внутри кадра, в пикселях текстуры.
export type GibCut = { x: number; y: number; w: number; h: number };

// Один кусок уже в координатах поля. frame пустой — берётся вся текстура.
export type GibBit = {
  key: string;
  frame?: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  originX: number;
  originY: number;
};

// Кадр, из которого нарезаются куски, и куда на поле сажается его точка ног.
export type GibPose = {
  key: string;
  cuts: readonly GibCut[];
  frameW: number;
  frameH: number;
  originX: number;
  originY: number;
  scale: number;
  x: number;
  y: number;
};

type Flight = {
  image: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  spin: number;
  groundY: number;
  landed: boolean;
  age: number;
  lifeMs: number;
};

const stainKey = 'gib-blood';
const stainFrame = { w: 120, h: 36 };
// Пиксели в секунду. Подброс около половины роста, к земле куски сходятся за полсекунды.
const gravity = 1700;

const flights = new WeakMap<Phaser.Scene, Flight[]>();

// Нарезает кадр и ставит каждый прямоугольник туда, где он был на живом спрайте.
// null — картинка другого размера: запасной рисунок 64×80, прямоугольники с него снимут не то.
export function frameBits(scene: Phaser.Scene, pose: GibPose): GibBit[] | null {
  if (!scene.textures.exists(pose.key)) {
    return null;
  }
  const texture = scene.textures.get(pose.key);
  const source = texture.getSourceImage() as { width?: number; height?: number };
  if (source.width !== pose.frameW || source.height !== pose.frameH) {
    return null;
  }

  const bits: GibBit[] = [];
  for (const cut of pose.cuts) {
    if (cut.w < 1 || cut.h < 1) {
      continue;
    }
    if (cut.x < 0 || cut.y < 0 || cut.x + cut.w > pose.frameW || cut.y + cut.h > pose.frameH) {
      continue;
    }
    const name = `gib-${cut.x}-${cut.y}-${cut.w}-${cut.h}`;
    if (!texture.has(name)) {
      texture.add(name, 0, cut.x, cut.y, cut.w, cut.h);
    }
    // add() ставит первый кусок кадром по умолчанию. Стойка берёт текстуру без имени кадра
    // и тогда рисует одну каску, а винтовка остаётся на высоте целого тела.
    texture.firstFrame = '__BASE';
    const cx = cut.x + cut.w / 2;
    const cy = cut.y + cut.h / 2;
    bits.push({
      key: pose.key,
      frame: name,
      x: pose.x + (cx - pose.originX * pose.frameW) * pose.scale,
      y: pose.y + (cy - pose.originY * pose.frameH) * pose.scale,
      scaleX: pose.scale,
      scaleY: pose.scale,
      rotation: 0,
      originX: 0.5,
      originY: 0.5,
    });
  }
  return bits;
}

// Отдельная картинка оружия: руки уже стоят на своём месте, их только копируем.
export function imageBit(image: Phaser.GameObjects.Image): GibBit {
  return {
    key: image.texture.key,
    frame: image.frame.name,
    x: image.x,
    y: image.y,
    scaleX: image.scaleX,
    scaleY: image.scaleY,
    rotation: image.rotation,
    originX: image.originX,
    originY: image.originY,
  };
}

// blast — центр разрыва, от него лёгкий сдвиг. ground — линия подошвы: куски падают в лужу под телом.
// lifeMs — сколько лежат, тот же срок, что у целого трупа.
export function scatterGibs(
  scene: Phaser.Scene,
  bits: readonly GibBit[],
  blast: WorldPoint,
  ground: WorldPoint,
  lifeMs: number,
  stainScale: number,
): void {
  if (bits.length === 0) {
    return;
  }
  const bag = flightsOf(scene);
  ensureStain(scene);
  // Лужа под центром кусков, не под одной точкой ноги: корпус шире якоря.
  let stainX = 0;
  for (const bit of bits) {
    stainX += bit.x;
  }
  stainX /= bits.length;
  // Тот же пояс, что у трупа: ниже живых, выше воронок. Куски чуть выше лужи.
  const layer = 8 + Phaser.Math.Clamp(ground.y / GAME.height, 0, 1) * 0.9;
  const stain = scene.add.image(stainX, ground.y, stainKey).setOrigin(0.5, 1).setDepth(layer);
  // Плоское пятно под одним телом. Равномерный масштаб раздувал его в круг на соседние дорожки.
  stain.setScale(stainScale * 0.72, stainScale * 0.42);
  bag.push({
    image: stain,
    vx: 0,
    vy: 0,
    spin: 0,
    groundY: ground.y,
    landed: true,
    age: 0,
    lifeMs,
  });

  for (const bit of bits) {
    const image = scene.add.image(bit.x, bit.y, bit.key, bit.frame).setDepth(layer + 0.05);
    image.setOrigin(bit.originX, bit.originY);
    image.setScale(bit.scaleX, bit.scaleY);
    image.setRotation(bit.rotation);
    sitOnGround(image, ground.y);
    const launch = toss(image.x, blast);
    bag.push({
      image,
      vx: launch.vx,
      vy: launch.vy,
      spin: launch.spin,
      groundY: ground.y,
      landed: false,
      age: 0,
      lifeMs,
    });
  }
}

function flightsOf(scene: Phaser.Scene): Flight[] {
  const existing = flights.get(scene);
  if (existing) {
    return existing;
  }
  const bag: Flight[] = [];
  flights.set(scene, bag);
  const onUpdate = (_time: number, delta: number) => step(scene, bag, delta);
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    for (const flight of bag) {
      if (flight.image.active) {
        flight.image.destroy();
      }
    }
    bag.length = 0;
    flights.delete(scene);
  });
  return bag;
}

function step(scene: Phaser.Scene, bag: Flight[], delta: number): void {
  // Пауза ставит time.paused и не останавливает update сцены. Твины трупа в это время стоят.
  if (scene.time.paused) {
    return;
  }
  const dt = Math.min(delta, 64) / 1000;
  const ms = dt * 1000;
  for (let i = bag.length - 1; i >= 0; i -= 1) {
    const flight = bag[i];
    if (!flight || !flight.image.active) {
      bag.splice(i, 1);
      continue;
    }
    flight.age += ms;
    if (flight.age >= flight.lifeMs) {
      flight.image.destroy();
      bag.splice(i, 1);
      continue;
    }
    if (flight.landed) {
      continue;
    }
    flight.vy += gravity * dt;
    flight.image.x += flight.vx * dt;
    flight.image.y += flight.vy * dt;
    flight.image.rotation += flight.spin * dt;
    // Пока летит вверх, землю не ловим: ноги стартуют уже на линии подошвы.
    if (flight.vy < 0) {
      continue;
    }
    const bottom = lowest(flight.image);
    if (bottom < flight.groundY) {
      continue;
    }
    flight.image.y -= bottom - flight.groundY;
    flight.vx = 0;
    flight.vy = 0;
    flight.spin = 0;
    flight.landed = true;
  }
}

// Короткий подброс. Общий снос от взрыва уносил всю кучу с лужи, кровь оставалась на ноге.
// Лёгкий знак в сторону разрыва, остальное — разброс внутри лужи.
function toss(x: number, blast: WorldPoint): { vx: number; vy: number; spin: number } {
  const dx = x - blast.x;
  const bias = Math.abs(dx) < 8 ? 0 : Math.sign(dx) * 22;
  return {
    vx: bias + Phaser.Math.FloatBetween(-48, 48),
    vy: -Phaser.Math.FloatBetween(240, 380),
    spin: Phaser.Math.FloatBetween(4, 8) * (Phaser.Math.Between(0, 1) === 0 ? -1 : 1),
  };
}

function sitOnGround(image: Phaser.GameObjects.Image, groundY: number): void {
  const bottom = lowest(image);
  if (bottom > groundY) {
    image.y -= bottom - groundY;
  }
}

// Нижняя точка повёрнутого прямоугольника. Origin оружия — плечо, не центр кадра.
function lowest(image: Phaser.GameObjects.Image): number {
  const w = image.displayWidth;
  const h = image.displayHeight;
  const ox = image.originX * w;
  const oy = image.originY * h;
  const cos = Math.cos(image.rotation);
  const sin = Math.sin(image.rotation);
  let bottom = -Infinity;
  const corners: readonly (readonly [number, number])[] = [
    [-ox, -oy],
    [w - ox, -oy],
    [-ox, h - oy],
    [w - ox, h - oy],
  ];
  for (const [lx, ly] of corners) {
    const y = image.y + lx * sin + ly * cos;
    if (y > bottom) {
      bottom = y;
    }
  }
  return bottom;
}

function ensureStain(scene: Phaser.Scene): void {
  if (scene.textures.exists(stainKey)) {
    const source = scene.textures.get(stainKey).getSourceImage() as { width?: number };
    if (source.width === stainFrame.w) {
      return;
    }
    scene.textures.remove(stainKey);
  }
  const { w, h } = stainFrame;
  bake(scene, stainKey, w, h, (g) => {
    g.fillStyle(0x2a0608, 0.45);
    g.fillEllipse(w / 2, h - 10, w - 4, 18);
    g.fillStyle(0x5a1014, 0.95);
    g.fillEllipse(w / 2 - 4, h - 11, w * 0.62, 12);
    g.fillStyle(0x8e181c, 0.85);
    g.fillEllipse(w / 2 - 16, h - 12, w * 0.28, 8);
  });
}
