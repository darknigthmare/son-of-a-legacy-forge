(function () {
  const LF = window.LF = window.LF || {};
  const U = LF.utils = {};

  U.clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.invLerp = (a, b, value) => a === b ? 0 : (value - a) / (b - a);
  U.distance = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  U.wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
  U.randomId = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  U.deepClone = value => JSON.parse(JSON.stringify(value));
  U.escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char]));
  U.formatNumber = value => Math.round(value).toLocaleString('fr-FR');
  U.formatTime = seconds => {
    const total = Math.max(0, Math.round(seconds));
    return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
  };

  U.hashString = str => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < String(str).length; i++) {
      h ^= String(str).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  U.mulberry32 = seed => {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  U.seeded = seedText => U.mulberry32(U.hashString(seedText));
  U.pick = (list, random = Math.random) => list[Math.floor(random() * list.length)];
  U.shuffle = (list, random = Math.random) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  U.weightedPick = (entries, random = Math.random) => {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * total;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) return entry.value;
    }
    return entries[entries.length - 1]?.value;
  };

  U.hexToRgb = hex => {
    let clean = String(hex).replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    const value = parseInt(clean, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  };
  U.rgbToHex = ({ r, g, b }) => `#${[r,g,b].map(v => U.clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('')}`;
  U.mixColor = (a, b, t = .5) => {
    const ca = U.hexToRgb(a), cb = U.hexToRgb(b);
    return U.rgbToHex({ r: U.lerp(ca.r, cb.r, t), g: U.lerp(ca.g, cb.g, t), b: U.lerp(ca.b, cb.b, t) });
  };
  U.alphaColor = (hex, alpha = 1) => {
    const c = U.hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
  };
  U.lighten = (hex, amount = .2) => U.mixColor(hex, '#ffffff', amount);
  U.darken = (hex, amount = .2) => U.mixColor(hex, '#000000', amount);

  U.roundRect = (ctx, x, y, width, height, radius = 10) => {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  };

  U.encodeData = data => {
    const json = JSON.stringify(data);
    return btoa(unescape(encodeURIComponent(json))).replace(/=+$/g, '');
  };
  U.decodeData = encoded => { const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/'); const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4); return JSON.parse(decodeURIComponent(escape(atob(padded)))); };

  U.download = (filename, content, type = 'application/octet-stream') => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  U.copyText = async text => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  };

  U.safeJsonParse = (text, fallback = null) => {
    try { return JSON.parse(text); } catch { return fallback; }
  };
})();
