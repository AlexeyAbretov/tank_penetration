// Английские тексты. Ключи те же, что в ru.ts: новый язык копирует эту форму.

import type { Locale } from './ru';

export const en: Locale = {
  name: 'English',

  boot: {
    label: 'Loading',
    progress: (pct) => `Loading ${pct}%`,
  },

  settings: {
    title: 'SETTINGS',
    music: 'Music volume',
    effects: 'Effects volume',
    focus: 'Pause on lost focus',
    language: 'Language',
    on: 'ON',
    off: 'OFF',
    done: 'DONE',
  },

  hud: {
    wave: (wave) => `WAVE  ${wave}`,
    pause: 'PAUSE',
    resume: 'Esc to continue',
    newGame: 'NEW GAME',
    keys: 'KEYS',
    bannerWave: (wave) => `WAVE ${wave}`,
    boss: 'BOSS',
    bossNamed: (title) => `BOSS\n${title}`,
    stats: (row) => {
      const mode = row.auto ? 'AUTO' : 'LMB';
      const coins = row.coins > 0 ? `   COINS +${row.coins}` : '';
      const points = row.points > 0 ? `   SCORE +${row.points}` : '';
      return `DMG  ${row.damage}   BLAST  ${row.blast}   PIERCE  ${row.pierce}%   FIRE  ${row.fire} s   FLIGHT  ${row.flight} s${coins}${points}   ${mode}`;
    },
  },

  keys: {
    aim: { key: 'mouse', action: 'aim' },
    fire: { key: 'LMB', action: 'fire' },
    haste: { key: '+', action: 'haste' },
    pause: { key: 'Esc', action: 'pause' },
    sound: { key: 'gear', action: 'sound' },
    autoShop: { key: 'right icon', action: 'autobuy' },
    autoFire: { key: 'right icon', action: 'autofire' },
    autoAimBeside: { key: 'left of autobuy', action: 'auto-aim' },
    autoAimEdge: { key: 'edge icon', action: 'auto-aim' },
    artillerySwitch: { key: 'strike switch', action: 'auto-use' },
    minesSwitch: { key: 'mine switch', action: 'auto-use' },
    ionSwitch: { key: 'beam switch', action: 'auto-use' },
    wallSwitch: { key: 'wall switch', action: 'auto-use' },
    bomberSwitch: { key: 'bomb switch', action: 'auto-use' },
    ability: {
      artillery: { key: '1', action: 'strike' },
      mines: { key: '2', action: 'mines' },
      nuclear: { key: '3', action: 'nuke' },
      ion: { key: '4', action: 'beam' },
      wall: { key: '5', action: 'wall' },
      bomber: { key: '6', action: 'bombs' },
      emp: { key: '7', action: 'EMP' },
    },
  },

  shop: {
    title: 'SHOP',
    nextWave: 'NEXT WAVE',
  },

  defeat: {
    title: 'BASE DESTROYED',
    newGame: 'NEW GAME',
    fight: 'TO BATTLE',
  },

  tabs: {
    tank: 'Tank',
    gun: 'Machine gun',
    wire: 'Barbed wire',
    flame: 'Flamethrower',
    laser: 'Laser',
    salvo: 'MLRS',
    artillery: 'Artillery',
    ion: 'Ion cannon',
    mines: 'Mine',
    nuclear: 'Nuclear blast',
    wall: 'Energy wall',
    bomber: 'Bomber',
    emp: 'EMP',
    resources: 'Resources',
  },

  card: {
    damage: '+1 damage',
    blastArea: '+1 blast area',
    blast: '+1 blast',
    reload002: '−0.02 s reload',
    reload001: '−0.01 s reload',
    reload1: '−1 s reload',
    reload01: '−0.10 s reload',
    reloadMin: '−0.1 min reload',
    flight01: '−0.10 s flight',
    knock3: '+3 knockback',
    knock1: '+1 knockback',
    pierce1: '+1% pierce',
    absorb: '+1% absorb',
    hp: '+10 health',
    bullet: '+1 bullet',
    bulletDamage: '+1 bullet damage',
    beam: '+1 beam',
    rocket: '+1 rocket',
    shell: '+1 shell',
    mine: '+1 mine',
    sweep01: '−0.10 s sweep',
    sweep02: '−0.20 s sweep',
    stun: '+0.10 s stun',
    duration: '+0.10 s duration',
    width: '+10% width',
    coin: '+1 coin',
    point: '+1 point',
    buy: 'Buy',
    install: 'Install',
    afterInstall: 'after install',
    afterBuy: 'after purchase',
    max: 'maximum',
    maxShort: 'max',
  },

  auto: {
    fire: 'autofire',
    fireInfo: 'the tank fires on its own',
    aim: 'auto-aim',
    aimHeld: 'holds one target',
    aimOffer: 'the turret holds an enemy',
    shop: 'autobuy',
    shopHeld: 'next wave after 1 s',
    shopOffer: 'the wave shop spends coins',
    use: 'auto-use',
    strike: 'strike after 1 s',
    beam: 'beam after 1 s',
    flyover: 'flyover after 1 s',
    wall: 'blocks an incoming shot',
    mines: 'mines after 1 s',
  },

  phrase: {
    ahead: 'in front of the tank',
    holds: 'holds infantry',
    alongAim: 'along the aim',
    downsRpg: 'downs RPGs',
    stream: 'stream / 10 s',
    quarter: 'quarter of the field',
    salvoField: 'salvo across the field',
    queue: (sec) => `burst / ${sec} s`,
    rocketEvery: (cooldown) => `rocket / ${cooldown}`,
    salvoEvery: (label, sec) => `${label} / ${sec} s`,
    flameBoth: (level, now) => `lv. ${level} · stream and pool ${now}→${now + 1}`,
    reload: (cooldown) => `reload ${cooldown}`,
    volley: (count, damage, cooldown) => `${count}×${damage} · reload ${cooldown}`,
    stun: (stun) => `stun ${stun}`,
    stunReload: (stun, cooldown) => `stun ${stun} · reload ${cooldown}`,
    damageReload: (damage, cooldown) => `${damage} · reload ${cooldown}`,
    screen: (cooldown) => `full screen · ${cooldown}`,
    allDamage: (hold, cooldown) => `all damage · ${hold} · ${cooldown}`,
  },

  line: {
    now: (level, value) => `lv. ${level} · ${value}`,
    step: (level, now, next) => `lv. ${level} · ${now}→${next}`,
    plus: (level) => `lv. ${level} · +${level}→+${level + 1}`,
    pct: (level, value) => `lv. ${level} · ${value}%`,
    pctStep: (level, now, next) => `lv. ${level} · ${now}%→${next}%`,
    times: (level, value) => `lv. ${level} · ×${value}`,
    timesStep: (level, now, next) => `lv. ${level} · ×${now}→×${next}`,
  },

  time: {
    seconds: (value) => `${value} s`,
  },

  rockets: (count) => (count === 1 ? `${count} rocket` : `${count} rockets`),

  boss: {
    super: 'SUPERSOLDIER',
    heavy: 'HEAVY TANK',
    carrier: 'DRONE CARRIER',
    btr: 'APC',
    all: 'ALL BOSSES',
    join: (names) => {
      if (names.length === 0) {
        return '';
      }
      const last = names[names.length - 1] ?? '';
      if (names.length === 1) {
        return last;
      }
      return `${names.slice(0, -1).join(', ')} AND ${last}`;
    },
  },

  debug: {
    mark: 'DEBUG',
    quiet: 'DEBUG  PAUSE',
    waveCount: 'Regulars in a wave',
    tankHp: 'Tank health',
    hitbox: 'Hitbox',
    ruler: 'Ruler',
    pierce: 'Pierce',
    pierces: 'pierces',
    misses: 'does not pierce',
    space: { key: 'space', action: 'quiet pause' },
    doubleTap: { key: 'double tap', action: 'reset' },
    addUnit: { key: 'A', action: 'one more unit' },
    restart: { key: 'R', action: 'restart wave' },
    skip: { key: 'N', action: 'skip wave' },
    lose: { key: 'F', action: 'lose' },
    enemyDamage: { key: 'left icon', action: 'enemy damage' },
  },
};
