// Число на карточке и сумма, которую списывает покупка. Оба магазина зовут её, а не свою формулу.
// npm run build:html:gift собирает ту же страницу с --mode gift: здесь любая цена становится 1
// и выбранная сложность цену не поднимает.
// dev, build, обычный build:html и build:html:debug этот режим не включают. Vite подставляет MODE при сборке.
// Вне подарочной сборки цену множит строка сложности.

import { difficultyPrice } from './difficulty';

export function shopPrice(amount: number): number {
  if (import.meta.env.MODE === 'gift') {
    return 1;
  }
  return difficultyPrice(amount);
}
