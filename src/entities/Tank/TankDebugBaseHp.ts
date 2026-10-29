// Базовое здоровье танка в дебаг-партии.
// Танк это число не читает: его берёт дебаг-игрок.
// Поле в настройках пишет число и зовёт слушателя только с кнопки «Готово».
// Свой ключ, не ключ партии: «новая игра» стирает бой, а запас остаётся.

import { TankBaseHp } from './TankBaseHp';

const STORAGE_KEY = 'tank-penetration-tank-hp:debug';
const DEFAULT_HP = 500;

export class TankDebugBaseHp extends TankBaseHp {
  protected static override store = TankBaseHp.openStore(STORAGE_KEY, DEFAULT_HP);
}
