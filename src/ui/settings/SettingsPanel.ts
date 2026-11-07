// Окно громкости и паузы при потере фокуса. Бой на это время стоит, музыка играет:
// ползунок музыки сразу слышно. Закрывает его только кнопка «Готово».
// Второй ползунок — эффекты. Музыку он не трогает.
// Переключатель паузы только рисует флаг. Решает сцена, пишет FocusPause.

import Phaser from 'phaser';
import { fieldInk, fieldInkStroke, fieldMuted, fieldPaper, paintFieldPlate, paintFieldRule, paintOrderBar } from '../militaryDialog';

const PANEL_W = 520;
// Ниже ползунков стоит переключатель. Верх карточки остаётся на −200, низ уезжает вниз.
const PANEL_H = 448;
const CARD_TOP = -200;
const PANEL_HALF = PANEL_W / 2;
const MUSIC_Y = -56;
const EFFECTS_Y = 64;
const PAUSE_Y = 116;
const DONE_Y = 196;
const FOCUS_W = 72;
const FOCUS_H = 40;
// Отступ карточки до контента. Дорожка, «0%» и строки дебага стоят в этих краях.
const INSET = 24;
const PERCENT_HALF = 18;
const TRACK_GAP = 12;
const THUMB_R = 11;
// Обводка круга наполовину снаружи радиуса. Край круга, не центр, встаёт на край текста.
const THUMB_EDGE = THUMB_R + 1;
export const SETTINGS_CONTENT_LEFT = -PANEL_HALF + INSET;
export const SETTINGS_CONTENT_RIGHT = PANEL_HALF - INSET;
export const SETTINGS_PERCENT_X = SETTINGS_CONTENT_RIGHT - PERCENT_HALF;
const TRACK_LEFT = SETTINGS_CONTENT_LEFT + THUMB_EDGE;
const TRACK_RIGHT = SETTINGS_PERCENT_X - PERCENT_HALF - TRACK_GAP;
const TRACK_W = TRACK_RIGHT - TRACK_LEFT;
const TRACK_CENTER = TRACK_LEFT + TRACK_W / 2;

type Slider = {
  nodes: Phaser.GameObjects.GameObject[];
  paint: (level: number) => void;
  apply: (pointer: Phaser.Input.Pointer) => void;
};

export class SettingsPanel {
  protected container!: Phaser.GameObjects.Container;
  // Затемнение открыто наследнику: после сдвига контейнера его возвращают в центр экрана.
  protected readonly dim: Phaser.GameObjects.Rectangle;
  // Карточка и «Готово» открыты наследнику: дебаг дописывает поле снизу и растит окно вниз.
  protected card!: Phaser.GameObjects.Rectangle;
  protected cardFace!: Phaser.GameObjects.Graphics;
  protected done!: Phaser.GameObjects.Rectangle;
  protected doneFace!: Phaser.GameObjects.Graphics;
  protected doneLabel!: Phaser.GameObjects.Text;
  private readonly music: Slider;
  private readonly effects: Slider;
  private readonly focusLabel: Phaser.GameObjects.Text;
  private focusOn = true;
  private dragging: Slider | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly frame: { width: number; height: number },
    onMusic: (level: number) => void,
    onEffects: (level: number) => void,
    onFocusPause: (on: boolean) => void,
    private readonly onClose: () => void,
  ) {
    this.dim = scene.add.rectangle(0, 0, frame.width, frame.height, 0x000000, 0.45).setInteractive();

    // Прямоугольник только ловит клик. Рисунок едет за ним, когда дебаг растит окно вниз.
    // Верх на прежнем месте: ползунки не прыгают, когда карточка выросла вниз.
    this.card = scene.add.rectangle(0, CARD_TOP + PANEL_H / 2, PANEL_W, PANEL_H, 0x000000, 0);
    // Глушит клик по затемнению, когда курсор над самой карточкой.
    this.card.setInteractive();
    this.cardFace = scene.add.graphics();
    this.paintCard();

    const title = scene.add
      .text(0, -158, 'НАСТРОЙКИ', {
        fontSize: '40px',
        color: fieldInk,
        stroke: fieldInkStroke,
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const rule = scene.add.graphics();
    paintFieldRule(rule, -124, 180);

    const musicLabel = label(scene, -100, 'Громкость музыки');
    const effectsLabel = label(scene, 20, 'Громкость эффектов');
    this.music = this.makeSlider(scene, MUSIC_Y, onMusic);
    this.effects = this.makeSlider(scene, EFFECTS_Y, onEffects);
    const focusRow = this.makeFocusToggle(scene, onFocusPause);
    this.focusLabel = focusRow.label;

    const onMove = (pointer: Phaser.Input.Pointer): void => {
      if (!this.dragging || !this.container.visible) {
        return;
      }
      this.dragging.apply(pointer);
    };
    const onUp = (): void => {
      this.dragging = null;
    };
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.events.once('shutdown', () => {
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
    });

    this.doneFace = scene.add.graphics().setPosition(0, DONE_Y);
    paintOrderBar(this.doneFace, 220, 48);
    this.done = scene.add.rectangle(0, DONE_Y, 220, 48, 0x000000, 0);
    this.done.setInteractive({ useHandCursor: true });
    this.done.on('pointerup', () => this.onClose());
    this.doneLabel = scene.add
      .text(0, DONE_Y, 'ГОТОВО', {
        fontSize: '18px',
        color: fieldInk,
      })
      .setOrigin(0.5);

    this.container = scene.add
      .container(frame.width / 2, frame.height / 2, [
        this.dim,
        this.cardFace,
        this.card,
        title,
        rule,
        musicLabel,
        effectsLabel,
        ...this.music.nodes,
        ...this.effects.nodes,
        ...focusRow.nodes,
        this.doneFace,
        this.done,
        this.doneLabel,
      ])
      .setDepth(88)
      .setVisible(false);
  }

  // Окно стало шире — затемнение и карточка остаются по центру нового поля.
  layout(): void {
    this.container.setPosition(this.frame.width / 2, this.frame.height / 2);
    this.dim.setSize(this.frame.width, this.frame.height);
  }

  // Только рисунок. Звук зовёт сцена, когда ползунок реально сдвинули.
  setMusic(level: number): void {
    this.music.paint(clamp01(level));
  }

  setEffects(level: number): void {
    this.effects.paint(clamp01(level));
  }

  // Только рисунок. Флаг пишет сцена, когда кнопку реально нажали.
  setFocusPause(on: boolean): void {
    this.paintFocus(on);
  }

  setOpen(open: boolean): void {
    this.dragging = null;
    this.container.setVisible(open);
  }

  // Карточка сдвинулась или выросла — скобы рисуются заново по её размеру.
  protected paintCard(): void {
    paintFieldPlate(this.cardFace, this.card.width, this.card.height);
    this.cardFace.setPosition(this.card.x, this.card.y);
  }

  private makeSlider(
    scene: Phaser.Scene,
    y: number,
    onChange: (level: number) => void,
  ): Slider {
    const track = scene.add.rectangle(TRACK_CENTER, y, TRACK_W, 8, 0x161c12);
    const fill = scene.add.rectangle(TRACK_LEFT, y, 0, 8, 0x8a7848).setOrigin(0, 0.5);
    const thumb = scene.add.circle(TRACK_LEFT, y, THUMB_R, 0xc4a15a).setStrokeStyle(2, 0x1a2214);
    const valueText = scene.add
      .text(SETTINGS_PERCENT_X, y, '0%', {
        fontSize: '22px',
        color: fieldInk,
      })
      .setOrigin(0.5);

    const slider: Slider = {
      nodes: [],
      paint: (level) => {
        const width = TRACK_W * level;
        fill.width = Math.max(0, width);
        thumb.x = TRACK_LEFT + width;
        valueText.setText(`${Math.round(level * 100)}%`);
      },
      apply: (pointer) => {
        const left = this.container.x + TRACK_LEFT;
        const ratio = clamp01((pointer.worldX - left) / TRACK_W);
        const level = Math.round(ratio * 100) / 100;
        slider.paint(level);
        onChange(level);
      },
    };

    // Полоска толще дорожки, чтобы в неё попадали без прицеливания.
    const hit = scene.add
      .rectangle(TRACK_CENTER, y, TRACK_W, 36, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.dragging) {
        return;
      }
      this.dragging = slider;
      slider.apply(pointer);
    });
    slider.nodes.push(track, fill, thumb, hit, valueText);
    return slider;
  }

  // Подпись слева, кнопка у правого края. ВКЛ — уход со вкладки ставит паузу.
  private makeFocusToggle(
    scene: Phaser.Scene,
    onChange: (on: boolean) => void,
  ): { nodes: Phaser.GameObjects.GameObject[]; label: Phaser.GameObjects.Text } {
    const caption = scene.add
      .text(SETTINGS_CONTENT_LEFT, PAUSE_Y, 'Пауза при потере фокуса', {
        fontSize: '22px',
        color: fieldPaper,
      })
      .setOrigin(0, 0.5);
    const btnX = SETTINGS_CONTENT_RIGHT - FOCUS_W / 2;
    const button = scene.add
      .rectangle(btnX, PAUSE_Y, FOCUS_W, FOCUS_H, 0x1a2214)
      .setStrokeStyle(2, 0x6e6240)
      .setInteractive({ useHandCursor: true });
    const value = scene.add
      .text(btnX, PAUSE_Y, 'ВКЛ', {
        fontSize: '22px',
        color: fieldInk,
      })
      .setOrigin(0.5);
    button.on('pointerup', () => {
      const next = !this.focusOn;
      this.paintFocus(next);
      onChange(next);
    });
    return { nodes: [caption, button, value], label: value };
  }

  private paintFocus(on: boolean): void {
    this.focusOn = on;
    this.focusLabel.setText(on ? 'ВКЛ' : 'ВЫКЛ');
    this.focusLabel.setColor(on ? fieldInk : fieldMuted);
  }
}

function label(scene: Phaser.Scene, y: number, text: string): Phaser.GameObjects.Text {
  return scene.add
    .text(0, y, text, {
      fontSize: '22px',
      color: fieldPaper,
    })
    .setOrigin(0.5);
}

function clamp01(level: number): number {
  return Math.min(1, Math.max(0, level));
}
