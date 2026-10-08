// Штурмовик: обычный солдат. Идёт влево до базы и бьёт её при контакте.
// Удар по базе — взрыв на месте, а не тихое исчезновение.
// С первой волны и до 10-й волна состоит из них. Дальше фабрика дописывает других.

// Phaser нужен из-за типа Scene и вспышки BlendModes при взрыве о базу.
import Phaser from 'phaser';
import { ASSAULT_LOOK, CORPSE_FRAME, SOLDIER_FRAME } from '../gfx/looks';
import { bake } from '../gfx/textures';
import { Infantry } from './Infantry';

export class AssaultInfantry extends Infantry {
  static readonly walkFps = 7;
  static readonly corpseKey = 'infantry-corpse';

  // Убийство даёт 1 монету.
  readonly coinReward = 1;
  // Доходит до стены, в отличие от стрелков.
  readonly reachesBase = true;
  // Столько здоровья базы снимает один дошедший солдат.
  readonly contactDamage = 12;

  // Два кадра шага и анимация, которая их чередует. Повторный вызов ничего не рисует заново.
  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('infantry-0')) {
      bake(scene, 'infantry-0', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 0, ASSAULT_LOOK),
      );
      bake(scene, 'infantry-1', SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 1, ASSAULT_LOOK),
      );
    }
    if (!scene.textures.exists(this.corpseKey)) {
      bake(scene, this.corpseKey, CORPSE_FRAME.w, CORPSE_FRAME.h, (g) =>
        this.drawCorpse(g, ASSAULT_LOOK),
      );
    }
    // exists: после поражения сцена создаётся снова, а анимация живёт в общем менеджере.
    if (!scene.anims.exists('infantry-walk')) {
      scene.anims.create({
        key: 'infantry-walk',
        // Кадры — две отдельные текстуры, не разрезанный лист.
        frames: [{ key: 'infantry-0' }, { key: 'infantry-1' }],
        frameRate: this.walkFps,
        repeat: -1, // крутить без конца
      });
    }
  }

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number) {
    // Картинки infantry-0 / infantry-1 и анимация infantry-walk, красная полоска HP.
    super(scene, x, y, hp, 'infantry-0', 'infantry-walk', 0xd42a2a);
  }

  protected override corpseTexture(): string | null {
    return AssaultInfantry.corpseKey;
  }

  // До стены доходит живым, поэтому трупа нет: вместо таяния вспышка на корпусе.
  protected override vanish(): void {
    const scene = this.scene;
    const x = this.x;
    const y = this.y;
    this.destroy();
    AssaultInfantry.detonate(scene, x, y);
  }

  // Взрыв о броне. Ноги в (x, y): вспышка по груди, ошмётки формы разлетаются в стороны.
  static detonate(scene: Phaser.Scene, x: number, feetY: number): void {
    const chest = feetY - 48;
    AssaultInfantry.ensureSpark(scene);

    const flash = scene.add
      .circle(x, chest, 10, 0xfff6d0, 1)
      .setDepth(32)
      .setBlendMode(Phaser.BlendModes.ADD);
    const fire = scene.add
      .circle(x, chest, 22, 0xff4a12, 0.95)
      .setDepth(30)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: flash,
      scale: 3.2,
      alpha: 0,
      duration: 140,
      onComplete: () => flash.destroy(),
    });
    scene.tweens.add({
      targets: fire,
      scale: 3.6,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.Out',
      onComplete: () => fire.destroy(),
    });

    const ring = scene.add
      .ellipse(x, feetY - 6, 24, 10, 0xfff4d0, 0)
      .setStrokeStyle(3, 0xffe080, 0.95)
      .setDepth(29)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: ring,
      scaleX: 5.4,
      scaleY: 2.6,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    const sparks = scene.add.particles(x, chest, 'spark', {
      lifespan: { min: 280, max: 640 },
      speed: { min: 80, max: 460 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.6, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      color: [0xfff6d0, 0xff8a22, 0xff2a10],
      gravityY: 520,
      emitting: false,
    });
    sparks.setDepth(33);
    sparks.explode(36);

    const smoke = scene.add.particles(x, chest, 'spark', {
      lifespan: { min: 420, max: 860 },
      speed: { min: 16, max: 90 },
      angle: { min: -120, max: -60 },
      scale: { start: 1.3, end: 3.4 },
      alpha: { start: 0.4, end: 0 },
      color: [0xd8d0c4, 0x6a645c],
      gravityY: -30,
      emitting: false,
    });
    smoke.setDepth(28);
    smoke.explode(10);

    scene.time.delayedCall(900, () => {
      if (sparks.scene) {
        sparks.destroy();
      }
      if (smoke.scene) {
        smoke.destroy();
      }
    });

    const scrap = [
      ASSAULT_LOOK.tunic,
      ASSAULT_LOOK.vest,
      ASSAULT_LOOK.helmet,
      ASSAULT_LOOK.pants,
      ASSAULT_LOOK.boots,
      ASSAULT_LOOK.rifle,
    ];
    for (let i = 0; i < scrap.length; i += 1) {
      const wide = i % 2 === 0;
      const bit = scene.add
        .rectangle(x, chest, wide ? 14 : 8, wide ? 6 : 8, scrap[i])
        .setDepth(31);
      const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
      const dist = Phaser.Math.Between(70, 170);
      scene.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * dist,
        y: chest + Math.sin(angle) * dist * 0.65 + 48,
        angle: Phaser.Math.Between(-220, 220),
        alpha: 0,
        duration: Phaser.Math.Between(420, 680),
        ease: 'Quad.Out',
        onComplete: () => bit.destroy(),
      });
    }

    // Второй клуб чуть левее: заряд догорает уже о броню, а не одним хлопком.
    scene.time.delayedCall(80, () => {
      const lick = scene.add
        .circle(x - 18, chest - 6, 14, 0xff6a18, 0.9)
        .setDepth(31)
        .setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: lick,
        scale: 2.4,
        alpha: 0,
        duration: 200,
        onComplete: () => lick.destroy(),
      });
    });

    scene.cameras.main.shake(120, 0.005);
  }

  private static ensureSpark(scene: Phaser.Scene): void {
    if (scene.textures.exists('spark')) {
      return;
    }
    bake(scene, 'spark', 12, 12, (g) => {
      g.fillStyle(0xffffff);
      g.fillCircle(6, 6, 5);
    });
  }
}
