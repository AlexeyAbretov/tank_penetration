// Штурмовик: обычный солдат. Идёт влево до базы и бьёт её при контакте.
// Удар по базе — взрыв на месте, а не тихое исчезновение.
// С первой волны и до 10-й волна состоит из них. Дальше фабрика дописывает других.

// Phaser нужен из-за типа Scene.
import Phaser from 'phaser';
import { contactBlast } from '../gfx/contactBlast';
import { ASSAULT_LOOK, CORPSE_FRAME, SOLDIER_FRAME } from '../gfx/looks';
import { bake } from '../gfx/textures';
import { Infantry } from './Infantry';

export class AssaultInfantry extends Infantry {
  static readonly walkFps = 9;
  static readonly corpseKey = 'infantry-corpse';
  // Шесть кадров шага обрезаны по фигуре. Подошва стоит на строке 62.
  static readonly frame = { w: 53, h: 64 };
  // Опора и хитбокс этих картинок. Общие числа Infantry рассчитаны на кадр 64×80.
  static readonly fit = {
    originX: 35 / 53,
    originY: 63 / 64,
    bodyW: 22,
    bodyH: 52,
    bodyX: 24,
    bodyY: 6,
  };
  // Лежащее тело шире шага. Низ крови и винтовки — та же земля, что у подошвы.
  // Рост стоящего — 61 px, длина лежащего — 89 px. Тот же масштаб делает труп крупнее.
  static readonly corpseFrame = { w: 91, h: 45 };
  static readonly corpseFit = {
    originX: 0.5,
    originY: 44.5 / 45,
    scale: Infantry.placed.scale * (61 / 89),
  };

  // Контакт → подъём → пронос → контакт другой ноги → подъём → пронос. Последний — труп.
  // Пути в public/. Строки буквальные: singlefile-сборка подменяет их на data:.
  static readonly images = {
    'infantry-0': 'assets/infantry-0.png',
    'infantry-1': 'assets/infantry-1.png',
    'infantry-2': 'assets/infantry-2.png',
    'infantry-3': 'assets/infantry-3.png',
    'infantry-4': 'assets/infantry-4.png',
    'infantry-5': 'assets/infantry-5.png',
    [AssaultInfantry.corpseKey]: 'assets/infantry-corpse.png',
  } as const;

  // Все ключи кроме трупа — в порядке шага.
  static readonly frameKeys = (
    Object.keys(AssaultInfantry.images) as (keyof typeof AssaultInfantry.images)[]
  ).filter((key) => key !== AssaultInfantry.corpseKey);

  // Убийство даёт 1 монету.
  readonly coinReward = 1;
  // Доходит до стены, в отличие от стрелков.
  readonly reachesBase = true;
  // Столько здоровья базы снимает один дошедший солдат.
  readonly contactDamage = 12;

  // GameScene и студия зовут до create.
  static preload(scene: Phaser.Scene): void {
    for (const [key, path] of Object.entries(this.images)) {
      scene.load.image(key, path);
    }
  }

  // Шесть кадров шага и анимация, которая их крутит. Повторный вызов ничего не рисует заново.
  // В бою кадры — картинки из assets/. Фигурный рисунок остаётся, если файл не загрузили.
  static ensureTextures(scene: Phaser.Scene): void {
    const idle = this.frameKeys[0];
    const step = this.frameKeys[1];
    if (idle && !scene.textures.exists(idle)) {
      bake(scene, idle, SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
        this.drawSoldier(g, 0, ASSAULT_LOOK),
      );
      if (step) {
        bake(scene, step, SOLDIER_FRAME.w, SOLDIER_FRAME.h, (g) =>
          this.drawSoldier(g, 1, ASSAULT_LOOK),
        );
      }
    }
    if (!scene.textures.exists(this.corpseKey)) {
      bake(scene, this.corpseKey, CORPSE_FRAME.w, CORPSE_FRAME.h, (g) =>
        this.drawCorpse(g, ASSAULT_LOOK),
      );
    }
    const frames = this.frameKeys.filter((key) => scene.textures.exists(key));
    // Кадры шага — пиксели. Ближний фильтр не размывает их при увеличении.
    for (const key of frames) {
      if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    if (scene.textures.exists(this.corpseKey)) {
      scene.textures.get(this.corpseKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    // Анимация живёт в общем менеджере. Собираем заново: порядок кадров мог смениться.
    if (scene.anims.exists('infantry-walk')) {
      scene.anims.remove('infantry-walk');
    }
    scene.anims.create({
      key: 'infantry-walk',
      frames: frames.map((key) => ({ key })),
      frameRate: this.walkFps,
      repeat: -1,
    });
  }

  constructor(scene: Phaser.Scene, x: number, y: number, hp: number) {
    // Первый кадр шага и анимация infantry-walk, красная полоска HP.
    super(scene, x, y, hp, AssaultInfantry.frameKeys[0], 'infantry-walk', 0xd42a2a);
    const fit = AssaultInfantry.fit;
    this.setOrigin(fit.originX, fit.originY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(fit.bodyW, fit.bodyH);
    body.setOffset(fit.bodyX, fit.bodyY);
  }

  protected override corpseTexture(): string | null {
    return AssaultInfantry.corpseKey;
  }

  // После смены картинки опора шага уже не подходит: тело лежит, а не стоит.
  override kill(): void {
    const wasAlive = !this.reachedWall;
    super.kill();
    if (wasAlive && this.texture.key === AssaultInfantry.corpseKey) {
      this.setOrigin(AssaultInfantry.corpseFit.originX, AssaultInfantry.corpseFit.originY);
      this.setScale(AssaultInfantry.corpseFit.scale);
    }
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
    contactBlast(scene, x, chest, feetY);
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
  }
}
