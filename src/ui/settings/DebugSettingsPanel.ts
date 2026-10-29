// Поля дебаг-партии внизу того же окна громкости.
// Число обычных врагов берёт волна, которая ещё не начала выходить. Уже идущая остаётся как была.
// Босс-волна это поле не читает: там по-прежнему один суперсолдат.
// Клавиша A добавляет юнита в идущую волну и этим числом не ограничена.
// Здоровье танка пишется в localStorage в том же закрытии, что и кнопка «Готово».

import Phaser from 'phaser';
import { TankDebugBaseHp } from '../../entities/Tank/TankDebugBaseHp';
import { DebugEnemyFactory } from '../../entities/DebugEnemyFactory';
import { SettingsPanel } from './SettingsPanel';

const FIELD_X = 156;
const WAVE_Y = 132;
const HP_Y = 196;
const FIELD_W = 88;
const HP_W = 112;
const FIELD_H = 40;
const CARD_EXTRA = 128;
const DONE_Y = 264;

export class DebugSettingsPanel extends SettingsPanel {
  private readonly field: HTMLInputElement;
  private readonly hpField: HTMLInputElement;
  private readonly scene: Phaser.Scene;
  private readonly view: { width: number; height: number };

  constructor(
    scene: Phaser.Scene,
    frame: { width: number; height: number },
    onMusic: (level: number) => void,
    onEffects: (level: number) => void,
    onClose: () => void,
  ) {
    super(scene, frame, onMusic, onEffects, () => {
      this.commitHp();
      onClose();
    });
    this.scene = scene;
    this.view = frame;
    this.extendCardDown(CARD_EXTRA);
    this.done.y = DONE_Y;
    this.doneLabel.y = DONE_Y;

    this.container.add(this.caption(scene, WAVE_Y, FIELD_W, 'Обычных в волне'));
    this.container.add(this.caption(scene, HP_Y, HP_W, 'Здоровье танка'));

    this.field = this.mountField(
      'debug-wave-count',
      'Обычных в волне',
      1,
      DebugEnemyFactory.regularMax,
      String(DebugEnemyFactory.regularCountOf()),
    );
    this.field.addEventListener('input', () => this.applyField());
    this.field.addEventListener('change', () => this.commitField());

    this.hpField = this.mountField(
      'debug-tank-hp',
      'Здоровье танка',
      TankDebugBaseHp.min,
      TankDebugBaseHp.max,
      String(TankDebugBaseHp.currentOf()),
    );

    this.placeFields();

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.placeFields, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, this.placeFields, this);
      this.field.remove();
      this.hpField.remove();
    });
  }

  override setOpen(open: boolean): void {
    if (!open) {
      this.commitField();
    }
    super.setOpen(open);
    const shown = open ? 'block' : 'none';
    this.field.style.display = shown;
    this.hpField.style.display = shown;
    if (open) {
      this.field.value = String(DebugEnemyFactory.regularCountOf());
      this.hpField.value = String(TankDebugBaseHp.currentOf());
      this.placeFields();
    } else {
      this.field.blur();
      this.hpField.blur();
    }
  }

  // Растим карточку только вниз: верх окна и ползунки остаются на своих местах.
  private extendCardDown(extra: number): void {
    const top = this.card.y - this.card.height / 2;
    this.card.setSize(this.card.width, this.card.height + extra);
    this.card.y = top + this.card.height / 2;
  }

  private caption(scene: Phaser.Scene, y: number, fieldW: number, text: string): Phaser.GameObjects.Text {
    return scene.add
      .text(FIELD_X + FIELD_W / 2 - fieldW - 16, y, text, {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f0dcc0',
      })
      .setOrigin(1, 0.5);
  }

  private mountField(
    id: string,
    label: string,
    min: number,
    max: number,
    value: string,
  ): HTMLInputElement {
    hideNumberSpin();
    const field = document.createElement('input');
    field.id = id;
    field.type = 'number';
    field.min = String(min);
    field.max = String(max);
    field.step = '1';
    field.inputMode = 'numeric';
    field.autocomplete = 'off';
    field.setAttribute('aria-label', label);
    field.value = value;

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

  private placeFields = (): void => {
    this.placeInput(this.field, WAVE_Y, FIELD_W);
    this.placeInput(this.hpField, HP_Y, HP_W);
  };

  private placeInput(field: HTMLInputElement, fieldY: number, fieldW: number): void {
    const canvas = this.scene.game.canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }
    const sx = rect.width / this.view.width;
    const sy = rect.height / this.view.height;
    const x = this.view.width / 2 + FIELD_X + FIELD_W / 2 - fieldW / 2;
    const y = this.view.height / 2 + fieldY;
    const w = fieldW * sx;
    const h = FIELD_H * sy;
    const style = field.style;
    style.left = `${rect.left + x * sx - w / 2}px`;
    style.top = `${rect.top + y * sy - h / 2}px`;
    style.width = `${w}px`;
    style.height = `${h}px`;
    style.fontSize = `${Math.round(20 * sy)}px`;
  }

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

  private commitHp(): void {
    const hp = this.readHp();
    TankDebugBaseHp.set(hp ?? TankDebugBaseHp.currentOf());
    this.hpField.value = String(TankDebugBaseHp.currentOf());
  }

  private readCount(): number | null {
    return readWhole(this.field.value);
  }

  private readHp(): number | null {
    return readWhole(this.hpField.value);
  }
}

function readWhole(raw: string): number | null {
  const text = raw.trim();
  if (text === '') {
    return null;
  }
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) ? value : null;
}

function hideNumberSpin(): void {
  if (document.getElementById('debug-wave-count-style')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'debug-wave-count-style';
  style.textContent =
    '#debug-wave-count::-webkit-outer-spin-button,' +
    '#debug-wave-count::-webkit-inner-spin-button,' +
    '#debug-tank-hp::-webkit-outer-spin-button,' +
    '#debug-tank-hp::-webkit-inner-spin-button{appearance:none;margin:0}' +
    '#debug-wave-count,#debug-tank-hp{appearance:textfield}';
  document.head.appendChild(style);
}
