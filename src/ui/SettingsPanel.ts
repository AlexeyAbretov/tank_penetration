// Окно громкости. Бой на это время стоит, музыка играет:
// ползунок сразу слышно. Клик мимо окна и кнопка «Готово» закрывают его.

import Phaser from 'phaser';
import { GAME } from '../gameConfig';

const PANEL_W = 520;
const PANEL_H = 280;
const TRACK_W = 340;
const TRACK_Y = 18;

export class SettingsPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly thumb: Phaser.GameObjects.Arc;
  private readonly valueText: Phaser.GameObjects.Text;
  private dragging = false;

  constructor(
    scene: Phaser.Scene,
    private readonly onVolume: (level: number) => void,
    private readonly onClose: () => void,
  ) {
    const dim = scene.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.45).setInteractive();
    // Отпускание после перетаскивания ползунка за край окна не должно его закрывать.
    dim.on('pointerup', () => {
      if (this.dragging) {
        return;
      }
      this.onClose();
    });

    const panel = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x3a0c0c, 0.96).setStrokeStyle(4, 0xc9a227);
    // Глушит клик по затемнению, когда курсор над самой карточкой.
    panel.setInteractive();

    const title = scene.add
      .text(0, -88, 'НАСТРОЙКИ', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '40px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const label = scene.add
      .text(0, -28, 'Громкость музыки', {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);

    this.valueText = scene.add
      .text(TRACK_W / 2 + 48, TRACK_Y, '0%', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    const track = scene.add.rectangle(0, TRACK_Y, TRACK_W, 8, 0x2a0a0a);
    this.fill = scene.add.rectangle(-TRACK_W / 2, TRACK_Y, 0, 8, 0xc9a227).setOrigin(0, 0.5);
    this.thumb = scene.add.circle(-TRACK_W / 2, TRACK_Y, 11, 0xf0d56a).setStrokeStyle(2, 0x4a1208);

    // Полоска толще дорожки, чтобы в неё попадали без прицеливания.
    const hit = scene.add
      .rectangle(0, TRACK_Y, TRACK_W, 36, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.applyPointer(pointer);
    });

    const onMove = (pointer: Phaser.Input.Pointer): void => {
      if (!this.dragging || !this.container.visible) {
        return;
      }
      this.applyPointer(pointer);
    };
    const onUp = (): void => {
      this.dragging = false;
    };
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.events.once('shutdown', () => {
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
    });

    const done = scene.add.rectangle(0, 92, 220, 48, 0x8a1810).setStrokeStyle(2, 0xf0d56a);
    done.setInteractive({ useHandCursor: true });
    done.on('pointerup', () => this.onClose());
    const doneLabel = scene.add
      .text(0, 92, 'ГОТОВО', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);

    this.container = scene.add
      .container(GAME.width / 2, GAME.height / 2, [
        dim,
        panel,
        title,
        label,
        track,
        this.fill,
        this.thumb,
        hit,
        this.valueText,
        done,
        doneLabel,
      ])
      .setDepth(88)
      .setVisible(false);
  }

  // Только рисунок. Звук зовёт сцена, когда ползунок реально сдвинули.
  setVolume(level: number): void {
    this.paint(clamp01(level));
  }

  setOpen(open: boolean): void {
    this.dragging = false;
    this.container.setVisible(open);
  }

  private applyPointer(pointer: Phaser.Input.Pointer): void {
    const left = GAME.width / 2 - TRACK_W / 2;
    const ratio = clamp01((pointer.worldX - left) / TRACK_W);
    const level = Math.round(ratio * 100) / 100;
    this.paint(level);
    this.onVolume(level);
  }

  private paint(level: number): void {
    const width = TRACK_W * level;
    this.fill.width = Math.max(0, width);
    this.thumb.x = -TRACK_W / 2 + width;
    this.valueText.setText(`${Math.round(level * 100)}%`);
  }
}

function clamp01(level: number): number {
  return Math.min(1, Math.max(0, level));
}
