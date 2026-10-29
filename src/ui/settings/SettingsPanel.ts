// Окно громкости. Бой на это время стоит, музыка играет:
// ползунок музыки сразу слышно. Закрывает его только кнопка «Готово».
// Второй ползунок — эффекты. Музыку он не трогает.

import Phaser from 'phaser';

const PANEL_W = 520;
const PANEL_H = 400;
const TRACK_W = 340;
const MUSIC_Y = -56;
const EFFECTS_Y = 64;

type Slider = {
  nodes: Phaser.GameObjects.GameObject[];
  paint: (level: number) => void;
  apply: (pointer: Phaser.Input.Pointer) => void;
};

export class SettingsPanel {
  protected container!: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Rectangle;
  // Карточка и «Готово» открыты наследнику: дебаг дописывает поле снизу и растит окно вниз.
  protected card!: Phaser.GameObjects.Rectangle;
  protected done!: Phaser.GameObjects.Rectangle;
  protected doneLabel!: Phaser.GameObjects.Text;
  private readonly music: Slider;
  private readonly effects: Slider;
  private dragging: Slider | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly frame: { width: number; height: number },
    onMusic: (level: number) => void,
    onEffects: (level: number) => void,
    private readonly onClose: () => void,
  ) {
    this.dim = scene.add.rectangle(0, 0, frame.width, frame.height, 0x000000, 0.45).setInteractive();

    this.card = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x3a0c0c, 0.96).setStrokeStyle(4, 0xc9a227);
    // Глушит клик по затемнению, когда курсор над самой карточкой.
    this.card.setInteractive();

    const title = scene.add
      .text(0, -158, 'НАСТРОЙКИ', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '40px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const musicLabel = label(scene, -100, 'Громкость музыки');
    const effectsLabel = label(scene, 20, 'Громкость эффектов');
    this.music = this.makeSlider(scene, MUSIC_Y, onMusic);
    this.effects = this.makeSlider(scene, EFFECTS_Y, onEffects);

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

    this.done = scene.add.rectangle(0, 148, 220, 48, 0x8a1810).setStrokeStyle(2, 0xf0d56a);
    this.done.setInteractive({ useHandCursor: true });
    this.done.on('pointerup', () => this.onClose());
    this.doneLabel = scene.add
      .text(0, 148, 'ГОТОВО', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    this.container = scene.add
      .container(frame.width / 2, frame.height / 2, [
        this.dim,
        this.card,
        title,
        musicLabel,
        effectsLabel,
        ...this.music.nodes,
        ...this.effects.nodes,
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

  setOpen(open: boolean): void {
    this.dragging = null;
    this.container.setVisible(open);
  }

  private makeSlider(
    scene: Phaser.Scene,
    y: number,
    onChange: (level: number) => void,
  ): Slider {
    const track = scene.add.rectangle(0, y, TRACK_W, 8, 0x2a0a0a);
    const fill = scene.add.rectangle(-TRACK_W / 2, y, 0, 8, 0xc9a227).setOrigin(0, 0.5);
    const thumb = scene.add.circle(-TRACK_W / 2, y, 11, 0xf0d56a).setStrokeStyle(2, 0x4a1208);
    const valueText = scene.add
      .text(TRACK_W / 2 + 48, y, '0%', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    const slider: Slider = {
      nodes: [],
      paint: (level) => {
        const width = TRACK_W * level;
        fill.width = Math.max(0, width);
        thumb.x = -TRACK_W / 2 + width;
        valueText.setText(`${Math.round(level * 100)}%`);
      },
      apply: (pointer) => {
        const left = this.frame.width / 2 - TRACK_W / 2;
        const ratio = clamp01((pointer.worldX - left) / TRACK_W);
        const level = Math.round(ratio * 100) / 100;
        slider.paint(level);
        onChange(level);
      },
    };

    // Полоска толще дорожки, чтобы в неё попадали без прицеливания.
    const hit = scene.add.rectangle(0, y, TRACK_W, 36, 0x000000, 0.001).setInteractive({ useHandCursor: true });
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
}

function label(scene: Phaser.Scene, y: number, text: string): Phaser.GameObjects.Text {
  return scene.add
    .text(0, y, text, {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#f0dcc0',
    })
    .setOrigin(0.5);
}

function clamp01(level: number): number {
  return Math.min(1, Math.max(0, level));
}
