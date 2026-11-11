// Вспышка ЭМИ: луч падает в центр поля, затем полусфера накрывает всё поле.
// Когда она гаснет, бой глушит живых и рвёт ракеты. Сама картинка урон не считает.

import Phaser from 'phaser';
import { GAME } from '../../gameConfig';

const BEAM_MS = 340;
const DOME_MS = 720;
const FADE_MS = 260;
// Диск основания сжат перспективой: доля горизонтального радиуса купола.
const BASE_SQUASH = 0.12;
// Кромка чуть выходит за углы поля, чтобы полусфера накрыла его целиком.
const DOME_PAD = 28;
// Угол от основания к макушке. Макушка — π/2.
const LATITUDES = [0.42, 0.78, 1.12];
// Азимут от ближней точки диска. ±π/2 — левый и правый край силуэта.
const MERIDIANS = [-1.15, -0.58, 0.58, 1.15];

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

  // Луч до середины поля. Из этой точки растёт купол и гаснет.
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
    this.drawDome(g, cx, cy, ease, fade);
  }

  // Полусфера стоит на земле и расходится из точки удара, пока кромка не уйдёт за углы поля.
  // Силуэт — дуга сферы, низ — сжатый диск. Кольца широты и дуги долготы держат объём купола.
  private drawDome(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    ease: number,
    fade: number,
  ): void {
    if (ease <= 0 || fade <= 0) {
      return;
    }
    const halfW = Math.max(cx, GAME.width - cx);
    const lip0 = Math.min(GAME.bannerY * 0.16, Math.max(56, halfW * BASE_SQUASH));
    const eqY0 = GAME.bannerY - lip0;
    const reach = Math.hypot(halfW, eqY0) + DOME_PAD;
    const eqY = cy + (eqY0 - cy) * ease;
    const radius = reach * ease;
    const lip = lip0 * ease;
    if (radius < 4) {
      return;
    }

    g.fillStyle(0x8fd8ff, 0.16 * fade);
    g.beginPath();
    this.traceEllipse(g, cx, eqY, radius, radius, Math.PI, Math.PI * 2, true);
    this.traceEllipse(g, cx, eqY, radius, lip, 0, Math.PI, false);
    g.closePath();
    g.fillPath();

    for (const alpha of LATITUDES) {
      const ring = Math.cos(alpha);
      const ringR = radius * ring;
      const ringY = eqY - radius * Math.sin(alpha);
      const ringLip = lip * ring;
      if (ringR < 3 || ringLip < 1) {
        continue;
      }
      g.lineStyle(2, 0x9fd0ee, 0.28 * fade);
      g.beginPath();
      this.traceEllipse(g, cx, ringY, ringR, ringLip, Math.PI, Math.PI * 2, true);
      g.strokePath();
      g.lineStyle(2, 0xd7f4ff, 0.55 * fade);
      g.beginPath();
      this.traceEllipse(g, cx, ringY, ringR, ringLip, 0, Math.PI, true);
      g.strokePath();
    }

    g.lineStyle(2, 0xd7f4ff, 0.4 * fade);
    for (const beta of MERIDIANS) {
      this.strokeMeridian(g, cx, eqY, radius, lip, beta);
    }
    g.beginPath();
    g.moveTo(cx, eqY - radius);
    g.lineTo(cx, eqY + lip);
    g.strokePath();

    g.lineStyle(2, 0xb7e4ff, 0.4 * fade);
    g.beginPath();
    this.traceEllipse(g, cx, eqY, radius, lip, Math.PI, Math.PI * 2, true);
    g.strokePath();

    g.lineStyle(7, 0xeaf8ff, 0.9 * fade);
    g.beginPath();
    this.traceEllipse(g, cx, eqY, radius, radius, Math.PI, Math.PI * 2, true);
    g.strokePath();
    g.beginPath();
    this.traceEllipse(g, cx, eqY, radius, lip, 0, Math.PI, true);
    g.strokePath();

    g.lineStyle(2, 0xffffff, 0.7 * fade);
    g.beginPath();
    this.traceEllipse(g, cx, eqY, radius, radius, Math.PI, Math.PI * 2, true);
    g.strokePath();
    g.beginPath();
    this.traceEllipse(g, cx, eqY, radius, lip, 0, Math.PI, true);
    g.strokePath();
  }

  // phi = π/2 — макушка, phi = 0 — кромка диска. Ближняя дуга кончается на нижней губе.
  private strokeMeridian(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    eqY: number,
    radius: number,
    lip: number,
    beta: number,
  ): void {
    const steps = Math.max(12, Math.ceil(radius / 18));
    const sinB = Math.sin(beta);
    const cosB = Math.cos(beta);
    g.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const phi = (Math.PI / 2) * (1 - i / steps);
      const x = cx + sinB * radius * Math.cos(phi);
      const y = eqY - radius * Math.sin(phi) + lip * cosB * Math.cos(phi);
      if (i === 0) {
        g.moveTo(x, y);
      } else {
        g.lineTo(x, y);
      }
    }
    g.strokePath();
  }

  // Угол как у холста: 0 — вправо, дальше по часовой, потому что Y растёт вниз.
  private traceEllipse(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    from: number,
    to: number,
    move: boolean,
  ): void {
    const steps = Math.max(16, Math.ceil((Math.max(rx, ry) * Math.abs(to - from)) / 14));
    for (let i = 0; i <= steps; i += 1) {
      const t = from + ((to - from) * i) / steps;
      const x = cx + Math.cos(t) * rx;
      const y = cy + Math.sin(t) * ry;
      if (i === 0 && move) {
        g.moveTo(x, y);
      } else {
        g.lineTo(x, y);
      }
    }
  }
}
