/* ============================================
   WebKeys — app.js
   Web Audio API Piano + Effects Engine
   Key layout: Web Harmonium style
   ============================================ */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const SCALE_INTERVALS = {
  chromatic:  [0,1,2,3,4,5,6,7,8,9,10,11],
  major:      [0,2,4,5,7,9,11],
  minor:      [0,2,3,5,7,8,10],
  pentatonic: [0,2,4,7,9],
};

/*
  Web-Harmonium keyboard layout:

  NUMBER ROW → black (sharp) keys:
    1=C#  2=D#  4=F#  5=G#  6=A#   (octave 1)
    8=C#  9=D#  -=F#  ==G#          (octave 2)

  QWERTY ROW → white (natural) keys:
    Q=C  W=D  E=E  R=F  T=G  Y=A  U=B   (octave 1)
    I=C  O=D  P=E  [=F  ]=G              (octave 2)
*/

const KEY_NOTE_MAP = {
  // ── Octave 1 white keys ──
  'q': { noteIndex: 0,  octaveOffset: 0, isBlack: false, label: 'Q' },
  'w': { noteIndex: 2,  octaveOffset: 0, isBlack: false, label: 'W' },
  'e': { noteIndex: 4,  octaveOffset: 0, isBlack: false, label: 'E' },
  'r': { noteIndex: 5,  octaveOffset: 0, isBlack: false, label: 'R' },
  't': { noteIndex: 7,  octaveOffset: 0, isBlack: false, label: 'T' },
  'y': { noteIndex: 9,  octaveOffset: 0, isBlack: false, label: 'Y' },
  'u': { noteIndex: 11, octaveOffset: 0, isBlack: false, label: 'U' },
  // ── Octave 2 white keys ──
  'i': { noteIndex: 0,  octaveOffset: 1, isBlack: false, label: 'I' },
  'o': { noteIndex: 2,  octaveOffset: 1, isBlack: false, label: 'O' },
  'p': { noteIndex: 4,  octaveOffset: 1, isBlack: false, label: 'P' },
  '[': { noteIndex: 5,  octaveOffset: 1, isBlack: false, label: '[' },
  ']': { noteIndex: 7,  octaveOffset: 1, isBlack: false, label: ']' },
  // ── Octave 1 black keys ──
  '1': { noteIndex: 1,  octaveOffset: 0, isBlack: true,  label: '1' },
  '2': { noteIndex: 3,  octaveOffset: 0, isBlack: true,  label: '2' },
  '4': { noteIndex: 6,  octaveOffset: 0, isBlack: true,  label: '4' },
  '5': { noteIndex: 8,  octaveOffset: 0, isBlack: true,  label: '5' },
  '6': { noteIndex: 10, octaveOffset: 0, isBlack: true,  label: '6' },
  // ── Octave 2 black keys ──
  '8': { noteIndex: 1,  octaveOffset: 1, isBlack: true,  label: '8' },
  '9': { noteIndex: 3,  octaveOffset: 1, isBlack: true,  label: '9' },
  '-': { noteIndex: 6,  octaveOffset: 1, isBlack: true,  label: '-' },
  '=': { noteIndex: 8,  octaveOffset: 1, isBlack: true,  label: '=' },
};

// Per-instrument oscillator configs
const INSTRUMENT_PRESETS = {
  piano: {
    type: 'triangle',
    attackTime: 0.005,
    decayTime: 0.3,
    sustainLevel: 0.25,
    harmonics: [
      { ratio: 1,    gainMult: 1.0  },
      { ratio: 2,    gainMult: 0.35 },
      { ratio: 3,    gainMult: 0.15 },
      { ratio: 4,    gainMult: 0.08 },
      { ratio: 0.5,  gainMult: 0.05 },
    ],
  },
  organ: {
    type: 'sine',
    attackTime: 0.01,
    decayTime: 0.0,
    sustainLevel: 0.9,
    harmonics: [
      { ratio: 1, gainMult: 1.0  },
      { ratio: 2, gainMult: 0.6  },
      { ratio: 3, gainMult: 0.4  },
      { ratio: 4, gainMult: 0.2  },
      { ratio: 6, gainMult: 0.12 },
      { ratio: 8, gainMult: 0.07 },
    ],
  },
  synth: {
    type: 'sawtooth',
    attackTime: 0.02,
    decayTime: 0.1,
    sustainLevel: 0.7,
    harmonics: [{ ratio: 1, gainMult: 1.0 }],
    filterType: 'lowpass',
    filterFreq: 1800,
    filterQ: 8,
  },
  marimba: {
    type: 'sine',
    attackTime: 0.001,
    decayTime: 0.4,
    sustainLevel: 0.0,
    harmonics: [
      { ratio: 1,   gainMult: 1.0  },
      { ratio: 3.9, gainMult: 0.4  },
      { ratio: 9.9, gainMult: 0.1  },
    ],
  },
};

// ─── State ────────────────────────────────────────────────────────────────────

let audioCtx    = null;
let dryGain     = null;
let wetGain     = null;
let masterGain  = null;
let analyser    = null;

let currentOctave     = 4;
let currentKeyOffset  = 0;
let currentInstrument = 'piano';
let currentScale      = 'chromatic';
let reverbAmount      = 0.20;
let sustainMs         = 800;
let volumeLevel       = 0.80;

const activeNodes = new Map();

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const keyboardWrap  = document.getElementById('keyboard-wrap');
const noteNameEl    = document.getElementById('note-name');
const noteFreqEl    = document.getElementById('note-freq');
const keyDisplay    = document.getElementById('key-display');
const keyBadge      = document.getElementById('current-key-badge');
const octDisplay    = document.getElementById('oct-display');
const reverbSlider  = document.getElementById('reverb-slider');
const reverbValEl   = document.getElementById('reverb-val');
const sustainSlider = document.getElementById('sustain-slider');
const sustainValEl  = document.getElementById('sustain-val');
const volumeSlider  = document.getElementById('volume-slider');
const volumeValEl   = document.getElementById('volume-val');
const vizCanvas     = document.getElementById('vizCanvas');

// ─── Loading overlay ──────────────────────────────────────────────────────────

function showLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-icon">𝄞</div>
    <div class="loading-text">WebKeys</div>
    <div class="loading-sub">Initialising Audio Engine</div>
    <div class="loading-bar-wrap"><div class="loading-bar" id="lbar"></div></div>
  `;
  document.body.prepend(overlay);
  let p = 0;
  const bar = document.getElementById('lbar');
  const iv = setInterval(() => {
    p = Math.min(p + Math.random() * 22, 95);
    bar.style.width = p + '%';
  }, 120);
  setTimeout(() => {
    clearInterval(iv);
    bar.style.width = '100%';
    setTimeout(() => {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.remove(), 600);
    }, 300);
  }, 900);
}

// ─── Audio engine ─────────────────────────────────────────────────────────────

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = volumeLevel;
  masterGain.connect(audioCtx.destination);

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.connect(masterGain);

  dryGain = audioCtx.createGain();
  wetGain = audioCtx.createGain();
  dryGain.gain.value = 1 - reverbAmount;
  wetGain.gain.value = reverbAmount;
  dryGain.connect(analyser);

  buildReverb().then(conv => {
    if (conv) {
      wetGain.connect(conv);
      conv.connect(analyser);
    } else {
      const d1 = audioCtx.createDelay(0.5); d1.delayTime.value = 0.03;
      const d2 = audioCtx.createDelay(0.5); d2.delayTime.value = 0.07;
      const g1 = audioCtx.createGain(); g1.gain.value = 0.4;
      const g2 = audioCtx.createGain(); g2.gain.value = 0.3;
      wetGain.connect(d1); d1.connect(g1); g1.connect(d1);
      d1.connect(d2); d2.connect(g2); g2.connect(d2);
      d2.connect(analyser);
    }
  });

  startVisualizer();
}

async function buildReverb() {
  try {
    const sr = audioCtx.sampleRate;
    const len = sr * 2.5;
    const buf = audioCtx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
    const conv = audioCtx.createConvolver();
    conv.buffer = buf;
    return conv;
  } catch { return null; }
}

function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

function getNoteFreq(noteIndex, octave) {
  const midi = (octave + 1) * 12 + ((noteIndex + currentKeyOffset + 12) % 12);
  return midiToFreq(midi);
}

// ─── Play / Stop ─────────────────────────────────────────────────────────────

function playNote(noteIndex, octave, keyEl) {
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const noteId = `${noteIndex}-${octave}`;
  if (activeNodes.has(noteId)) return;

  const freq   = getNoteFreq(noteIndex, octave);
  const preset = INSTRUMENT_PRESETS[currentInstrument];
  const now    = audioCtx.currentTime;
  const nodes  = [];

  preset.harmonics.forEach(h => {
    const osc     = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = preset.type;
    osc.frequency.value = freq * h.ratio;

    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(
      volumeLevel * h.gainMult * 0.5,
      now + preset.attackTime
    );
    if (preset.decayTime > 0) {
      oscGain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, volumeLevel * h.gainMult * preset.sustainLevel),
        now + preset.attackTime + preset.decayTime
      );
    }

    if (preset.filterType) {
      const f = audioCtx.createBiquadFilter();
      f.type = preset.filterType;
      f.frequency.value = preset.filterFreq;
      f.Q.value = preset.filterQ;
      osc.connect(f); f.connect(oscGain);
    } else {
      osc.connect(oscGain);
    }

    oscGain.connect(dryGain);
    oscGain.connect(wetGain);
    osc.start(now);
    nodes.push({ osc, oscGain });
  });

  activeNodes.set(noteId, nodes);

  const dispIdx = ((noteIndex + currentKeyOffset) % 12 + 12) % 12;
  noteNameEl.textContent = `${NOTE_NAMES[dispIdx]}${octave}`;
  noteFreqEl.textContent = `${freq.toFixed(1)} Hz`;

  if (keyEl) { keyEl.classList.add('active'); spawnRipple(keyEl); }
}

function stopNote(noteIndex, octave, keyEl) {
  const noteId = `${noteIndex}-${octave}`;
  const nodes  = activeNodes.get(noteId);
  if (!nodes) return;

  const rel = sustainMs / 1000;
  const now = audioCtx.currentTime;
  nodes.forEach(({ osc, oscGain }) => {
    oscGain.gain.cancelScheduledValues(now);
    oscGain.gain.setValueAtTime(oscGain.gain.value, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + rel);
    osc.stop(now + rel + 0.05);
  });
  activeNodes.delete(noteId);
  if (keyEl) keyEl.classList.remove('active');
}

function spawnRipple(keyEl) {
  const r    = document.createElement('span');
  r.classList.add('ripple');
  const size = keyEl.classList.contains('key-black') ? 16 : 20;
  r.style.cssText = `width:${size}px;height:${size}px;left:calc(50% - ${size/2}px);top:40%;`;
  keyEl.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ─── Keyboard builder ─────────────────────────────────────────────────────────

const WHITE_NOTES = [
  { noteIndex: 0  },
  { noteIndex: 2  },
  { noteIndex: 4  },
  { noteIndex: 5  },
  { noteIndex: 7  },
  { noteIndex: 9  },
  { noteIndex: 11 },
];

// pos = left offset in white-key-width units
const BLACK_NOTES = [
  { noteIndex: 1,  pos: 0.65 },
  { noteIndex: 3,  pos: 1.65 },
  { noteIndex: 6,  pos: 3.65 },
  { noteIndex: 8,  pos: 4.65 },
  { noteIndex: 10, pos: 5.65 },
];

// Shortcut labels per octave slot
const LABELS = {
  white: [
    ['Q','W','E','R','T','Y','U'],   // octave 0
    ['I','O','P','[',']','',''],      // octave 1 (only 5 mapped)
  ],
  black: [
    ['1','2','4','5','6'],            // octave 0
    ['8','9','-','=',''],             // octave 1
  ],
};

function buildKeyboard() {
  keyboardWrap.innerHTML = '';
  const wkw = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--white-key-w')
  ) || 52;

  [0, 1].forEach(octIdx => {
    const oct = currentOctave + octIdx;
    const wrap = document.createElement('div');
    wrap.className = 'octave-container';
    wrap.style.cssText = `position:relative;display:inline-block;width:${7 * wkw}px;flex-shrink:0;`;

    // White keys
    WHITE_NOTES.forEach(({ noteIndex }, wIdx) => {
      const el = document.createElement('div');
      el.className = 'key-white';
      if (!isNoteInScale(noteIndex)) el.classList.add('scale-inactive');
      const lbl = LABELS.white[octIdx][wIdx] || '';
      const dn  = NOTE_NAMES[((noteIndex + currentKeyOffset) % 12 + 12) % 12];
      el.dataset.noteIndex = noteIndex;
      el.dataset.octave    = oct;
      el.dataset.note      = `${dn}${oct}`;
      if (lbl) el.dataset.shortcut = lbl;
      bindKey(el, noteIndex, oct);
      wrap.appendChild(el);
    });

    // Black keys
    BLACK_NOTES.forEach(({ noteIndex, pos }, bIdx) => {
      const el = document.createElement('div');
      el.className = 'key-black';
      if (!isNoteInScale(noteIndex)) el.classList.add('scale-inactive');
      const lbl = LABELS.black[octIdx][bIdx] || '';
      const dn  = NOTE_NAMES[((noteIndex + currentKeyOffset) % 12 + 12) % 12];
      el.dataset.noteIndex = noteIndex;
      el.dataset.octave    = oct;
      el.dataset.note      = `${dn}${oct}`;
      if (lbl) el.dataset.shortcut = lbl;
      el.style.left = `${pos * wkw}px`;
      bindKey(el, noteIndex, oct);
      wrap.appendChild(el);
    });

    keyboardWrap.appendChild(wrap);
  });
}

function bindKey(el, noteIndex, oct) {
  el.addEventListener('mousedown',  e => { e.preventDefault(); playNote(noteIndex, oct, el); });
  el.addEventListener('mouseup',    e => { e.preventDefault(); stopNote(noteIndex, oct, el); });
  el.addEventListener('mouseleave', e => { if (e.buttons)      stopNote(noteIndex, oct, el); });
  el.addEventListener('touchstart', e => { e.preventDefault(); playNote(noteIndex, oct, el); }, { passive: false });
  el.addEventListener('touchend',   e => { e.preventDefault(); stopNote(noteIndex, oct, el); }, { passive: false });
}

// ─── Scale helpers ────────────────────────────────────────────────────────────

function isNoteInScale(noteIndex) {
  if (currentScale === 'chromatic') return true;
  return SCALE_INTERVALS[currentScale].includes(noteIndex % 12);
}

function applyScaleHighlights() {
  keyboardWrap.querySelectorAll('.key-white,.key-black').forEach(k => {
    const ni = parseInt(k.dataset.noteIndex);
    k.classList.toggle('scale-inactive', !isNoteInScale(ni));
  });
}

// ─── Controls ────────────────────────────────────────────────────────────────

const KEY_LABELS_ARR = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function updateKeyDisplay() {
  const name = KEY_LABELS_ARR[((currentKeyOffset % 12) + 12) % 12];
  const mode = currentScale === 'minor' ? 'Minor'
    : currentScale === 'pentatonic' ? 'Penta' : 'Major';
  keyDisplay.textContent = `${name} ${mode}`;
  keyBadge.textContent   = name;
}

document.getElementById('key-up').addEventListener('click', () => {
  currentKeyOffset = (currentKeyOffset + 1) % 12;
  updateKeyDisplay(); buildKeyboard(); applyScaleHighlights();
});
document.getElementById('key-down').addEventListener('click', () => {
  currentKeyOffset = ((currentKeyOffset - 1) % 12 + 12) % 12;
  updateKeyDisplay(); buildKeyboard(); applyScaleHighlights();
});
document.getElementById('oct-up').addEventListener('click', () => {
  if (currentOctave < 7) { currentOctave++; octDisplay.textContent = currentOctave; buildKeyboard(); }
});
document.getElementById('oct-down').addEventListener('click', () => {
  if (currentOctave > 1) { currentOctave--; octDisplay.textContent = currentOctave; buildKeyboard(); }
});

document.querySelectorAll('#instrument-group .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#instrument-group .pill').forEach(b => {
      b.classList.remove('active'); b.setAttribute('aria-checked','false');
    });
    btn.classList.add('active'); btn.setAttribute('aria-checked','true');
    currentInstrument = btn.dataset.instrument;
  });
});

document.querySelectorAll('#scale-group .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#scale-group .pill').forEach(b => {
      b.classList.remove('active'); b.setAttribute('aria-checked','false');
    });
    btn.classList.add('active'); btn.setAttribute('aria-checked','true');
    currentScale = btn.dataset.scale;
    updateKeyDisplay(); applyScaleHighlights();
  });
});

reverbSlider.addEventListener('input', () => {
  reverbAmount = reverbSlider.value / 100;
  reverbValEl.textContent = `${reverbSlider.value}%`;
  if (dryGain) dryGain.gain.value = 1 - reverbAmount;
  if (wetGain) wetGain.gain.value = reverbAmount;
});
sustainSlider.addEventListener('input', () => {
  sustainMs = parseInt(sustainSlider.value);
  sustainValEl.textContent = `${(sustainMs/1000).toFixed(1)}s`;
});
volumeSlider.addEventListener('input', () => {
  volumeLevel = volumeSlider.value / 100;
  volumeValEl.textContent = `${volumeSlider.value}%`;
  if (masterGain) masterGain.gain.value = volumeLevel;
});

// ─── Keyboard input (Web Harmonium layout) ────────────────────────────────────

const pressedKeys = new Set();

function resolveKey(e) {
  // Preserve special characters that e.key.toLowerCase() would mangle
  if (e.key === '-') return '-';
  if (e.key === '=') return '=';
  if (e.key === '[') return '[';
  if (e.key === ']') return ']';
  return e.key.toLowerCase();
}

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.repeat) return;
  const k = resolveKey(e);
  if (pressedKeys.has(k) || !KEY_NOTE_MAP[k]) return;
  pressedKeys.add(k);
  const { noteIndex, octaveOffset } = KEY_NOTE_MAP[k];
  const oct   = currentOctave + octaveOffset;
  const keyEl = keyboardWrap.querySelector(`[data-note-index="${noteIndex}"][data-octave="${oct}"]`);
  playNote(noteIndex, oct, keyEl);
});

document.addEventListener('keyup', e => {
  const k = resolveKey(e);
  pressedKeys.delete(k);
  const mapping = KEY_NOTE_MAP[k];
  if (!mapping) return;
  const { noteIndex, octaveOffset } = mapping;
  const oct   = currentOctave + octaveOffset;
  const keyEl = keyboardWrap.querySelector(`[data-note-index="${noteIndex}"][data-octave="${oct}"]`);
  stopNote(noteIndex, oct, keyEl);
});

// ─── Visualizer ──────────────────────────────────────────────────────────────

function startVisualizer() {
  const ctx = vizCanvas.getContext('2d');
  function resize() {
    vizCanvas.width  = vizCanvas.offsetWidth;
    vizCanvas.height = vizCanvas.offsetHeight;
  }
  resize();
  new ResizeObserver(resize).observe(vizCanvas);

  function draw() {
    requestAnimationFrame(draw);
    if (!analyser) return;
    const W = vizCanvas.width, H = vizCanvas.height;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(17,17,24,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#d4af64';
    ctx.shadowColor = '#d4af64';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    const sw = W / buf.length;
    buf.forEach((v, i) => {
      const y = (v / 128) * H / 2;
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * sw, y);
    });
    ctx.lineTo(W, H / 2);
    ctx.stroke();
  }
  draw();
}

// ─── Background particles ─────────────────────────────────────────────────────

function initBgParticles() {
  const canvas = document.getElementById('bgCanvas');
  const ctx    = canvas.getContext('2d');
  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  const glyphs = ['♩','♪','♫','𝄞','♭','♯'];
  const pts = Array.from({ length: 55 }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random() - 0.5) * 0.2,
    vy: -(Math.random() * 0.15 + 0.05),
    a: Math.random() * 0.4 + 0.1,
    g: glyphs[Math.floor(Math.random() * glyphs.length)],
  }));

  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,175,100,${p.a * 0.5})`;
      ctx.fill();
      ctx.font = `${Math.floor(p.r * 10 + 8)}px serif`;
      ctx.fillStyle = `rgba(212,175,100,${p.a * 0.22})`;
      ctx.fillText(p.g, p.x, p.y);
      p.x += p.vx; p.y += p.vy; p.a -= 0.0005;
      if (p.y < -20 || p.a <= 0) {
        p.x = Math.random() * canvas.width;
        p.y = canvas.height + 10;
        p.a = Math.random() * 0.4 + 0.1;
        p.vy = -(Math.random() * 0.15 + 0.05);
      }
    });
    requestAnimationFrame(draw);
  })();
}

// ─── Also update hint text in HTML ───────────────────────────────────────────

function updateHintText() {
  const hint = document.querySelector('.keyboard-hint span');
  if (hint) {
    hint.innerHTML = 'White keys: <kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><kbd>R</kbd><kbd>T</kbd><kbd>Y</kbd><kbd>U</kbd> &nbsp;·&nbsp; Black keys: <kbd>1</kbd><kbd>2</kbd><kbd>4</kbd><kbd>5</kbd><kbd>6</kbd> &nbsp;·&nbsp; Next octave: <kbd>I</kbd><kbd>O</kbd><kbd>P</kbd><kbd>[</kbd><kbd>]</kbd> / <kbd>8</kbd><kbd>9</kbd><kbd>-</kbd><kbd>=</kbd>';
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

showLoadingOverlay();
initBgParticles();
buildKeyboard();
updateKeyDisplay();
updateHintText();

document.addEventListener('click',      () => initAudio(), { once: true });
document.addEventListener('keydown',    () => initAudio(), { once: true });
document.addEventListener('touchstart', () => initAudio(), { once: true });
