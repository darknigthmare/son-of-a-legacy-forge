(function () {
  const LF = window.LF = window.LF || {};
  const V = LF.validation;
  if (!V) throw new Error('LF.validation doit être chargé avant src/storage.js.');

  const KEY = 'son-of-a-legacy-forge-save-v1';
  const MAX_SAFE_REVISION = Number.MAX_SAFE_INTEGER - 1;
  const now = () => new Date().toISOString();
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const makeRunId = () => LF.utils?.randomId?.('run') || `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  function defaultRaw() {
    const timestamp = now();
    return {
      version: LF.VERSION || '1.0.0',
      schemaVersion: V.LIMITS.schemaVersion,
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 0,
      essence: 0,
      dynasty: [],
      activeDraft: null,
      activeRun: null,
      settings: { sound: true, reducedMotion: false, highContrast: false, quality: 'auto' },
      statistics: {
        runs: 0, victories: 0, defeats: 0, totalKills: 0, bestScore: 0,
        highestGeneration: 0, mutationsFound: [], bossesDefeated: []
      },
      progression: {
        legacy: {}, totalEssenceSpent: 0, tutorialSeen: false, onboardingComplete: false,
        tutorialStep: 0, unlockedOrigins: [], unlockedFeatures: []
      },
      quarantine: []
    };
  }

  function makeDefault() {
    return V.sanitizeSave(defaultRaw(), { source: 'default' }).data;
  }

  function normalizeError(error, fallback = 'Erreur de sauvegarde inconnue.') {
    if (error instanceof Error) return error;
    return new Error(typeof error === 'string' ? error : fallback);
  }

  function sanitizeResult(result, runId = null) {
    const candidate = { ...result };
    if (typeof candidate.accuracy === 'number' && Number.isFinite(candidate.accuracy)) {
      candidate.accuracy = Math.max(0, Math.min(100, candidate.accuracy));
    }
    candidate.recordedAt = candidate.recordedAt || now();
    candidate.runId = candidate.runId || runId || makeRunId();
    return V.sanitizeRunResult(candidate);
  }

  function historyKey(result) {
    return result.runId || [result.recordedAt, result.victory, result.score, result.kills, result.time].join('|');
  }

  function mergeHistories(...histories) {
    const seen = new Set();
    const merged = [];
    for (const history of histories) {
      for (const result of history || []) {
        const key = historyKey(result);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(result);
      }
    }
    return merged.slice(-V.LIMITS.maxRunHistory);
  }

  function mergeHeirs(existing, incoming, runResult = null) {
    const previous = existing || null;
    let history = mergeHistories(previous?.runHistory, incoming.runHistory);
    let resultAdded = false;
    if (runResult && !history.some(entry => historyKey(entry) === historyKey(runResult))) {
      history = mergeHistories(history, [runResult]);
      resultAdded = true;
    }
    const merged = {
      ...(previous || {}),
      ...incoming,
      createdAt: previous?.createdAt || incoming.createdAt || now(),
      updatedAt: now(),
      runHistory: history,
      bestScore: Math.max(previous?.bestScore || 0, incoming.bestScore || 0, runResult?.score || 0),
      victories: Math.max(previous?.victories || 0, incoming.victories || 0) + (resultAdded && runResult?.victory ? 1 : 0),
      defeats: Math.max(previous?.defeats || 0, incoming.defeats || 0) + (resultAdded && runResult && !runResult.victory ? 1 : 0),
      legend: Boolean(previous?.legend || incoming.legend || (resultAdded && runResult?.victory))
    };
    return { heir: V.sanitizeHeir(merged), resultAdded };
  }

  function recordHeirProgress(data, heir) {
    data.statistics.highestGeneration = Math.max(data.statistics.highestGeneration || 0, heir.generation || 1);
    if (heir.mutation?.id && !data.statistics.mutationsFound.includes(heir.mutation.id)) {
      data.statistics.mutationsFound.push(heir.mutation.id);
    }
  }

  function recordGlobalRun(data, result) {
    const stats = data.statistics;
    stats.runs = Math.min(1e9, stats.runs + 1);
    stats.victories = Math.min(1e9, stats.victories + (result.victory ? 1 : 0));
    stats.defeats = Math.min(1e9, stats.defeats + (result.victory ? 0 : 1));
    stats.totalKills = Math.min(1e12, stats.totalKills + result.kills);
    stats.bestScore = Math.max(stats.bestScore || 0, result.score);
    for (const boss of result.bosses) {
      if (!stats.bossesDefeated.includes(boss) && stats.bossesDefeated.length < 100) stats.bossesDefeated.push(boss);
    }
    data.essence = Math.min(1e12, data.essence + result.essence);
  }

  function appendHeir(data, heir) {
    const index = data.dynasty.findIndex(entry => entry.id === heir.id);
    if (index >= 0) data.dynasty[index] = heir;
    else {
      if (data.dynasty.length >= V.LIMITS.maxDynasty) {
        const removed = data.dynasty.shift();
        data.quarantine.push(V.quarantineEntry({
          source: 'storage', path: 'dynasty', ref: removed?.id || '',
          reason: `Entrée la plus ancienne écartée par la limite de ${V.LIMITS.maxDynasty}.`
        }));
      }
      data.dynasty.push(heir);
    }
    recordHeirProgress(data, heir);
  }

  const Storage = LF.storage = {
    key: KEY,
    data: makeDefault(),
    lastError: null,
    lastLoadError: null,
    lastWarnings: [],
    _lastPersisted: null,

    _setError(error, warning = 'Impossible d’enregistrer la sauvegarde.') {
      this.lastError = normalizeError(error);
      console.warn(warning, this.lastError);
      return false;
    },

    _commit(candidate, options = {}) {
      const rollback = clone(this._lastPersisted || this.data || makeDefault());
      try {
        const validation = V.sanitizeSave(candidate, { source: options.source || 'save' });
        const next = validation.data;
        const priorRevision = Math.max(
          Number.isSafeInteger(rollback?.revision) ? rollback.revision : 0,
          Number.isSafeInteger(next.revision) ? next.revision : 0
        );
        next.version = LF.VERSION || next.version;
        next.updatedAt = now();
        next.revision = Math.min(MAX_SAFE_REVISION, priorRevision + 1);
        const serialized = JSON.stringify(next);
        V.assertTextSize(serialized, V.LIMITS.maxSaveBytes, 'save');
        localStorage.setItem(KEY, serialized);
        this.data = next;
        this._lastPersisted = clone(next);
        this.lastError = null;
        this.lastWarnings = validation.issues;
        return true;
      } catch (error) {
        this.data = rollback;
        return this._setError(error);
      }
    },

    _transaction(mutator, source = 'transaction') {
      const candidate = clone(this.data);
      let result;
      try { result = mutator(candidate); }
      catch (error) { return { ok: this._setError(error, 'Mutation de sauvegarde refusée.'), result: null }; }
      if (!this._commit(candidate, { source })) return { ok: false, result: null };
      return { ok: true, result };
    },

    load() {
      this.lastError = null;
      this.lastLoadError = null;
      this.lastWarnings = [];
      let raw;
      try { raw = localStorage.getItem(KEY); }
      catch (error) {
        this.data = makeDefault();
        this._lastPersisted = clone(this.data);
        this.lastLoadError = normalizeError(error);
        this._setError(error, 'Stockage local indisponible.');
        return this.data;
      }

      if (!raw) {
        this.data = makeDefault();
        this._lastPersisted = clone(this.data);
        this._commit(this.data, { source: 'initial' });
        return this.data;
      }

      try {
        V.assertTextSize(raw, V.LIMITS.maxImportBytes, 'save');
        const parsed = JSON.parse(raw);
        const validation = V.sanitizeSave(parsed, { source: 'load' });
        const clean = validation.data;
        clean.version = LF.VERSION || clean.version;
        this.data = clean;
        this._lastPersisted = clone(clean);
        this.lastWarnings = validation.issues;
        if (raw !== JSON.stringify(clean)) {
          const warnings = [...validation.issues];
          const migrated = this._commit(clean, { source: 'migration' });
          this.lastWarnings = warnings;
          if (!migrated) {
            this.data = clean;
            this._lastPersisted = clone(clean);
          }
        }
      } catch (error) {
        this.lastLoadError = normalizeError(error);
        const replacement = makeDefault();
        replacement.quarantine.push(V.quarantineEntry({
          source: 'load', path: 'save', ref: KEY,
          reason: `Sauvegarde racine illisible : ${this.lastLoadError.message}`
        }));
        this.data = replacement;
        this._lastPersisted = clone(replacement);
        this._commit(replacement, { source: 'recovery' });
      }
      return this.data;
    },

    save() {
      return this._commit(this.data, { source: 'save' });
    },

    reset() {
      return this._commit(makeDefault(), { source: 'reset' });
    },

    setDraft(draft) {
      if (draft == null) return this.clearDraft();
      let sanitized;
      try { sanitized = V.sanitizeDraft(draft); sanitized.updatedAt = now(); }
      catch (error) { return this._setError(error, 'Draft invalide refusé.'); }
      return this._transaction(data => { data.activeDraft = sanitized; }, 'setDraft').ok;
    },

    clearDraft() {
      return this._transaction(data => { data.activeDraft = null; }, 'clearDraft').ok;
    },

    setActiveRun(activeRun) {
      if (activeRun == null) return this.clearActiveRun();
      let sanitized;
      try {
        const candidate = { ...activeRun };
        const previous = this.data.activeRun;
        if (previous && previous.childId === candidate.childId) {
          candidate.id = candidate.id || previous.id;
          candidate.startedAt = candidate.startedAt || previous.startedAt;
        }
        candidate.updatedAt = now();
        sanitized = V.sanitizeActiveRun(candidate);
      }
      catch (error) { return this._setError(error, 'Checkpoint de mission invalide refusé.'); }
      return this._transaction(data => { data.activeRun = sanitized; }, 'setActiveRun').ok;
    },

    clearActiveRun() {
      return this._transaction(data => { data.activeRun = null; }, 'clearActiveRun').ok;
    },

    clearRunAndDraft() {
      return this._transaction(data => {
        data.activeRun = null;
        data.activeDraft = null;
      }, 'clearRunAndDraft').ok;
    },

    addOrUpdateHeir(child, runResult = null) {
      let incoming;
      let result = null;
      try {
        incoming = V.sanitizeHeir(child);
        if (runResult) result = sanitizeResult(runResult);
      } catch (error) {
        this._setError(error, 'Héritier ou résultat invalide refusé.');
        return null;
      }
      const transaction = this._transaction(data => {
        const existing = data.dynasty.find(entry => entry.id === incoming.id) || null;
        const merged = mergeHeirs(existing, incoming, result);
        appendHeir(data, merged.heir);
        return merged.heir;
      }, 'addOrUpdateHeir');
      return transaction.ok ? transaction.result : null;
    },

    removeHeir(id) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(id)) return this._setError(new V.ValidationError('identifiant invalide', 'id'));
      return this._transaction(data => {
        data.dynasty = data.dynasty.filter(entry => entry.id !== id);
      }, 'removeHeir').ok;
    },

    registerRun(runResult) {
      let result;
      try { result = sanitizeResult(runResult); }
      catch (error) { return this._setError(error, 'Résultat de mission invalide refusé.'); }
      return this._transaction(data => { recordGlobalRun(data, result); }, 'registerRun').ok;
    },

    completeRun(child, runResult) {
      let incoming;
      let result;
      try {
        incoming = V.sanitizeHeir(child);
        if (this.data.activeRun && this.data.activeRun.childId !== incoming.id) {
          throw new V.ValidationError('le checkpoint actif appartient à un autre héritier', 'activeRun.childId');
        }
        result = sanitizeResult(runResult, this.data.activeRun?.id || null);
      } catch (error) {
        this._setError(error, 'Mission terminée avec des données invalides.');
        return null;
      }
      const transaction = this._transaction(data => {
        const existing = data.dynasty.find(entry => entry.id === incoming.id) || null;
        const merged = mergeHeirs(existing, incoming, result);
        appendHeir(data, merged.heir);
        if (merged.resultAdded) recordGlobalRun(data, result);
        data.activeDraft = null;
        data.activeRun = null;
        return merged.heir;
      }, 'completeRun');
      return transaction.ok ? transaction.result : null;
    },

    spendEssence(amount) {
      if (!Number.isInteger(amount) || amount <= 0 || amount > 1e9) {
        return this._setError(new V.ValidationError('montant entier positif attendu', 'amount'));
      }
      if (this.data.essence < amount) { this.lastError = null; return false; }
      return this._transaction(data => { data.essence -= amount; }, 'spendEssence').ok;
    },

    purchaseLegacy(id, cost, maxRank = 1) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(id)) {
        this._setError(new V.ValidationError('identifiant invalide', 'legacy.id'));
        return false;
      }
      if (!Number.isInteger(cost) || cost < 0 || cost > 1e9 || !Number.isInteger(maxRank) || maxRank < 1 || maxRank > 100) {
        this._setError(new V.ValidationError('coût ou rang maximal invalide', 'legacy'));
        return false;
      }
      const currentRank = this.data.progression.legacy[id] || 0;
      if (currentRank >= maxRank || this.data.essence < cost) { this.lastError = null; return false; }
      const transaction = this._transaction(data => {
        const rank = (data.progression.legacy[id] || 0) + 1;
        data.progression.legacy[id] = rank;
        data.progression.totalEssenceSpent = Math.min(1e12, data.progression.totalEssenceSpent + cost);
        data.essence -= cost;
        return rank;
      }, 'purchaseLegacy');
      return transaction.ok ? transaction.result : false;
    },

    export() {
      try {
        const clean = V.sanitizeSave(this.data, { source: 'export' }).data;
        this.lastError = null;
        return JSON.stringify(clean, null, 2);
      } catch (error) {
        this._setError(error, 'Export de sauvegarde impossible.');
        throw this.lastError;
      }
    },

    import(text) {
      const previousWarnings = [...this.lastWarnings];
      try {
        V.assertTextSize(text, V.LIMITS.maxImportBytes, 'import');
        const parsed = JSON.parse(text);
        const validation = V.sanitizeSave(parsed, { source: 'import', requireDynasty: true });
        if (!this._commit(validation.data, { source: 'import' })) throw this.lastError;
        this.lastWarnings = validation.issues;
        return this.data;
      } catch (error) {
        this.lastWarnings = previousWarnings;
        this.lastError = normalizeError(error, 'Format de sauvegarde invalide.');
        throw this.lastError;
      }
    }
  };
})();
