// Что сцена сообщает бою. Тип отдельно, чтобы его можно было прочитать, не импортируя класс боя.

export type CombatCallbacks = {
  onKill: (coinReward: number) => void;
  onBaseHit: (amount: number) => void;
};
