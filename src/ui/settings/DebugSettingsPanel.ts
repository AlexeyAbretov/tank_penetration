// Поля дебаг-партии внизу того же окна громкости.
// Число обычных врагов берёт волна, которая ещё не начала выходить. Уже идущая остаётся как была.
// Босс-волна это поле не читает: там по-прежнему один суперсолдат.
// Смешанная тоже не читает: там по одному штурмовику, стрелку, пикапу и ракетчику.
// Клавиша A добавляет юнита в идущую волну и этим числом не ограничена.
// Здоровье танка пишется в localStorage в том же закрытии, что и кнопка «Готово».
// Хитбокс и линейка в одной строке. Пробитие — строкой ниже.
// Переключаются сразу, не дожидаясь «Готово».
// Пробитие только пишет на снаряде, пробьёт он или нет. Сам выстрел не меняет.

import Phaser from 'phaser';
import { cameraView } from '../../gameConfig';
import { FieldRuler } from '../../debug/FieldRuler';
import { t } from '../../locale';
import { Hitboxes } from '../../debug/Hitboxes';
import { PierceMarks } from '../../debug/PierceMarks';
import { TankDebugBaseHp } from '../../entities/Tank/TankDebugBaseHp';
import { DebugEnemyFactory } from '../../entities/DebugEnemyFactory';
import { SETTINGS_CONTENT_LEFT, SETTINGS_CONTENT_RIGHT, SettingsPanel } from './SettingsPanel';

const WAVE_Y = 176;
const HP_Y = 228;
const TOGGLE_Y = 280;
const PIERCE_Y = 332;
const INPUT_W = 100;
const INPUT_H = 40;
const GAP = 16;
const TOGGLE_W = 72;
const CARD_EXTRA = 192;
const DONE_Y = 396;
// Те же края, что у дорожки и «0%».
const CONTENT_RIGHT = SETTINGS_CONTENT_RIGHT;
const CONTENT_LEFT = SETTINGS_CONTENT_LEFT;
const INPUT_CENTER_X = CONTENT_RIGHT - INPUT_W / 2;
const RULER_BTN_X = CONTENT_RIGHT - TOGGLE_W / 2;

export class DebugSettingsPanel extends SettingsPanel {
  private readonly field: HTMLInputElement;
  private readonly hpField: HTMLInputElement;
  private readonly hitboxLabel: Phaser.GameObjects.Text;
  private readonly rulerLabel: Phaser.GameObjects.Text;
  private readonly pierceLabel: Phaser.GameObjects.Text;
  private readonly waveCaption: Phaser.GameObjects.Text;
  private readonly hpCaption: Phaser.GameObjects.Text;
  private readonly hitboxCaption: Phaser.GameObjects.Text;
  private readonly rulerCaption: Phaser.GameObjects.Text;
  private readonly pierceCaption: Phaser.GameObjects.Text;
  private readonly hitboxButton: Phaser.GameObjects.Rectangle;
  private readonly pierceButton: Phaser.GameObjects.Rectangle;
  private readonly scene: Phaser.Scene;
  private readonly view: { width: number; height: number };

  constructor(
    scene: Phaser.Scene,
    frame: { width: number; height: number },
    onMusic: (level: number) => void,
    onEffects: (level: number) => void,
    onFocusPause: (on: boolean) => void,
    onClose: () => void,
  ) {
    super(scene, frame, onMusic, onEffects, onFocusPause, () => {
      this.commitHp();
      onClose();
    });
    this.scene = scene;
    this.view = frame;
    this.extendCardDown(CARD_EXTRA);
    this.paintCard();
    this.done.y = DONE_Y;
    this.doneFace.y = DONE_Y;
    this.doneLabel.y = DONE_Y;
    this.centerExtended();

    const copy = t().debug;
    this.waveCaption = this.caption(scene, WAVE_Y, copy.waveCount);
    this.hpCaption = this.caption(scene, HP_Y, copy.tankHp);
    this.container.add([this.waveCaption, this.hpCaption]);

    this.field = this.mountField(
      'debug-wave-count',
      copy.waveCount,
      1,
      DebugEnemyFactory.regularMax,
      String(DebugEnemyFactory.regularCountOf()),
    );
    this.field.addEventListener('input', () => this.applyField());
    this.field.addEventListener('change', () => this.commitField());

    this.hpField = this.mountField(
      'debug-tank-hp',
      copy.tankHp,
      TankDebugBaseHp.min,
      TankDebugBaseHp.max,
      String(TankDebugBaseHp.currentOf()),
    );

    this.placeFields();

    const hitbox = this.makeLeftToggle(scene, copy.hitbox, () => {
      Hitboxes.toggle();
      this.paintHitbox();
    });
    this.hitboxLabel = hitbox.label;
    this.hitboxCaption = hitbox.caption;
    this.hitboxButton = hitbox.button;
    this.paintHitbox();

    const ruler = this.makeToggle(scene, RULER_BTN_X, copy.ruler, () => {
      FieldRuler.toggle();
      this.paintRuler();
    });
    this.rulerLabel = ruler.label;
    this.rulerCaption = ruler.caption;
    this.paintRuler();

    const pierce = this.makeLeftToggle(scene, copy.pierce, () => {
      PierceMarks.toggle();
      this.paintPierce();
    }, PIERCE_Y);
    this.pierceLabel = pierce.label;
    this.pierceCaption = pierce.caption;
    this.pierceButton = pierce.button;
    this.paintPierce();

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.placeFields, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, this.placeFields, this);
      this.field.remove();
      this.hpField.remove();
    });
  }

  override applyLanguage(): void {
    super.applyLanguage();
    const copy = t().debug;
    this.waveCaption.setText(copy.waveCount);
    this.hpCaption.setText(copy.tankHp);
    this.hitboxCaption.setText(copy.hitbox);
    this.rulerCaption.setText(copy.ruler);
    this.pierceCaption.setText(copy.pierce);
    this.placeLeftToggle(this.hitboxCaption, this.hitboxButton, this.hitboxLabel);
    this.placeLeftToggle(this.pierceCaption, this.pierceButton, this.pierceLabel);
    this.field.setAttribute('aria-label', copy.waveCount);
    this.hpField.setAttribute('aria-label', copy.tankHp);
    this.paintHitbox();
    this.paintRuler();
    this.paintPierce();
  }

  override layout(): void {
    super.layout();
    this.centerExtended();
    this.placeFields();
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
      this.paintHitbox();
      this.paintRuler();
      this.paintPierce();
      this.centerExtended();
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

  // Карточка после роста смещена вниз. Поднимаем контейнер, затемнение оставляем в центре экрана.
  private centerExtended(): void {
    const view = cameraView(this.view.width, this.view.height);
    this.container.setPosition(view.x + view.width / 2, view.y + view.height / 2 - this.card.y);
    this.dim.setPosition(0, this.card.y);
    this.dim.setSize(this.view.width, this.view.height);
  }

  // Подпись с того же левого края, что «Обычных в волне». Кнопка сразу справа от неё.
  private makeLeftToggle(
    scene: Phaser.Scene,
    title: string,
    onClick: () => void,
    y = TOGGLE_Y,
  ): { label: Phaser.GameObjects.Text; caption: Phaser.GameObjects.Text; button: Phaser.GameObjects.Rectangle } {
    const caption = scene.add
      .text(CONTENT_LEFT, y, title, {
        fontSize: '22px',
        color: '#d4ccb8',
      })
      .setOrigin(0, 0.5);
    const btnX = this.leftToggleX(caption);
    const button = scene.add
      .rectangle(btnX, y, TOGGLE_W, INPUT_H, 0x1a2214)
      .setStrokeStyle(2, 0x6e6240)
      .setInteractive({ useHandCursor: true });
    const label = scene.add
      .text(btnX, y, '', {
        fontSize: '22px',
        color: '#e6d7a8',
      })
      .setOrigin(0.5);
    button.on('pointerup', onClick);
    this.container.add([caption, button, label]);
    return { label, caption, button };
  }

  // Кнопка едет за подписью: английское слово короче русского.
  private placeLeftToggle(
    caption: Phaser.GameObjects.Text,
    button: Phaser.GameObjects.Rectangle,
    label: Phaser.GameObjects.Text,
  ): void {
    const x = this.leftToggleX(caption);
    button.x = x;
    label.x = x;
  }

  private leftToggleX(caption: Phaser.GameObjects.Text): number {
    return CONTENT_LEFT + caption.width + GAP + TOGGLE_W / 2;
  }

  private makeToggle(
    scene: Phaser.Scene,
    btnX: number,
    title: string,
    onClick: () => void,
  ): { label: Phaser.GameObjects.Text; caption: Phaser.GameObjects.Text } {
    const caption = scene.add
      .text(btnX - TOGGLE_W / 2 - GAP, TOGGLE_Y, title, {
        fontSize: '22px',
        color: '#d4ccb8',
      })
      .setOrigin(1, 0.5);
    const button = scene.add
      .rectangle(btnX, TOGGLE_Y, TOGGLE_W, INPUT_H, 0x1a2214)
      .setStrokeStyle(2, 0x6e6240)
      .setInteractive({ useHandCursor: true });
    const label = scene.add
      .text(btnX, TOGGLE_Y, '', {
        fontSize: '22px',
        color: '#e6d7a8',
      })
      .setOrigin(0.5);
    button.on('pointerup', onClick);
    this.container.add([caption, button, label]);
    return { label, caption };
  }

  private caption(scene: Phaser.Scene, y: number, text: string): Phaser.GameObjects.Text {
    return scene.add
      .text(CONTENT_LEFT, y, text, {
        fontSize: '22px',
        color: '#d4ccb8',
      })
      .setOrigin(0, 0.5);
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
    style.border = '2px solid #6e6240';
    style.borderRadius = '2px';
    style.background = '#1a2214';
    style.color = '#e6d7a8';
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
    this.placeInput(this.field, WAVE_Y);
    this.placeInput(this.hpField, HP_Y);
  };

  private placeInput(field: HTMLInputElement, fieldY: number): void {
    const canvas = this.scene.game.canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }
    const view = cameraView(this.view.width, this.view.height);
    const sx = rect.width / view.width;
    const sy = rect.height / view.height;
    const x = this.container.x + INPUT_CENTER_X - view.x;
    const y = this.container.y + fieldY - view.y;
    const w = INPUT_W * sx;
    const h = INPUT_H * sy;
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

  private paintHitbox(): void {
    const on = Hitboxes.isEnabled;
    const copy = t().settings;
    this.hitboxLabel.setText(on ? copy.on : copy.off);
    this.hitboxLabel.setColor(on ? '#e6d7a8' : '#8a7d68');
  }

  private paintRuler(): void {
    const on = FieldRuler.isEnabled;
    const copy = t().settings;
    this.rulerLabel.setText(on ? copy.on : copy.off);
    this.rulerLabel.setColor(on ? '#e6d7a8' : '#8a7d68');
  }

  private paintPierce(): void {
    const on = PierceMarks.isEnabled;
    const copy = t().settings;
    this.pierceLabel.setText(on ? copy.on : copy.off);
    this.pierceLabel.setColor(on ? '#e6d7a8' : '#8a7d68');
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
