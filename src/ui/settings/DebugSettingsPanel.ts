// Поле числа обычных врагов. Только дебаг-партия, внизу того же окна громкости.
// Босс-волна это поле не читает: там по-прежнему один суперсолдат.
// Число берёт волна, которая ещё не начала выходить. Уже идущая остаётся как была.
// Клавиша A добавляет юнита в идущую волну и этим числом не ограничена.

import Phaser from 'phaser';
import { DebugEnemyFactory } from '../../entities/DebugEnemyFactory';
import { SettingsPanel } from './SettingsPanel';

const FIELD_X = 156;
const FIELD_Y = 132;
const FIELD_W = 88;
const FIELD_H = 40;
const CARD_EXTRA = 64;

export class DebugSettingsPanel extends SettingsPanel {
  private readonly field: HTMLInputElement;
  private readonly scene: Phaser.Scene;
  private readonly view: { width: number; height: number };

  constructor(
    scene: Phaser.Scene,
    frame: { width: number; height: number },
    onMusic: (level: number) => void,
    onEffects: (level: number) => void,
    onClose: () => void,
  ) {
    super(scene, frame, onMusic, onEffects, onClose);
    this.scene = scene;
    this.view = frame;
    this.extendCardDown(CARD_EXTRA);
    this.done.y = 200;
    this.doneLabel.y = 200;

    const caption = scene.add
      .text(FIELD_X - FIELD_W / 2 - 16, FIELD_Y, 'Обычных в волне', {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f0dcc0',
      })
      .setOrigin(1, 0.5);
    this.container.add(caption);

    this.field = this.mountField();
    this.placeField();

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.placeField, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, this.placeField, this);
      this.field.remove();
    });
  }

  override setOpen(open: boolean): void {
    if (!open) {
      this.commitField();
    }
    super.setOpen(open);
    this.field.style.display = open ? 'block' : 'none';
    if (open) {
      this.field.value = String(DebugEnemyFactory.regularCountOf());
      this.placeField();
    } else {
      this.field.blur();
    }
  }

  // Растим карточку только вниз: верх окна и ползунки остаются на своих местах.
  private extendCardDown(extra: number): void {
    const top = this.card.y - this.card.height / 2;
    this.card.setSize(this.card.width, this.card.height + extra);
    this.card.y = top + this.card.height / 2;
  }

  private mountField(): HTMLInputElement {
    hideNumberSpin();
    const field = document.createElement('input');
    field.id = 'debug-wave-count';
    field.type = 'number';
    field.min = '1';
    field.max = String(DebugEnemyFactory.regularMax);
    field.step = '1';
    field.inputMode = 'numeric';
    field.autocomplete = 'off';
    field.setAttribute('aria-label', 'Обычных в волне');
    field.value = String(DebugEnemyFactory.regularCountOf());

    const style = field.style;
    style.position = 'fixed';
    style.boxSizing = 'border-box';
    style.display = 'none';
    style.margin = '0';
    style.padding = '0 8px';
    style.border = '2px solid #c9a227';
    style.borderRadius = '2px';
    style.background = '#2a0a0a';
    style.color = '#f3d56a';
    style.fontFamily = 'Georgia, serif';
    style.textAlign = 'center';
    style.outline = 'none';
    style.zIndex = '40';

    field.addEventListener('input', () => this.applyField());
    field.addEventListener('change', () => this.commitField());
    // 1, 2 и 3 игра слушает на window и гасит событие: артиллерия, мины, атомный удар.
    // Пока фокус в поле, клавиша не должна всплыть. Иначе после очистки эти цифры не набираются, а 4 и дальше — набираются.
    const stayInField = (event: KeyboardEvent): void => event.stopPropagation();
    field.addEventListener('keydown', stayInField);
    field.addEventListener('keyup', stayInField);
    // Колесо над полем не крутит число: это ввод, не ползунок.
    field.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
    document.body.appendChild(field);
    return field;
  }

  private placeField = (): void => {
    const canvas = this.scene.game.canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }
    const sx = rect.width / this.view.width;
    const sy = rect.height / this.view.height;
    const x = this.view.width / 2 + FIELD_X;
    const y = this.view.height / 2 + FIELD_Y;
    const w = FIELD_W * sx;
    const h = FIELD_H * sy;
    const style = this.field.style;
    style.left = `${rect.left + x * sx - w / 2}px`;
    style.top = `${rect.top + y * sy - h / 2}px`;
    style.width = `${w}px`;
    style.height = `${h}px`;
    style.fontSize = `${Math.round(20 * sy)}px`;
  };

  // Пока число ещё не целое в диапазоне, завод не трогаем: игрок может допечатать «50».
  private applyField(): void {
    const count = this.readCount();
    if (count === null || count < 1) {
      return;
    }
    DebugEnemyFactory.setRegularCount(count);
    if (count > DebugEnemyFactory.regularMax) {
      this.field.value = String(DebugEnemyFactory.regularCountOf());
    }
  }

  private commitField(): void {
    const count = this.readCount();
    DebugEnemyFactory.setRegularCount(count ?? DebugEnemyFactory.regularCountOf());
    this.field.value = String(DebugEnemyFactory.regularCountOf());
  }

  private readCount(): number | null {
    const raw = this.field.value.trim();
    if (raw === '') {
      return null;
    }
    const count = Number.parseInt(raw, 10);
    return Number.isFinite(count) ? count : null;
  }
}

function hideNumberSpin(): void {
  if (document.getElementById('debug-wave-count-style')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'debug-wave-count-style';
  style.textContent =
    '#debug-wave-count::-webkit-outer-spin-button,' +
    '#debug-wave-count::-webkit-inner-spin-button{appearance:none;margin:0}' +
    '#debug-wave-count{appearance:textfield}';
  document.head.appendChild(style);
}
