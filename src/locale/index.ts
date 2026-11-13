// Список языков. Новый язык — файл рядом и одна строка в locales.
// Нет ключа в хранилище — русский. Чужое значение тоже читается как русский.

import { en } from './en';
import { ru, type Locale } from './ru';

export type { AbilityId, KeyLine, Locale } from './ru';
export { en } from './en';
export { ru } from './ru';

export const locales = { ru, en } satisfies Record<string, Locale>;

export type LangId = keyof typeof locales;

const STORAGE_KEY = 'tank-penetration-language:v1';

let current: LangId = readLanguage();
const listeners = new Set<() => void>();

export function language(): LangId {
  return current;
}

export function t(): Locale {
  return locales[current];
}

export function setLanguage(id: LangId): void {
  if (id === current || !(id in locales)) {
    return;
  }
  current = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Приватный режим: язык держится, пока открыта вкладка.
  }
  for (const listener of listeners) {
    listener();
  }
}

// Порядок — порядок ключей в locales. Кнопка в настройках идёт по этому кругу.
export function cycleLanguage(): void {
  const ids = Object.keys(locales) as LangId[];
  const index = ids.indexOf(current);
  const next = ids[(index + 1) % ids.length];
  if (next) {
    setLanguage(next);
  }
}

export function onLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readLanguage(): LangId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null && raw in locales) {
      return raw as LangId;
    }
  } catch {
    // Нет хранилища — русский.
  }
  return 'ru';
}
