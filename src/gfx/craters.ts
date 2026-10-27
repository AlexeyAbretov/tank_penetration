// Четыре воронки с одной фотографии. Артиллерия и мины берут любую,
// атомный взрыв — только 0–2. Картинка здесь, а не у одной из сущностей.
// Строки путей буквальные: singlefile-сборка подменяет каждую на data: ровно один раз.

import Phaser from 'phaser';

export const craterImages = {
  'artillery-crater-0': 'assets/artillery-crater-0.png',
  'artillery-crater-1': 'assets/artillery-crater-1.png',
  'artillery-crater-2': 'assets/artillery-crater-2.png',
  'artillery-crater-3': 'assets/artillery-crater-3.png',
} as const;

// Кадр около 200 px. На поле чаша меньше: иначе три воронки накрывают середину экрана.
export const craterScale = 0.55;
// Самая широкая чаша — камни, 243 px. Полэтого — запас, чтобы край не вылез за линию.
export const craterWidth = 243;

export function craterReach(): number {
  return (craterWidth * craterScale) / 2;
}

// Атомный взрыв не берёт вал (картинка 3): у него другая высота чаши.
export const nuclearCraterKeys = [
  'artillery-crater-0',
  'artillery-crater-1',
  'artillery-crater-2',
] as const;

export function preloadCraters(scene: Phaser.Scene): void {
  for (const [key, path] of Object.entries(craterImages)) {
    scene.load.image(key, path);
  }
}

export function ensureCraters(scene: Phaser.Scene): void {
  for (const key of Object.keys(craterImages)) {
    if (scene.textures.exists(key)) {
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
}

type CraterPlace = {
  keys?: readonly string[];
  scale?: number;
  // Ширина на поле. Масштаб считается от выбранного кадра, чтобы 0–2 легли одним размером.
  width?: number;
  fadeMs?: number;
};

// Случайная чаша. Гаснет сама: последние fadeMs — затухание.
export function placeCrater(
  scene: Phaser.Scene,
  x: number,
  y: number,
  lifeMs: number,
  place?: CraterPlace,
): void {
  const keys = place?.keys ?? Object.keys(craterImages);
  const key = keys[Phaser.Math.Between(0, keys.length - 1)];
  if (!scene.textures.exists(key)) {
    return;
  }
  const frame = scene.textures.get(key).get();
  const scale = place?.width ? place.width / frame.width : (place?.scale ?? craterScale);
  const fadeMs = place?.fadeMs ?? 400;
  const crater = scene.add.image(x, y, key).setDepth(3).setScale(scale);
  scene.tweens.add({
    targets: crater,
    alpha: 0,
    delay: Math.max(0, lifeMs - fadeMs),
    duration: fadeMs,
    onComplete: () => crater.destroy(),
  });
}
