import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_SCRIPTS = [
  'src/data.js',
  'src/utils.js',
  'src/validation.js',
  'src/storage.js',
  'src/fusion.js'
];

class FakeLocalStorage {
  constructor(seed = {}) {
    this.values = new Map(Object.entries(seed).map(([key, value]) => [String(key), String(value)]));
    this.failWrites = false;
  }

  getItem(key) {
    const normalized = String(key);
    return this.values.has(normalized) ? this.values.get(normalized) : null;
  }

  setItem(key, value) {
    if (this.failWrites) throw new Error('QuotaExceededError simulée');
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }

  clear() {
    this.values.clear();
  }
}

function makeTimers() {
  let nextId = 1;
  const pending = new Map();
  return {
    setTimeout(callback, _delay, ...args) {
      const id = nextId++;
      pending.set(id, () => callback(...args));
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    runAll() {
      while (pending.size) {
        const batch = [...pending.entries()];
        pending.clear();
        for (const [, callback] of batch) callback();
      }
    }
  };
}

function makeEventTarget(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    }
  };
}

function createRuntime({ arena = false } = {}) {
  const localStorage = new FakeLocalStorage();
  const timers = makeTimers();
  const warnings = [];
  const document = makeEventTarget({
    hidden: false,
    body: { appendChild() {} },
    createElement() {
      return { style: {}, remove() {}, click() {}, select() {} };
    },
    execCommand() { return true; }
  });
  const sandbox = makeEventTarget({
    console: {
      log() {},
      info() {},
      error() {},
      warn(...args) { warnings.push(args.map(String).join(' ')); }
    },
    localStorage,
    document,
    navigator: { clipboard: null },
    performance: { now: () => 0 },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    TextEncoder,
    TextDecoder,
    Blob,
    URL,
    encodeURIComponent,
    decodeURIComponent,
    escape,
    unescape,
    btoa: value => Buffer.from(String(value), 'binary').toString('base64'),
    atob: value => Buffer.from(String(value), 'base64').toString('binary')
  });
  const context = vm.createContext(sandbox);
  context.window = context;
  context.self = context;

  for (const relative of CORE_SCRIPTS) {
    vm.runInContext(readFileSync(resolve(ROOT, relative), 'utf8'), context, { filename: relative });
  }

  if (arena) {
    context.LF.audio = {
      play() {},
      startMusic() {},
      stopMusic() {},
      setPaused() {}
    };
    context.LF.render = {
      drawPortrait() {},
      drawTopDown() {}
    };
    vm.runInContext(readFileSync(resolve(ROOT, 'src/arena.js'), 'utf8'), context, { filename: 'src/arena.js' });
  }

  return { context, LF: context.LF, localStorage, timers, warnings };
}

function intoRuntime(runtime, value) {
  runtime.context.__fixtureJson = JSON.stringify(value);
  try {
    return vm.runInContext('JSON.parse(__fixtureJson)', runtime.context);
  } finally {
    delete runtime.context.__fixtureJson;
  }
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeChild(runtime, seed = 'NODE_TEST') {
  const education = intoRuntime(runtime, { mentor: 'zero', discipline: 'engineer', event: 'rescue' });
  return runtime.LF.fusion.generateChild(runtime.LF.ORIGINS[0], runtime.LF.ORIGINS[3], education, seed);
}

function makeResult(runtime, overrides = {}) {
  return intoRuntime(runtime, {
    victory: false,
    score: 0,
    kills: 0,
    damage: 0,
    damageTaken: 0,
    maxCombo: 1,
    level: 1,
    time: 0,
    realm: 0,
    wave: 1,
    bosses: [],
    essence: 0,
    accuracy: 0,
    recordedAt: '2026-08-30T12:00:00.000Z',
    ...overrides
  });
}

function makeCanvas() {
  return makeEventTarget({
    width: 960,
    height: 540,
    style: {},
    getContext: () => ({}),
    focus() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 })
  });
}

const emptyHud = () => ({ querySelector: () => null });

test('les cinq synergies auparavant inatteignables sont résolues dans les deux ordres', () => {
  const { LF } = createRuntime();
  const cases = [
    ['electric', 'fire', 'Plasma Royal'],
    ['electric', 'shadow', 'Éclair Noir'],
    ['bio', 'nature', 'Évolution Sauvage'],
    ['sound', 'water', 'Sirène de Choc'],
    ['time', 'water', 'Marée des Âges']
  ];

  for (const [a, b, expectedName] of cases) {
    const forward = LF.fusion.getSynergy({ element: a }, { element: b });
    const reverse = LF.fusion.getSynergy({ element: b }, { element: a });
    assert.equal(forward.key, [a, b].sort().join('+'));
    assert.equal(forward.name, expectedName);
    assert.equal(reverse.name, expectedName);
  }
});

test('un code génétique hostile est refusé sans pollution de prototype', () => {
  const runtime = createRuntime();
  const child = plain(makeChild(runtime, 'HOSTILE'));
  delete child.code;
  delete child.runHistory;
  child.id = 'javascript:alert(1)';
  child.parents.a.name = '<img src=x onerror=alert(1)>';
  Object.defineProperty(child, '__proto__', {
    value: { polluted: true }, enumerable: true, configurable: true
  });
  const payload = intoRuntime(runtime, { v: 1, child });
  const code = `SOA1-${runtime.LF.utils.encodeData(payload)}`;

  assert.throws(
    () => runtime.LF.fusion.decodeChild(code),
    error => error?.name === 'ValidationError' && /heir\.id/.test(error.message)
  );
  assert.equal({}.polluted, undefined);
});

test('la validation borne la précision et refuse un checkpoint hors limites', () => {
  const runtime = createRuntime({ arena: true });
  const result = runtime.LF.validation.sanitizeRunResult(makeResult(runtime, { accuracy: 987 }));
  assert.equal(result.accuracy, 100);

  const child = makeChild(runtime, 'LIMITS');
  const game = new runtime.LF.ArenaGame(makeCanvas(), child, emptyHud(), { quality: 'low' });
  const activeRun = game.exportCheckpoint('manual');
  activeRun.player.level = 10_001;
  assert.throws(
    () => runtime.LF.validation.sanitizeActiveRun(activeRun),
    error => error?.name === 'ValidationError' && /activeRun\.player\.level/.test(error.message)
  );
  game.stop();
});

test('un replay conserve historique, meilleur score, victoires et statut de légende', () => {
  const runtime = createRuntime();
  const storage = runtime.LF.storage;
  storage.load();
  const child = makeChild(runtime, 'REPLAY');

  const victory = makeResult(runtime, {
    victory: true,
    runId: 'run_victory',
    score: 12500,
    kills: 84,
    essence: 160,
    accuracy: 140,
    bosses: ['Le Gardien'],
    recordedAt: '2026-08-30T12:01:00.000Z'
  });
  const defeat = makeResult(runtime, {
    victory: false,
    runId: 'run_defeat',
    score: 2400,
    kills: 19,
    essence: 35,
    recordedAt: '2026-08-30T12:02:00.000Z'
  });

  assert.ok(storage.completeRun(child, victory));
  assert.ok(storage.completeRun(child, defeat));

  const saved = storage.data.dynasty.find(entry => entry.id === child.id);
  assert.ok(saved);
  assert.equal(saved.runHistory.length, 2);
  assert.deepEqual(plain(saved.runHistory.map(entry => entry.runId)), ['run_victory', 'run_defeat']);
  assert.equal(saved.runHistory[0].accuracy, 100);
  assert.equal(saved.bestScore, 12500);
  assert.equal(saved.victories, 1);
  assert.equal(saved.defeats, 1);
  assert.equal(saved.legend, true);
  assert.equal(storage.data.statistics.runs, 2);
  assert.equal(storage.data.statistics.victories, 1);
  assert.equal(storage.data.statistics.defeats, 1);
  assert.equal(storage.data.statistics.bestScore, 12500);
  assert.equal(storage.data.essence, 195);
});

test('completeRun est atomique quand la persistance locale échoue', () => {
  const runtime = createRuntime({ arena: true });
  const storage = runtime.LF.storage;
  storage.load();
  const child = makeChild(runtime, 'ATOMIC');
  const game = new runtime.LF.ArenaGame(makeCanvas(), child, emptyHud(), { quality: 'low' });
  game.wave = 1;
  game.runTime = 12;
  game.stats.kills = 3;
  const checkpoint = game.exportCheckpoint('wave-start');
  assert.equal(storage.setActiveRun(checkpoint), true);

  const beforeData = plain(storage.data);
  const beforeDisk = runtime.localStorage.getItem(storage.key);
  runtime.localStorage.failWrites = true;
  const completed = storage.completeRun(child, makeResult(runtime, {
    victory: true,
    runId: 'run_atomic',
    score: 9999,
    kills: 99,
    essence: 999
  }));

  assert.equal(completed, null);
  assert.deepEqual(plain(storage.data), beforeData);
  assert.equal(runtime.localStorage.getItem(storage.key), beforeDisk);
  assert.equal(storage.data.activeRun.childId, child.id);
  assert.ok(storage.lastError);
  game.stop();
});

test('les achats Legacy débitent l’Essence, incrémentent le rang et respectent les limites', () => {
  const runtime = createRuntime();
  const storage = runtime.LF.storage;
  storage.load();
  storage.data.essence = 200;
  assert.equal(storage.save(), true);

  assert.equal(storage.purchaseLegacy('power', 45, 2), 1);
  assert.equal(storage.purchaseLegacy('power', 45, 2), 2);
  assert.equal(storage.data.progression.legacy.power, 2);
  assert.equal(storage.data.progression.totalEssenceSpent, 90);
  assert.equal(storage.data.essence, 110);

  assert.equal(storage.purchaseLegacy('power', 45, 2), false);
  assert.equal(storage.purchaseLegacy('resonance', 150, 3), false);
  assert.equal(storage.data.progression.legacy.power, 2);
  assert.equal(storage.data.progression.totalEssenceSpent, 90);
  assert.equal(storage.data.essence, 110);
});

test('les rangs Legacy modifient réellement PV, dégâts et Essence de fin de mission', () => {
  const runtime = createRuntime({ arena: true });
  const child = makeChild(runtime, 'LEGACY_FX');
  const base = new runtime.LF.ArenaGame(makeCanvas(), child, emptyHud(), { quality: 'low' });

  runtime.LF.storage.data.progression.legacy = { vitality: 2, power: 3, resonance: 4 };
  let endResult = null;
  const boosted = new runtime.LF.ArenaGame(makeCanvas(), child, emptyHud(), {
    quality: 'low',
    onEnd: result => { endResult = plain(result); }
  });

  assert.ok(Math.abs(boosted.player.maxHp - base.player.maxHp * 1.08) < 1e-9);
  assert.ok(Math.abs(boosted.player.damage - base.player.damage * 1.09) < 1e-9);

  boosted.stats.kills = 10;
  boosted.realmIndex = 1;
  boosted.end(false);
  runtime.timers.runAll();
  const baseEssence = 24 + 10 * 1.4 + 1 * 28 + child.generation * 8;
  assert.equal(endResult.essence, Math.round(baseEssence * 1.2));

  base.stop();
  boosted.stop();
});

test('le checkpoint v1 est émis aux frontières, persisté et restauré au début de la vague', () => {
  const runtime = createRuntime({ arena: true });
  const storage = runtime.LF.storage;
  storage.load();
  const child = makeChild(runtime, 'CHECKPOINT');
  const emitted = [];
  const game = new runtime.LF.ArenaGame(makeCanvas(), child, emptyHud(), {
    quality: 'low',
    onCheckpoint(state) {
      emitted.push(plain(state));
      storage.setActiveRun(state);
    }
  });

  game.enterRealm(0, true);
  game.player.hp = game.player.maxHp - 17;
  game.player.cooldowns.a = 2.5;
  game.stats.kills = 7;
  game.stats.score = 4321;
  game.runTime = 28.5;
  game.combo = 11;
  game.comboTimer = 1.4;
  game.startWave();

  assert.deepEqual(emitted.map(state => state.reason), ['realm-entry', 'wave-start']);
  const checkpoint = emitted.at(-1);
  assert.deepEqual(Object.keys(checkpoint).sort(), [
    'childId', 'combo', 'comboTimer', 'player', 'realmIndex', 'reason',
    'runTime', 'stats', 'version', 'wave'
  ]);
  assert.equal(checkpoint.version, 1);
  assert.equal(checkpoint.childId, child.id);
  assert.equal(checkpoint.realmIndex, 0);
  assert.equal(checkpoint.wave, 1);
  assert.equal(checkpoint.stats.kills, 7);
  assert.equal(checkpoint.stats.score, 4321);
  assert.equal(checkpoint.player.cooldowns.a, 2.5);
  assert.equal(storage.data.activeRun.reason, 'wave-start');

  const resumed = new runtime.LF.ArenaGame(makeCanvas(), child, emptyHud(), {
    quality: 'low',
    resumeState: storage.data.activeRun
  });
  resumed.start();
  assert.equal(resumed.realmIndex, 0);
  assert.equal(resumed.wave, 1);
  assert.equal(resumed.stats.kills, 7);
  assert.equal(resumed.stats.score, 4321);
  assert.equal(resumed.runTime, 28.5);
  assert.equal(resumed.combo, 11);
  assert.equal(resumed.player.cooldowns.a, 2.5);

  const mismatched = intoRuntime(runtime, { ...checkpoint, childId: 'heir_other' });
  assert.equal(resumed.restoreCheckpoint(mismatched), false);
  game.stop();
  resumed.stop();
});
