// Вспышка ЭМИ: лист кадров. Луч падает к земле, затем полусфера накрывает поле.
// Когда ролик кончается, бой глушит живых и рвёт ракеты. Сама картинка урон не считает.

import Phaser from 'phaser';
import { GAME } from '../../gameConfig';

// Кадр листа 192×128, сорок штук в ряд. Низ кадра — земля, луч входит сверху.
const FRAME = { w: 192, h: 128 };
const FRAMES = 40;
const FPS = 20;

export class EmpFlash {
  static readonly sheetKey = 'emp-flash';
  static readonly animKey = 'emp-flash';
  // Путь буквальный: singlefile-сборка подменяет его на data:.
  static readonly sheetPath = 'assets/emp-flash.png';
  // Ролик 2 с. Без листа глушение ждёт столько же, чтобы удар не сработал мгновенно.
  static readonly playMs = (FRAMES / FPS) * 1000;
  // С этого кадра у земли всходит полусфера. Раньше в листе только луч.
  static readonly spreadFrame = 12;
  static readonly spreadMs = (EmpFlash.spreadFrame / FPS) * 1000;

  private elapsed = 0;
  private sprite?: Phaser.GameObjects.Sprite;
  private done = false;
  private spreadSent = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onPulse: () => void,
    private readonly onSpread: () => void,
  ) {}

  get active(): boolean {
    return !this.done;
  }

  static preload(scene: Phaser.Scene): void {
    if (scene.textures.exists(EmpFlash.sheetKey)) {
      const first = scene.textures.get(EmpFlash.sheetKey).get(0);
      if (first.width === FRAME.w && first.height === FRAME.h) {
        return;
      }
      scene.textures.remove(EmpFlash.sheetKey);
    }
    scene.load.spritesheet(EmpFlash.sheetKey, EmpFlash.sheetPath, {
      frameWidth: FRAME.w,
      frameHeight: FRAME.h,
    });
  }

  static ensure(scene: Phaser.Scene): void {
    if (!scene.textures.exists(EmpFlash.sheetKey)) {
      return;
    }
    scene.textures.get(EmpFlash.sheetKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const current = scene.anims.exists(EmpFlash.animKey) ? scene.anims.get(EmpFlash.animKey) : null;
    if (current && current.frames.length === FRAMES) {
      return;
    }
    if (current) {
      scene.anims.remove(EmpFlash.animKey);
    }
    scene.anims.create({
      key: EmpFlash.animKey,
      frames: scene.anims.generateFrameNumbers(EmpFlash.sheetKey, {
        start: 0,
        end: FRAMES - 1,
      }),
      frameRate: FPS,
      repeat: 0,
    });
  }

  start(): void {
    EmpFlash.ensure(this.scene);
    if (!this.scene.textures.exists(EmpFlash.sheetKey) || !this.scene.anims.exists(EmpFlash.animKey)) {
      return;
    }
    // Выше солдат, техники и снарядов, ниже ленты. Низ кадра стоит на линии баннера.
    this.sprite = this.scene.add.sprite(0, 0, EmpFlash.sheetKey, 0).setOrigin(0.5, 1).setDepth(40);
    this.place();
    this.sprite.play(EmpFlash.animKey);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.finish());
  }

  tick(delta: number): void {
    if (this.done) {
      return;
    }
    this.place();
    if (!this.sprite) {
      this.elapsed += delta;
    }
    this.watchSpread();
    if (!this.sprite && this.elapsed >= EmpFlash.playMs) {
      this.finish();
    }
  }

  cancel(): void {
    this.done = true;
    this.sprite?.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    this.sprite?.destroy();
    this.sprite = undefined;
  }

  // Купол всходит на кадре листа. Бой в этот момент играет расширение, не вместе со сходом луча.
  private watchSpread(): void {
    if (this.spreadSent || this.done) {
      return;
    }
    const frame = this.sprite?.anims.currentFrame?.index;
    const ready = frame === undefined ? this.elapsed >= EmpFlash.spreadMs : frame >= EmpFlash.spreadFrame;
    if (!ready) {
      return;
    }
    this.spreadSent = true;
    this.onSpread();
  }

  // Ширина поля тянет кадр на весь холст. Пиксель остаётся квадратным, верх уходит за кромку.
  private place(): void {
    const sprite = this.sprite;
    if (!sprite) {
      return;
    }
    const scale = GAME.width / FRAME.w;
    sprite.setPosition(GAME.width / 2, GAME.bannerY);
    sprite.setScale(scale);
  }

  private finish(): void {
    if (this.done) {
      return;
    }
    this.onPulse();
    this.cancel();
  }
}
