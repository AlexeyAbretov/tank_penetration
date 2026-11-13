// Русские тексты. Форма этого объекта — образец: другой язык обязан повторить ключи.
// Строка списка клавиш — пара «кнопка / действие», чтобы колонки не зависели от тире.

export const ru = {
  name: 'Русский',

  boot: {
    label: 'Загрузка',
    progress: (pct: number): string => `Загрузка ${pct}%`,
  },

  settings: {
    title: 'НАСТРОЙКИ',
    music: 'Громкость музыки',
    effects: 'Громкость эффектов',
    focus: 'Пауза при потере фокуса',
    language: 'Язык',
    on: 'ВКЛ',
    off: 'ВЫКЛ',
    done: 'ГОТОВО',
  },

  hud: {
    wave: (wave: number): string => `WAVE  ${wave}`,
    pause: 'ПАУЗА',
    resume: 'Esc, чтобы продолжить',
    newGame: 'НОВАЯ ИГРА',
    keys: 'КЛАВИШИ',
    bannerWave: (wave: number): string => `ВОЛНА ${wave}`,
    boss: 'БОСС',
    bossNamed: (title: string): string => `БОСС\n${title}`,
    stats: (row: {
      damage: number;
      blast: number;
      pierce: number;
      fire: string;
      flight: string;
      coins: number;
      points: number;
      auto: boolean;
    }): string => {
      const mode = row.auto ? 'авто' : 'ЛКМ';
      const coins = row.coins > 0 ? `   МОНЕТЫ +${row.coins}` : '';
      const points = row.points > 0 ? `   ОЧКИ +${row.points}` : '';
      return `УРОН  ${row.damage}   ВЗРЫВ  ${row.blast}   ПРОБИВ  ${row.pierce}%   ОГОНЬ  ${row.fire} с   ПОЛЁТ  ${row.flight} с${coins}${points}   ${mode}`;
    },
  },

  keys: {
    aim: { key: 'мышь', action: 'прицел' },
    fire: { key: 'ЛКМ', action: 'огонь' },
    haste: { key: '+', action: 'темп' },
    pause: { key: 'Esc', action: 'пауза' },
    sound: { key: 'шестерёнка', action: 'звук' },
    autoShop: { key: 'иконка справа', action: 'автопокупка' },
    autoFire: { key: 'иконка справа', action: 'автострельба' },
    autoAimBeside: { key: 'слева от автопокупки', action: 'автонаведение' },
    autoAimEdge: { key: 'иконка у края', action: 'автонаведение' },
    artillerySwitch: { key: 'выключатель удара', action: 'автоприменение' },
    minesSwitch: { key: 'выключатель мин', action: 'автоприменение' },
    ionSwitch: { key: 'выключатель луча', action: 'автоприменение' },
    wallSwitch: { key: 'выключатель стены', action: 'автоприменение' },
    bomberSwitch: { key: 'выключатель бомб', action: 'автоприменение' },
    ability: {
      artillery: { key: '1', action: 'удар' },
      mines: { key: '2', action: 'мины' },
      nuclear: { key: '3', action: 'атом' },
      ion: { key: '4', action: 'луч' },
      wall: { key: '5', action: 'стена' },
      bomber: { key: '6', action: 'бомбы' },
      emp: { key: '7', action: 'ЭМИ' },
    },
  },

  shop: {
    title: 'МАГАЗИН',
    nextWave: 'СЛЕДУЮЩАЯ ВОЛНА',
  },

  defeat: {
    title: 'БАЗА РАЗБИТА',
    newGame: 'НОВАЯ ИГРА',
    fight: 'В БОЙ',
  },

  tabs: {
    tank: 'Танк',
    gun: 'Пулемёт',
    wire: 'Колючая проволока',
    flame: 'Огнемёт',
    laser: 'Лазерная установка',
    salvo: 'РСЗО',
    artillery: 'Артиллерия',
    ion: 'Ионная пушка',
    mines: 'Мина',
    nuclear: 'Атомный взрыв',
    wall: 'Энергетическая стена',
    bomber: 'Бомбардировщик',
    emp: 'ЭМИ',
    resources: 'Ресурсы',
  },

  card: {
    damage: '+1 урон',
    blastArea: '+1 область взрыва',
    blast: '+1 взрыв',
    reload002: '−0.02 с перезарядки',
    reload001: '−0.01 с перезарядки',
    reload1: '−1 с перезарядки',
    reload01: '−0.10 с перезарядки',
    reloadMin: '−0,1 мин перезарядки',
    flight01: '−0.10 с полёта',
    knock3: '+3 отталкивание',
    knock1: '+1 отталкивание',
    pierce1: '+1% пробивание',
    absorb: '+1% поглощение урона',
    hp: '+10 здоровья',
    bullet: '+1 пуля',
    bulletDamage: '+1 урон пули',
    beam: '+1 луч',
    rocket: '+1 ракета',
    shell: '+1 снаряд',
    mine: '+1 мина',
    sweep01: '−0.10 с хода',
    sweep02: '−0.20 с хода',
    stun: '+0.10 с оглушения',
    duration: '+0.10 с длительности',
    width: '+10% ширины',
    coin: '+1 монета',
    point: '+1 очко',
    buy: 'Покупка',
    install: 'Установка',
    afterInstall: 'после установки',
    afterBuy: 'после покупки',
    max: 'максимум',
    maxShort: 'макс.',
  },

  auto: {
    fire: 'автострельба',
    fireInfo: 'танк стреляет сам',
    aim: 'автонаведение',
    aimHeld: 'держит одну цель',
    aimOffer: 'башня сама держит врага',
    shop: 'автопокупка',
    shopHeld: 'через 1 с на следующую волну',
    shopOffer: 'магазин волны тратит монеты',
    use: 'автоприменение',
    strike: 'удар сам через 1 с',
    beam: 'луч сам через 1 с',
    flyover: 'пролёт сам через 1 с',
    wall: 'гасит входящий выстрел',
    mines: 'мины сами через 1 с',
  },

  phrase: {
    ahead: 'перед танком',
    holds: 'держит пехоту',
    alongAim: 'вдоль прицела',
    downsRpg: 'сбивает РПГ',
    stream: 'струя / 10 с',
    quarter: 'четверть поля',
    salvoField: 'залп по полю',
    queue: (sec: string): string => `очередь / ${sec} с`,
    rocketEvery: (cooldown: string): string => `ракета / ${cooldown}`,
    salvoEvery: (label: string, sec: number): string => `${label} / ${sec} с`,
    flameBoth: (level: number, now: number): string => `ур. ${level} · струя и пятно ${now}→${now + 1}`,
    reload: (cooldown: string): string => `откат ${cooldown}`,
    volley: (count: number, damage: number, cooldown: string): string => `${count}×${damage} · откат ${cooldown}`,
    stun: (stun: string): string => `оглушение ${stun}`,
    stunReload: (stun: string, cooldown: string): string => `оглушение ${stun} · откат ${cooldown}`,
    damageReload: (damage: number, cooldown: string): string => `${damage} · откат ${cooldown}`,
    screen: (cooldown: string): string => `весь экран · ${cooldown}`,
    allDamage: (hold: string, cooldown: string): string => `весь урон · ${hold} · ${cooldown}`,
  },

  line: {
    now: (level: number, value: string | number): string => `ур. ${level} · ${value}`,
    step: (level: number, now: string | number, next: string | number): string => `ур. ${level} · ${now}→${next}`,
    plus: (level: number): string => `ур. ${level} · +${level}→+${level + 1}`,
    pct: (level: number, value: number): string => `ур. ${level} · ${value}%`,
    pctStep: (level: number, now: number, next: number): string => `ур. ${level} · ${now}%→${next}%`,
    times: (level: number, value: string): string => `ур. ${level} · ×${value}`,
    timesStep: (level: number, now: string, next: string): string => `ур. ${level} · ×${now}→×${next}`,
  },

  time: {
    seconds: (value: string): string => `${value} с`,
  },

  // 3 и 4 — «ракеты», с пяти — «ракет». Единица тоже «ракет»: так карточка писала и раньше.
  rockets: (count: number): string => {
    const word = count % 10 >= 2 && count % 10 <= 4 ? 'ракеты' : 'ракет';
    return `${count} ${word}`;
  },

  boss: {
    super: 'СУПЕРСОЛДАТ',
    heavy: 'ТЯЖЁЛЫЙ ТАНК',
    carrier: 'ДРОНОМАТКА',
    btr: 'БТР',
    all: 'ВСЕ БОССЫ',
    join: (names: readonly string[]): string => {
      if (names.length === 0) {
        return '';
      }
      const last = names[names.length - 1] ?? '';
      if (names.length === 1) {
        return last;
      }
      return `${names.slice(0, -1).join(', ')} И ${last}`;
    },
  },

  debug: {
    mark: 'DEBUG',
    quiet: 'DEBUG  ПАУЗА',
    waveCount: 'Обычных в волне',
    tankHp: 'Здоровье танка',
    hitbox: 'Хитбокс',
    ruler: 'Линейка',
    pierce: 'Пробитие',
    pierces: 'пробивает',
    misses: 'не пробивает',
    space: { key: 'пробел', action: 'пауза без экрана' },
    doubleTap: { key: 'двойное нажатие', action: 'сброс' },
    addUnit: { key: 'A', action: 'ещё юнит' },
    restart: { key: 'R', action: 'перезапуск волны' },
    skip: { key: 'N', action: 'пропуск волны' },
    lose: { key: 'F', action: 'проигрыш' },
    enemyDamage: { key: 'иконка слева', action: 'урон врагов' },
  },
};

type Widen<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => Widen<R>
  : T extends string
    ? string
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

export type Locale = Widen<typeof ru>;

export type KeyLine = Locale['keys']['aim'];
export type AbilityId = keyof Locale['keys']['ability'];
