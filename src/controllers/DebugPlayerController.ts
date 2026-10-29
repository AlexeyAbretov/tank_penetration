// Дебаг-игрок. Запас берёт из настройки, танк это число не читает.
// «Готово» в настройках меняет и полоску, и текущее здоровье.

import { TankDebugBaseHp } from '../entities/Tank/TankDebugBaseHp';
import { PlayerController } from './PlayerController';

export class DebugPlayerController extends PlayerController {
  static override baseHp(): number {
    return TankDebugBaseHp.currentOf();
  }

  // Настройки пишут своё число. Обычный запас дебаг-танк не слушает.
  protected override watchBaseHp(): () => void {
    return TankDebugBaseHp.watch((hp) => this.setBaseHp(hp));
  }
}
