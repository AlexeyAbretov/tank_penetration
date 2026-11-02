// Цифра урона над макушкой. Поднимается медленно и гаснет в конце пути,
// чтобы число успели прочитать. К спрайту не привязана: после гибели дочитывается.

import Phaser from 'phaser';

// Сколько пикселей цифра проходит вверх и за сколько. ~26 пикселей в секунду.
const RISE_PX = 36;
const RISE_MS = 1400;
const FADE_MS = 450;

// headY — верх картинки. Цифра стартует выше полоски здоровья и запаса.
// depth — слой. У пехоты хватает 16, танк рисуется выше и передаёт свой.
export function floatDamage(
  scene: Phaser.Scene,
  x: number,
  headY: number,
  damage: number,
  depth = 16,
): void {
  const label = scene.add
    .text(x + Phaser.Math.Between(-10, 10), headY - 36 - Phaser.Math.Between(0, 12), String(damage), {
      fontSize: '16px',
      color: '#ffe14a',
      stroke: '#1a0808',
      strokeThickness: 3,
    })
    .setOrigin(0.5, 1)
    .setDepth(depth);

  scene.tweens.add({
    targets: label,
    y: label.y - RISE_PX,
    duration: RISE_MS,
    ease: 'Linear',
  });
  scene.tweens.add({
    targets: label,
    alpha: 0,
    delay: RISE_MS - FADE_MS,
    duration: FADE_MS,
    onComplete: () => label.destroy(),
  });
}
