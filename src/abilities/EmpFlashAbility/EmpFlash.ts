// Вспышка ЭМИ: луч падает в центр поля, затем полусфера накрывает всё поле.
// Когда она гаснет, бой глушит живых и рвёт ракеты. Сама картинка урон не считает.

import Phaser from 'phaser';
import { GAME } from '../../gameConfig';

const BEAM_MS = 340;
const DOME_MS = 720;
const FADE_MS = 260;

export class EmpFlash {
  private elapsed = 0;
  private graphic?: Phaser.GameObjects.Graphics;
  private pulsed = false;
  private done = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onPulse: () => void,
  ) {}

  get active(): boolean {
    return !this.done;
  }

  start(): void {
    // Выше солдат, техники и снарядов, ниже ленты. Сложение светлит луч и кромку купола.
    this.graphic = this.scene.add.graphics().setDepth(40).setBlendMode(Phaser.BlendModes.ADD);
  }

  tick(delta: number): void {
    if (this.done) {
      return;
    }
    this.elapsed += delta;
    const total = BEAM_MS + DOME_MS + FADE_MS;
    this.draw();
    if (this.elapsed < total) {
      return;
    }
    if (!this.pulsed) {
      this.pulsed = true;
      this.onPulse();
    }
    this.cancel();
  }

  cancel(): void {
    this.done = true;
    this.graphic?.destroy();
    this.graphic = undefined;
  }

  // Луч до середины поля, потом купол растёт до краёв и гаснет.
  private draw(): void {
    const g = this.graphic;
    if (!g) {
      return;
    }
    g.clear();
    const cx = GAME.width / 2;
    const cy = GAME.bannerY / 2;
    const beam = Math.min(1, this.elapsed / BEAM_MS);
    if (this.elapsed < BEAM_MS + 140) {
      const y = cy * beam;
      const alpha = this.elapsed < BEAM_MS ? 1 : Math.max(0, 1 - (this.elapsed - BEAM_MS) / 140);
      g.lineStyle(22, 0x6ad4ff, 0.35 * alpha);
      g.lineBetween(cx, 0, cx, y);
      g.lineStyle(7, 0xd7f4ff, 0.85 * alpha);
      g.lineBetween(cx, 0, cx, y);
      g.lineStyle(2, 0xffffff, alpha);
      g.lineBetween(cx, 0, cx, y);
      g.fillStyle(0xffffff, 0.95 * alpha);
      g.fillCircle(cx, y, 8 + 10 * beam);
    }
    if (this.elapsed < BEAM_MS) {
      return;
    }
    const into = this.elapsed - BEAM_MS;
    const grow = Math.min(1, into / DOME_MS);
    const ease = 1 - (1 - grow) ** 2;
    const fade = into <= DOME_MS ? 1 : Math.max(0, 1 - (into - DOME_MS) / FADE_MS);
    const rx = 28 + (Math.max(cx, GAME.width - cx) + 36 - 28) * ease;
    const ry = 18 + (Math.max(cy, GAME.bannerY - cy) + 24 - 18) * ease;
    g.fillStyle(0x8fd8ff, 0.16 * fade);
    g.fillEllipse(cx, cy, rx * 2, ry * 2);
    g.lineStyle(7, 0xeaf8ff, 0.9 * fade);
    g.strokeEllipse(cx, cy, rx * 2, ry * 2);
    g.lineStyle(3, 0xffffff, 0.55 * fade);
    g.strokeEllipse(cx, cy, rx * 2 * 0.62, ry * 2 * 0.62);
  }
}
