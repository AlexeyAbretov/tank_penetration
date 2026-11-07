// Две половины уже нарисованного спрайта. Ионный столб режет вдоль своего наклона.
// Если передана земля, стоячий кусок валится набок и ложится на эту линию,
// широкий просто падает вниз. Без земли половины только разъезжаются.
// Лежат тот же срок, что труп.

import Phaser from 'phaser';

type Picture = Phaser.GameObjects.Image;

let seq = 0;

// null — кадр прочитать не удалось, вызывающий оставляет обычную смерть.
// Две половины: первая по ту сторону, куда смотрит нормаль разреза, вторая — по другую.
export function bisectImage(
  scene: Phaser.Scene,
  image: Picture,
  cutAngle: number,
  lifeMs: number,
  groundY: number | null = null,
): readonly [Phaser.GameObjects.Image, Phaser.GameObjects.Image] | null {
  const frame = image.frame;
  const width = frame.cutWidth;
  const height = frame.cutHeight;
  if (width < 2 || height < 2 || !image.active) {
    return null;
  }
  const pixels = framePixels(image.texture, frame);
  if (!pixels) {
    return null;
  }

  const left = scene.textures.createCanvas(`bisect-src-${seq}`, width, height);
  seq += 1;
  if (!left) {
    return null;
  }
  // createCanvas уже занял номер. Вторая половина — следующий.
  const rightKey = `bisect-src-${seq}`;
  seq += 1;
  const right = scene.textures.createCanvas(rightKey, width, height);
  if (!right) {
    scene.textures.remove(left.key);
    return null;
  }

  const leftData = left.context.getImageData(0, 0, width, height);
  const rightData = right.context.getImageData(0, 0, width, height);
  const extentA = emptyExtent();
  const extentB = emptyExtent();
  const nx = -Math.sin(cutAngle);
  const ny = Math.cos(cutAngle);
  const cos = Math.cos(image.rotation);
  const sin = Math.sin(image.rotation);
  const originX = image.originX * frame.width;
  const originY = image.originY * frame.height;
  // Узкая щель по оси столба, кромка подсвечена: разрез виден ещё до того, как половины разъедутся.
  const gap = 1.2;
  const glow = 3.4;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = pixels[index + 3];
      if (alpha === 0) {
        continue;
      }
      const lx = (x + 0.5 - originX) * image.scaleX;
      const ly = (y + 0.5 - originY) * image.scaleY;
      const wx = lx * cos - ly * sin;
      const wy = lx * sin + ly * cos;
      const side = wx * nx + wy * ny;
      if (Math.abs(side) <= gap) {
        continue;
      }
      const positive = side > 0;
      growExtent(positive ? extentA : extentB, wx, wy);
      const target = positive ? leftData.data : rightData.data;
      let r = pixels[index];
      let g = pixels[index + 1];
      let b = pixels[index + 2];
      if (Math.abs(side) <= glow) {
        r = Math.min(255, r + 90);
        g = Math.min(255, g + 150);
        b = Math.min(255, b + 170);
      }
      target[index] = r;
      target[index + 1] = g;
      target[index + 2] = b;
      target[index + 3] = alpha;
    }
  }

  left.context.putImageData(leftData, 0, 0);
  right.context.putImageData(rightData, 0, 0);
  left.refresh();
  right.refresh();
  left.setFilter(Phaser.Textures.FilterMode.NEAREST);
  right.setFilter(Phaser.Textures.FilterMode.NEAREST);

  const depth = image.depth;
  const halfA = placeHalf(scene, left.key, image, depth);
  const halfB = placeHalf(scene, right.key, image, depth);
  if (groundY === null) {
    const push = 28;
    separate(scene, halfA, nx * push, ny * push + 8, 0.2);
    separate(scene, halfB, -nx * push, -ny * push + 8, -0.2);
  } else {
    layDown(scene, halfA, leftData.data, image, extentA, nx, ny, groundY);
    layDown(scene, halfB, rightData.data, image, extentB, -nx, -ny, groundY);
  }

  let gone = false;
  const drop = () => {
    if (gone) {
      return;
    }
    gone = true;
    if (halfA.active) {
      halfA.destroy();
    }
    if (halfB.active) {
      halfB.destroy();
    }
    if (scene.textures.exists(left.key)) {
      scene.textures.remove(left.key);
    }
    if (scene.textures.exists(right.key)) {
      scene.textures.remove(right.key);
    }
  };
  scene.time.delayedCall(lifeMs, drop);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, drop);
  return [halfA, halfB];
}

function placeHalf(
  scene: Phaser.Scene,
  key: string,
  image: Picture,
  depth: number,
): Phaser.GameObjects.Image {
  const half = scene.add.image(image.x, image.y, key);
  half.setOrigin(image.originX, image.originY);
  half.setScale(image.scaleX, image.scaleY);
  half.setRotation(image.rotation);
  half.setDepth(depth);
  return half;
}

type Extent = { minX: number; maxX: number; minY: number; maxY: number; any: boolean };

function emptyExtent(): Extent {
  return { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, any: false };
}

function growExtent(extent: Extent, x: number, y: number): void {
  extent.any = true;
  if (x < extent.minX) {
    extent.minX = x;
  }
  if (x > extent.maxX) {
    extent.maxX = x;
  }
  if (y < extent.minY) {
    extent.minY = y;
  }
  if (y > extent.maxY) {
    extent.maxY = y;
  }
}

// Стоячий кусок валится в сторону от разреза. Широкий только оседает на землю.
function layDown(
  scene: Phaser.Scene,
  half: Phaser.GameObjects.Image,
  pixels: Uint8ClampedArray,
  image: Picture,
  extent: Extent,
  outX: number,
  outY: number,
  groundY: number,
): void {
  if (!extent.any) {
    return;
  }
  const tall = extent.maxY - extent.minY > extent.maxX - extent.minX;
  const spin = tall ? tipSpin(image.rotation, outX, outY) : Math.sign(outX || outY) * 0.2;
  const rotation = image.rotation + spin;
  const frame = image.frame;
  const low = lowestOffset(
    pixels,
    frame.cutWidth,
    frame.cutHeight,
    image.originX * frame.width,
    image.originY * frame.height,
    image.scaleX,
    image.scaleY,
    rotation,
  );
  if (!Number.isFinite(low)) {
    return;
  }
  const push = tall ? 22 : 28;
  scene.tweens.add({
    targets: half,
    x: half.x + outX * push,
    y: groundY - low,
    rotation,
    duration: 620,
    ease: 'Cubic.In',
  });
}

// Куда крутить, чтобы верх спрайта ушёл вдоль outward. Положительный угол — по часовой.
function tipSpin(rotation: number, outX: number, outY: number): number {
  const ux = Math.sin(rotation);
  const uy = -Math.cos(rotation);
  const cross = ux * outY - uy * outX;
  if (cross === 0) {
    return Math.PI / 2;
  }
  return Math.sign(cross) * (Math.PI / 2);
}

function lowestOffset(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  originX: number,
  originY: number,
  scaleX: number,
  scaleY: number,
  rotation: number,
): number {
  const sin = Math.sin(rotation);
  const cos = Math.cos(rotation);
  let low = -Infinity;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (pixels[index + 3] === 0) {
        continue;
      }
      const lx = (x + 0.5 - originX) * scaleX;
      const ly = (y + 0.5 - originY) * scaleY;
      const wy = lx * sin + ly * cos;
      if (wy > low) {
        low = wy;
      }
    }
  }
  return low;
}

function separate(
  scene: Phaser.Scene,
  half: Phaser.GameObjects.Image,
  dx: number,
  dy: number,
  spin: number,
): void {
  scene.tweens.add({
    targets: half,
    x: half.x + dx,
    y: half.y + dy,
    rotation: half.rotation + spin,
    duration: 420,
    ease: 'Quad.Out',
  });
}

function framePixels(texture: Phaser.Textures.Texture, frame: Phaser.Textures.Frame): Uint8ClampedArray | null {
  const source = texture.getSourceImage() as CanvasImageSource & { width?: number; height?: number };
  if (!source || !source.width || !source.height) {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = frame.cutWidth;
  canvas.height = frame.cutHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.drawImage(
    source,
    frame.cutX,
    frame.cutY,
    frame.cutWidth,
    frame.cutHeight,
    0,
    0,
    frame.cutWidth,
    frame.cutHeight,
  );
  return ctx.getImageData(0, 0, frame.cutWidth, frame.cutHeight).data;
}
