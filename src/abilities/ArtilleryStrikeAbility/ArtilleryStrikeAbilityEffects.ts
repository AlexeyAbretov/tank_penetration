import Phaser from 'phaser';

import { ArtilleryFlight, ArtilleryMark } from "./ArtilleryStrikeAbility.types";

import { bake } from "../../gfx/textures";
import { playBoom } from '../../sounds/BoomSounds';
import { boomAt } from '../../gfx/boom';
import { placeCrater } from '../../gfx/craters';
import { ArtilleryStrikeAbilityConfig } from './ArtilleryStrikeAbilityConfig';

export class ArtilleryStrikeAbilityEffects {
    protected shellKey = 'artillery-shell';
    protected flarePuffKey = 'artillery-flare-puff';

    constructor(
        protected readonly config: typeof ArtilleryStrikeAbilityConfig,
    ) { }

    // Трубка факела и мягкое пятно для огня и дыма. Пятно белое: цвет задаёт tint частиц.
    protected ensureFlareTextures(scene: Phaser.Scene): void {
        if (!scene.textures.exists(this.flarePuffKey)) {
            // Вытянутый клок, не круг: по ветру читается полоса, а не шар.
            bake(scene, this.flarePuffKey, 64, 28, (g) => {
                g.fillStyle(0xffffff, 0.16);
                g.fillEllipse(34, 14, 52, 16);
                g.fillStyle(0xffffff, 0.4);
                g.fillEllipse(26, 14, 32, 12);
                g.fillStyle(0xffffff, 0.72);
                g.fillEllipse(18, 14, 16, 8);
            });
        }
    }

    // Оранжевый дым в точке, куда сядет снаряд. Трубка и струя огня ниже выключены.
    // clear гасит метку: удар уже случился или залп отменён.
    mark(scene: Phaser.Scene, x: number, y: number): ArtilleryMark {
        this.ensureFlareTextures(scene);

        const puff = this.flarePuffKey;
        // Один шлейф вправо и вверх. Оранжевый и светлый летят одним ветром, светлый чуть выше по тому же следу.
        const smoke = scene.add.particles(x, y, puff, {
            x: { min: 0, max: 6 },
            y: { min: -2, max: 3 },
            lifespan: { min: 1100, max: 1600 },
            frequency: 20,
            quantity: 2,
            speedX: { min: 40, max: 72 },
            speedY: { min: -22, max: -8 },
            gravityX: 6,
            gravityY: -8,
            scaleX: { start: 0.45, end: 1.6 },
            scaleY: { start: 0.22, end: 0.62 },
            rotate: { min: -22, max: 4 },
            alpha: { start: 0.85, end: 0 },
            color: [0xff6a22, 0xff3c0c, 0xd42c08],
        }).setDepth(16);

        const cap = scene.add.particles(x + 16, y - 10, puff, {
            x: { min: 0, max: 12 },
            y: { min: -8, max: 0 },
            lifespan: { min: 1000, max: 1500 },
            frequency: 28,
            quantity: 1,
            speedX: { min: 38, max: 68 },
            speedY: { min: -24, max: -10 },
            gravityX: 6,
            gravityY: -8,
            scaleX: { start: 0.4, end: 1.5 },
            scaleY: { start: 0.22, end: 0.58 },
            rotate: { min: -22, max: 4 },
            alpha: { start: 0.5, end: 0 },
            color: [0xffd48a, 0xffa040, 0xff6a22],
        }).setDepth(17);

        let gone = false;

        return {
            clear() {
                if (gone) {
                    return;
                }
                gone = true;
                smoke.destroy();
                cap.destroy();
            },
        };
    }

    // Светящийся снаряд падает сверху. onImpact — взрыв в точке, куда сел носик.
    // Хлопок батареи к этому моменту уже отзвучал: его играет вызов удара.
    drop(scene: Phaser.Scene, x: number, y: number, onImpact: () => void): ArtilleryFlight {
        this.ensureShellTextures(scene);

        const drift = Phaser.Math.Between(-28, 28);
        const shell = scene.add.image(x + drift, -8, this.shellKey).setDepth(18);
        shell.setOrigin(0.5, 1);
        shell.setRotation(drift * 0.004);
        shell.setBlendMode(Phaser.BlendModes.ADD);

        let settled = false;
        const tween = scene.tweens.add({
            targets: shell,
            x,
            y,
            duration: this.config.fallMs,
            ease: 'Quad.In',
            onComplete: () => {
                if (settled) {
                    return;
                }
                settled = true;
                shell.destroy();
                onImpact();
            },
        });

        return {
            cancel() {
                if (settled) {
                    return;
                }
                settled = true;
                tween.stop();
                shell.destroy();
            },
        };
    }

    protected ensureShellTextures(scene: Phaser.Scene): void {
        if (!scene.textures.exists(this.shellKey)) {
            bake(scene, this.shellKey, 16, 40, (g) => this.renderShell(g));
        }
    }

    // Носик у нижнего края: origin спрайта стоит на острие.
    protected renderShell(g: Phaser.GameObjects.Graphics): void {
        g.fillStyle(0xff2200, 0.35);
        g.fillEllipse(8, 18, 14, 34);
        g.fillStyle(0xff6600, 0.9);
        g.fillRoundedRect(4, 2, 8, 24, 3);
        g.fillStyle(0xffee66);
        g.fillTriangle(2, 22, 14, 22, 8, 38);
        g.fillStyle(0xffffff);
        g.fillCircle(8, 8, 2.5);
    }

    // Четыре кадра разрыва и воронка. Воронка гаснет сама через craterMs.
    // Свой звук на каждый снаряд.
    boom(scene: Phaser.Scene, x: number, y: number): void {
        playBoom(scene);
        boomAt(scene, x, y);
        placeCrater(scene, x, y, 5_000);

        scene.cameras.main.shake(90, 0.0035);
    }
}