(function () {
  const LF = window.LF = window.LF || {};

  const LIMITS = Object.freeze({
    schemaVersion: 2,
    maxImportBytes: 4_000_000,
    maxSaveBytes: 4_000_000,
    maxHeirBytes: 256_000,
    maxActiveRunBytes: 750_000,
    maxDynasty: 300,
    maxRunHistory: 30,
    maxQuarantine: 50,
    maxGenericArray: 500,
    maxGenericKeys: 100,
    maxGenericDepth: 8
  });

  const ELEMENTS = Object.freeze([
    'fire', 'shadow', 'earth', 'electric', 'ice', 'nature',
    'water', 'sound', 'spirit', 'time', 'beast', 'bio'
  ]);
  const ELEMENT_SET = new Set(ELEMENTS);
  const MUTATIONS = new Set(['third-strand', 'giant-gene', 'phase-skin', 'twin-core', 'unstable-crown', 'ancestral-return']);
  const MUTATION_EFFECTS = new Set(['thirdElement', 'giant', 'phase', 'echo', 'overload', 'ancestor']);
  const DISCIPLINES = new Set(['warrior', 'mystic', 'engineer', 'trickster']);
  const EVENTS = new Set(['rescue', 'betrayal', 'exile', 'triumph']);
  const MENTORS = new Set(['parentA', 'parentB', 'zero']);
  const QUALITIES = new Set(['auto', 'low', 'medium', 'high']);
  const RARITIES = new Set(['ANOMALIE', 'HÉRITAGE LÉGENDAIRE', 'HÉRITAGE ANCIEN', 'DYNASTIQUE', 'HYBRIDE STABLE']);
  const VISUAL_ENUMS = Object.freeze({
    body: new Set(['athletic', 'slim', 'massive', 'android', 'regal', 'organic', 'fluid', 'performer', 'spectral', 'monk', 'feral', 'insect']),
    head: new Set(['human', 'golem', 'visor', 'alien', 'skull', 'masked', 'beast', 'mantis']),
    hair: new Set(['none', 'flame', 'long', 'antenna', 'crystal', 'leaves', 'tendrils', 'wave', 'mist', 'mane']),
    wings: new Set(['none', 'veil', 'thrusters', 'ice', 'petal', 'fin', 'speaker', 'ghost', 'clock', 'insect']),
    tail: new Set(['none', 'ember', 'stone', 'cable', 'vine', 'tentacle', 'wisp', 'ribbon', 'beast', 'stinger']),
    armor: new Set(['heavy', 'light', 'crag', 'tech', 'robe', 'bark', 'scale', 'stage', 'ceremonial', 'cloth', 'hide', 'carapace']),
    aura: new Set(['none', 'sparks', 'shadow', 'dust', 'electric', 'snow', 'pollen', 'bubbles', 'rings', 'souls', 'clock', 'claws', 'spores'])
  });
  const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;
  const SAFE_KEY = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
  const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const GENETIC_CODE = /^SOA1-[A-Za-z0-9+/_=-]+$/;

  class ValidationError extends Error {
    constructor(message, path = 'value') {
      super(`${path}: ${message}`);
      this.name = 'ValidationError';
      this.path = path;
    }
  }

  function fail(path, message) { throw new ValidationError(message, path); }
  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function requireObject(value, path) {
    if (!isPlainObject(value)) fail(path, 'objet attendu');
    return value;
  }
  function byteLength(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(text)).length;
    return String(text).length * 2;
  }
  function jsonSize(value, path) {
    let text;
    try { text = JSON.stringify(value); }
    catch { fail(path, 'objet non sérialisable'); }
    if (typeof text !== 'string') fail(path, 'objet non sérialisable');
    return byteLength(text);
  }
  function assertTextSize(text, maxBytes, path = 'text') {
    if (typeof text !== 'string') fail(path, 'texte attendu');
    if (byteLength(text) > maxBytes) fail(path, `taille maximale dépassée (${maxBytes} octets)`);
    return text;
  }
  function assertObjectSize(value, maxBytes, path) {
    if (jsonSize(value, path) > maxBytes) fail(path, `taille maximale dépassée (${maxBytes} octets)`);
  }
  function cleanString(value, options = {}) {
    const { path = 'value', max = 160, required = false, fallback = '', pattern = null } = options;
    if (typeof value !== 'string') {
      if (required) fail(path, 'chaîne attendue');
      return fallback;
    }
    const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[<>]/g, '').trim();
    if (required && !cleaned) fail(path, 'chaîne vide');
    if (cleaned.length > max) fail(path, `chaîne trop longue (maximum ${max})`);
    if (pattern && cleaned && !pattern.test(cleaned)) fail(path, 'format invalide');
    return cleaned || fallback;
  }
  function safeId(value, path, required = true) {
    return cleanString(value, { path, max: 96, required, fallback: '', pattern: SAFE_ID });
  }
  function finiteNumber(value, options = {}) {
    const { path = 'value', min = -1e12, max = 1e12, integer = false, required = true, fallback = 0 } = options;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      if (required) fail(path, 'nombre fini attendu');
      return fallback;
    }
    if (value < min || value > max) fail(path, `nombre hors limites [${min}, ${max}]`);
    return integer ? Math.round(value) : value;
  }
  function recoverNumber(value, options, issues, fallback = 0) {
    try { return finiteNumber(value, options); }
    catch (error) {
      issues.push({ path: options.path || 'number', reason: `${error.message} Valeur par défaut restaurée.` });
      return fallback;
    }
  }
  function booleanValue(value, fallback = false) { return typeof value === 'boolean' ? value : fallback; }
  function enumValue(value, allowed, path, options = {}) {
    const { required = true, fallback = null } = options;
    if (typeof value === 'string' && allowed.has(value)) return value;
    if (required) fail(path, 'valeur non reconnue');
    return fallback;
  }
  function color(value, path, fallback = null) {
    if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
      if (fallback !== null) return fallback;
      fail(path, 'couleur hexadécimale invalide');
    }
    let normalized = value.toLowerCase();
    if (normalized.length === 4) normalized = `#${normalized.slice(1).split('').map(char => char + char).join('')}`;
    return normalized;
  }
  function isoDate(value, path, fallback = null) {
    if (typeof value === 'string') {
      const time = Date.parse(value);
      if (Number.isFinite(time)) {
        const year = new Date(time).getUTCFullYear();
        if (year >= 2000 && year <= 2200) return new Date(time).toISOString();
      }
    }
    if (fallback !== null) return fallback;
    fail(path, 'date ISO invalide');
  }
  function stringList(value, options = {}) {
    const { path = 'list', maxItems = 50, maxLength = 96, ids = false } = options;
    if (!Array.isArray(value)) return [];
    const output = [];
    for (let index = 0; index < value.length && output.length < maxItems; index++) {
      try {
        const item = ids ? safeId(value[index], `${path}[${index}]`) : cleanString(value[index], { path: `${path}[${index}]`, max: maxLength, required: true });
        if (!output.includes(item)) output.push(item);
      } catch {}
    }
    return output;
  }

  function sanitizeStats(value, path = 'stats') {
    requireObject(value, path);
    const output = {};
    for (const key of ['vitality', 'power', 'speed', 'control']) {
      output[key] = finiteNumber(value[key], { path: `${path}.${key}`, min: 2, max: 13, integer: true });
    }
    return output;
  }
  function sanitizeStatModifiers(value, path) {
    if (!isPlainObject(value)) return {};
    const output = {};
    for (const key of ['vitality', 'power', 'speed', 'control']) {
      if (value[key] !== undefined) output[key] = finiteNumber(value[key], { path: `${path}.${key}`, min: -3, max: 3, integer: true });
    }
    return output;
  }
  function sanitizeColors(value, path = 'colors') {
    if (!Array.isArray(value) || value.length < 3) fail(path, 'trois couleurs attendues');
    return [0, 1, 2].map(index => color(value[index], `${path}[${index}]`));
  }
  function sanitizeVisual(value, path = 'visual') {
    requireObject(value, path);
    const output = {};
    for (const key of ['body', 'head', 'hair', 'wings', 'tail', 'armor', 'aura']) {
      output[key] = enumValue(value[key] ?? 'none', VISUAL_ENUMS[key], `${path}.${key}`);
    }
    output.horns = finiteNumber(value.horns ?? 0, { path: `${path}.horns`, min: 0, max: 2, integer: true });
    return output;
  }
  function sanitizeNamedDescription(value, path) {
    requireObject(value, path);
    return {
      name: cleanString(value.name, { path: `${path}.name`, max: 120, required: true }),
      desc: cleanString(value.desc, { path: `${path}.desc`, max: 600, required: true })
    };
  }
  function sanitizeMutation(value, path = 'mutation') {
    if (value == null) return null;
    requireObject(value, path);
    const mutation = {
      id: enumValue(value.id, MUTATIONS, `${path}.id`),
      name: cleanString(value.name, { path: `${path}.name`, max: 100, required: true }),
      desc: cleanString(value.desc, { path: `${path}.desc`, max: 500, required: true }),
      color: color(value.color, `${path}.color`),
      chance: finiteNumber(value.chance ?? 1, { path: `${path}.chance`, min: 0, max: 10, required: false, fallback: 1 }),
      stat: sanitizeStatModifiers(value.stat, `${path}.stat`),
      effect: enumValue(value.effect, MUTATION_EFFECTS, `${path}.effect`)
    };
    if (value.thirdElement != null) mutation.thirdElement = enumValue(value.thirdElement, ELEMENT_SET, `${path}.thirdElement`);
    return mutation;
  }
  function sanitizeAbility(value, path, fusion = false) {
    requireObject(value, path);
    const ability = {
      name: cleanString(value.name, { path: `${path}.name`, max: 140, required: true }),
      desc: cleanString(value.desc, { path: `${path}.desc`, max: 700, required: true })
    };
    if (fusion) {
      if (!Array.isArray(value.elements) || !value.elements.length || value.elements.length > 3) fail(`${path}.elements`, 'un à trois éléments attendus');
      ability.elements = value.elements.map((entry, index) => enumValue(entry, ELEMENT_SET, `${path}.elements[${index}]`));
    } else {
      ability.element = enumValue(value.element, ELEMENT_SET, `${path}.element`);
    }
    if (value.icon != null) ability.icon = cleanString(value.icon, { path: `${path}.icon`, max: 12 });
    return ability;
  }
  function sanitizeParentRef(value, path) {
    requireObject(value, path);
    return {
      id: safeId(value.id, `${path}.id`),
      name: cleanString(value.name, { path: `${path}.name`, max: 80, required: true }),
      generation: finiteNumber(value.generation ?? 0, { path: `${path}.generation`, min: 0, max: 10_000, integer: true })
    };
  }
  function sanitizeEducation(value, path = 'education') {
    requireObject(value, path);
    return {
      mentor: enumValue(value.mentor, MENTORS, `${path}.mentor`),
      mentorName: cleanString(value.mentorName, { path: `${path}.mentorName`, max: 120, required: true }),
      discipline: enumValue(value.discipline, DISCIPLINES, `${path}.discipline`),
      disciplineName: cleanString(value.disciplineName, { path: `${path}.disciplineName`, max: 120, required: true }),
      event: enumValue(value.event, EVENTS, `${path}.event`),
      eventName: cleanString(value.eventName, { path: `${path}.eventName`, max: 140, required: true }),
      trait: cleanString(value.trait, { path: `${path}.trait`, max: 80, required: true })
    };
  }
  function sanitizeCombat(value, path = 'combat') {
    requireObject(value, path);
    return {
      projectileSpeed: finiteNumber(value.projectileSpeed ?? 1, { path: `${path}.projectileSpeed`, min: .25, max: 4 }),
      dashCooldown: finiteNumber(value.dashCooldown ?? 0, { path: `${path}.dashCooldown`, min: -1, max: 5 }),
      fusionCooldown: finiteNumber(value.fusionCooldown ?? 0, { path: `${path}.fusionCooldown`, min: -10, max: 30 }),
      crit: finiteNumber(value.crit ?? 0, { path: `${path}.crit`, min: 0, max: 1 }),
      healBonus: finiteNumber(value.healBonus ?? 1, { path: `${path}.healBonus`, min: .1, max: 5 }),
      statusResist: finiteNumber(value.statusResist ?? 0, { path: `${path}.statusResist`, min: 0, max: 1 }),
      comboWindow: finiteNumber(value.comboWindow ?? 1, { path: `${path}.comboWindow`, min: .25, max: 5 }),
      mentorSource: enumValue(value.mentorSource ?? 'Z', new Set(['A', 'B', 'Z']), `${path}.mentorSource`)
    };
  }
  function sanitizeRunResult(value, options = {}) {
    const path = options.path || 'runResult';
    requireObject(value, path);
    if (typeof value.victory !== 'boolean') fail(`${path}.victory`, 'booléen attendu');
    const output = {
      victory: value.victory,
      score: finiteNumber(value.score ?? 0, { path: `${path}.score`, min: 0, max: 1e12, integer: true }),
      kills: finiteNumber(value.kills ?? 0, { path: `${path}.kills`, min: 0, max: 1e7, integer: true }),
      damage: finiteNumber(value.damage ?? 0, { path: `${path}.damage`, min: 0, max: 1e15, integer: true }),
      damageTaken: finiteNumber(value.damageTaken ?? 0, { path: `${path}.damageTaken`, min: 0, max: 1e15, integer: true }),
      maxCombo: finiteNumber(value.maxCombo ?? 0, { path: `${path}.maxCombo`, min: 0, max: 1e7, integer: true }),
      level: finiteNumber(value.level ?? 1, { path: `${path}.level`, min: 1, max: 10_000, integer: true }),
      time: finiteNumber(value.time ?? 0, { path: `${path}.time`, min: 0, max: 31_536_000 }),
      realm: finiteNumber(value.realm ?? 0, { path: `${path}.realm`, min: 0, max: 99, integer: true }),
      wave: finiteNumber(value.wave ?? 0, { path: `${path}.wave`, min: 0, max: 999, integer: true }),
      bosses: stringList(value.bosses, { path: `${path}.bosses`, maxItems: 50, maxLength: 120 }),
      essence: finiteNumber(value.essence ?? 0, { path: `${path}.essence`, min: 0, max: 1e9, integer: true }),
      accuracy: Math.min(100, finiteNumber(value.accuracy ?? 0, { path: `${path}.accuracy`, min: 0, max: 1_000_000, integer: true })),
      recordedAt: isoDate(value.recordedAt, `${path}.recordedAt`, new Date().toISOString())
    };
    if (value.runId != null) output.runId = safeId(value.runId, `${path}.runId`);
    return output;
  }
  function sanitizeRunHistory(value, path = 'runHistory', issues = null) {
    if (!Array.isArray(value)) return [];
    if (value.length > LIMITS.maxRunHistory && issues) {
      issues.push({ path, reason: `${value.length - LIMITS.maxRunHistory} anciens résultats écartés par la limite de ${LIMITS.maxRunHistory}.` });
    }
    const output = [];
    for (const [index, entry] of value.slice(-LIMITS.maxRunHistory).entries()) {
      try { output.push(sanitizeRunResult(entry, { path: `${path}[${index}]` })); }
      catch (error) {
        if (!issues) throw error;
        issues.push({ path: `${path}[${index}]`, reason: error.message });
      }
    }
    return output;
  }

  function sanitizeHeir(value, options = {}) {
    const path = options.path || 'heir';
    requireObject(value, path);
    assertObjectSize(value, LIMITS.maxHeirBytes, path);
    const now = new Date().toISOString();
    const parents = requireObject(value.parents, `${path}.parents`);
    const abilities = requireObject(value.abilities, `${path}.abilities`);
    const passive = sanitizeNamedDescription(value.passive, `${path}.passive`);
    const weakness = sanitizeNamedDescription(value.weakness, `${path}.weakness`);
    const output = {
      id: safeId(value.id, `${path}.id`),
      kind: enumValue(value.kind, new Set(['heir']), `${path}.kind`),
      generation: finiteNumber(value.generation, { path: `${path}.generation`, min: 1, max: 10_000, integer: true }),
      seed: cleanString(value.seed, { path: `${path}.seed`, max: 12, required: true, pattern: /^[A-Z0-9_-]+$/ }),
      createdAt: isoDate(value.createdAt, `${path}.createdAt`, now),
      updatedAt: isoDate(value.updatedAt, `${path}.updatedAt`, isoDate(value.createdAt, `${path}.createdAt`, now)),
      name: cleanString(value.name, { path: `${path}.name`, max: 80, required: true }),
      title: cleanString(value.title, { path: `${path}.title`, max: 180, required: true }),
      lineageName: cleanString(value.lineageName, { path: `${path}.lineageName`, max: 140, required: true }),
      phrase: cleanString(value.phrase, { path: `${path}.phrase`, max: 40, required: true }),
      element: enumValue(value.element, ELEMENT_SET, `${path}.element`),
      secondaryElement: enumValue(value.secondaryElement, ELEMENT_SET, `${path}.secondaryElement`),
      thirdElement: value.thirdElement == null ? null : enumValue(value.thirdElement, ELEMENT_SET, `${path}.thirdElement`),
      stats: sanitizeStats(value.stats, `${path}.stats`),
      colors: sanitizeColors(value.colors, `${path}.colors`),
      visual: sanitizeVisual(value.visual, `${path}.visual`),
      mutation: sanitizeMutation(value.mutation, `${path}.mutation`),
      parents: {
        a: sanitizeParentRef(parents.a, `${path}.parents.a`),
        b: sanitizeParentRef(parents.b, `${path}.parents.b`)
      },
      education: sanitizeEducation(value.education, `${path}.education`),
      abilities: {
        basic: sanitizeAbility(abilities.basic, `${path}.abilities.basic`),
        parentA: sanitizeAbility(abilities.parentA, `${path}.abilities.parentA`),
        parentB: sanitizeAbility(abilities.parentB, `${path}.abilities.parentB`),
        fusion: sanitizeAbility(abilities.fusion, `${path}.abilities.fusion`, true)
      },
      passive,
      weakness,
      combat: sanitizeCombat(value.combat, `${path}.combat`),
      rarity: enumValue(value.rarity, RARITIES, `${path}.rarity`),
      rarityColor: color(value.rarityColor, `${path}.rarityColor`),
      legend: booleanValue(value.legend),
      victories: finiteNumber(value.victories ?? 0, { path: `${path}.victories`, min: 0, max: 1e7, integer: true }),
      defeats: finiteNumber(value.defeats ?? 0, { path: `${path}.defeats`, min: 0, max: 1e7, integer: true }),
      bestScore: finiteNumber(value.bestScore ?? 0, { path: `${path}.bestScore`, min: 0, max: 1e12, integer: true }),
      runHistory: sanitizeRunHistory(value.runHistory, `${path}.runHistory`, options.issues || null)
    };
    if (value.code != null && value.code !== '') {
      output.code = cleanString(value.code, { path: `${path}.code`, max: 250_000, required: true, pattern: GENETIC_CODE });
    }
    return output;
  }

  function sanitizeParent(value, options = {}) {
    const path = options.path || 'parent';
    if (value == null) return null;
    requireObject(value, path);
    const output = {
      id: safeId(value.id, `${path}.id`),
      kind: enumValue(value.kind, new Set(['origin', 'heir']), `${path}.kind`),
      generation: finiteNumber(value.generation ?? 0, { path: `${path}.generation`, min: 0, max: 10_000, integer: true }),
      name: cleanString(value.name, { path: `${path}.name`, max: 80, required: true }),
      title: cleanString(value.title, { path: `${path}.title`, max: 180, required: true }),
      role: cleanString(value.role, { path: `${path}.role`, max: 120, required: true }),
      element: enumValue(value.element, ELEMENT_SET, `${path}.element`),
      secondaryElement: value.secondaryElement == null ? null : enumValue(value.secondaryElement, ELEMENT_SET, `${path}.secondaryElement`),
      stats: sanitizeStats(value.stats, `${path}.stats`),
      colors: sanitizeColors(value.colors, `${path}.colors`),
      visual: sanitizeVisual(value.visual, `${path}.visual`),
      mutation: sanitizeMutation(value.mutation, `${path}.mutation`),
      ability: sanitizeAbility({ ...value.ability, element: value.ability?.element ?? value.element }, `${path}.ability`),
      passive: sanitizeNamedDescription(value.passive, `${path}.passive`),
      weakness: sanitizeNamedDescription(value.weakness, `${path}.weakness`),
      lore: cleanString(value.lore, { path: `${path}.lore`, max: 1_000, required: true }),
      legend: booleanValue(value.legend)
    };
    if (value.sourceChildId != null) output.sourceChildId = safeId(value.sourceChildId, `${path}.sourceChildId`);
    return output;
  }

  function sanitizeDraft(value, options = {}) {
    const path = options.path || 'activeDraft';
    if (value == null) return null;
    requireObject(value, path);
    const education = isPlainObject(value.education) ? value.education : {};
    const mode = enumValue(value.mode ?? 'campaign', new Set(['campaign', 'lab']), `${path}.mode`);
    const parentA = sanitizeParent(value.parentA, { path: `${path}.parentA` });
    const parentB = sanitizeParent(value.parentB, { path: `${path}.parentB` });
    const child = value.child == null ? null : sanitizeHeir(value.child, { path: `${path}.child` });
    const inferredStep = child ? 'reveal' : parentA && parentB ? 'education' : 'fusion';
    return {
      mode,
      step: enumValue(value.step ?? inferredStep, new Set(['fusion', 'education', 'reveal', 'game']), `${path}.step`),
      parentA,
      parentB,
      education: {
        mentor: education.mentor == null ? null : enumValue(education.mentor, MENTORS, `${path}.education.mentor`),
        discipline: education.discipline == null ? null : enumValue(education.discipline, DISCIPLINES, `${path}.education.discipline`),
        event: education.event == null ? null : enumValue(education.event, EVENTS, `${path}.education.event`)
      },
      seed: cleanString(value.seed ?? 'GENESIS', { path: `${path}.seed`, max: 12, required: true, pattern: /^[A-Z0-9_-]+$/ }),
      child,
      updatedAt: isoDate(value.updatedAt, `${path}.updatedAt`, new Date().toISOString())
    };
  }

  function sanitizeGeneric(value, path = 'value', depth = 0) {
    if (depth > LIMITS.maxGenericDepth) fail(path, 'profondeur maximale dépassée');
    if (value == null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return finiteNumber(value, { path, min: -1e12, max: 1e12 });
    if (typeof value === 'string') return cleanString(value, { path, max: 512 });
    if (Array.isArray(value)) {
      if (value.length > LIMITS.maxGenericArray) fail(path, 'tableau trop long');
      return value.map((entry, index) => sanitizeGeneric(entry, `${path}[${index}]`, depth + 1));
    }
    requireObject(value, path);
    const keys = Object.keys(value);
    if (keys.length > LIMITS.maxGenericKeys) fail(path, 'trop de propriétés');
    const output = {};
    for (const key of keys) {
      if (!SAFE_KEY.test(key) || ['__proto__', 'prototype', 'constructor'].includes(key)) fail(`${path}.${key}`, 'clé interdite');
      output[key] = sanitizeGeneric(value[key], `${path}.${key}`, depth + 1);
    }
    return output;
  }
  function sanitizeActiveRun(value, options = {}) {
    const path = options.path || 'activeRun';
    if (value == null) return null;
    requireObject(value, path);
    assertObjectSize(value, LIMITS.maxActiveRunBytes, path);
    const playerSource = requireObject(value.player, `${path}.player`);
    const statsSource = requireObject(value.stats, `${path}.stats`);
    const cooldownSource = requireObject(playerSource.cooldowns, `${path}.player.cooldowns`);
    const number = (source, key, min, max, integer = false) => finiteNumber(source[key], {
      path: `${path}.${source === playerSource ? 'player.' : source === statsSource ? 'stats.' : 'player.cooldowns.'}${key}`,
      min, max, integer
    });
    const maxHp = number(playerSource, 'maxHp', 1, 1e9);
    const player = {
      x: number(playerSource, 'x', 0, 10_000),
      y: number(playerSource, 'y', 0, 10_000),
      maxHp,
      hp: Math.min(maxHp, number(playerSource, 'hp', 0, 1e9)),
      speed: number(playerSource, 'speed', 1, 10_000),
      damage: number(playerSource, 'damage', 0, 1e12),
      damageMult: number(playerSource, 'damageMult', .01, 1_000),
      fireRate: number(playerSource, 'fireRate', .03, 60),
      projectileSpeed: number(playerSource, 'projectileSpeed', 1, 100_000),
      projectileCount: number(playerSource, 'projectileCount', 1, 10, true),
      pierce: number(playerSource, 'pierce', 0, 100, true),
      critChance: number(playerSource, 'critChance', 0, 1),
      critMult: number(playerSource, 'critMult', 1, 100),
      magnet: number(playerSource, 'magnet', 0, 100_000),
      regen: number(playerSource, 'regen', 0, 1e6),
      lifeSteal: number(playerSource, 'lifeSteal', 0, 1),
      auraDamage: number(playerSource, 'auraDamage', 0, 1e9),
      deathBlast: number(playerSource, 'deathBlast', 0, 1e9),
      shieldTimer: number(playerSource, 'shieldTimer', 0, 1e9),
      dashCooldownBase: number(playerSource, 'dashCooldownBase', .1, 86_400),
      dashCooldown: number(playerSource, 'dashCooldown', 0, 86_400),
      abilityCooldownMult: number(playerSource, 'abilityCooldownMult', .05, 100),
      fusionCooldownMult: number(playerSource, 'fusionCooldownMult', .05, 100),
      statusResist: number(playerSource, 'statusResist', 0, 1),
      healBonus: number(playerSource, 'healBonus', 0, 100),
      comboWindow: number(playerSource, 'comboWindow', .1, 100),
      level: number(playerSource, 'level', 1, 10_000, true),
      xp: number(playerSource, 'xp', 0, 1e12),
      xpNext: number(playerSource, 'xpNext', 1, 1e12),
      fusionDamageMult: number(playerSource, 'fusionDamageMult', 0, 100),
      shieldEnabled: booleanValue(playerSource.shieldEnabled),
      shieldReady: booleanValue(playerSource.shieldReady),
      cooldowns: {
        a: number(cooldownSource, 'a', 0, 86_400),
        b: number(cooldownSource, 'b', 0, 86_400),
        fusion: number(cooldownSource, 'fusion', 0, 86_400)
      }
    };
    if (playerSource.phaseChance !== undefined) player.phaseChance = number(playerSource, 'phaseChance', 0, 1);
    if (playerSource.echoChance !== undefined) player.echoChance = number(playerSource, 'echoChance', 0, 1);
    const stats = {
      kills: number(statsSource, 'kills', 0, 1e7, true),
      damage: number(statsSource, 'damage', 0, 1e15),
      damageTaken: number(statsSource, 'damageTaken', 0, 1e15),
      score: number(statsSource, 'score', 0, 1e12),
      maxCombo: number(statsSource, 'maxCombo', 0, 1e7, true),
      bosses: stringList(statsSource.bosses, { path: `${path}.stats.bosses`, maxItems: 50, maxLength: 120 }),
      shots: number(statsSource, 'shots', 0, 1e9, true),
      hits: number(statsSource, 'hits', 0, 1e9, true)
    };
    const output = {
      version: finiteNumber(value.version ?? 1, { path: `${path}.version`, min: 1, max: 1, integer: true }),
      reason: enumValue(value.reason ?? 'manual', new Set(['realm-entry', 'wave-start', 'manual']), `${path}.reason`),
      childId: safeId(value.childId, `${path}.childId`),
      realmIndex: finiteNumber(value.realmIndex ?? 0, { path: `${path}.realmIndex`, min: 0, max: 99, integer: true }),
      wave: finiteNumber(value.wave ?? 0, { path: `${path}.wave`, min: 0, max: 999, integer: true }),
      player,
      stats,
      runTime: finiteNumber(value.runTime ?? 0, { path: `${path}.runTime`, min: 0, max: 31_536_000 }),
      combo: finiteNumber(value.combo ?? 0, { path: `${path}.combo`, min: 0, max: 1e7, integer: true }),
      comboTimer: finiteNumber(value.comboTimer ?? 0, { path: `${path}.comboTimer`, min: 0, max: 100_000 })
    };
    output.id = value.id == null ? `run_${Date.now().toString(36)}` : safeId(value.id, `${path}.id`);
    output.status = enumValue(value.status ?? 'active', new Set(['active', 'paused', 'checkpoint']), `${path}.status`);
    if (value.child != null) output.child = sanitizeHeir(value.child, { path: `${path}.child` });
    if (value.draft != null) output.draft = sanitizeDraft(value.draft, { path: `${path}.draft` });
    output.startedAt = isoDate(value.startedAt, `${path}.startedAt`, new Date().toISOString());
    output.updatedAt = isoDate(value.updatedAt, `${path}.updatedAt`, new Date().toISOString());
    return output;
  }

  function sanitizeSettings(value, issues) {
    if (!isPlainObject(value)) {
      if (value != null) issues.push({ path: 'settings', reason: 'Paramètres invalides remplacés par les valeurs par défaut.' });
      value = {};
    }
    for (const [key, fallback] of [['sound', true], ['reducedMotion', false], ['highContrast', false]]) {
      if (value[key] !== undefined && typeof value[key] !== 'boolean') {
        issues.push({ path: `settings.${key}`, reason: `Booléen invalide remplacé par ${fallback}.` });
      }
    }
    if (value.quality !== undefined && !QUALITIES.has(value.quality)) {
      issues.push({ path: 'settings.quality', reason: 'Qualité invalide remplacée par auto.' });
    }
    return {
      sound: booleanValue(value.sound, true),
      reducedMotion: booleanValue(value.reducedMotion, false),
      highContrast: booleanValue(value.highContrast, false),
      quality: enumValue(value.quality ?? 'auto', QUALITIES, 'settings.quality', { required: false, fallback: 'auto' })
    };
  }
  function sanitizeStatistics(value, issues) {
    if (!isPlainObject(value)) {
      if (value != null) issues.push({ path: 'statistics', reason: 'Statistiques invalides remplacées.' });
      value = {};
    }
    return {
      runs: recoverNumber(value.runs ?? 0, { path: 'statistics.runs', min: 0, max: 1e9, integer: true }, issues),
      victories: recoverNumber(value.victories ?? 0, { path: 'statistics.victories', min: 0, max: 1e9, integer: true }, issues),
      defeats: recoverNumber(value.defeats ?? 0, { path: 'statistics.defeats', min: 0, max: 1e9, integer: true }, issues),
      totalKills: recoverNumber(value.totalKills ?? 0, { path: 'statistics.totalKills', min: 0, max: 1e12, integer: true }, issues),
      bestScore: recoverNumber(value.bestScore ?? 0, { path: 'statistics.bestScore', min: 0, max: 1e12, integer: true }, issues),
      highestGeneration: recoverNumber(value.highestGeneration ?? 0, { path: 'statistics.highestGeneration', min: 0, max: 10_000, integer: true }, issues),
      mutationsFound: stringList(value.mutationsFound, { path: 'statistics.mutationsFound', maxItems: 100, ids: true }),
      bossesDefeated: stringList(value.bossesDefeated, { path: 'statistics.bossesDefeated', maxItems: 100, maxLength: 120 })
    };
  }
  function sanitizeProgression(value, issues) {
    if (!isPlainObject(value)) {
      if (value != null) issues.push({ path: 'progression', reason: 'Progression invalide remplacée.' });
      value = {};
    }
    const rawLegacy = isPlainObject(value.legacy) ? value.legacy : isPlainObject(value.legacies) ? value.legacies : {};
    const legacy = {};
    for (const [id, rank] of Object.entries(rawLegacy).slice(0, 100)) {
      if (!SAFE_ID.test(id)) continue;
      try { legacy[id] = finiteNumber(rank, { path: `progression.legacy.${id}`, min: 0, max: 100, integer: true }); }
      catch (error) { issues.push({ path: `progression.legacy.${id}`, reason: `${error.message} Entrée écartée.` }); }
    }
    const tutorialSeen = booleanValue(value.tutorialSeen, booleanValue(value.onboardingComplete, false));
    return {
      legacy,
      totalEssenceSpent: recoverNumber(value.totalEssenceSpent ?? 0, { path: 'progression.totalEssenceSpent', min: 0, max: 1e12, integer: true }, issues),
      tutorialSeen,
      onboardingComplete: tutorialSeen,
      tutorialStep: recoverNumber(value.tutorialStep ?? 0, { path: 'progression.tutorialStep', min: 0, max: 100, integer: true }, issues),
      unlockedOrigins: stringList(value.unlockedOrigins, { path: 'progression.unlockedOrigins', maxItems: 100, ids: true }),
      unlockedFeatures: stringList(value.unlockedFeatures, { path: 'progression.unlockedFeatures', maxItems: 100, ids: true })
    };
  }
  function quarantineEntry(value = {}) {
    return {
      at: isoDate(value.at, 'quarantine.at', new Date().toISOString()),
      source: cleanString(value.source ?? 'validation', { path: 'quarantine.source', max: 32, fallback: 'validation' }),
      path: cleanString(value.path ?? 'unknown', { path: 'quarantine.path', max: 160, fallback: 'unknown' }),
      reason: cleanString(value.reason ?? 'Entrée invalide.', { path: 'quarantine.reason', max: 500, fallback: 'Entrée invalide.' }),
      ref: cleanString(value.ref ?? '', { path: 'quarantine.ref', max: 120 })
    };
  }
  function sanitizeQuarantine(value) {
    if (!Array.isArray(value)) return [];
    const output = [];
    for (const entry of value.slice(-LIMITS.maxQuarantine)) {
      try { output.push(quarantineEntry(entry)); } catch {}
    }
    return output;
  }

  function sanitizeSave(value, options = {}) {
    const source = options.source || 'load';
    requireObject(value, 'save');
    if (value.schemaVersion !== undefined) {
      const incomingSchema = finiteNumber(value.schemaVersion, { path: 'save.schemaVersion', min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
      if (incomingSchema > LIMITS.schemaVersion) {
        fail('save.schemaVersion', `version ${incomingSchema} plus récente que la version prise en charge (${LIMITS.schemaVersion})`);
      }
    }
    const issues = [];
    if (options.requireDynasty && !Array.isArray(value.dynasty)) fail('save.dynasty', 'tableau requis');
    const rawDynasty = Array.isArray(value.dynasty) ? value.dynasty : [];
    if (!Array.isArray(value.dynasty) && value.dynasty != null) issues.push({ path: 'dynasty', reason: 'Dynastie invalide remplacée.' });
    const candidates = rawDynasty.slice(-LIMITS.maxDynasty);
    if (rawDynasty.length > LIMITS.maxDynasty) issues.push({ path: 'dynasty', reason: `${rawDynasty.length - LIMITS.maxDynasty} entrées anciennes écartées par la limite de ${LIMITS.maxDynasty}.` });
    const dynasty = [];
    const ids = new Set();
    for (let index = 0; index < candidates.length; index++) {
      try {
        const heir = sanitizeHeir(candidates[index], { path: `dynasty[${index}]`, issues });
        if (ids.has(heir.id)) {
          issues.push({ path: `dynasty[${index}]`, reason: 'Identifiant dupliqué écarté.', ref: heir.id });
          continue;
        }
        ids.add(heir.id);
        dynasty.push(heir);
      } catch (error) {
        issues.push({ path: `dynasty[${index}]`, reason: error.message, ref: isPlainObject(candidates[index]) && typeof candidates[index].id === 'string' ? candidates[index].id.slice(0, 96) : '' });
      }
    }
    let activeDraft = null;
    try { activeDraft = sanitizeDraft(value.activeDraft, { path: 'activeDraft' }); }
    catch (error) { issues.push({ path: 'activeDraft', reason: error.message }); }
    let activeRun = null;
    try { activeRun = sanitizeActiveRun(value.activeRun, { path: 'activeRun' }); }
    catch (error) { issues.push({ path: 'activeRun', reason: error.message }); }
    const now = new Date().toISOString();
    const statistics = sanitizeStatistics(value.statistics, issues);
    for (const heir of dynasty) {
      statistics.highestGeneration = Math.max(statistics.highestGeneration, heir.generation);
      if (heir.mutation?.id && !statistics.mutationsFound.includes(heir.mutation.id)) statistics.mutationsFound.push(heir.mutation.id);
    }
    const settings = sanitizeSettings(value.settings, issues);
    const progression = sanitizeProgression(value.progression, issues);
    const revision = recoverNumber(value.revision ?? 0, { path: 'save.revision', min: 0, max: Number.MAX_SAFE_INTEGER - 1, integer: true }, issues);
    const essence = recoverNumber(value.essence ?? 0, { path: 'save.essence', min: 0, max: 1e12, integer: true }, issues);
    const quarantine = sanitizeQuarantine(value.quarantine);
    for (const issue of issues) quarantine.push(quarantineEntry({ ...issue, source }));
    const data = {
      version: cleanString(value.version ?? LF.VERSION ?? '1.0.0', { path: 'save.version', max: 32, fallback: LF.VERSION || '1.0.0' }),
      schemaVersion: LIMITS.schemaVersion,
      createdAt: isoDate(value.createdAt, 'save.createdAt', now),
      updatedAt: isoDate(value.updatedAt, 'save.updatedAt', now),
      revision,
      essence,
      dynasty,
      activeDraft,
      activeRun,
      settings,
      statistics,
      progression,
      quarantine: quarantine.slice(-LIMITS.maxQuarantine)
    };
    return { data, issues };
  }

  const Validation = LF.validation = {
    LIMITS,
    ValidationError,
    isPlainObject,
    byteLength,
    assertTextSize,
    sanitizeHeir,
    sanitizeParent,
    sanitizeDraft,
    sanitizeActiveRun,
    sanitizeRunResult,
    sanitizeSave,
    quarantineEntry,
    trySanitizeHeir(value, options) {
      try { return { ok: true, value: sanitizeHeir(value, options), error: null }; }
      catch (error) { return { ok: false, value: null, error }; }
    }
  };
})();
