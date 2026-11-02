// Военный шрифт с кириллицей. Phaser без семейства пишет Courier, поэтому
// пустое семейство подменяется здесь, и у каждой надписи его указывать не нужно.
// Файл лежит в public/fonts, а не на Google: в Telegram и без сети тот адрес
// часто не открывается. Холст рисует буквы один раз и не перерисовывает их,
// когда шрифт доезжает позже, поэтому старт игры ждёт loadGameFont.

import Phaser from 'phaser';

export const gameFont = '"Russo One", Impact, sans-serif';

// Три куска одного семейства: латиница, её расширение и кириллица.
// Без диапазона браузер берёт первый файл на все буквы, и русские надписи пропадают.
const gameFontFaces = [
  {
    file: 'fonts/russo-one-cyrillic.woff2',
    unicodeRange: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  },
  {
    file: 'fonts/russo-one-latin-ext.woff2',
    unicodeRange:
      'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
  },
  {
    file: 'fonts/russo-one-latin.woff2',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
] as const;

// Ждём файл. Если он не открылся, игра всё равно стартует: на холсте останется Impact или системный шрифт.
export function loadGameFont(): Promise<void> {
  if (typeof FontFace === 'undefined') {
    return Promise.resolve();
  }

  const ready = (async () => {
    await Promise.all(
      gameFontFaces.map(async ({ file, unicodeRange }) => {
        const face = new FontFace('Russo One', `url("${file}")`, {
          unicodeRange,
          display: 'block',
        });
        document.fonts.add(await face.load());
      }),
    );

    // На части телефонов холст видит семейство только после того, как им написали в документе.
    const probe = document.createElement('span');
    probe.textContent = 'ЖA';
    probe.style.fontFamily = '"Russo One"';
    probe.style.position = 'fixed';
    probe.style.left = '-999px';
    probe.style.top = '0';
    document.body.appendChild(probe);
    try {
      void probe.offsetWidth;
      await document.fonts.load('16px "Russo One"', 'ЖA');
      await document.fonts.ready;
      // Один кадр: иначе часть телефонов уже отдала холсту запасной шрифт.
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    } finally {
      probe.remove();
    }
  })();

  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, 4000);
  });

  return Promise.race([ready.catch(() => undefined), timeout]);
}

type SetStyle = (
  style: Phaser.Types.GameObjects.Text.TextStyle | undefined,
  updateText?: boolean,
  setDefaults?: boolean,
) => Phaser.GameObjects.Text;

export function installGameFont(): void {
  const proto = Phaser.GameObjects.TextStyle.prototype as Phaser.GameObjects.TextStyle & {
    setStyle: SetStyle;
  };
  const setStyle = proto.setStyle;
  proto.setStyle = function (style, updateText, setDefaults) {
    if (setDefaults) {
      const next: Phaser.Types.GameObjects.Text.TextStyle = { ...style };
      if (next.fontFamily === undefined && next.font === undefined) {
        next.fontFamily = gameFont;
      }
      style = next;
    }
    return setStyle.call(this, style, updateText, setDefaults);
  };
}
