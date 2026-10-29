import Phaser from 'phaser';
import { EnemyDamage } from '../../debug/EnemyDamage';
import { GameHud, type HudAbility, type HudFrame } from './GameHud';

export class DebugGameHud extends GameHud {
  private readonly debugLabel: Phaser.GameObjects.Text;
  private readonly enemyDamagePlate: Phaser.GameObjects.Rectangle;
  private readonly enemyDamageIcon: Phaser.GameObjects.Graphics;

  // Дебаг-клавиши только в окне списка. Верхняя плашка остаётся статусом партии.
  protected override controlHints(): readonly string[] {
    return [
      ...super.controlHints(),
      'пробел — пауза без экрана',
      'двойное нажатие — сброс',
      'A — ещё юнит',
      'N — пропуск волны',
      'пуля — урон врагов',
    ];
  }

  constructor(scene: Phaser.Scene, frame: HudFrame, maxHp: number, abilities: readonly HudAbility[]) {
    super(scene, frame, maxHp, abilities);

    this.debugLabel = scene.add
      .text(frame.width / 2, this.statusY, 'DEBUG', {
        ...this.statusStyle,
        color: '#ff5a48',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(51);

    // То же имя шлёт DebugQuietPause. Константа ради одной подписи не нужна.
    // Эмиттер сцены переживает перезапуск. Старая подпись после «новой игры»
    // пишет в уничтоженный текст: updateText падает, и requestAnimationFrame
    // больше не ставит следующий кадр — пробел паузу уже не снимает.
    const onQuietPause = (on: boolean): void => {
      if (!this.debugLabel.scene) {
        return;
      }
      this.debugLabel.setText(on ? 'DEBUG  ПАУЗА' : 'DEBUG');
    };
    scene.events.on('quiet-pause', onQuietPause);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off('quiet-pause', onQuietPause);
    });

    // Сразу левее автострельбы. Та же глубина: между волнами плашка остаётся над магазином.
    const x = this.plateLeftOf(this.autoFireX);
    this.enemyDamagePlate = scene.add
      .rectangle(x, this.plateY, this.plateSize, this.plateSize, 0x3a0c0c)
      .setStrokeStyle(2, 0xc9a227)
      .setDepth(80)
      .setInteractive({ useHandCursor: true });
    this.enemyDamageIcon = scene.add.graphics().setPosition(x, this.plateY).setDepth(81);
    this.paintEnemyDamage(EnemyDamage.isEnabled);
    this.enemyDamagePlate.on('pointerup', () => {
      this.paintEnemyDamage(EnemyDamage.toggle());
    });
  }

  override layout(): void {
    super.layout();
    const x = this.plateLeftOf(this.autoFireX);
    this.enemyDamagePlate.setPosition(x, this.plateY);
    this.enemyDamageIcon.setPosition(x, this.plateY);
    this.debugLabel.setX(this.frame.width / 2);
  }

  override coversEnemyDamage(pointer: Phaser.Input.Pointer): boolean {
    return this.enemyDamagePlate.getBounds().contains(pointer.worldX, pointer.worldY);
  }

  private paintEnemyDamage(on: boolean): void {
    this.enemyDamagePlate.setFillStyle(on ? 0x8a1810 : 0x3a0c0c);
    this.drawEnemyDamage(on);
  }

  // Толстый борт справа и короткая пуля слева. Тонкая стрелка читалась как «дальше».
  // Тусклые, пока урон выключен.
  private drawEnemyDamage(on: boolean): void {
    const g = this.enemyDamageIcon;
    g.clear();
    const color = on ? 0xf0d56a : 0x6e5840;
    g.fillStyle(color, 1);
    g.fillRect(6, -11, 5, 22);
    g.fillRect(-12, -1, 8, 2);
    g.fillTriangle(-4, -3, -4, 3, 3, 0);
    g.fillRect(3, -7, 2, 4);
    g.fillRect(3, 3, 2, 4);
  }
}
