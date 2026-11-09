// Базовое здоровье танка в дебаг-партии.
// Танк это число не читает: его берёт дебаг-игрок.
// Поле в настройках пишет число и зовёт слушателя только с кнопки «Готово».
// Потолок поля выше потолка покупки: магазин это поле не зажимает.
// Свой ключ, не ключ партии: «новая игра» стирает бой, а запас остаётся.

import { TankBaseHp } from './TankBaseHp';

export class TankDebugBaseHp extends TankBaseHp {
  protected static override storageKey = 'tank-penetration-tank-hp:debug';
  protected static override shopMax = 10_000;
  protected static override defaultHp = 500;

  protected static override store = this.openTankHpStore(this.storageKey, this.defaultHp, this.shopMax);
}
