// Счёт, полоска HP и баннер волны. Плашка поражения — магазин между проигрышами.

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
  private readonly hastePlate: Phaser.GameObjects.Rectangle;
  private readonly hasteIcon: Phaser.GameObjects.Graphics;
  private readonly pausePlate: Phaser.GameObjects.Rectangle;
  private readonly pauseOverlay: Phaser.GameObjects.Container;
  private artilleryOwned = false;
  private hasteCycle?: () => void;
  private pauseRequest?: () => void;
  private resumeRequest?: () => void;
  private newGameRequest?: () => void;

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

    const statusY = 28;
    const statusStyle = {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '18px',
      stroke: '#2a0a08',
      strokeThickness: 4,
    };
    this.scoreText = scene.add
      .text(28, statusY, 'SCORE  0', { ...statusStyle, color: '#f3d56a' })
      .setOrigin(0, 0.5)
      .setDepth(51);
    this.waveText = scene.add
      .text(0, statusY, 'WAVE  0', { ...statusStyle, color: '#e8c48a' })
      .setOrigin(0, 0.5)
      .setDepth(51);
    this.coinsText = scene.add
      .text(0, statusY, 'COINS  0', { ...statusStyle, color: '#f3d56a' })
      .setOrigin(0, 0.5)
      .setDepth(51);
    this.layoutStatus();

    this.tankStatsText = scene.add
      .text(28, 56, '', {
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

    // Рамка HP: центр 1128, ширина 280. Иконки стоят сразу слева от неё.
    const icon = 40;
    const hpLeft = 1128 - 140;
    const hasteX = hpLeft - 8 - icon / 2;
    const pauseX = hasteX - 6 - icon;
    const iconY = 28;

    this.hastePlate = scene.add
      .rectangle(hasteX, iconY, icon, icon, 0x3a0c0c)
      .setStrokeStyle(2, 0xc9a227)
      .setDepth(53)
      .setInteractive({ useHandCursor: true });
    this.hasteIcon = scene.add.graphics().setPosition(hasteX, iconY).setDepth(54);
    this.drawSpeedometer(1);
    this.hastePlate.on('pointerup', () => this.hasteCycle?.());

    this.pausePlate = scene.add
      .rectangle(pauseX, iconY, icon, icon, 0x3a0c0c)
      .setStrokeStyle(2, 0xc9a227)
      .setDepth(53)
      .setInteractive({ useHandCursor: true });
    // Обычные прямоугольники, не Graphics: скруглённая заливка узкой полоски
    // сдвигает её низ в сторону.
    scene.add.rectangle(pauseX - 4, iconY, 4, 16, 0xf0d56a).setDepth(54);
    scene.add.rectangle(pauseX + 4, iconY, 4, 16, 0xf0d56a).setDepth(54);
    this.pausePlate.on('pointerup', () => this.pauseRequest?.());

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

    this.pauseOverlay = scene.add.container(GAME.width / 2, GAME.height / 2).setDepth(90).setVisible(false);
    const pauseDim = scene.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.45).setInteractive();
    pauseDim.on('pointerup', () => this.resumeRequest?.());
    const pauseTitle = scene.add
      .text(0, -70, 'ПАУЗА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '48px',
        color: '#f3d56a',
        stroke: '#4a1208',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const pauseHint = scene.add
      .text(0, -8, 'Кликните или Esc, чтобы продолжить', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#f0dcc0',
      })
      .setOrigin(0.5);
    const fresh = scene.add.container(0, 78);
    const freshBg = scene.add.rectangle(0, 0, 300, 52, 0x8a1810).setStrokeStyle(2, 0xf0d56a);
    const freshLabel = scene.add
      .text(0, 0, 'НОВАЯ ИГРА', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#f3d56a',
      })
      .setOrigin(0.5);
    fresh.add([freshBg, freshLabel]);
    fresh.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-150, -26, 300, 52),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    fresh.on('pointerup', () => this.newGameRequest?.());
    this.pauseOverlay.add([pauseDim, pauseTitle, pauseHint, fresh]);
  }

  setScore(score: number): void {
    this.scoreText.setText(`SCORE  ${score}`);
    this.layoutStatus();
  }

  setWave(wave: number): void {
    this.waveText.setText(`WAVE  ${wave}`);
    this.layoutStatus();
  }

  setCoins(coins: number): void {
    this.coinsText.setText(`COINS  ${coins}`);
    this.layoutStatus();
  }

  private layoutStatus(): void {
    const gap = 32;
    this.waveText.setX(this.scoreText.x + this.scoreText.width + gap);
    this.coinsText.setX(this.waveText.x + this.waveText.width + gap);
  }

  setTankStats(
    damage: number,
    blastRadius: number,
    fireDelayMs: number,
    autoFire = false,
    coinBonus = 0,
  ): void {
    const fireSec = (fireDelayMs / 1000).toFixed(2);
    const mode = autoFire ? 'авто' : 'ЛКМ';
    const coins = coinBonus > 0 ? `   МОНЕТЫ +${coinBonus}` : '';
    this.tankStatsText.setText(
      `УРОН  ${damage}   ВЗРЫВ  ${blastRadius}   ОГОНЬ  ${fireSec} с${coins}   ${mode}`,
    );
  }

  onHasteCycle(cycle: () => void): void {
    this.hasteCycle = cycle;
  }

  onPause(request: () => void): void {
    this.pauseRequest = request;
  }

  onResume(request: () => void): void {
    this.resumeRequest = request;
  }

  onNewGame(request: () => void): void {
    this.newGameRequest = request;
  }

  setPaused(paused: boolean): void {
    this.pauseOverlay.setVisible(paused);
  }

  setHaste(multiplier: number): void {
    this.hastePlate.setFillStyle(multiplier > 1 ? 0x8a1810 : 0x3a0c0c);
    this.drawSpeedometer(multiplier);
  }

  // Три дуги разного цвета. Короткая светлая стрелка не сливается со средней в букву Т.
  private drawSpeedometer(level: number): void {
    const g = this.hasteIcon;
    g.clear();
    const cy = 5;
    const radius = 12;
    const gap = 0.22;
    const span = Math.PI;
    const seg = (span - gap * 2) / 3;
    const start = Math.PI;
    const step = Phaser.Math.Clamp(Math.round(level), 1, 3);
    const colors = [0x6ecf4a, 0xf0c14a, 0xe24a3a];
    const dim = [0x2c4a1c, 0x5a4320, 0x5a221c];

    g.lineStyle(1.5, 0x4a3018, 1);
    g.beginPath();
    g.arc(0, cy, radius + 3, start, start + span, false);
    g.strokePath();

    for (let i = 0; i < 3; i += 1) {
      const a0 = start + i * (seg + gap);
      const a1 = a0 + seg;
      g.lineStyle(4, i < step ? colors[i] : dim[i], 1);
      g.beginPath();
      g.arc(0, cy, radius, a0, a1, false);
      g.strokePath();
    }

    const mid = start + (step - 1) * (seg + gap) + seg / 2;
    const tip = 8;
    const ux = Math.cos(mid);
    const uy = Math.sin(mid);
    g.lineStyle(2, 0xfff8ee, 1);
    g.beginPath();
    g.moveTo(ux * 1.5, cy + uy * 1.5);
    g.lineTo(ux * tip, cy + uy * tip);
    g.strokePath();
  }

  // Клик по плашке темпа не должен быть выстрелом танка.
  coversHaste(pointer: Phaser.Input.Pointer): boolean {
    return this.hastePlate.getBounds().contains(pointer.worldX, pointer.worldY);
  }

  // Клик по кнопке паузы не должен быть выстрелом танка.
  coversPause(pointer: Phaser.Input.Pointer): boolean {
    return this.pausePlate.getBounds().contains(pointer.worldX, pointer.worldY);
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

  showWaveBanner(wave: number, boss = false): void {
    const scene = this.waveBanner.scene;
    this.waveBanner.setText(boss ? 'БОСС' : `ВОЛНА ${wave}`);
    this.waveBanner.setColor(boss ? '#ff5a48' : '#f3d56a');
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

  private controlsLine(artillery: boolean): string {
    const tempo = 'мышь — прицел   ЛКМ — огонь   2 — темп   Esc — пауза';
    return artillery ? `${tempo}   1 — удар` : tempo;
  }
}
