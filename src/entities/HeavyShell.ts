// Снаряд тяжёлого танка. Нос картинки смотрит влево, к базе.
// Лазер его не берёт: это не ракета. Стена и броня танка встречают его как чужой выстрел.

import Phaser, { Scene } from 'phaser';
import { EnemyShot } from './EnemyShot';

export class HeavyShell extends EnemyShot {
  static readonly textureKey = 'heavy-tank-shell';
  static readonly imagePath = 'assets/heavy-tank-shell.png';
  // Кадр 192×96. Нос и огонь занимают почти всю ширину, тело ниже середины.
  static readonly frame = { w: 192, h: 96 };
  // Вдвое меньше кадра на поле: болванка уже ствола, из которого вылетела.
  static readonly scale = 0.25;
  // Хитбокс по стальному телу, без ореола огня по краям картинки.
  static readonly bodySize = { w: 78, h: 28, x: 48, y: 32 };
  // Лист попадания в танк игрока: 12 кадров 96×96 в ряд. В файле каждый кадр держится 70 мс.
  static readonly burstKey = 'heavy-shell-burst';
  static readonly burstPath = 'assets/heavy-shell-burst.png';
  static readonly burstFrame = { w: 96, h: 96 };
  static readonly burstFrames = 12;
  static readonly burstFps = 1000 / 70;
  static readonly burstAnim = 'heavy-shell-burst';

  static preload(scene: Scene): void {
    scene.load.spritesheet(this.burstKey, this.burstPath, {
      frameWidth: this.burstFrame.w,
      frameHeight: this.burstFrame.h,
    });
  }

  protected ensureTextures(scene: Scene): void {
    if (scene.textures.exists(HeavyShell.textureKey)) {
      scene.textures.get(HeavyShell.textureKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    HeavyShell.ensureBurst(scene);
  }

  // Вспышка, огонь и серый дым на броне. Фон листа прозрачный, поэтому режим ADD не нужен.
  static burstAt(scene: Scene, x: number, y: number): void {
    this.ensureBurst(scene);
    if (!scene.anims.exists(this.burstAnim)) {
      return;
    }
    const boom = scene.add.sprite(x, y, this.burstKey).setOrigin(0.5, 0.5).setScale(1.5).setDepth(32);
    boom.play(this.burstAnim);
    boom.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => boom.destroy());
  }

  private static ensureBurst(scene: Scene): void {
    if (!scene.textures.exists(this.burstKey)) {
      return;
    }
    scene.textures.get(this.burstKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (scene.anims.exists(this.burstAnim)) {
      return;
    }
    scene.anims.create({
      key: this.burstAnim,
      frames: scene.anims.generateFrameNumbers(this.burstKey, {
        start: 0,
        end: this.burstFrames - 1,
      }),
      frameRate: this.burstFps,
      repeat: 0,
    });
  }

  constructor(scene: Scene, x: number, y: number, damage: number) {
    super(scene, x, y, damage, HeavyShell.textureKey);

    this.ensureTextures(scene);

    this.setScale(HeavyShell.scale);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(HeavyShell.bodySize.w, HeavyShell.bodySize.h);
    body.setOffset(HeavyShell.bodySize.x, HeavyShell.bodySize.y);
  }

  // Картинка уже смотрит влево. Угол полёта 0 — вправо, поэтому от него отнимается разворот.
  override launch(angle: number, speed: number): this {
    const shot = super.launch(angle, speed);
    this.setRotation(Phaser.Math.Angle.Wrap(angle - Math.PI));
    return shot;
  }

  // Хлопок пули здесь лишний: пушку озвучивает сам танк.
  protected override reportShot(): void {}
}
