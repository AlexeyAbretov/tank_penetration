// Окно выбора сложности. Само число не считает: строка живёт в списке сложностей.
// Первая партия закрывается только выбором. «Новая игра» поверх паузы или магазина очков ещё и крестиком.

import Phaser from 'phaser';
import { DIFFICULTIES, type DifficultyId } from '../../difficulty';
import { t } from '../../locale';
import { fieldInk, fieldInkStroke, fieldPaper, paintFieldPlate, paintFieldRule, paintOrderBar } from '../militaryDialog';

const PANEL_W = 640;
const BAR_W = 540;
const BAR_H = 88;
const GAP = 16;
const TITLE_BAND = 132;

type Choice = {
  id: DifficultyId;
  name: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.Text;
};

export class DifficultyPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly closeRoot: Phaser.GameObjects.Container;
  private closeHit!: Phaser.GameObjects.Rectangle;
  private readonly choices: Choice[];
  private onPick?: (id: DifficultyId) => void;
  private onCancel?: () => void;

  constructor(
    scene: Phaser.Scene,
    private readonly frame: { width: number; height: number },
  ) {
    const stack = DIFFICULTIES.length * BAR_H + Math.max(0, DIFFICULTIES.length - 1) * GAP;
    const panelH = TITLE_BAND + stack + 28;
    const firstY = -panelH / 2 + TITLE_BAND + BAR_H / 2;

    this.dim = scene.add.rectangle(0, 0, frame.width, frame.height, 0x000000, 0.55).setInteractive();
    const plate = scene.add.graphics();
    paintFieldPlate(plate, PANEL_W, panelH);
    const rule = scene.add.graphics();
    paintFieldRule(rule, -panelH / 2 + 86, 220);
    this.title = scene.add
      .text(0, -panelH / 2 + 52, t().difficulty.title, {
        fontSize: '40px',
        color: fieldInk,
        stroke: fieldInkStroke,
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const nodes: Phaser.GameObjects.GameObject[] = [this.dim, plate, rule, this.title];
    this.choices = DIFFICULTIES.map((row, index) => {
      const y = firstY + index * (BAR_H + GAP);
      const face = scene.add.graphics().setPosition(0, y);
      paintOrderBar(face, BAR_W, BAR_H);
      const hit = scene.add.rectangle(0, y, BAR_W, BAR_H, 0x000000, 0).setInteractive({ useHandCursor: true });
      const name = scene.add
        .text(0, y - 16, '', {
          fontSize: '22px',
          color: fieldInk,
        })
        .setOrigin(0.5);
      const hint = scene.add
        .text(0, y + 16, '', {
          fontSize: '16px',
          color: fieldPaper,
          align: 'center',
          wordWrap: { width: BAR_W - 48 },
        })
        .setOrigin(0.5);
      hit.on('pointerup', () => this.onPick?.(row.id));
      nodes.push(face, hit, name, hint);
      return { id: row.id, name, hint };
    });

    this.closeRoot = this.makeClose(scene);
    this.closeRoot.setPosition(PANEL_W / 2 - 40, -panelH / 2 + 38);
    this.closeRoot.setVisible(false);
    nodes.push(this.closeRoot);

    this.container = scene.add
      .container(frame.width / 2, frame.height / 2, nodes)
      .setDepth(96)
      .setVisible(false);
    this.applyLanguage();
  }

  layout(): void {
    this.container.setPosition(this.frame.width / 2, this.frame.height / 2);
    this.dim.setSize(this.frame.width, this.frame.height);
  }

  isOpen(): boolean {
    return this.container.visible;
  }

  // Крестик и Esc есть только когда под окном уже идёт партия или магазин очков.
  canDismiss(): boolean {
    return this.onCancel !== undefined;
  }

  open(onPick: (id: DifficultyId) => void, onCancel?: () => void): void {
    this.onPick = onPick;
    this.onCancel = onCancel;
    this.closeRoot.setVisible(onCancel !== undefined);
    if (onCancel) {
      this.closeHit.setInteractive({ useHandCursor: true });
    } else {
      this.closeHit.disableInteractive();
    }
    this.applyLanguage();
    this.container.setVisible(true);
  }

  hide(): void {
    this.onPick = undefined;
    this.onCancel = undefined;
    this.closeHit.disableInteractive();
    this.closeRoot.setVisible(false);
    this.container.setVisible(false);
  }

  applyLanguage(): void {
    const copy = t().difficulty;
    this.title.setText(copy.title);
    for (const choice of this.choices) {
      const row = copy.options[choice.id];
      choice.name.setText(row.name);
      choice.hint.setText(row.hint);
    }
  }

  private makeClose(scene: Phaser.Scene): Phaser.GameObjects.Container {
    this.closeHit = scene.add.rectangle(0, 0, 48, 48, 0x000000, 0.001);
    const mark = scene.add
      .text(0, -1, '×', {
        fontSize: '32px',
        color: fieldInk,
      })
      .setOrigin(0.5);
    this.closeHit.on('pointerup', () => this.onCancel?.());
    return scene.add.container(0, 0, [this.closeHit, mark]);
  }
}
