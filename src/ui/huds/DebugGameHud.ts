import Phaser from 'phaser';

import { GameHud } from './GameHud';
import { HudFrame } from './GameHud.types';

import { EnemyDamageDebugAbilityIcon, EnemyDamageDebugAbility } from '../../abilities';

export class DebugGameHud extends GameHud {
  // Картинка урона врагов. Общий список её не грузит: обычная партия этот класс не импортирует.
  static override preload(scene: Phaser.Scene): void {
    super.preload(scene);

    EnemyDamageDebugAbilityIcon.preload(scene);
  }

  private readonly debugLabel: Phaser.GameObjects.Text;
  private readonly enemyDamageRoot: Phaser.GameObjects.Container;
  private readonly enemyDamageGlow: Phaser.GameObjects.Image;

  // Дебаг-клавиши только в окне списка. Верхняя плашка остаётся статусом партии.
  protected override controlHints(): readonly string[] {
    return [
      ...super.controlHints(),
      'пробел — пауза без экрана',
      'двойное нажатие — сброс',
      'A — ещё юнит',
      'N — пропуск волны',
      'F — проигрыш',
      'иконка слева — урон врагов',
    ];
  }

  constructor(scene: Phaser.Scene, frame: HudFrame, maxHp: number) {
    super(scene, frame, maxHp);

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

    GameHud.nearest(scene, EnemyDamageDebugAbilityIcon.iconKey);
    const icon = this.bindRoundIcon(EnemyDamageDebugAbilityIcon.iconKey, this.rightSkillRoots().length, 53);
    
    this.enemyDamageRoot = icon.root;
    this.enemyDamageGlow = icon.glow;
    this.showRoundToggle(icon.root, icon.glow, true, EnemyDamageDebugAbility.isEnabled);

    icon.root.on('pointerup', () => {
      this.showRoundToggle(this.enemyDamageRoot, this.enemyDamageGlow, true, EnemyDamageDebugAbility.toggle());
    });
  }

  override layout(): void {
    super.layout();

    this.enemyDamageRoot.setPosition(this.edgeIconX(this.rightSkillRoots().length), this.skillY());
    this.debugLabel.setX(this.frame.width / 2);
  }

  override coversEnemyDamage(pointer: Phaser.Input.Pointer): boolean {
    return (
      this.enemyDamageRoot.visible &&
      this.enemyDamageRoot.getBounds().contains(pointer.worldX, pointer.worldY)
    );
  }
}
