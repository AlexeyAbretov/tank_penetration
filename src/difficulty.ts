// Сложность партии. Новая строка списка — новая сложность.
// Пока список меняет только цену улучшений и здоровье с уроном боссов и врагов.
// «Новая игра» записывает выбор. Нет записи — старая партия идёт как стандарт.

import { isDebugRun } from './gameConfig';

export const DIFFICULTIES = [
  // null в цене — любая покупка стоит 1, как в подарочной сборке.
  { id: 'easy', price: null, enemy: 1 },
  { id: 'normal', price: 1, enemy: 1 },
  { id: 'hard', price: 2, enemy: 2 },
] as const;

export type DifficultyId = (typeof DIFFICULTIES)[number]['id'];

export type Difficulty = (typeof DIFFICULTIES)[number];

const CAMPAIGN_KEY = 'tank-penetration-difficulty:v1';
const DEBUG_KEY = 'tank-penetration-difficulty:debug';

const byId = new Map<DifficultyId, Difficulty>(DIFFICULTIES.map((row) => [row.id, row]));

let picked: DifficultyId | null = readStored();

export function difficultyChosen(): boolean {
  return picked !== null;
}

export function setDifficulty(id: DifficultyId): void {
  picked = id;
  try {
    localStorage.setItem(storageKey(), id);
  } catch {
    // Приватный режим: выбор держится, пока открыта вкладка.
  }
}

// Множитель цены. null в строке сложности уже превращён в 1.
export function difficultyPrice(amount: number): number {
  const price = current().price;
  if (price === null) {
    return 1;
  }
  if (price === 1) {
    return amount;
  }
  return Math.max(1, Math.round(amount * price));
}

// Множитель здоровья и урона. Ноль остаётся нулём: касание стрелка базу не бьёт.
export function difficultyEnemy(amount: number): number {
  const scale = current().enemy;
  if (scale === 1 || amount <= 0) {
    return amount;
  }
  return Math.max(1, Math.round(amount * scale));
}

function current(): Difficulty {
  return byId.get(picked ?? 'normal') ?? DIFFICULTIES[1];
}

function storageKey(): string {
  return isDebugRun() ? DEBUG_KEY : CAMPAIGN_KEY;
}

function readStored(): DifficultyId | null {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw !== null && byId.has(raw as DifficultyId)) {
      return raw as DifficultyId;
    }
  } catch {
    // Нет хранилища — стандарт, пока игрок не выберет.
  }
  return null;
}
