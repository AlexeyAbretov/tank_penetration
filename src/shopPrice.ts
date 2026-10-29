// Число на карточке и сумма, которую списывает покупка. Оба магазина зовут её, а не свою формулу.
// npm run build:html:gift собирает ту же страницу с --mode gift: здесь любая цена становится 1.
// dev, build и обычный build:html этот режим не включают. Vite подставляет MODE при сборке.
export function shopPrice(amount: number): number {
  return import.meta.env.MODE === 'gift' ? 1 : amount;
}
