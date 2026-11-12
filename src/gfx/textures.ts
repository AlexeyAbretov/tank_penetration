// Общие фигурные текстуры: искра и рамка здоровья.
// Graphics рисует фигуры, bake сохраняет их как текстуру по строковому имени.

import Phaser from 'phaser';
import { ensureArmorSpark } from './sparks';

// Рисует одноразовый холст и превращает его в текстуру с именем key.
// После этого холст удаляется: на сцене остаётся только сохранённая картинка.
export function bake(
  scene: Phaser.Scene,
  key: string, // имя, по которому текстуру потом берут спрайты
  width: number, // ширина картинки в пикселях
  height: number, // высота картинки в пикселях
  draw?: (g: Phaser.GameObjects.Graphics) => void, // функция, которая собственно рисует
): void {
  // Graphics — невидимый «карандаш». Пока его не добавили бы в сцену насовсем, он нужен только чтобы снять текстуру.
  const g = scene.add.graphics();
  // Вызываем переданную функцию и отдаём ей этот карандаш.
  draw?.(g);
  // Снимок прямоугольника 0,0 — width,height кладётся в менеджер текстур под именем key.
  g.generateTexture(key, width, height);
  // Сам карандаш больше не нужен, иначе пустой объект останется в списке сцены.
  g.destroy();
}

// Искра и рамка полоски здоровья. Фото травы грузит imagePreloader.
// Картинки сущностей и способностей сцена просит у их классов.
export function createTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('spark')) {
    createParticles(scene);
  }

  if (!scene.textures.exists('hp-frame')) {
    createHpFrame(scene);
  }
}

// Круглая искра взрыва, черта рикошета и уголёк фона.
function createParticles(scene: Phaser.Scene): void {
  bake(scene, 'spark', 12, 12, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(6, 6, 5);
  });
  ensureArmorSpark(scene);
  bake(scene, 'ember', 8, 8, (g) => {
    g.fillStyle(0xff6622);
    g.fillCircle(4, 4, 3);
  });
}

// Сердце слева и заливка полоски. Один красный, чтобы знак и шкала читались вместе.
export const hpMarkColor = 0xe44538;

// Рамка полоски HP базы. Сама заливка здоровья рисуется в сцене отдельным прямоугольником.
function createHpFrame(scene: Phaser.Scene): void {
  bake(scene, 'hp-frame', 280, 28, (g) => {
    // Красный кожух и тёмный жёлоб. Полоска ложится внутрь, сердце слева остаётся снаружи.
    g.fillStyle(0x7a3830, 1);
    g.fillRect(22, 2, 252, 24);
    g.fillStyle(0x1a2214, 1);
    g.fillRect(26, 6, 244, 16);
    // Ободок темнее заливки: на траве сердце не сливается с полоской.
    fillHeart(g, 12, 14, 0.6, 0x8e241c);
    fillHeart(g, 12, 14, 0.48, hpMarkColor);
  });
}

// Кардиоида шире, чем высока: низ формулы −17, верх около 12.
// Сдвиг по вертикали сажает остриё вниз, на место прежнего кружка.
const HEART_Y_MID = (-17 + 11.92) / 2;

function fillHeart(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  scale: number,
  color: number,
): void {
  const steps = 40;
  g.fillStyle(color, 1);
  g.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const px = cx + x * scale;
    const py = cy - (y - HEART_Y_MID) * scale;
    if (i === 0) {
      g.moveTo(px, py);
    } else {
      g.lineTo(px, py);
    }
  }
  g.closePath();
  g.fillPath();
}

export const preloadTextures = (scene: Phaser.Scene, key: string, path: string): void => {
  if (scene.textures.exists(key)) {
    return;
  }

  scene.load.image(key, path);
}
