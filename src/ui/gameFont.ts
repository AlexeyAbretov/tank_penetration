// Военный шрифт с кириллицей. Phaser без семейства пишет Courier, поэтому
// пустое семейство подменяется здесь, и у каждой надписи его указывать не нужно.

import Phaser from 'phaser';

export const gameFont = '"Russo One", Impact, sans-serif';

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
