// Дебаг-игрок. Запас берёт из настройки, танк это число не читает.
// «Готово» в настройках меняет и полоску, и текущее здоровье.
import { PlayerController } from './PlayerController';

import { EnemyDamageDebugAbility } from '../abilities';
import { TankDebugBaseHp } from '../entities';

export class DebugPlayerController extends PlayerController {
  static override baseHp(): number {
    return TankDebugBaseHp.currentOf();
  }

  // Настройки пишут своё число. Обычный запас дебаг-танк не слушает.
  protected override watchBaseHp(): () => void {
    return TankDebugBaseHp.watch((hp) => this.setBaseHp(hp));
  }

  // Выключенный урон врагов не трогает полоску. Искры и взрывы остаются: их считает снаряд.
  override damage(amount: number): void {
    if (!EnemyDamageDebugAbility.isEnabled) {
      return;
    }

    super.damage(amount);
  }
}
