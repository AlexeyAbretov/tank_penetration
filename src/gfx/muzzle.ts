import { MUZZLE_FRAME, MUZZLE_PAINT, MuzzlePaint } from "./looks";
import { bake } from "./textures";

export class Muzzle {
    static ensureTextures(scene: Phaser.Scene): void {
        if (!scene.textures.exists('muzzle')) {
            this.createMuzzle(scene);
        }
    }

    // Круглая вспышка выстрела и взрыва. В игре её ещё красят режимом ADD, поэтому она светится.
    private static createMuzzle(scene: Phaser.Scene): void {
        bake(scene, 'muzzle', MUZZLE_FRAME.w, MUZZLE_FRAME.h, (g) => this.renderMuzzle(g));
    }

    static renderMuzzle(g: Phaser.GameObjects.Graphics, paint: MuzzlePaint = MUZZLE_PAINT): void {
        g.fillStyle(paint.outer, 0.5); // широкое оранжевое пятно
        g.fillCircle(24, 24, 22);
        g.fillStyle(paint.mid, 0.9); // жёлтый центр
        g.fillCircle(24, 24, 12);
        g.fillStyle(paint.core); // белая точка
        g.fillCircle(24, 24, 5);
    }
}