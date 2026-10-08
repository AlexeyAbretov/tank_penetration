// Счёт, полоска HP, баннер волны и плашка поражения.

import Phaser from 'phaser';
import { ArtilleryStrike } from '../entities/ArtilleryStrike';
import { Tank } from '../entities/Tank';
import { GAME } from '../gameConfig';
export class GameHud {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly coinsText: Phaser.GameObjects.Text;
  private readonly tankStatsText: Phaser.GameObjects.Text;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly waveBanner: Phaser.GameObjects.Text;
  private readonly controls: Phaser.GameObjects.Text;
  private readonly artillery: Phaser.GameObjects.Container;
  private readonly artillerySweep: Phaser.GameObjects.Graphics;
  private readonly artilleryTime: Phaser.GameObjects.Text;
  private readonly overlay: Phaser.GameObjects.Container;
  private readonly hastePlate: Phaser.GameObjects.Rectangle;
  private readonly hasteLabel: Phaser.GameObjects.Text;
  private artilleryOwned = false;
  private hasteCycle?: () => void;

  constructor(scene: Phaser.Scene) {
    scene.add.image(GAME.width / 2, 677, 'banner').setDepth(50);

    scene.add
      .text(GAME.width / 2, 678, 'TANK', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '42px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(51);

    this.scoreText = scene.add
      .text(28, 18, 'SCORE  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f3d56a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setDepth(51);

    this.waveText = scene.add
      .text(28, 48, 'WAVE  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#e8c48a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setDepth(51);

    this.coinsText = scene.add
      .text(28, 74, 'COINS  0', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setDepth(51);

    this.tankStatsText = scene.add
      .text(28, 104, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#e8c48a',
        stroke: '#2a0a08',
        strokeThickness: 3,
        lineSpacing: 4,
      })
      .setDepth(51);

    this.waveBanner = scene.add
      .text(GAME.width / 2, 120, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '56px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setAlpha(0);

    this.hastePlate = scene.add
      .rectangle(102, 150, 148, 34, 0x3a0c0c)
      .setStrokeStyle(2, 0xc9a227)
      .setDepth(53)
      .setInteractive({ useHandCursor: true });
    this.hasteLabel = scene.add
      .text(102, 150, 'ТЕМП  ×1', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '16px',
        color: '#f3d56a',
        stroke: '#2a0a08',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(54);
    this.hastePlate.on('pointerup', () => this.hasteCycle?.());

    this.controls = scene.add
      .text(GAME.width / 2, 708, this.controlsLine(false), {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#e8c48a',
      })
      .setOrigin(0.5)
      .setDepth(51)
      .setAlpha(0.8);

    ArtilleryStrike.ensureTextures(scene);
    const glyph = scene.add.image(0, 0, ArtilleryStrike.iconKey);
    this.artillerySweep = scene.add.graphics();
    this.artilleryTime = scene.add
      .text(0, 2, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f3d56a',
        stroke: '#2a0a08',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const badge = scene.add.circle(20, 20, 10, 0x8a1810).setStrokeStyle(2, 0xf0d56a);
    const key = scene.add
      .text(20, 20, '1', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '14px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    // Над баннером, у левого края поля.
    this.artillery = scene.add
      .container(56, GAME.bannerY - 48, [glyph, this.artillerySweep, this.artilleryTime, badge, key])
      .setDepth(53)
      .setVisible(false);

    scene.add.image(1128, 28, 'hp-frame').setDepth(51);
    scene.add.rectangle(1018, 28, 236, 10, 0x2a0a0a).setOrigin(0, 0.5).setDepth(51);
    this.hpFill = scene.add.rectangle(1018, 28, 236, 10, 0xd42a2a).setOrigin(0, 0.5).setDepth(52);

    this.overlay = scene.add.container(GAME.width / 2, GAME.height / 2).setDepth(80).setVisible(false);
    const dim = scene.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.55);
    const title = scene.add
      .text(0, -24, 'БАЗА РАЗБИТА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '48px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const hint = scene.add
      .text(0, 36, 'Кликните, чтобы начать снова', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);
    this.overlay.add([dim, title, hint]);
  }

  setScore(score: number): void {
    this.scoreText.setText(`SCORE  ${score}`);
  }

  setWave(wave: number): void {
    this.waveText.setText(`WAVE  ${wave}`);
  }

  setCoins(coins: number): void {
    this.coinsText.setText(`COINS  ${coins}`);
  }

  setTankStats(
    damage: number,
    blastRadius: number,
    fireDelayMs: number,
    autoFire = false,
  ): void {
    const fireSec = (fireDelayMs / 1000).toFixed(2);
    const mode = autoFire ? 'авто' : 'ЛКМ';
    this.tankStatsText.setText(
      `УРОН  ${damage}   ВЗРЫВ  ${blastRadius}   ОГОНЬ  ${fireSec} с   ${mode}`,
    );
  }

  onHasteCycle(cycle: () => void): void {
    this.hasteCycle = cycle;
  }

  setHaste(multiplier: number): void {
    this.hasteLabel.setText(`ТЕМП  ×${multiplier}`);
    this.hastePlate.setFillStyle(multiplier > 1 ? 0x8a1810 : 0x3a0c0c);
  }

  // Клик по плашке темпа не должен быть выстрелом танка.
  coversHaste(pointer: Phaser.Input.Pointer): boolean {
    return this.hastePlate.getBounds().contains(pointer.worldX, pointer.worldY);
  }

  setArtillery(owned: boolean, cooldownMs: number): void {
    if (this.artilleryOwned !== owned) {
      this.artilleryOwned = owned;
      this.artillery.setVisible(owned);
      this.controls.setText(this.controlsLine(owned));
    }
    if (!owned) {
      return;
    }

    const cooling = cooldownMs > 0;
    const label = cooling ? `${Math.ceil(cooldownMs / 1000)}` : '';
    if (this.artilleryTime.text !== label) {
      this.artilleryTime.setText(label);
    }

    this.artillerySweep.clear();
    if (!cooling) {
      return;
    }
    const ratio = Math.min(1, cooldownMs / ArtilleryStrike.shop.cooldownMs);
    const radius = ArtilleryStrike.iconRadius - 4;
    this.artillerySweep.fillStyle(0x000000, 0.62);
    if (ratio > 0.98) {
      this.artillerySweep.fillCircle(0, 0, radius);
      return;
    }
    this.artillerySweep.slice(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
    this.artillerySweep.fillPath();
  }

  setHp(hp: number): void {
    this.hpFill.width = 236 * (hp / Tank.baseHp);
  }

  showWaveBanner(wave: number): void {
    const scene = this.waveBanner.scene;
    this.waveBanner.setText(`ВОЛНА ${wave}`);
    this.waveBanner.setAlpha(1);
    this.waveBanner.setScale(0.86);
    scene.tweens.killTweensOf(this.waveBanner);
    scene.tweens.add({
      targets: this.waveBanner,
      scale: 1.08,
      duration: 280,
      ease: 'Back.Out',
    });
    scene.tweens.add({
      targets: this.waveBanner,
      alpha: 0,
      duration: 500,
      delay: 900,
    });
  }

  showDefeatOverlay(): void {
    this.overlay.setVisible(true);
  }

  get defeatOverlayVisible(): boolean {
    return this.overlay.visible;
  }

  private controlsLine(artillery: boolean): string {
    const tempo = 'мышь — прицел   ЛКМ — огонь   2 — темп';
    return artillery ? `${tempo}   1 — удар` : tempo;
  }
}
