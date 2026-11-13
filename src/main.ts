// Точка входа: этот файл запускает игру.
// Vite подключает его из index.html как <script type="module">.

// Phaser — игровой движок: рисует картинки, считает физику, ловит мышь.
import Phaser from 'phaser';
// Размер холста — в gameConfig.ts. Сцену собирает GameSceneFactory.
import { GAME, fitGameTo } from './gameConfig';
import { GameSceneFactory } from './scenes/GameSceneFactory';
import { paintBootLabel, watchBootProgress } from './bootScreen';
import { installClipVolumes } from './sounds/clipVolume';
import { installGameFont, loadGameFont } from './ui/gameFont';

function parentBox(): { width: number; height: number } {
  const parent = document.getElementById('game');
  return {
    width: parent?.clientWidth ?? window.innerWidth,
    height: parent?.clientHeight ?? window.innerHeight,
  };
}

paintBootLabel();

const initial = parentBox();
fitGameTo(initial.width, initial.height);

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
    // FIT: холст целиком влезает в окно. На широком экране ширина поля уже совпадает с окном,
    // поэтому чёрных полос слева и справа не остаётся.
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
  scene: [GameSceneFactory.create()],
  callbacks: {
    // Холст уже есть, сцена стоит в очереди файлов. Полоса живёт поверх, пока поле не собрано.
    postBoot: (game) => {
      watchBootProgress(game);
    },
  },
};

void startGame();

async function startGame(): Promise<void> {
  // До холста: узлы громкости создаются внутри new Phaser.Game.
  installClipVolumes();
  // До первых надписей: пустое семейство становится Russo One, и файл шрифта уже загружен.
  // Иначе телефон рисует системным шрифтом и не меняет его, когда файл доезжает.
  installGameFont();
  await loadGameFont();
  // new Phaser.Game создаёт холст и запускает сцену.
  const game = new Phaser.Game(config);

  // Окно поменяло пропорции — поле снова подгоняется под него.
  const fitWindow = (): void => {
    const box = parentBox();
    fitGameTo(box.width, box.height);
    if (game.scale.width !== GAME.width || game.scale.height !== GAME.height) {
      game.scale.setGameSize(GAME.width, GAME.height);
    }
  };
  window.addEventListener('resize', fitWindow);
  window.requestAnimationFrame(fitWindow);
}
