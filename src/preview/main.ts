// Отдельная страница просмотра спрайтов. Игру не запускает.
// Vite отдаёт её по адресу /preview.html

import Phaser from 'phaser';
import { StudioScene } from './StudioScene';

void new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  width: 960,
  height: 640,
  backgroundColor: '#1a0806',
  antialias: false,
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  scene: [StudioScene],
});
