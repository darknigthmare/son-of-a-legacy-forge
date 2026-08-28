(function () {
  const LF = window.LF = window.LF || {};
  const KEY = 'son-of-a-legacy-forge-save-v1';

  const makeDefault = () => ({
    version: LF.VERSION || '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    essence: 0,
    dynasty: [],
    activeDraft: null,
    settings: { sound: true, reducedMotion: false },
    statistics: {
      runs: 0, victories: 0, defeats: 0, totalKills: 0, bestScore: 0,
      highestGeneration: 0, mutationsFound: [], bossesDefeated: []
    }
  });

  const Storage = LF.storage = {
    data: makeDefault(),

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) {
          this.data = makeDefault();
          this.save();
          return this.data;
        }
        const parsed = JSON.parse(raw);
        const defaults = makeDefault();
        this.data = {
          ...defaults,
          ...parsed,
          settings: { ...defaults.settings, ...(parsed.settings || {}) },
          statistics: { ...defaults.statistics, ...(parsed.statistics || {}) },
          dynasty: Array.isArray(parsed.dynasty) ? parsed.dynasty : []
        };
      } catch (error) {
        console.warn('Sauvegarde illisible, création d’une nouvelle.', error);
        this.data = makeDefault();
      }
      return this.data;
    },

    save() {
      this.data.updatedAt = new Date().toISOString();
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); }
      catch (error) { console.warn('Impossible d’enregistrer la sauvegarde.', error); }
      return this.data;
    },

    reset() {
      this.data = makeDefault();
      this.save();
      return this.data;
    },

    setDraft(draft) {
      this.data.activeDraft = draft ? LF.utils.deepClone(draft) : null;
      this.save();
    },

    clearDraft() {
      this.data.activeDraft = null;
      this.save();
    },

    addOrUpdateHeir(child, runResult = null) {
      const copy = LF.utils.deepClone(child);
      const existingIndex = this.data.dynasty.findIndex(entry => entry.id === copy.id);
      copy.updatedAt = new Date().toISOString();
      copy.createdAt = copy.createdAt || copy.updatedAt;
      if (runResult) {
        copy.runHistory = copy.runHistory || [];
        copy.runHistory.push({ ...runResult, recordedAt: new Date().toISOString() });
        copy.bestScore = Math.max(copy.bestScore || 0, runResult.score || 0);
        copy.victories = (copy.victories || 0) + (runResult.victory ? 1 : 0);
        copy.defeats = (copy.defeats || 0) + (runResult.victory ? 0 : 1);
        copy.legend = Boolean(copy.legend || runResult.victory);
      }
      if (existingIndex >= 0) this.data.dynasty[existingIndex] = { ...this.data.dynasty[existingIndex], ...copy };
      else this.data.dynasty.push(copy);
      this.data.statistics.highestGeneration = Math.max(this.data.statistics.highestGeneration || 0, copy.generation || 1);
      if (copy.mutation?.id && !this.data.statistics.mutationsFound.includes(copy.mutation.id)) this.data.statistics.mutationsFound.push(copy.mutation.id);
      this.save();
      return copy;
    },

    removeHeir(id) {
      this.data.dynasty = this.data.dynasty.filter(entry => entry.id !== id);
      this.save();
    },

    registerRun(result) {
      const stats = this.data.statistics;
      stats.runs += 1;
      stats.victories += result.victory ? 1 : 0;
      stats.defeats += result.victory ? 0 : 1;
      stats.totalKills += result.kills || 0;
      stats.bestScore = Math.max(stats.bestScore || 0, result.score || 0);
      for (const boss of result.bosses || []) if (!stats.bossesDefeated.includes(boss)) stats.bossesDefeated.push(boss);
      this.data.essence += result.essence || 0;
      this.save();
    },

    spendEssence(amount) {
      if (this.data.essence < amount) return false;
      this.data.essence -= amount;
      this.save();
      return true;
    },

    export() {
      return JSON.stringify(this.data, null, 2);
    },

    import(text) {
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.dynasty) || typeof parsed.settings !== 'object') throw new Error('Format de sauvegarde invalide.');
      this.data = { ...makeDefault(), ...parsed };
      this.save();
      return this.data;
    }
  };
})();
