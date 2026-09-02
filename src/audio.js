(function () {
  const LF = window.LF = window.LF || {};

  class AudioSystem {
    constructor() {
      this.context = null;
      this.master = null;
      this.enabled = true;
      this.paused = false;
      this.unlocked = false;
      this.musicNodes = [];
    }

    init(enabled = true) {
      this.enabled = enabled;
      const unlock = () => this.unlock();
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    }

    unlock() {
      if (!this.context) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.context = new Ctx();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? .16 : 0;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume();
      this.unlocked = true;
    }

    setEnabled(value) {
      this.enabled = Boolean(value);
      this.unlock();
      if (this.master && this.context) this.master.gain.setTargetAtTime(this.enabled ? (this.paused ? .035 : .16) : 0, this.context.currentTime, .02);
      if (!this.enabled) this.stopMusic();
    }

    setPaused(value) {
      this.paused = Boolean(value);
      if(this.master&&this.context&&this.enabled)this.master.gain.setTargetAtTime(this.paused ? .035 : .16,this.context.currentTime,.04);
    }

    tone(frequency, duration = .08, type = 'sine', volume = .3, slide = 0, delay = 0) {
      if (!this.enabled) return;
      this.unlock();
      if (!this.context || !this.master) return;
      const now = this.context.currentTime + delay;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(30, frequency), now);
      if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume), now + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + duration + .02);
    }

    noise(duration = .08, volume = .1, delay = 0) {
      if (!this.enabled) return;
      this.unlock();
      if (!this.context || !this.master) return;
      const rate = this.context.sampleRate;
      const buffer = this.context.createBuffer(1, Math.max(1, Math.floor(rate * duration)), rate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(this.master);
      source.start(this.context.currentTime + delay);
    }

    play(name) {
      if (!this.enabled) return;
      switch (name) {
        case 'hover': this.tone(520, .035, 'sine', .08, 90); break;
        case 'select': this.tone(330, .07, 'triangle', .14, 190); this.tone(660, .08, 'sine', .08, 80, .03); break;
        case 'back': this.tone(300, .09, 'triangle', .1, -100); break;
        case 'forge':
          this.tone(100, .7, 'sawtooth', .16, 340);
          this.tone(220, .5, 'triangle', .13, 660, .15);
          this.noise(.45, .08, .2);
          break;
        case 'shoot': this.tone(240, .035, 'square', .055, 110); break;
        case 'hit': this.tone(120, .045, 'sawtooth', .07, -40); break;
        case 'crit': this.tone(760, .08, 'square', .1, 450); this.noise(.04, .05); break;
        case 'hurt': this.tone(90, .12, 'sawtooth', .16, -35); this.noise(.1, .11); break;
        case 'heal': this.tone(520, .12, 'sine', .1, 260); this.tone(780, .1, 'sine', .08, 160, .07); break;
        case 'dash': this.noise(.08, .08); this.tone(190, .08, 'triangle', .07, 400); break;
        case 'ability': this.tone(180, .2, 'sawtooth', .12, 480); break;
        case 'fusion':
          [110,165,220,330].forEach((f,i) => this.tone(f, .45, 'sawtooth', .12, f * 2.2, i * .035));
          this.noise(.45, .15, .12);
          break;
        case 'kill': this.tone(420, .045, 'triangle', .055, 160); break;
        case 'level': [330,440,660,880].forEach((f,i)=>this.tone(f,.14,'sine',.11,80,i*.07)); break;
        case 'boss': this.tone(65, .8, 'sawtooth', .2, 30); this.noise(.7, .1); break;
        case 'victory': [262,330,392,523,659].forEach((f,i)=>this.tone(f,.42,'triangle',.12,40,i*.11)); break;
        case 'defeat': [220,185,147,110].forEach((f,i)=>this.tone(f,.35,'sawtooth',.11,-30,i*.12)); break;
      }
    }

    startMusic(realmIndex = 0) {
      this.stopMusic();
      if (!this.enabled) return;
      this.unlock();
      if (!this.context || !this.master) return;
      const base = [55, 65, 49][realmIndex] || 55;
      const makeDrone = (ratio, gainValue, type) => {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const filter = this.context.createBiquadFilter();
        osc.type = type;
        osc.frequency.value = base * ratio;
        gain.gain.value = gainValue;
        filter.type = 'lowpass';
        filter.frequency.value = 420 + realmIndex * 100;
        osc.connect(filter); filter.connect(gain); gain.connect(this.master);
        osc.start();
        this.musicNodes.push(osc, gain, filter);
      };
      makeDrone(1, .055, 'sine');
      makeDrone(1.5, .018, 'triangle');
      makeDrone(2.01, .009, 'sawtooth');
    }

    stopMusic() {
      for (const node of this.musicNodes) {
        try { if (typeof node.stop === 'function') node.stop(); } catch {}
        try { node.disconnect(); } catch {}
      }
      this.musicNodes = [];
    }
  }

  LF.audio = new AudioSystem();
})();
