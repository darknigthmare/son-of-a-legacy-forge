(function () {
  const LF = window.LF = window.LF || {};
  const U = LF.utils;

  const TAU = Math.PI * 2;
  const CHECKPOINT_VERSION = 1;
  const CHECKPOINT_PLAYER_NUMBERS = [
    'x','y','maxHp','hp','speed','damage','damageMult','fireRate','projectileSpeed','projectileCount','pierce',
    'critChance','critMult','magnet','regen','lifeSteal','auraDamage','deathBlast','shieldTimer','dashCooldownBase',
    'dashCooldown','abilityCooldownMult','fusionCooldownMult','statusResist','healBonus','comboWindow','level','xp','xpNext',
    'phaseChance','echoChance','fusionDamageMult'
  ];

  class ArenaGame {
    constructor(canvas, child, hudRoot, callbacks = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.child = child;
      this.hudRoot = hudRoot;
      this.callbacks = callbacks;
      this.resumeState = callbacks.resumeState || null;
      this.quality = this.resolveQuality(callbacks.quality);
      this.effectLimits = {
        low: { particles: 280, damageTexts: 48, auraInterval: .25 },
        medium: { particles: 600, damageTexts: 80, auraInterval: .22 },
        high: { particles: 1000, damageTexts: 120, auraInterval: .2 }
      }[this.quality];
      this.legacyRanks = this.readLegacyRanks();
      this.width = canvas.width;
      this.height = canvas.height;
      this.running = false;
      this.paused = false;
      this.pauseReason = null;
      this.ended = false;
      this.frame = 0;
      this.lastTime = 0;
      this.time = 0;
      this.runTime = 0;
      this.realmIndex = 0;
      this.wave = 0;
      this.waveActive = false;
      this.waveTransition = 0;
      this.spawnQueue = [];
      this.spawnTimer = 0;
      this.projectiles = [];
      this.enemyProjectiles = [];
      this.enemies = [];
      this.pickups = [];
      this.particles = [];
      this.effects = [];
      this.damageTexts = [];
      this.delayedActions = [];
      this.keys = new Set();
      this.mouse = { x: this.width * .72, y: this.height * .5, down: false, active: false };
      this.touchVector = { x: 0, y: 0 };
      this.touchBasic = false;
      this.touchKnob = null;
      this.shake = 0;
      this.flash = { color: '#ffffff', alpha: 0 };
      this.timeSlowTimer = 0;
      this.fusionAura = 0;
      this.announcementTimer = 0;
      this.stats = { kills: 0, damage: 0, damageTaken: 0, score: 0, maxCombo: 1, bosses: [], shots: 0, hits: 0 };
      this.combo = 0;
      this.comboTimer = 0;
      this.upgradeQueue = [];
      this.upgradeActive = false;
      this.boss = null;
      this.endTimer = 0;
      this.auraTickTimer = 0;
      this.boundEvents = [];
      this.decorSeed = U.hashString(child.id);
      this.setupPlayer();
      this.cacheHud();
      this.setupAbilityDock();
      this.bindInput();
    }

    resolveQuality(value) {
      const requested = typeof value === 'string' ? value : value?.mode;
      if (requested === 'low' || requested === 'medium' || requested === 'high') return requested;
      return window.matchMedia?.('(pointer: coarse)').matches ? 'low' : 'high';
    }

    readLegacyRanks() {
      const legacy = LF.storage?.data?.progression?.legacy || {};
      const rank = key => {
        const value = Number(legacy[key]);
        return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
      };
      return { vitality: rank('vitality'), power: rank('power'), resonance: rank('resonance') };
    }

    exportCheckpoint(reason = 'manual') {
      const player = {};
      for (const key of CHECKPOINT_PLAYER_NUMBERS) {
        const value = this.player[key];
        if (Number.isFinite(value)) player[key] = value;
      }
      player.shieldEnabled = Boolean(this.player.shieldEnabled);
      player.shieldReady = Boolean(this.player.shieldReady);
      player.cooldowns = {
        a: Math.max(0, Number(this.player.cooldowns?.a) || 0),
        b: Math.max(0, Number(this.player.cooldowns?.b) || 0),
        fusion: Math.max(0, Number(this.player.cooldowns?.fusion) || 0)
      };
      return {
        version: CHECKPOINT_VERSION,
        reason,
        childId: this.child.id,
        realmIndex: this.realmIndex,
        wave: this.wave,
        player,
        stats: {
          kills: this.stats.kills,
          damage: this.stats.damage,
          damageTaken: this.stats.damageTaken,
          score: this.stats.score,
          maxCombo: this.stats.maxCombo,
          bosses: [...this.stats.bosses],
          shots: this.stats.shots,
          hits: this.stats.hits
        },
        runTime: this.runTime,
        combo: this.combo,
        comboTimer: this.comboTimer
      };
    }

    emitCheckpoint(reason) {
      if (typeof this.callbacks.onCheckpoint !== 'function') return;
      try { this.callbacks.onCheckpoint(this.exportCheckpoint(reason)); }
      catch (error) { console.warn('Impossible d’enregistrer le checkpoint de mission.', error); }
    }

    restoreCheckpoint(rawState) {
      if (!rawState) return false;
      let state = rawState;
      if (typeof state === 'string') {
        try { state = JSON.parse(state); } catch { return false; }
      }
      const realmIndex = Number(state?.realmIndex);
      const wave = Number(state?.wave);
      const realm = LF.REALMS[realmIndex];
      if (state?.version !== CHECKPOINT_VERSION || state.childId !== this.child.id || !realm || !Number.isInteger(wave) || wave < 0 || wave > realm.waves) return false;

      const sourcePlayer = state.player || {};
      for (const key of CHECKPOINT_PLAYER_NUMBERS) {
        const value = Number(sourcePlayer[key]);
        if (Number.isFinite(value)) this.player[key] = value;
      }
      this.player.maxHp = Math.max(1, this.player.maxHp);
      this.player.hp = U.clamp(this.player.hp, 1, this.player.maxHp);
      this.player.x = U.clamp(this.player.x, 34, this.width - 34);
      this.player.y = U.clamp(this.player.y, 52, this.height - 34);
      this.player.projectileCount = U.clamp(Math.round(this.player.projectileCount), 1, 5);
      this.player.pierce = Math.max(0, Math.round(this.player.pierce));
      this.player.speed = Math.max(1, this.player.speed);
      this.player.damage = Math.max(0, this.player.damage);
      this.player.damageMult = Math.max(.01, this.player.damageMult);
      this.player.fireRate = Math.max(.03, this.player.fireRate);
      this.player.projectileSpeed = Math.max(1, this.player.projectileSpeed);
      this.player.critChance = U.clamp(this.player.critChance, 0, 1);
      this.player.critMult = Math.max(1, this.player.critMult);
      this.player.magnet = Math.max(0, this.player.magnet);
      this.player.regen = Math.max(0, this.player.regen);
      this.player.lifeSteal = Math.max(0, this.player.lifeSteal);
      this.player.auraDamage = Math.max(0, this.player.auraDamage);
      this.player.deathBlast = Math.max(0, this.player.deathBlast);
      this.player.dashCooldownBase = Math.max(.1, this.player.dashCooldownBase);
      this.player.dashCooldown = Math.max(0, this.player.dashCooldown);
      this.player.abilityCooldownMult = Math.max(.05, this.player.abilityCooldownMult);
      this.player.fusionCooldownMult = Math.max(.05, this.player.fusionCooldownMult);
      this.player.statusResist = U.clamp(this.player.statusResist, 0, 1);
      this.player.healBonus = Math.max(0, this.player.healBonus);
      this.player.comboWindow = Math.max(.1, this.player.comboWindow);
      if (Number.isFinite(this.player.phaseChance)) this.player.phaseChance = U.clamp(this.player.phaseChance, 0, 1);
      if (Number.isFinite(this.player.echoChance)) this.player.echoChance = U.clamp(this.player.echoChance, 0, 1);
      this.player.fusionDamageMult = Math.max(0, this.player.fusionDamageMult);
      this.player.level = Math.max(1, Math.round(this.player.level));
      this.player.xp = Math.max(0, this.player.xp);
      this.player.xpNext = Math.max(1, this.player.xpNext);
      this.player.shieldEnabled = Boolean(sourcePlayer.shieldEnabled);
      this.player.shieldReady = Boolean(sourcePlayer.shieldReady);
      this.player.cooldowns = {
        a: Math.max(0, Number(sourcePlayer.cooldowns?.a) || 0),
        b: Math.max(0, Number(sourcePlayer.cooldowns?.b) || 0),
        fusion: Math.max(0, Number(sourcePlayer.cooldowns?.fusion) || 0)
      };
      this.player.fireTimer = 0;
      this.player.dashTimer = 0;
      this.player.invuln = 0;

      const sourceStats = state.stats || {};
      for (const key of ['kills','damage','damageTaken','score','maxCombo','shots','hits']) {
        const value = Number(sourceStats[key]);
        if (Number.isFinite(value)) this.stats[key] = Math.max(0, value);
      }
      this.stats.bosses = Array.isArray(sourceStats.bosses) ? sourceStats.bosses.filter(name => typeof name === 'string').slice(0, LF.REALMS.length) : [];
      this.runTime = Math.max(0, Number(state.runTime) || 0);
      this.combo = Math.max(0, Number(state.combo) || 0);
      this.comboTimer = Math.max(0, Number(state.comboTimer) || 0);
      this.realmIndex = realmIndex;
      this.wave = wave;
      this.waveActive = false;
      this.waveTransition = 0;
      this.spawnQueue.length = 0;
      this.projectiles.length = 0;
      this.enemyProjectiles.length = 0;
      this.enemies.length = 0;
      this.pickups.length = 0;
      this.particles.length = 0;
      this.effects.length = 0;
      this.damageTexts.length = 0;
      this.delayedActions.length = 0;
      this.boss = null;
      return true;
    }

    startRestoredCheckpoint() {
      const targetWave = this.wave;
      LF.audio.startMusic(this.realmIndex);
      if (targetWave > 0) {
        this.wave = targetWave - 1;
        this.startWave();
        this.announce('MISSION REPRISE', `${LF.REALMS[this.realmIndex].name} · vague ${targetWave}/4`, 2.1);
      } else {
        this.waveTransition = 2.9;
        this.announce('MISSION REPRISE', LF.REALMS[this.realmIndex].subtitle, 2.1);
        this.emitCheckpoint('realm-entry');
      }
    }

    clearInputState() {
      this.keys.clear();
      this.mouse.down = false;
      this.touchBasic = false;
      this.touchVector.x = 0;
      this.touchVector.y = 0;
      if (this.touchKnob) this.touchKnob.style.transform = '';
    }

    setupPlayer() {
      const stats = this.child.stats;
      const mutation = this.child.mutation?.effect;
      const sizeMult = mutation === 'giant' ? 1.25 : 1;
      const maxHp = (72 + stats.vitality * 11 + (this.child.generation || 1) * 2) * (1 + this.legacyRanks.vitality * .04);
      this.player = {
        x: this.width / 2, y: this.height * .57, radius: 19 * sizeMult,
        maxHp, hp: maxHp,
        speed: 155 + stats.speed * 9,
        damage: (6.5 + stats.power * 2.15) * (1 + this.legacyRanks.power * .03),
        damageMult: 1,
        fireRate: Math.max(.16, .38 - stats.speed * .012),
        fireTimer: 0,
        projectileSpeed: 560 * (this.child.combat?.projectileSpeed || 1),
        projectileCount: 1,
        pierce: 0,
        critChance: .045 + (this.child.combat?.crit || 0) + stats.control * .004,
        critMult: 1.85,
        magnet: 82,
        regen: this.child.element === 'nature' ? .45 : 0,
        lifeSteal: this.child.element === 'spirit' ? .015 : 0,
        auraDamage: 0,
        deathBlast: 0,
        shieldEnabled: false,
        shieldTimer: 0,
        shieldReady: false,
        invuln: 0,
        dashTimer: 0,
        dashDuration: .18,
        dashCooldownBase: Math.max(.65, 1.55 + (this.child.combat?.dashCooldown || 0)),
        dashCooldown: 0,
        dashDir: { x: 1, y: 0 },
        cooldowns: { a: 0, b: 0, fusion: 0 },
        baseCooldowns: {
          a: 6.2,
          b: 7.1,
          fusion: Math.max(12, 23 + (this.child.combat?.fusionCooldown || 0) + (mutation === 'overload' ? 4 : 0))
        },
        abilityCooldownMult: 1,
        fusionCooldownMult: 1,
        statusResist: this.child.combat?.statusResist || 0,
        healBonus: this.child.combat?.healBonus || 1,
        comboWindow: 2.55 * (this.child.combat?.comboWindow || 1),
        level: 1,
        xp: 0,
        xpNext: 56,
        aimAngle: 0
      };
      if (mutation === 'phase') this.player.phaseChance = .12;
      if (mutation === 'echo') this.player.echoChance = .18;
      if (mutation === 'overload') this.player.fusionDamageMult = 1.5;
      else this.player.fusionDamageMult = 1;
    }

    cacheHud() {
      const q = selector => this.hudRoot.querySelector(selector);
      this.hud = {
        portrait: q('.hud-portrait'), name: q('.hud-name'), level: q('.hud-level'),
        healthBar: q('.health-bar span'), healthText: q('.health-text'),
        xpBar: q('.xp-bar span'), xpText: q('.xp-text'), realm: q('.realm-label'),
        wave: q('.wave-label'), objective: q('.objective-label'), score: q('.score-value'),
        combo: q('.combo-value'), bossHud: q('.boss-hud'), bossName: q('.boss-name'),
        bossBar: q('.boss-bar span'), abilityDock: q('.ability-dock'),
        announcement: q('.announcement'), damageVignette: q('.damage-vignette'),
        pauseButton: q('.pause-button'), mobile: q('.mobile-controls')
      };
      if (this.hud.name) this.hud.name.textContent = this.child.name;
      if (this.hud.portrait) LF.render.drawPortrait(this.hud.portrait, this.child, { scale: 1.35 });
    }

    setupAbilityDock() {
      if (!this.hud.abilityDock) return;
      const items = [
        { id:'basic', key:'CLIC', symbol:LF.ELEMENTS[this.child.element]?.symbol || '•', name:this.child.abilities.basic.name, color:LF.ELEMENTS[this.child.element]?.color },
        { id:'a', key:'1', symbol:LF.ELEMENTS[this.child.abilities.parentA.element]?.symbol || 'A', name:this.child.abilities.parentA.name, color:LF.ELEMENTS[this.child.abilities.parentA.element]?.color },
        { id:'b', key:'2', symbol:LF.ELEMENTS[this.child.abilities.parentB.element]?.symbol || 'B', name:this.child.abilities.parentB.name, color:LF.ELEMENTS[this.child.abilities.parentB.element]?.color },
        { id:'fusion', key:'R', symbol:'◈', name:this.child.abilities.fusion.name, color:this.child.colors[2] },
        { id:'dash', key:'ESPACE', symbol:'↯', name:'Esquive phasique', color:'#ffffff' }
      ];
      this.hud.abilityDock.innerHTML = items.map(item => `
        <div class="ability-chip" data-ability="${item.id}" style="--chip-color:${item.color}">
          <div class="cooldown-sweep"></div><div class="cooldown-text"></div>
          <kbd>${item.key}</kbd><span class="ability-symbol">${item.symbol}</span><small>${U.escapeHtml(item.name)}</small>
        </div>`).join('');
      this.abilityChips = {};
      this.hud.abilityDock.querySelectorAll('.ability-chip').forEach(chip => this.abilityChips[chip.dataset.ability] = chip);
    }

    bind(target, event, handler, options) {
      target.addEventListener(event, handler, options);
      this.boundEvents.push(() => target.removeEventListener(event, handler, options));
    }

    bindInput() {
      this.bind(window, 'keydown', event => {
        if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
        if (event.code === 'Escape') {
          event.preventDefault();
          if (this.pauseReason === 'upgrade') return;
          this.callbacks.onPause?.(this);
          return;
        }
        if (this.paused || this.ended) return;
        this.keys.add(event.code);
        if (event.repeat) return;
        if (event.code === 'Digit1' || event.code === 'Numpad1') this.castAbility('a');
        if (event.code === 'Digit2' || event.code === 'Numpad2') this.castAbility('b');
        if (event.code === 'KeyR') this.castFusion();
        if (event.code === 'Space') this.dash();
      });
      this.bind(window, 'keyup', event => this.keys.delete(event.code));
      this.bind(this.canvas, 'pointermove', event => {
        if (event.pointerType !== 'mouse') return;
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (event.clientX - rect.left) * this.width / rect.width;
        this.mouse.y = (event.clientY - rect.top) * this.height / rect.height;
        this.mouse.active = true;
      });
      this.bind(this.canvas, 'pointerdown', event => {
        event.preventDefault();
        this.canvas.focus();
        if (event.pointerType !== 'mouse') return;
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (event.clientX - rect.left) * this.width / rect.width;
        this.mouse.y = (event.clientY - rect.top) * this.height / rect.height;
        this.mouse.active = true;
        if (event.button === 0) this.mouse.down = true;
        if (event.button === 2) this.castAbility('a');
      });
      this.bind(window, 'pointerup', event => { if (event.button === 0) this.mouse.down = false; });
      this.bind(this.canvas, 'contextmenu', event => event.preventDefault());
      if (this.hud.pauseButton) this.bind(this.hud.pauseButton, 'click', () => this.callbacks.onPause?.(this));
      const autoPause = () => {
        this.clearInputState();
        if (!this.running || this.paused || this.ended) return;
        if (typeof this.callbacks.onPause === 'function') this.callbacks.onPause(this);
        else this.setPaused(true, 'system');
      };
      this.bind(window, 'blur', autoPause);
      this.bind(document, 'visibilitychange', () => { if (document.hidden) autoPause(); });
      this.canvas.style.touchAction = 'none';
      this.setupTouchControls();
    }

    setupTouchControls() {
      if (!this.hud.mobile) return;
      const stick = this.hud.mobile.querySelector('.touch-stick');
      const knob = stick?.querySelector('div');
      const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
      if (coarsePointer) this.hud.mobile.classList.remove('hidden');
      this.hud.mobile.style.touchAction = 'none';
      this.touchKnob = knob || null;
      let pointerId = null;
      const updateStick = event => {
        if (!stick) return;
        const rect = stick.getBoundingClientRect();
        let dx = event.clientX - (rect.left + rect.width / 2);
        let dy = event.clientY - (rect.top + rect.height / 2);
        const max = rect.width * .34;
        const len = Math.hypot(dx,dy) || 1;
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        this.touchVector.x = dx / max; this.touchVector.y = dy / max;
        if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
      };
      if (stick) {
        stick.style.touchAction = 'none';
        this.bind(stick,'pointerdown',event=>{event.preventDefault();pointerId=event.pointerId;stick.setPointerCapture?.(pointerId);updateStick(event);});
        this.bind(stick,'pointermove',event=>{if(event.pointerId===pointerId)updateStick(event);});
        const release=event=>{if(event.pointerId!==pointerId)return;pointerId=null;this.touchVector.x=0;this.touchVector.y=0;if(knob)knob.style.transform='';};
        this.bind(stick,'pointerup',release);this.bind(stick,'pointercancel',release);
      }
      this.hud.mobile.querySelectorAll('[data-action]').forEach(button => {
        const action=button.dataset.action;
        button.style.touchAction = 'none';
        this.bind(button,'pointerdown',event=>{
          event.preventDefault();
          button.setPointerCapture?.(event.pointerId);
          if(action==='basic')this.touchBasic=true;
          if(action==='a')this.castAbility('a',true);
          if(action==='b')this.castAbility('b',true);
          if(action==='fusion')this.castFusion(true);
          if(action==='dash')this.dash();
        });
        if(action==='basic'){
          this.bind(button,'pointerup',()=>this.touchBasic=false);
          this.bind(button,'pointercancel',()=>this.touchBasic=false);
        }
      });
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.canvas.focus();
      if (this.restoreCheckpoint(this.resumeState)) this.startRestoredCheckpoint();
      else this.enterRealm(0, true);
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(time => this.loop(time));
    }

    stop() {
      this.running = false;
      if (this.frame) cancelAnimationFrame(this.frame);
      if (this.endTimer) { clearTimeout(this.endTimer); this.endTimer = 0; }
      this.clearInputState();
      this.boundEvents.splice(0).forEach(unbind => unbind());
      LF.audio.setPaused?.(false);
      LF.audio.stopMusic();
    }

    setPaused(value, reason = null) {
      this.paused = Boolean(value);
      this.pauseReason = this.paused ? reason : null;
      if (this.paused) this.clearInputState();
      LF.audio.setPaused?.(this.paused);
      if (!this.paused) this.lastTime = performance.now();
    }

    loop(timestamp) {
      if (!this.running) return;
      const dt = Math.min(.034, Math.max(0, (timestamp - this.lastTime) / 1000));
      this.lastTime = timestamp;
      if (!this.paused && !this.ended) {
        this.update(dt);
        this.runTime += dt;
      }
      this.draw();
      this.updateHud();
      this.frame = requestAnimationFrame(time => this.loop(time));
    }

    enterRealm(index, first = false) {
      this.realmIndex = index;
      this.wave = 0;
      this.waveActive = false;
      this.spawnQueue.length = 0;
      this.enemies.length = 0;
      this.enemyProjectiles.length = 0;
      this.boss = null;
      this.player.x = this.width / 2;
      this.player.y = this.height * .58;
      const realm = LF.REALMS[index];
      LF.audio.startMusic(index);
      this.announce(realm.name, realm.subtitle, 2.7);
      if (!first) this.healPlayer(this.player.maxHp * .22, false);
      this.waveTransition = 2.9;
      this.emitCheckpoint('realm-entry');
    }

    startWave() {
      const realm = LF.REALMS[this.realmIndex];
      this.wave += 1;
      this.waveActive = true;
      this.spawnQueue = [];
      this.spawnTimer = .2;
      const globalWave = this.realmIndex * 4 + this.wave;
      if (this.wave === realm.waves) {
        this.announce('SIGNATURE MAJEURE', realm.boss.name, 2.1);
        LF.audio.play('boss');
        this.spawnQueue.push({ type:'boss', delay:1.1 });
        const supportCount = 2 + this.realmIndex * 2;
        for (let i=0;i<supportCount;i++) this.spawnQueue.push({ type:i%2?'crawler':'shooter', delay:.35 });
      } else {
        this.announce(`VAGUE ${globalWave}`, `Royaume ${this.realmIndex+1} · ${this.wave}/${realm.waves}`, 1.35);
        const count = 4 + globalWave * 2 + this.realmIndex;
        for (let i=0;i<count;i++) {
          let type='crawler';
          const roll=Math.random();
          if(globalWave>=2 && roll>.62)type='shooter';
          if(globalWave>=3 && roll>.78)type='brute';
          if(globalWave>=5 && roll>.72)type='splitter';
          if(globalWave>=7 && roll>.86)type='leech';
          this.spawnQueue.push({type,delay:.22+Math.random()*.25});
        }
      }
      this.emitCheckpoint('wave-start');
    }

    update(dt) {
      this.time += dt;
      this.player.fireTimer -= dt;
      this.player.dashCooldown = Math.max(0, this.player.dashCooldown - dt);
      this.player.invuln = Math.max(0, this.player.invuln - dt);
      for (const key of Object.keys(this.player.cooldowns)) this.player.cooldowns[key] = Math.max(0, this.player.cooldowns[key] - dt);
      if (this.player.shieldEnabled) {
        this.player.shieldTimer -= dt;
        if (this.player.shieldTimer <= 0) this.player.shieldReady = true;
      }
      if (this.player.regen > 0 && this.player.hp > 0) this.healPlayer(this.player.regen * dt, false);
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
      this.timeSlowTimer = Math.max(0, this.timeSlowTimer - dt);
      this.fusionAura = Math.max(0, this.fusionAura - dt);
      this.shake = Math.max(0, this.shake - dt * 18);
      this.flash.alpha = Math.max(0, this.flash.alpha - dt * 1.9);
      if (this.announcementTimer > 0) {
        this.announcementTimer -= dt;
        if (this.announcementTimer <= 0 && this.hud.announcement) this.hud.announcement.classList.add('hidden');
      }
      if (this.waveTransition > 0) {
        this.waveTransition -= dt;
        if (this.waveTransition <= 0) this.startWave();
      }
      this.processDelayed(dt);
      this.processSpawns(dt);
      this.updatePlayer(dt);
      this.updateProjectiles(dt);
      this.updateEnemies(dt);
      this.updatePickups(dt);
      this.updateParticles(dt);
      this.updateEffects(dt);
      this.checkWaveClear();
    }

    processDelayed(dt) {
      for (let i=this.delayedActions.length-1;i>=0;i--) {
        const action=this.delayedActions[i];action.time-=dt;
        if(action.time<=0){this.delayedActions.splice(i,1);try{action.fn();}catch(error){console.error(error);}}
      }
    }

    processSpawns(dt) {
      if (!this.spawnQueue.length) return;
      this.spawnTimer -= dt;
      if (this.spawnTimer > 0) return;
      const next = this.spawnQueue.shift();
      if (next.type === 'boss') this.spawnBoss(); else this.spawnEnemy(next.type);
      this.spawnTimer = next.delay || .3;
    }

    movementVector() {
      const left = this.keys.has('KeyA') || this.keys.has('KeyQ') || this.keys.has('ArrowLeft');
      const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
      const up = this.keys.has('KeyW') || this.keys.has('KeyZ') || this.keys.has('ArrowUp');
      const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
      let x=(right?1:0)-(left?1:0)+this.touchVector.x;
      let y=(down?1:0)-(up?1:0)+this.touchVector.y;
      const len=Math.hypot(x,y);
      if(len>1){x/=len;y/=len;}
      return {x,y,len:Math.min(1,len)};
    }

    aimPosition(forceAutoAim = false) {
      if (!forceAutoAim && this.mouse.active && !this.touchBasic) return { x:this.mouse.x, y:this.mouse.y };
      const target=this.nearestEnemy(this.player.x,this.player.y,9999);
      return target?{x:target.x,y:target.y}:{x:this.player.x+100,y:this.player.y};
    }

    updatePlayer(dt) {
      const p=this.player;
      const aim=this.aimPosition();
      p.aimAngle=Math.atan2(aim.y-p.y,aim.x-p.x);
      if(p.dashTimer>0){
        p.dashTimer-=dt;
        p.x+=p.dashDir.x*p.speed*3.5*dt;
        p.y+=p.dashDir.y*p.speed*3.5*dt;
        this.spawnTrail(p.x,p.y,this.child.colors[2],5);
      }else{
        const move=this.movementVector();
        p.x+=move.x*p.speed*dt;
        p.y+=move.y*p.speed*dt;
      }
      p.x=U.clamp(p.x,34,this.width-34);p.y=U.clamp(p.y,52,this.height-34);
      if((this.mouse.down||this.touchBasic||this.keys.has('KeyJ'))&&p.fireTimer<=0)this.basicAttack();
      if(p.auraDamage>0){
        const interval=this.effectLimits.auraInterval;
        this.auraTickTimer+=dt;
        if(this.auraTickTimer>=interval){
          this.auraTickTimer-=interval;
          for(const enemy of this.enemies){
            if(!enemy.dead&&U.distance(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius+42)this.damageEnemy(enemy,p.auraDamage*interval,this.child.element,'aura',false,false,true);
          }
        }
      }else this.auraTickTimer=0;
    }

    basicAttack() {
      const p=this.player;
      p.fireTimer=p.fireRate;
      const aim=this.aimPosition();
      const base=Math.atan2(aim.y-p.y,aim.x-p.x);
      const count=p.projectileCount;
      const spread=.11;
      for(let i=0;i<count;i++){
        const offset=(i-(count-1)/2)*spread;
        const angle=base+offset;
        const isCrit=Math.random()<p.critChance;
        this.spawnPlayerProjectile({
          x:p.x+Math.cos(angle)*p.radius,y:p.y+Math.sin(angle)*p.radius,
          angle,speed:p.projectileSpeed,damage:p.damage*p.damageMult*(this.fusionAura>0?1.22:1)*(isCrit?p.critMult:1),
          radius:5+(this.child.generation||1)*.15,color:LF.ELEMENTS[this.child.element].color,
          element:this.child.element,pierce:p.pierce,isCrit,life:1.55
        });
      }
      this.stats.shots+=count;
      LF.audio.play('shoot');
    }

    dash() {
      const p=this.player;
      if(this.paused||p.dashCooldown>0||p.dashTimer>0)return;
      let move=this.movementVector();
      if(move.len<.1){const aim=this.aimPosition();const a=Math.atan2(aim.y-p.y,aim.x-p.x);move={x:Math.cos(a),y:Math.sin(a)};}
      p.dashDir={x:move.x,y:move.y};p.dashTimer=p.dashDuration;p.dashCooldown=p.dashCooldownBase;p.invuln=p.dashDuration+.12;
      for(let i=0;i<16;i++)this.spawnParticle(p.x,p.y,this.child.colors[2],4+Math.random()*5,Math.random()*TAU,80+Math.random()*130,.4);
      LF.audio.play('dash');
    }

    castAbility(slot,forceAutoAim=false) {
      if(this.paused||this.ended)return;
      const p=this.player;
      if(p.cooldowns[slot]>0)return;
      const ability=slot==='a'?this.child.abilities.parentA:this.child.abilities.parentB;
      p.cooldowns[slot]=p.baseCooldowns[slot]*p.abilityCooldownMult;
      this.castElement(ability.element,1,slot,false,forceAutoAim);
      LF.audio.play('ability');
      if(p.echoChance&&Math.random()<p.echoChance){this.delayedActions.push({time:.55,fn:()=>this.castElement(ability.element,.65,'echo',true,forceAutoAim)});}
    }

    castElement(element,power=1,source='ability',free=false,forceAutoAim=false) {
      const p=this.player, aim=this.aimPosition(forceAutoAim), angle=Math.atan2(aim.y-p.y,aim.x-p.x);
      const color=LF.ELEMENTS[element]?.color||this.child.colors[2];
      const baseDamage=p.damage*p.damageMult*power*(this.fusionAura>0?1.25:1);
      if(element==='fire'){
        for(let i=-3;i<=3;i++){const a=angle+i*.13;this.spawnPlayerProjectile({x:p.x,y:p.y,angle:a,speed:p.projectileSpeed*.82,damage:baseDamage*1.45,radius:7,color,element,pierce:0,isCrit:false,life:1.2,explodeRadius:58*power});}
        this.addEffect('ring',p.x,p.y,25,190,color,.38);
      }else if(element==='shadow'){
        const distance=Math.min(220,U.distance(p.x,p.y,aim.x,aim.y));
        const ox=p.x,oy=p.y;p.x=U.clamp(p.x+Math.cos(angle)*distance,30,this.width-30);p.y=U.clamp(p.y+Math.sin(angle)*distance,45,this.height-30);p.invuln=Math.max(p.invuln,.48);
        this.damageLine(ox,oy,p.x,p.y,34,baseDamage*2.1,element);
        for(let i=0;i<24;i++){const t=i/23;this.spawnParticle(U.lerp(ox,p.x,t),U.lerp(oy,p.y,t),color,4+Math.random()*6,Math.random()*TAU,25+Math.random()*70,.55);}
      }else if(element==='earth'){
        this.damageArea(p.x,p.y,170*power,baseDamage*2.3,element,{stun:1.15,knockback:180});
        this.addEffect('shockwave',p.x,p.y,20,190*power,color,.6);this.shake=Math.max(this.shake,12);
      }else if(element==='electric'){
        const candidates=this.enemies.filter(e=>!e.dead).sort((a,b)=>U.distance(p.x,p.y,a.x,a.y)-U.distance(p.x,p.y,b.x,b.y)).slice(0,Math.round(5+power*2));
        let sx=p.x,sy=p.y;
        for(const enemy of candidates){this.addEffect('bolt',sx,sy,enemy.x,enemy.y,color,.18);this.damageEnemy(enemy,baseDamage*1.7,element,source,Math.random()<p.critChance);sx=enemy.x;sy=enemy.y;}
        if(!candidates.length){for(let i=-2;i<=2;i++){const a=angle+i*.2;this.spawnPlayerProjectile({x:p.x,y:p.y,angle:a,speed:p.projectileSpeed*1.3,damage:baseDamage*1.25,radius:5,color,element,pierce:1,life:1.1});}}
      }else if(element==='ice'){
        this.damageArea(p.x,p.y,230*power,baseDamage*1.15,element,{slow:4,slowFactor:.42});
        for(let i=0;i<16;i++){const a=i/16*TAU;this.spawnPlayerProjectile({x:p.x,y:p.y,angle:a,speed:p.projectileSpeed*.62,damage:baseDamage*.72,radius:5,color,element,pierce:0,life:.9});}
        this.addEffect('ring',p.x,p.y,10,245*power,color,.7);
      }else if(element==='nature'){
        this.damageArea(p.x,p.y,225*power,baseDamage*1.05,element,{root:2.2});
        this.healPlayer(10+this.child.stats.control*1.3,true);
        for(let i=0;i<18;i++)this.spawnParticle(p.x+(Math.random()-.5)*260,p.y+(Math.random()-.5)*180,color,3+Math.random()*5,-Math.PI/2,25+Math.random()*40,1.1);
      }else if(element==='water'){
        for(let i=-4;i<=4;i++){const a=angle+i*.085;this.spawnPlayerProjectile({x:p.x,y:p.y,angle:a,speed:p.projectileSpeed*.72,damage:baseDamage*1.25,radius:11,color,element,pierce:2,life:1.55,knockback:130});}
        this.addEffect('wave',p.x,p.y,angle,260,color,.75);
      }else if(element==='sound'){
        let destroyed=0;
        for(let i=this.enemyProjectiles.length-1;i>=0;i--){const proj=this.enemyProjectiles[i];if(U.distance(p.x,p.y,proj.x,proj.y)<285*power){this.enemyProjectiles.splice(i,1);destroyed++;}}
        this.damageArea(p.x,p.y,260*power,baseDamage*1.35,element,{knockback:260});
        this.addEffect('ring',p.x,p.y,15,285*power,color,.65);
        if(destroyed)this.stats.score+=destroyed*20;
      }else if(element==='spirit'){
        for(let i=0;i<7;i++){const a=i/7*TAU;this.spawnPlayerProjectile({x:p.x+Math.cos(a)*20,y:p.y+Math.sin(a)*20,angle:a,speed:p.projectileSpeed*.52,damage:baseDamage*1.25,radius:8,color,element,pierce:0,life:3.2,homing:.095,lifeSteal:.25});}
      }else if(element==='time'){
        this.timeSlowTimer=Math.max(this.timeSlowTimer,4.5*power);
        this.damageArea(p.x,p.y,320*power,baseDamage*.75,element,{slow:4.5,slowFactor:.28});
        this.addEffect('clock',p.x,p.y,30,320*power,color,1.1);
      }else if(element==='beast'){
        const distance=Math.min(235,U.distance(p.x,p.y,aim.x,aim.y));
        p.x=U.clamp(p.x+Math.cos(angle)*distance,30,this.width-30);p.y=U.clamp(p.y+Math.sin(angle)*distance,45,this.height-30);p.invuln=Math.max(p.invuln,.3);
        this.damageArea(p.x,p.y,105*power,baseDamage*2.65,element,{knockback:160,bleed:4});
        this.addEffect('slash',p.x,p.y,angle,130,color,.36);
      }else if(element==='bio'){
        for(let i=-4;i<=4;i++){const a=angle+i*.16;this.spawnPlayerProjectile({x:p.x,y:p.y,angle:a,speed:p.projectileSpeed*.95,damage:baseDamage*.95,radius:6,color,element,pierce:1,life:1.5,poison:5});}
        this.addEffect('cloud',p.x+Math.cos(angle)*100,p.y+Math.sin(angle)*100,15,140,color,2.8);
      }
      if(!free){this.flash.color=color;this.flash.alpha=Math.max(this.flash.alpha,.08);}
    }

    castFusion(forceAutoAim=false) {
      if(this.paused||this.ended||this.player.cooldowns.fusion>0)return;
      const p=this.player;
      p.cooldowns.fusion=p.baseCooldowns.fusion*p.fusionCooldownMult;
      p.invuln=Math.max(p.invuln,1.25);this.fusionAura=5.5;
      const mult=p.fusionDamageMult||1;
      this.damageArea(p.x,p.y,360,p.damage*p.damageMult*4.1*mult,this.child.element,{knockback:280,stun:.65});
      this.addEffect('fusion',p.x,p.y,30,430,this.child.colors[2],1.3);
      this.castElement(this.child.abilities.parentA.element,1.45*mult,'fusion',true,forceAutoAim);
      this.delayedActions.push({time:.22,fn:()=>this.castElement(this.child.abilities.parentB.element,1.45*mult,'fusion',true,forceAutoAim)});
      if(this.child.thirdElement)this.delayedActions.push({time:.48,fn:()=>this.castElement(this.child.thirdElement,1.25,'fusion',true,forceAutoAim)});
      this.flash.color=this.child.colors[2];this.flash.alpha=.42;this.shake=24;
      LF.audio.play('fusion');
    }

    spawnPlayerProjectile(options) {
      const angle=options.angle||0;
      this.projectiles.push({
        x:options.x,y:options.y,vx:Math.cos(angle)*(options.speed||500),vy:Math.sin(angle)*(options.speed||500),
        radius:options.radius||5,damage:options.damage||10,color:options.color||'#fff',element:options.element||'fire',
        life:options.life||1.5,pierce:options.pierce||0,isCrit:Boolean(options.isCrit),hitIds:new Set(),
        homing:options.homing||0,explodeRadius:options.explodeRadius||0,knockback:options.knockback||0,poison:options.poison||0,
        lifeSteal:options.lifeSteal||0
      });
    }

    updateProjectiles(dt) {
      const slow = this.timeSlowTimer > 0 ? 0.42 : 1;
      for(let i=this.projectiles.length-1;i>=0;i--){
        const p=this.projectiles[i];p.life-=dt;
        if(p.homing){const target=this.nearestEnemy(p.x,p.y,500,e=>!p.hitIds.has(e.id));if(target){const targetAngle=Math.atan2(target.y-p.y,target.x-p.x);const current=Math.atan2(p.vy,p.vx);const a=current+U.wrapAngle(targetAngle-current)*Math.min(1,p.homing*60*dt);const speed=Math.hypot(p.vx,p.vy);p.vx=Math.cos(a)*speed;p.vy=Math.sin(a)*speed;}}
        p.x+=p.vx*dt;p.y+=p.vy*dt;
        if(Math.random()<.6)this.spawnParticle(p.x,p.y,p.color,p.radius*.65,Math.atan2(-p.vy,-p.vx),20+Math.random()*30,.22);
        let removed=false;
        for(const enemy of this.enemies){
          if(enemy.dead||p.hitIds.has(enemy.id))continue;
          if(U.distance(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius){
            p.hitIds.add(enemy.id);this.stats.hits++;
            this.damageEnemy(enemy,p.damage,p.element,'projectile',p.isCrit);
            if(p.knockback)this.knockback(enemy,p.x,p.y,p.knockback);
            if(p.poison)this.applyStatus(enemy,'poison',p.poison,.9+p.damage*.025);
            if(p.lifeSteal)this.healPlayer(p.damage*p.lifeSteal,true);
            if(p.explodeRadius){this.damageArea(p.x,p.y,p.explodeRadius,p.damage*.58,p.element);this.addEffect('ring',p.x,p.y,4,p.explodeRadius,p.color,.32);}
            if(p.pierce>0)p.pierce--;else{this.projectiles.splice(i,1);removed=true;}
            break;
          }
        }
        if(!removed&&(p.life<=0||p.x<-80||p.x>this.width+80||p.y<-80||p.y>this.height+80))this.projectiles.splice(i,1);
      }
      for(let i=this.enemyProjectiles.length-1;i>=0;i--){
        const p=this.enemyProjectiles[i];p.life-=dt;p.x+=p.vx*dt*slow;p.y+=p.vy*dt*slow;
        if(p.homing){const a=Math.atan2(this.player.y-p.y,this.player.x-p.x);const current=Math.atan2(p.vy,p.vx);const next=current+U.wrapAngle(a-current)*Math.min(1,.9*dt);const speed=Math.hypot(p.vx,p.vy);p.vx=Math.cos(next)*speed;p.vy=Math.sin(next)*speed;}
        if(U.distance(p.x,p.y,this.player.x,this.player.y)<p.radius+this.player.radius){
          this.damagePlayer(p.damage,p.source);if(p.leech&&p.source&&!p.source.dead)p.source.hp=Math.min(p.source.maxHp,p.source.hp+p.damage*2);this.enemyProjectiles.splice(i,1);continue;
        }
        if(p.life<=0||p.x<-100||p.x>this.width+100||p.y<-100||p.y>this.height+100)this.enemyProjectiles.splice(i,1);
      }
    }

    spawnEnemy(type='crawler', options={}) {
      const base=LF.ENEMY_ARCHETYPES[type]||LF.ENEMY_ARCHETYPES.crawler;
      const globalWave=this.realmIndex*4+Math.max(1,this.wave);
      const scale=1+(globalWave-1)*.105+(this.child.generation||1)*.018;
      const side=Math.floor(Math.random()*4);let x,y;
      if(side===0){x=-30;y=70+Math.random()*(this.height-120);}else if(side===1){x=this.width+30;y=70+Math.random()*(this.height-120);}else if(side===2){x=50+Math.random()*(this.width-100);y=-30;}else{x=50+Math.random()*(this.width-100);y=this.height+30;}
      const enemy={
        id:U.randomId('enemy'),type,name:base.name,x,y,radius:base.radius*(options.mini?.72:1),
        maxHp:base.hp*scale*(options.mini?.45:1),hp:base.hp*scale*(options.mini?.45:1),speed:base.speed*(1+this.realmIndex*.04),
        damage:base.damage*(1+globalWave*.065),xp:base.xp*(1+this.realmIndex*.12),color:base.color,behavior:base.behavior,
        attackTimer:.5+Math.random()*1.2,contactTimer:0,statuses:{},dead:false,angle:0,phase:Math.random()*TAU,mini:Boolean(options.mini),splitDepth:options.splitDepth||0
      };
      this.enemies.push(enemy);return enemy;
    }

    spawnBoss() {
      const realm=LF.REALMS[this.realmIndex];
      const hp=[920,1450,2250][this.realmIndex]*(1+(this.child.generation||1)*.035);
      const colors=[['#59eeef','#18314b','#ffffff'],['#a8ec4e','#2f421d','#ff875f'],['#ff5d8a','#40172d','#e1b0ff']][this.realmIndex];
      const visuals=[
        {body:'android',head:'visor',hair:'antenna',horns:2,wings:'thrusters',tail:'cable',armor:'tech',aura:'electric'},
        {body:'massive',head:'alien',hair:'tendrils',horns:1,wings:'insect',tail:'tentacle',armor:'carapace',aura:'spores'},
        {body:'regal',head:'masked',hair:'crystal',horns:2,wings:'clock',tail:'ribbon',armor:'ceremonial',aura:'shadow'}
      ];
      const boss={
        id:U.randomId('boss'),type:'boss',bossType:realm.boss.type,name:realm.boss.name,x:this.width/2,y:120,radius:[42,52,46][this.realmIndex],
        maxHp:hp,hp,speed:[58,48,72][this.realmIndex],damage:[18,22,25][this.realmIndex],xp:220+this.realmIndex*120,
        color:colors[0],colors,visual:visuals[this.realmIndex],behavior:'boss',attackTimer:1.6,contactTimer:0,statuses:{},dead:false,angle:0,phase:0,
        model:{id:`boss_${realm.id}`,name:realm.boss.name,colors,visual:visuals[this.realmIndex]},teleportTimer:3.8,summonTimer:5.2
      };
      this.enemies.push(boss);this.boss=boss;
      if(this.hud.bossHud){this.hud.bossHud.classList.remove('hidden');this.hud.bossName.textContent=boss.name;}
      return boss;
    }

    updateEnemies(dt) {
      const timeFactor = this.timeSlowTimer > 0 ? 0.38 : 1;
      for(let i=this.enemies.length-1;i>=0;i--){
        const enemy=this.enemies[i];
        if(enemy.dead){this.enemies.splice(i,1);continue;}
        this.updateStatuses(enemy,dt);
        if(enemy.dead)continue;
        const statusSlow=enemy.statuses.slow?enemy.statuses.slow.factor:1;
        const root=enemy.statuses.root||enemy.statuses.stun;
        const factor=timeFactor*statusSlow*(root?0:1);
        enemy.attackTimer-=dt*timeFactor;enemy.contactTimer=Math.max(0,enemy.contactTimer-dt);enemy.phase+=dt;
        if(enemy.behavior==='boss')this.updateBoss(enemy,dt,factor);
        else this.updateEnemyAI(enemy,dt,factor);
        const d=U.distance(enemy.x,enemy.y,this.player.x,this.player.y);
        if(d<enemy.radius+this.player.radius&&enemy.contactTimer<=0){
          this.damagePlayer(enemy.damage,enemy);enemy.contactTimer=.85;
          const a=Math.atan2(enemy.y-this.player.y,enemy.x-this.player.x);enemy.x+=Math.cos(a)*22;enemy.y+=Math.sin(a)*22;
        }
      }
    }

    updateEnemyAI(enemy,dt,factor) {
      const p=this.player,dx=p.x-enemy.x,dy=p.y-enemy.y,dist=Math.hypot(dx,dy)||1;
      enemy.angle=Math.atan2(dy,dx);
      if(enemy.behavior==='ranged'||enemy.behavior==='leech'){
        let direction=dist>310?1:dist<190?-1:0;
        const strafe=Math.sin(enemy.phase*1.4+enemy.id.length)*.45;
        enemy.x+=(dx/dist*direction + -dy/dist*strafe)*enemy.speed*factor*dt;
        enemy.y+=(dy/dist*direction + dx/dist*strafe)*enemy.speed*factor*dt;
        if(enemy.attackTimer<=0&&dist<520){this.enemyShoot(enemy,enemy.behavior==='leech');enemy.attackTimer=enemy.behavior==='leech'?2.1:1.55+Math.random()*.5;}
      }else{
        enemy.x+=dx/dist*enemy.speed*factor*dt;enemy.y+=dy/dist*enemy.speed*factor*dt;
      }
      enemy.x=U.clamp(enemy.x,-50,this.width+50);enemy.y=U.clamp(enemy.y,-50,this.height+50);
    }

    updateBoss(boss,dt,factor) {
      const p=this.player,dx=p.x-boss.x,dy=p.y-boss.y,dist=Math.hypot(dx,dy)||1;boss.angle=Math.atan2(dy,dx);
      boss.teleportTimer-=dt;boss.summonTimer-=dt;
      if(boss.bossType==='warden'){
        const targetX=this.width/2+Math.sin(this.time*.55)*330,targetY=170+Math.cos(this.time*.7)*70;
        boss.x+=(targetX-boss.x)*dt*.9*factor;boss.y+=(targetY-boss.y)*dt*.9*factor;
        if(boss.attackTimer<=0){
          const count=14;for(let i=0;i<count;i++){const a=i/count*TAU+this.time*.35;this.spawnEnemyProjectile(boss,a,235,boss.damage*.62,'#5debf2');}
          boss.attackTimer=2.25;this.addEffect('ring',boss.x,boss.y,10,150,boss.color,.45);
        }
      }else if(boss.bossType==='maw'){
        if(dist>100){boss.x+=dx/dist*boss.speed*factor*dt;boss.y+=dy/dist*boss.speed*factor*dt;}
        if(boss.attackTimer<=0){
          this.damageAreaEnemy(boss.x,boss.y,150,boss.damage*1.25);this.addEffect('shockwave',boss.x,boss.y,20,180,boss.color,.7);this.shake=16;boss.attackTimer=2.45;
        }
        if(boss.summonTimer<=0){for(let i=0;i<2+this.realmIndex;i++){const minion=this.spawnEnemy(i%2?'splitter':'crawler',{mini:true});minion.x=boss.x+(Math.random()-.5)*80;minion.y=boss.y+(Math.random()-.5)*80;}boss.summonTimer=5.8;}
      }else{
        const targetDist=260;
        const direction=dist>targetDist?1:dist<190?-1:0;
        boss.x+=(dx/dist*direction + -dy/dist*.45)*boss.speed*factor*dt;boss.y+=(dy/dist*direction + dx/dist*.45)*boss.speed*factor*dt;
        if(boss.attackTimer<=0){
          const base=Math.atan2(dy,dx);
          for(let burst=0;burst<3;burst++)this.delayedActions.push({time:burst*.18,fn:()=>{for(let i=-2;i<=2;i++)this.spawnEnemyProjectile(boss,base+i*.16,300,boss.damage*.62,LF.ELEMENTS[this.child.element].color);}});
          boss.attackTimer=2.15;
        }
        if(boss.teleportTimer<=0){
          const old={x:boss.x,y:boss.y};boss.x=100+Math.random()*(this.width-200);boss.y=100+Math.random()*(this.height-200);this.addEffect('line',old.x,old.y,boss.x,boss.y,boss.color,.5);boss.teleportTimer=4.3;
        }
        if(boss.summonTimer<=0){for(let i=0;i<3;i++){const minion=this.spawnEnemy(i===0?'leech':'shooter',{mini:true});minion.x=boss.x+(Math.random()-.5)*100;minion.y=boss.y+(Math.random()-.5)*100;}boss.summonTimer=7.2;}
      }
    }

    enemyShoot(enemy,leech=false) {
      const angle=Math.atan2(this.player.y-enemy.y,this.player.x-enemy.x);
      this.spawnEnemyProjectile(enemy,angle,leech?210:255,enemy.damage,enemy.color,leech);
    }

    spawnEnemyProjectile(source,angle,speed,damage,color,leech=false) {
      this.enemyProjectiles.push({x:source.x,y:source.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,radius:leech?7:5,damage,color,life:4.2,source,leech,homing:leech});
    }

    updateStatuses(enemy,dt) {
      const s=enemy.statuses;
      for(const key of Object.keys(s)){
        s[key].time-=dt;
        if(key==='burn'||key==='poison'||key==='bleed'){
          s[key].tick=(s[key].tick||0)-dt;
          if(s[key].tick<=0){s[key].tick=.42;this.damageEnemy(enemy,s[key].dps*.42,key,'status',false,true);}
        }
        if(s[key].time<=0)delete s[key];
      }
    }

    applyStatus(enemy,type,time,value=1) {
      if(enemy.behavior==='boss')time*=.55;
      if(type==='burn')enemy.statuses.burn={time,dps:value,tick:.2};
      if(type==='poison')enemy.statuses.poison={time,dps:value,tick:.2};
      if(type==='bleed')enemy.statuses.bleed={time,dps:value,tick:.2};
      if(type==='slow')enemy.statuses.slow={time,factor:value};
      if(type==='root')enemy.statuses.root={time};
      if(type==='stun')enemy.statuses.stun={time};
    }

    applyElementStatus(enemy,element,damage) {
      if(element==='fire')this.applyStatus(enemy,'burn',3,Math.max(3,damage*.13));
      if(element==='ice')this.applyStatus(enemy,'slow',2.5,.58);
      if(element==='electric'&&Math.random()<.18)this.applyStatus(enemy,'stun',.42);
      if(element==='nature'&&Math.random()<.25)this.applyStatus(enemy,'root',.7);
      if(element==='water')this.knockback(enemy,this.player.x,this.player.y,55);
      if(element==='sound')this.knockback(enemy,this.player.x,this.player.y,75);
      if(element==='time')this.applyStatus(enemy,'slow',2,.45);
      if(element==='beast')this.applyStatus(enemy,'bleed',3.2,Math.max(2,damage*.1));
      if(element==='bio')this.applyStatus(enemy,'poison',4,Math.max(2,damage*.1));
    }

    damageEnemy(enemy,amount,element='fire',source='unknown',forcedCrit=false,silent=false,quiet=false) {
      if(!enemy||enemy.dead)return;
      const crit=forcedCrit||(!['status','aura'].includes(source)&&Math.random()<this.player.critChance*.15);
      let damage=amount*(crit?this.player.critMult:1);
      if(enemy.behavior==='boss')damage*=.88;
      enemy.hp-=damage;this.stats.damage+=damage;
      this.applyElementStatus(enemy,element,damage);
      if(this.player.lifeSteal>0&&(!silent||quiet))this.healPlayer(damage*this.player.lifeSteal,false);
      if(!quiet)this.addDamageText({x:enemy.x+(Math.random()-.5)*12,y:enemy.y-enemy.radius,value:Math.round(damage),color:crit?'#fff2a8':LF.ELEMENTS[element]?.color||'#fff',life:.65,maxLife:.65,crit});
      if(!silent&&!quiet){for(let i=0;i<(crit?8:3);i++)this.spawnParticle(enemy.x,enemy.y,LF.ELEMENTS[element]?.color||enemy.color,2+Math.random()*4,Math.random()*TAU,50+Math.random()*120,.35);LF.audio.play(crit?'crit':'hit');}
      if(enemy.hp<=0)this.killEnemy(enemy,element);
    }

    killEnemy(enemy,element) {
      if(enemy.dead)return;enemy.dead=true;
      const isBoss=enemy.behavior==='boss';
      this.stats.kills++;this.combo++;this.comboTimer=this.player.comboWindow;this.stats.maxCombo=Math.max(this.stats.maxCombo,this.combo);
      const multiplier=1+Math.floor(this.combo/8)*.25;this.stats.score+=Math.round((isBoss?3000:100+enemy.xp*5)*multiplier);
      this.gainXp(enemy.xp);
      for(let i=0;i<(isBoss?45:12);i++)this.spawnParticle(enemy.x,enemy.y,enemy.color,3+Math.random()*(isBoss?9:5),Math.random()*TAU,50+Math.random()*(isBoss?260:130),.5+Math.random()*.7);
      this.pickups.push({type:'xp',x:enemy.x,y:enemy.y,value:enemy.xp*.45,radius:6,color:'#8c75ff',vx:(Math.random()-.5)*90,vy:(Math.random()-.5)*90,life:12});
      if(Math.random() < (isBoss ? .8 : .085))this.pickups.push({type:'health',x:enemy.x,y:enemy.y,value:isBoss?32:14,radius:8,color:'#68f0a6',vx:(Math.random()-.5)*60,vy:(Math.random()-.5)*60,life:12});
      if(this.player.deathBlast>0)this.damageArea(enemy.x,enemy.y,75,this.player.deathBlast,this.child.element);
      if(enemy.type==='splitter'&&!enemy.mini&&enemy.splitDepth<1){for(let i=0;i<2;i++){const mini=this.spawnEnemy('crawler',{mini:true,splitDepth:1});mini.x=enemy.x+(i?18:-18);mini.y=enemy.y;}}
      if(isBoss){
        this.stats.bosses.push(enemy.name);this.boss=null;if(this.hud.bossHud)this.hud.bossHud.classList.add('hidden');
        this.flash.color=enemy.color;this.flash.alpha=.42;this.shake=25;
      }
      LF.audio.play(isBoss?'level':'kill');
    }

    damagePlayer(amount,source) {
      const p=this.player;
      if(p.invuln>0||p.dashTimer>0)return;
      if(p.phaseChance&&Math.random()<p.phaseChance){p.invuln=.2;this.addEffect('ring',p.x,p.y,10,80,this.child.colors[2],.3);return;}
      if(p.shieldReady){p.shieldReady=false;p.shieldTimer=14;this.addEffect('ring',p.x,p.y,10,90,'#a8eaff',.5);LF.audio.play('ability');return;}
      const reduction=U.clamp(this.child.stats.vitality*.018,0,.24);
      const final=amount*(1-reduction);p.hp-=final;this.stats.damageTaken+=final;p.invuln=.45;
      this.shake=Math.max(this.shake,8);this.flash.color='#ff285c';this.flash.alpha=.18;
      if(this.hud.damageVignette){this.hud.damageVignette.classList.add('active');setTimeout(()=>this.hud.damageVignette?.classList.remove('active'),150);}
      LF.audio.play('hurt');
      if(p.hp<=0){p.hp=0;this.end(false);}
    }

    healPlayer(amount,show=true) {
      if(amount<=0||this.player.hp<=0)return;
      const actual=Math.min(this.player.maxHp-this.player.hp,amount*this.player.healBonus);
      if(actual<=0)return;this.player.hp+=actual;
      if(show){this.addDamageText({x:this.player.x,y:this.player.y-30,value:`+${Math.round(actual)}`,color:'#69f0a7',life:.8,maxLife:.8,crit:false});LF.audio.play('heal');}
    }

    gainXp(amount) {
      const p=this.player;p.xp+=amount;
      while(p.xp>=p.xpNext){
        p.xp-=p.xpNext;p.level++;p.xpNext=Math.round(58+p.level*39);p.maxHp+=8;p.hp=Math.min(p.maxHp,p.hp+18);p.damage*=1.045;
        LF.audio.play('level');
        if(p.level%2===0)this.enqueueUpgrade('level');
      }
    }

    enqueueUpgrade(reason, after=null) {
      this.upgradeQueue.push({reason,after});
      this.openNextUpgrade();
    }

    openNextUpgrade() {
      if(this.upgradeActive||!this.upgradeQueue.length||this.ended)return;
      const item=this.upgradeQueue.shift();this.upgradeActive=true;this.setPaused(true,'upgrade');this.currentUpgrade=item;
      const rng=U.seeded(`${this.child.id}:${this.player.level}:${this.realmIndex}:${this.wave}:${this.stats.kills}`);
      const options=U.shuffle(LF.UPGRADES,rng).slice(0,3);
      this.callbacks.onUpgrade?.(this,{reason:item.reason,options,realm:this.realmIndex,level:this.player.level});
    }

    chooseUpgrade(id) {
      if(!this.upgradeActive)return;
      const upgrade=LF.UPGRADES.find(entry=>entry.id===id);if(upgrade)upgrade.apply(this);
      const after=this.currentUpgrade?.after;this.upgradeActive=false;this.currentUpgrade=null;
      if(typeof after==='function')after();
      if(this.upgradeQueue.length)this.openNextUpgrade();else this.setPaused(false);
    }

    checkWaveClear() {
      if(!this.waveActive||this.spawnQueue.length||this.enemies.some(e=>!e.dead))return;
      this.waveActive=false;
      const realm=LF.REALMS[this.realmIndex];
      if(this.wave>=realm.waves){
        if(this.realmIndex>=LF.REALMS.length-1){this.delayedActions.push({time:1.4,fn:()=>this.end(true)});this.announce('LIGNÉE IMPOSSIBLE', 'Le Progéniteur est vaincu', 2.6);}
        else{
          const next=this.realmIndex+1;
          this.announce('FRACTURE STABILISÉE', `Accès à ${LF.REALMS[next].name}`, 2.1);
          this.delayedActions.push({time:1.7,fn:()=>this.enqueueUpgrade('realm',()=>this.enterRealm(next))});
        }
      }else{
        this.waveTransition=2.2;this.announce('VAGUE ÉLIMINÉE', `Santé restaurée · prochaine menace imminente`, 1.5);this.healPlayer(this.player.maxHp*.065,false);
      }
    }

    updatePickups(dt) {
      const p=this.player;
      for(let i=this.pickups.length-1;i>=0;i--){
        const item=this.pickups[i];item.life-=dt;item.vx*=Math.pow(.05,dt);item.vy*=Math.pow(.05,dt);item.x+=item.vx*dt;item.y+=item.vy*dt;
        const dist=U.distance(item.x,item.y,p.x,p.y);
        if(dist<p.magnet){const a=Math.atan2(p.y-item.y,p.x-item.x);const speed=140+(p.magnet-dist)*5;item.x+=Math.cos(a)*speed*dt;item.y+=Math.sin(a)*speed*dt;}
        if(dist<p.radius+item.radius+8){if(item.type==='xp')this.gainXp(item.value);else this.healPlayer(item.value,true);this.pickups.splice(i,1);continue;}
        if(item.life<=0)this.pickups.splice(i,1);
      }
    }

    damageArea(x,y,radius,damage,element,options={}) {
      for(const enemy of this.enemies){if(enemy.dead)continue;const d=U.distance(x,y,enemy.x,enemy.y);if(d<=radius+enemy.radius){const falloff=.65+.35*(1-d/(radius+enemy.radius));this.damageEnemy(enemy,damage*falloff,element,'area',false);if(options.stun)this.applyStatus(enemy,'stun',options.stun);if(options.slow)this.applyStatus(enemy,'slow',options.slow,options.slowFactor||.5);if(options.root)this.applyStatus(enemy,'root',options.root);if(options.bleed)this.applyStatus(enemy,'bleed',options.bleed,damage*.12);if(options.knockback)this.knockback(enemy,x,y,options.knockback);}}
    }

    damageAreaEnemy(x,y,radius,damage) { if(U.distance(x,y,this.player.x,this.player.y)<radius+this.player.radius)this.damagePlayer(damage,{x,y}); }

    damageLine(x1,y1,x2,y2,width,damage,element) {
      const vx=x2-x1,vy=y2-y1,lenSq=vx*vx+vy*vy||1;
      for(const enemy of this.enemies){if(enemy.dead)continue;const t=U.clamp(((enemy.x-x1)*vx+(enemy.y-y1)*vy)/lenSq,0,1);const px=x1+t*vx,py=y1+t*vy;if(U.distance(px,py,enemy.x,enemy.y)<width+enemy.radius)this.damageEnemy(enemy,damage,element,'line',true);}
    }

    knockback(enemy,x,y,force) { const a=Math.atan2(enemy.y-y,enemy.x-x);enemy.x+=Math.cos(a)*force*.22;enemy.y+=Math.sin(a)*force*.22; }

    nearestEnemy(x,y,maxDistance=Infinity,filter=null) {
      let best=null,bestD=maxDistance;
      for(const enemy of this.enemies){if(enemy.dead||(filter&&!filter(enemy)))continue;const d=U.distance(x,y,enemy.x,enemy.y);if(d<bestD){bestD=d;best=enemy;}}
      return best;
    }

    addDamageText(entry) {
      if(this.damageTexts.length>=this.effectLimits.damageTexts)this.damageTexts.shift();
      this.damageTexts.push(entry);
    }

    spawnParticle(x,y,color,size=4,angle=Math.random()*TAU,speed=70,life=.5) {
      if(this.particles.length>=this.effectLimits.particles)return;
      this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,color,size,life,maxLife:life});
    }
    spawnTrail(x,y,color,size=4) {
      if(this.particles.length>=this.effectLimits.particles)return;
      this.particles.push({x,y,vx:(Math.random()-.5)*20,vy:(Math.random()-.5)*20,color,size,life:.3,maxLife:.3});
    }
    addEffect(type,...args) { this.effects.push({type,args,life:args[args.length-1]||.5,maxLife:args[args.length-1]||.5}); }

    updateParticles(dt) {
      for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.2,dt);p.vy*=Math.pow(.2,dt);if(p.life<=0)this.particles.splice(i,1);}
      for(let i=this.damageTexts.length-1;i>=0;i--){const t=this.damageTexts[i];t.life-=dt;t.y-=32*dt;if(t.life<=0)this.damageTexts.splice(i,1);}
    }
    updateEffects(dt) { for(let i=this.effects.length-1;i>=0;i--){this.effects[i].life-=dt;if(this.effects[i].life<=0)this.effects.splice(i,1);} }

    announce(title,subtitle,duration=1.5) {
      if(!this.hud.announcement)return;
      this.hud.announcement.innerHTML=`<div><strong>${U.escapeHtml(title)}</strong><span>${U.escapeHtml(subtitle)}</span></div>`;
      this.hud.announcement.classList.remove('hidden');this.announcementTimer=duration;
    }

    end(victory) {
      if(this.ended)return;this.ended=true;this.setPaused(true,'end');
      LF.audio.stopMusic();LF.audio.play(victory?'victory':'defeat');
      const baseEssence=(victory?150:24)+this.stats.kills*1.4+this.realmIndex*28+(this.child.generation||1)*8;
      const essence=Math.round(baseEssence*(1+this.legacyRanks.resonance*.05));
      const result={
        victory,score:Math.round(this.stats.score),kills:this.stats.kills,damage:Math.round(this.stats.damage),damageTaken:Math.round(this.stats.damageTaken),
        maxCombo:this.stats.maxCombo,level:this.player.level,time:this.runTime,realm:this.realmIndex,wave:this.wave,bosses:[...this.stats.bosses],essence,
        accuracy:this.stats.shots?U.clamp(Math.round(this.stats.hits/this.stats.shots*100),0,100):0
      };
      this.endTimer=window.setTimeout(()=>{this.endTimer=0;this.callbacks.onEnd?.(result);},victory?1800:900);
    }

    updateHud() {
      const p=this.player,realm=LF.REALMS[this.realmIndex];
      if(this.hud.healthBar)this.hud.healthBar.style.width=`${U.clamp(p.hp/p.maxHp*100,0,100)}%`;
      if(this.hud.healthText)this.hud.healthText.textContent=`${Math.ceil(p.hp)} / ${Math.ceil(p.maxHp)}`;
      if(this.hud.xpBar)this.hud.xpBar.style.width=`${U.clamp(p.xp/p.xpNext*100,0,100)}%`;
      if(this.hud.level)this.hud.level.textContent=`NIV. ${p.level}`;
      if(this.hud.realm)this.hud.realm.textContent=realm.name;
      if(this.hud.wave)this.hud.wave.textContent=`VAGUE ${this.realmIndex*4+Math.max(1,this.wave)} / 12`;
      if(this.hud.objective)this.hud.objective.textContent=this.boss?`ÉLIMINER ${this.boss.name}`:`MENACES RESTANTES : ${this.enemies.filter(e=>!e.dead).length+this.spawnQueue.length}`;
      if(this.hud.score)this.hud.score.textContent=U.formatNumber(this.stats.score);
      if(this.hud.combo)this.hud.combo.textContent=`x${Math.max(1,1+Math.floor(this.combo/8)*.25).toFixed(this.combo>=8?2:0)}`;
      if(this.boss&&this.hud.bossBar)this.hud.bossBar.style.width=`${U.clamp(this.boss.hp/this.boss.maxHp*100,0,100)}%`;
      this.updateAbilityChip('a',p.cooldowns.a,p.baseCooldowns.a*p.abilityCooldownMult);
      this.updateAbilityChip('b',p.cooldowns.b,p.baseCooldowns.b*p.abilityCooldownMult);
      this.updateAbilityChip('fusion',p.cooldowns.fusion,p.baseCooldowns.fusion*p.fusionCooldownMult);
      this.updateAbilityChip('dash',p.dashCooldown,p.dashCooldownBase);
    }

    updateAbilityChip(id,value,max) {
      const chip=this.abilityChips?.[id];if(!chip)return;
      const ratio=max?U.clamp(value/max,0,1):0;const sweep=chip.querySelector('.cooldown-sweep');const text=chip.querySelector('.cooldown-text');
      if(sweep)sweep.style.transform=`scaleY(${ratio})`;if(text)text.textContent=value>.08?value.toFixed(value>2?0:1):'';
    }

    draw() {
      const ctx=this.ctx,realm=LF.REALMS[this.realmIndex];
      ctx.save();
      const shakeX=(Math.random()-.5)*this.shake,shakeY=(Math.random()-.5)*this.shake;ctx.translate(shakeX,shakeY);
      this.drawBackground(ctx,realm);
      this.drawEffects(ctx,true);
      this.drawPickups(ctx);
      this.drawProjectiles(ctx);
      this.drawEnemies(ctx);
      LF.render.drawTopDown(ctx,this.child,this.player.x,this.player.y,this.player.radius,this.player.aimAngle,this.time,{glow:true});
      if(this.player.invuln>0){ctx.strokeStyle=U.alphaColor(this.child.colors[2],.7);ctx.lineWidth=2;ctx.beginPath();ctx.arc(this.player.x,this.player.y,this.player.radius+8+Math.sin(this.time*12)*3,0,TAU);ctx.stroke();}
      if(this.player.shieldReady){ctx.strokeStyle='rgba(150,230,255,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(this.player.x,this.player.y,this.player.radius+13,0,TAU);ctx.stroke();}
      this.drawEffects(ctx,false);
      this.drawParticles(ctx);
      this.drawDamageTexts(ctx);
      ctx.restore();
      if(this.flash.alpha>0){ctx.fillStyle=U.alphaColor(this.flash.color,this.flash.alpha);ctx.fillRect(0,0,this.width,this.height);}
    }

    drawBackground(ctx,realm) {
      const g=ctx.createLinearGradient(0,0,this.width,this.height);g.addColorStop(0,realm.background[0]);g.addColorStop(.55,realm.background[1]);g.addColorStop(1,realm.background[2]);ctx.fillStyle=g;ctx.fillRect(-40,-40,this.width+80,this.height+80);
      ctx.save();ctx.globalAlpha=.14;ctx.strokeStyle=realm.grid;ctx.lineWidth=1;
      const offsetX=(this.time*7)%48,offsetY=(this.time*4)%48;
      for(let x=-48+offsetX;x<this.width+48;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,this.height);ctx.stroke();}
      for(let y=-48+offsetY;y<this.height+48;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(this.width,y);ctx.stroke();}
      ctx.restore();
      const rng=U.seeded(`${this.decorSeed}:${this.realmIndex}`);ctx.save();ctx.globalAlpha=.12;ctx.fillStyle=realm.accent;
      for(let i=0;i<18;i++){const x=rng()*this.width,y=rng()*this.height,size=15+rng()*65;ctx.save();ctx.translate(x,y);ctx.rotate(rng()*TAU+this.time*(rng()-.5)*.08);if(this.realmIndex===0){U.roundRect(ctx,-size/2,-size/2,size,size,8);ctx.fill();}else if(this.realmIndex===1){ctx.beginPath();ctx.arc(0,0,size*.5,0,TAU);ctx.fill();for(let j=0;j<5;j++){ctx.beginPath();ctx.arc(Math.cos(j/5*TAU)*size*.55,Math.sin(j/5*TAU)*size*.55,size*.12,0,TAU);ctx.fill();}}else{ctx.beginPath();for(let j=0;j<6;j++){const a=j/6*TAU;const px=Math.cos(a)*size*.5,py=Math.sin(a)*size*.5;j?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();}ctx.restore();}
      ctx.restore();
      const vignette=ctx.createRadialGradient(this.width/2,this.height/2,this.height*.1,this.width/2,this.height/2,this.width*.72);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.5)');ctx.fillStyle=vignette;ctx.fillRect(0,0,this.width,this.height);
    }

    drawEnemies(ctx) {
      for(const enemy of this.enemies){
        if(enemy.dead)continue;
        if(enemy.behavior==='boss'){
          LF.render.drawTopDown(ctx,enemy.model,enemy.x,enemy.y,enemy.radius,enemy.angle,this.time,{glow:true});
        }else{
          ctx.save();ctx.translate(enemy.x,enemy.y);ctx.rotate(enemy.angle+Math.PI/2);
          const pulse=1+Math.sin(enemy.phase*4)*.035;ctx.scale(pulse,pulse);
          ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(0,enemy.radius*.45,enemy.radius*.85,enemy.radius*.4,0,0,TAU);ctx.fill();
          ctx.fillStyle=U.darken(enemy.color,.5);ctx.strokeStyle=enemy.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,enemy.radius,0,TAU);ctx.fill();ctx.stroke();
          ctx.fillStyle=enemy.color;
          if(enemy.type==='crawler'){for(let i=0;i<4;i++){const side=i%2?1:-1;const y=(Math.floor(i/2)*1.2-.6)*enemy.radius;ctx.fillRect(side*enemy.radius*.6,y,side*enemy.radius*.8,3);}}
          if(enemy.type==='brute'){for(let i=0;i<6;i++){const a=i/6*TAU;ctx.beginPath();ctx.moveTo(Math.cos(a)*enemy.radius*.75,Math.sin(a)*enemy.radius*.75);ctx.lineTo(Math.cos(a)*enemy.radius*1.25,Math.sin(a)*enemy.radius*1.25);ctx.lineTo(Math.cos(a+.18)*enemy.radius*.75,Math.sin(a+.18)*enemy.radius*.75);ctx.fill();}}
          if(enemy.type==='shooter'){ctx.beginPath();ctx.moveTo(0,-enemy.radius*1.35);ctx.lineTo(enemy.radius*.55,-enemy.radius*.2);ctx.lineTo(-enemy.radius*.55,-enemy.radius*.2);ctx.closePath();ctx.fill();}
          if(enemy.type==='splitter'){ctx.strokeStyle=U.lighten(enemy.color,.3);ctx.beginPath();ctx.moveTo(-enemy.radius*.8,-enemy.radius*.8);ctx.lineTo(enemy.radius*.8,enemy.radius*.8);ctx.moveTo(enemy.radius*.8,-enemy.radius*.8);ctx.lineTo(-enemy.radius*.8,enemy.radius*.8);ctx.stroke();}
          if(enemy.type==='leech'){ctx.beginPath();ctx.arc(0,0,enemy.radius*.5,0,TAU);ctx.fill();ctx.strokeStyle=enemy.color;for(let i=0;i<5;i++){const a=i/5*TAU+enemy.phase;ctx.beginPath();ctx.moveTo(Math.cos(a)*enemy.radius*.5,Math.sin(a)*enemy.radius*.5);ctx.lineTo(Math.cos(a)*enemy.radius*1.2,Math.sin(a)*enemy.radius*1.2);ctx.stroke();}}
          ctx.fillStyle='#fff';ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(-enemy.radius*.25,-enemy.radius*.3,enemy.radius*.11,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(enemy.radius*.25,-enemy.radius*.3,enemy.radius*.11,0,TAU);ctx.fill();ctx.restore();
        }
        if(enemy.hp<enemy.maxHp&&enemy.behavior!=='boss'){
          const w=enemy.radius*2.2,x=enemy.x-w/2,y=enemy.y-enemy.radius-10;ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(x,y,w,4);ctx.fillStyle=enemy.color;ctx.fillRect(x,y,w*U.clamp(enemy.hp/enemy.maxHp,0,1),4);
        }
        const statuses=Object.keys(enemy.statuses);if(statuses.length){ctx.fillStyle='#fff';ctx.font='8px sans-serif';ctx.textAlign='center';ctx.fillText(statuses.map(s=>s[0].toUpperCase()).join(' '),enemy.x,enemy.y+enemy.radius+12);}
      }
    }

    drawProjectiles(ctx) {
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(const p of this.projectiles){const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.radius*2.5);g.addColorStop(0,'#fff');g.addColorStop(.25,p.color);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,p.radius*2.5,0,TAU);ctx.fill();}
      for(const p of this.enemyProjectiles){ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();}
      ctx.restore();
    }

    drawPickups(ctx) {
      for(const item of this.pickups){ctx.save();ctx.translate(item.x,item.y);ctx.rotate(this.time*2);ctx.fillStyle=item.color;ctx.shadowColor=item.color;ctx.shadowBlur=12;if(item.type==='xp'){ctx.beginPath();ctx.moveTo(0,-item.radius);ctx.lineTo(item.radius,0);ctx.lineTo(0,item.radius);ctx.lineTo(-item.radius,0);ctx.closePath();ctx.fill();}else{ctx.fillRect(-2,-item.radius,4,item.radius*2);ctx.fillRect(-item.radius,-2,item.radius*2,4);}ctx.restore();}
    }

    drawParticles(ctx) {
      ctx.save();ctx.globalCompositeOperation='lighter';for(const p of this.particles){ctx.globalAlpha=U.clamp(p.life/p.maxLife,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(.35+.65*p.life/p.maxLife),0,TAU);ctx.fill();}ctx.restore();
    }

    drawDamageTexts(ctx) {
      ctx.save();ctx.textAlign='center';for(const t of this.damageTexts){ctx.globalAlpha=U.clamp(t.life/t.maxLife,0,1);ctx.fillStyle=t.color;ctx.font=`${t.crit?'700 18':'600 13'}px Oxanium, sans-serif`;ctx.fillText(String(t.value),t.x,t.y);}ctx.restore();
    }

    drawEffects(ctx,behind) {
      for(const effect of this.effects){
        const progress=1-effect.life/effect.maxLife,a=effect.args;
        const type=effect.type;
        if(behind!==['cloud','clock','fusion'].includes(type))continue;
        ctx.save();ctx.globalAlpha=U.clamp(effect.life/effect.maxLife,0,1);
        if(type==='ring'||type==='shockwave'||type==='fusion'||type==='clock'){
          const [x,y,start,max,color]=a;const r=U.lerp(start,max,progress);ctx.strokeStyle=color;ctx.lineWidth=type==='fusion'?9:3;ctx.globalCompositeOperation='lighter';ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();if(type==='fusion'){ctx.strokeStyle=U.alphaColor('#ffffff',.6);ctx.beginPath();ctx.arc(x,y,r*.74,0,TAU);ctx.stroke();}
          if(type==='clock'){for(let i=0;i<12;i++){const angle=i/12*TAU;ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*r*.86,y+Math.sin(angle)*r*.86);ctx.lineTo(x+Math.cos(angle)*r,y+Math.sin(angle)*r);ctx.stroke();}}
        }else if(type==='bolt'||type==='line'){
          const [x1,y1,x2,y2,color]=a;ctx.strokeStyle=color;ctx.lineWidth=3;ctx.globalCompositeOperation='lighter';ctx.beginPath();ctx.moveTo(x1,y1);const mx=(x1+x2)/2+(Math.random()-.5)*30,my=(y1+y2)/2+(Math.random()-.5)*30;ctx.lineTo(mx,my);ctx.lineTo(x2,y2);ctx.stroke();
        }else if(type==='wave'){
          const [x,y,angle,max,color]=a;ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle=color;ctx.lineWidth=10*(1-progress)+2;ctx.beginPath();ctx.arc(0,0,max*progress,-.65,.65);ctx.stroke();
        }else if(type==='slash'){
          const [x,y,angle,max,color]=a;ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle=color;ctx.lineWidth=8*(1-progress);ctx.beginPath();ctx.arc(0,0,max*.7,-1.2+progress*.5,1.2+progress*.5);ctx.stroke();
        }else if(type==='cloud'){
          const [x,y,start,max,color]=a;const r=U.lerp(start,max,Math.min(1,progress*1.7));ctx.fillStyle=U.alphaColor(color,.14*(1-progress));for(let i=0;i<7;i++){const ang=i/7*TAU+this.time*.15;ctx.beginPath();ctx.arc(x+Math.cos(ang)*r*.38,y+Math.sin(ang)*r*.3,r*.34,0,TAU);ctx.fill();}
        }
        ctx.restore();
      }
    }
  }

  LF.ArenaGame = ArenaGame;
})();
