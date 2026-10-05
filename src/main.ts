// Точка входа: этот файл запускает игру.
// Vite подключает его из index.html как <script type="module">.

// Phaser — игровой движок: рисует картинки, считает физику, ловит мышь.
import Phaser from 'phaser';
// Размер холста — в gameConfig.ts.
import { GAME } from './gameConfig';
// Единственная игровая сцена: поле боя, танк, враги, магазин.
import { GameScene } from './scenes/GameScene';

// Объект настроек, который Phaser читает при старте.
const config: Phaser.Types.Core.GameConfig = {
  // AUTO: движок сам выберет WebGL, а если видеокарта его не даёт — обычный Canvas.
  type: Phaser.AUTO,
  // Игра вставится внутрь HTML-элемента с id="game" (см. index.html).
  parent: 'game',
  // Ширина игрового мира в пикселях.
  width: GAME.width,
  // Высота игрового мира в пикселях.
  height: GAME.height,
  // Цвет фона, пока текстура поля ещё не нарисована. Формат как в CSS: #RRGGBB.
  backgroundColor: '#1a0808',
  // Спрайты ставятся на целые пиксели, чтобы картинки не мылились при движении.
  roundPixels: true,
  // Правый клик не открывает меню браузера поверх игры.
  disableContextMenu: true,
  scale: {
    // FIT: холст уменьшается или увеличивается, чтобы целиком влезть в окно, без обрезки.
    mode: Phaser.Scale.FIT,
    // Холст по центру окна и по горизонтали, и по вертикали.
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    // Arcade — простая физика: скорость, прямоугольные тела, пересечения. Без реалистичной массы.
    default: 'arcade',
    arcade: {
      // Гравитации нет: снаряды и солдаты летят строго туда, куда им задали скорость.
      gravity: { x: 0, y: 0 },
      // Розовые рамки хитбоксов на экране не показываем.
      debug: false,
    },
  },
  // Список сцен. Сейчас одна: она стартует сразу.
  scene: [GameScene],
};

// new Phaser.Game создаёт холст и запускает сцену.
// void говорит TypeScript: результат конструктора нам не нужен, это не ошибка.
void new Phaser.Game(config);
