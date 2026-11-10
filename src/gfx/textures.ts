// Картинки поля и интерфейса. Спрайты сущностей рисуют сами классы:
// Tank (корпус, башня, снаряд, вспышка), AssaultInfantry, GunnerInfantry, RocketInfantry, PickupTruck, RocketBuggy, EnemyShot.
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

// Фон и элементы интерфейса. Картинки сущностей сцена просит у их классов.
// Поле боя может уже лежать в загрузчике (фото травы). Тогда фигурный фон не затирает его,
// а искры всё равно пекутся: раньше вся функция пропускалась вместе с ними.
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

// Рамка полоски HP базы. Сама заливка здоровья рисуется в сцене отдельным прямоугольником.
function createHpFrame(scene: Phaser.Scene): void {
  bake(scene, 'hp-frame', 280, 28, (g) => {
    // Латунный кожух и тёмный жёлоб. Полоска ложится внутрь, кружок слева остаётся снаружи.
    g.fillStyle(0x6e6240, 1);
    g.fillRect(22, 2, 252, 24);
    g.fillStyle(0x1a2214, 1);
    g.fillRect(26, 6, 244, 16);
    g.fillStyle(0xc4a15a, 1);
    g.fillCircle(12, 14, 8);
    g.fillStyle(0x3a4630, 1);
    g.fillCircle(12, 14, 4);
  });
}
