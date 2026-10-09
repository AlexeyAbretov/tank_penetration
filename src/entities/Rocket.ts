// Ракета ракетчика: летит медленнее пули, тянет за собой дым и взрывается о броню.

import Phaser from 'phaser';
import { ROCKET_FRAME } from '../gfx/looks';
import { bake } from '../gfx/textures';
import { playRocketLaunch } from '../systems/RocketSounds';
import { EnemyShot } from './EnemyShot';

export class Rocket extends EnemyShot {
  private smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
  // Пауза до следующего клуба. След — это точки позади ракеты, а не облако, которое едет вместе с ней.
  private puffMs = 0;

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists('enemy-rocket')) {
      return;
    }
    bake(scene, 'enemy-rocket', ROCKET_FRAME.w, ROCKET_FRAME.h, (g) => this.render(g));
    this.ensurePuff(scene);
  }

  // Носик справа. Картинку в полёте крутят углом скорости, поэтому нос смотрит вперёд.
  static render(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x2a3224, 1);
    g.fillTriangle(1, 1, 9, 5, 1, 4);
    g.fillTriangle(1, 9, 9, 5, 1, 6);
    g.fillStyle(0x4a5340, 1);
    g.fillRoundedRect(6, 2, 14, 6, 2);
    g.fillStyle(0xc4a060, 1);
    g.fillRect(8, 3, 3, 4);
    g.fillStyle(0xe8dcc0, 1);
    g.fillTriangle(16, 2, 25, 5, 16, 8);
    g.fillStyle(0xfff2c8, 1);
    g.fillRect(20, 4, 3, 2);
    g.fillStyle(0xff6a18, 1);
    g.fillCircle(4, 5, 2);
    g.fillStyle(0xffe080, 1);
    g.fillCircle(5, 5, 1);
  }

  constructor(scene: Phaser.Scene, x: number, y: number, damage: number) {
    super(scene, x, y, damage, 'enemy-rocket');
    this.setScale(1.8);
    this.smoke = Rocket.trailAt(scene);
    const follow = () => {
      if (this.active) {
        this.driftSmoke();
      }
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
      this.releaseSmoke();
    });
  }

  // Свой хлопок из rocket_shot.mp3. Винтовочный выстрел ракете не подходит.
  protected override reportShot(): void {
    playRocketLaunch(this.scene);
  }

  // Клубы остаются там, где ракета уже пролетела, и гаснут сами.
  private driftSmoke(): void {
    const smoke = this.smoke;
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!smoke?.active || !body) {
      return;
    }
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed < 1) {
      return;
    }
    this.puffMs -= this.scene.game.loop.delta;
    if (this.puffMs > 0) {
      return;
    }
    this.puffMs = 22;
    const backX = -body.velocity.x / speed;
    const backY = -body.velocity.y / speed;
    smoke.emitParticleAt(this.x + backX * 12, this.y + backY * 12, 1);
  }

  private releaseSmoke(): void {
    const smoke = this.smoke;
    if (!smoke) {
      return;
    }
    this.smoke = undefined;
    smoke.stop();
    const scene = smoke.scene;
    if (!scene) {
      smoke.destroy();
      return;
    }
    scene.time.delayedCall(700, () => {
      if (smoke.scene) {
        smoke.destroy();
      }
    });
  }

  // Общий клуб дыма. Пикап рисует им выхлоп, ракета — след.
  static ensurePuff(scene: Phaser.Scene): void {
    if (scene.textures.exists('smoke-puff')) {
      return;
    }
    bake(scene, 'smoke-puff', 32, 32, (g) => {
      g.fillStyle(0xffffff, 0.18);
      g.fillCircle(16, 16, 15);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(16, 16, 9);
      g.fillStyle(0xffffff, 0.75);
      g.fillCircle(16, 16, 4);
    });
  }

  // Эмиттер в (0, 0): emitParticleAt прибавляет точку к позиции эмиттера.
  // Если поставить его на ракету, клуб сложится с её координатой и уйдёт за край поля.
  static trailAt(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
    this.ensurePuff(scene);
    const smoke = scene.add.particles(0, 0, 'smoke-puff', {
      lifespan: { min: 380, max: 720 },
      speed: { min: 8, max: 24 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.45, end: 1.35 },
      alpha: { start: 0.8, end: 0 },
      color: [0xffe0c0, 0xe4e0d8, 0x9a968e],
      emitting: false,
    });
    smoke.setDepth(13);
    return smoke;
  }

  // Короткий взрыв в точке попадания. Меньше гибели пикапа: вспышка и горсть искр.
  static burstAt(scene: Phaser.Scene, x: number, y: number): void {
    const sparkKey = 'spark';
    if (!scene.textures.exists(sparkKey)) {
      bake(scene, sparkKey, 12, 12, (g) => {
        g.fillStyle(0xffffff);
        g.fillCircle(6, 6, 5);
      });
    }
    const sparks = scene.add.particles(x, y, sparkKey, {
      lifespan: { min: 160, max: 340 },
      speed: { min: 24, max: 150 },
      scale: { start: 0.65, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      color: [0xfff6d0, 0xff8a22, 0xff2a10],
      gravityY: 260,
      emitting: false,
    });
    sparks.setDepth(27);
    sparks.explode(12);
    scene.time.delayedCall(420, () => {
      if (sparks.scene) {
        sparks.destroy();
      }
    });

    const fire = scene.add.circle(x, y, 14, 0xff4a12, 0.95).setDepth(27);
    const core = scene.add.circle(x, y, 6, 0xfff4c8, 1).setDepth(28);
    scene.tweens.add({
      targets: [fire, core],
      alpha: 0,
      scale: 2.4,
      duration: 200,
      onComplete: () => {
        fire.destroy();
        core.destroy();
      },
    });
  }
}
