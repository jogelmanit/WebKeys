/* ============================================
   WebKeys — app.js
   Web Audio API Piano  |  Web Harmonium key layout
   ============================================ */
'use strict';

// ─── Music constants ──────────────────────────────────────────────────────────

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const SCALE_INTERVALS = {
  chromatic:  [0,1,2,3,4,5,6,7,8,9,10,11],
  major:      [0,2,4,5,7,9,11],
  minor:      [0,2,3,5,7,8,10],
  pentatonic: [0,2,4,7,9],
};

/*
  Web-Harmonium layout
  QWERTY row = white keys   |   Number row = black keys
  Oct1 whites : Q W E R T Y U
  Oct1 blacks : 1 2 4 5 6
  Oct2 whites : I O P [ ]  (only 5)
  Oct2 blacks : 8 9 - =    (only 4)
*/
const KEY_NOTE_MAP = {
  'q': { noteIndex:0,  octaveOffset:0, isBlack:false, label:'Q' },
  'w': { noteIndex:2,  octaveOffset:0, isBlack:false, label:'W' },
  'e': { noteIndex:4,  octaveOffset:0, isBlack:false, label:'E' },
  'r': { noteIndex:5,  octaveOffset:0, isBlack:false, label:'R' },
  't': { noteIndex:7,  octaveOffset:0, isBlack:false, label:'T' },
  'y': { noteIndex:9,  octaveOffset:0, isBlack:false, label:'Y' },
  'u': { noteIndex:11, octaveOffset:0, isBlack:false, label:'U' },
  'i': { noteIndex:0,  octaveOffset:1, isBlack:false, label:'I' },
  'o': { noteIndex:2,  octaveOffset:1, isBlack:false, label:'O' },
  'p': { noteIndex:4,  octaveOffset:1, isBlack:false, label:'P' },
  '[': { noteIndex:5,  octaveOffset:1, isBlack:false, label:'[' },
  ']': { noteIndex:7,  octaveOffset:1, isBlack:false, label:']' },
  '1': { noteIndex:1,  octaveOffset:0, isBlack:true,  label:'1' },
  '2': { noteIndex:3,  octaveOffset:0, isBlack:true,  label:'2' },
  '4': { noteIndex:6,  octaveOffset:0, isBlack:true,  label:'4' },
  '5': { noteIndex:8,  octaveOffset:0, isBlack:true,  label:'5' },
  '6': { noteIndex:10, octaveOffset:0, isBlack:true,  label:'6' },
  '8': { noteIndex:1,  octaveOffset:1, isBlack:true,  label:'8' },
  '9': { noteIndex:3,  octaveOffset:1, isBlack:true,  label:'9' },
  '-': { noteIndex:6,  octaveOffset:1, isBlack:true,  label:'-' },
  '=': { noteIndex:8,  octaveOffset:1, isBlack:true,  label:'=' },
};

// ─── Instrument presets ───────────────────────────────────────────────────────

const PRESETS = {
  piano: {
    type:'triangle', attack:0.005, decay:0.3, sustain:0.25,
    harmonics:[{r:1,g:1},{r:2,g:.35},{r:3,g:.15},{r:4,g:.08},{r:.5,g:.05}],
  },
  organ: {
    type:'sine', attack:0.01, decay:0, sustain:0.9,
    harmonics:[{r:1,g:1},{r:2,g:.6},{r:3,g:.4},{r:4,g:.2},{r:6,g:.12},{r:8,g:.07}],
  },
  synth: {
    type:'sawtooth', attack:0.02, decay:0.1, sustain:0.7,
    harmonics:[{r:1,g:1}], filter:{type:'lowpass',freq:1800,Q:8},
  },
  harmonium: null, // uses real samples — see HarmoniumSampler
};

// ─── State ────────────────────────────────────────────────────────────────────

let audioCtx=null, dryGain=null, wetGain=null, masterGain=null, analyser=null;
let currentOctave=4, currentKeyOffset=0;
let currentInstrument='piano', currentScale='chromatic';
let reverbAmt=0.2, sustainMs=800, volumeLevel=0.8;
const active = new Map();

// ─── Global pointer tracking (prevents stuck keys) ────────────────────────────
// Tracks which note each mouse/touch is currently holding
const pointerHeld = new Map(); // 'mouse' → {ni, oct, el}
const touchHeld   = new Map(); // touchIdentifier → {ni, oct, el}

function releasePointer(key, map) {
  const held = map.get(key);
  if (held) { stopNote(held.ni, held.oct, held.el); map.delete(key); }
}

// Global mouseup — fires even if mouse released outside a key
document.addEventListener('mouseup', e => {
  if (e.button !== 0) return;
  releasePointer('mouse', pointerHeld);
});

// Global touchend / touchcancel — fires for any touch lift
document.addEventListener('touchend', e => {
  for (const t of e.changedTouches) releasePointer(t.identifier, touchHeld);
}, {passive:true});
document.addEventListener('touchcancel', e => {
  for (const t of e.changedTouches) releasePointer(t.identifier, touchHeld);
}, {passive:true});

// Safety net — stop ALL active notes if window loses focus (e.g. alt-tab)
window.addEventListener('blur', () => {
  pointerHeld.forEach((held, key) => { stopNote(held.ni, held.oct, held.el); });
  touchHeld.forEach((held, key)   => { stopNote(held.ni, held.oct, held.el); });
  pointerHeld.clear();
  touchHeld.clear();
  // Also kill any notes stuck in active map
  active.forEach((nodes, id) => {
    const [ni, oct] = id.split('-').map(Number);
    const el = document.querySelector(`[data-note-index="${ni}"][data-octave="${oct}"]`);
    stopNote(ni, oct, el);
  });
});

// ─── DOM ──────────────────────────────────────────────────────────────────────

const kbWrap      = document.getElementById('keyboard-wrap');
const noteNameEl  = document.getElementById('note-name');
const noteFreqEl  = document.getElementById('note-freq');
const keyDisplay  = document.getElementById('key-display');
const keyBadge    = document.getElementById('current-key-badge');
const octDisplay  = document.getElementById('oct-display');
const vizCanvas   = document.getElementById('vizCanvas');

// ─── Loading overlay ──────────────────────────────────────────────────────────

function showLoader() {
  const ov = document.createElement('div');
  ov.id = 'loading-overlay';
  ov.innerHTML = `<div class="loading-icon">𝄞</div>
    <div class="loading-text">WebKeys</div>
    <div class="loading-sub">Initialising Audio Engine</div>
    <div class="loading-bar-wrap"><div class="loading-bar" id="lbar"></div></div>`;
  document.body.prepend(ov);
  let p=0;
  const bar=document.getElementById('lbar');
  const iv=setInterval(()=>{ p=Math.min(p+Math.random()*22,95); bar.style.width=p+'%'; },120);
  setTimeout(()=>{
    clearInterval(iv); bar.style.width='100%';
    setTimeout(()=>{ ov.classList.add('hidden'); setTimeout(()=>ov.remove(),600); },300);
  },900);
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  masterGain = audioCtx.createGain(); masterGain.gain.value=volumeLevel;
  masterGain.connect(audioCtx.destination);
  analyser = audioCtx.createAnalyser(); analyser.fftSize=1024;
  analyser.connect(masterGain);
  dryGain = audioCtx.createGain(); dryGain.gain.value=1-reverbAmt;
  wetGain = audioCtx.createGain(); wetGain.gain.value=reverbAmt;
  dryGain.connect(analyser);
  buildReverb().then(conv=>{
    if(conv){ wetGain.connect(conv); conv.connect(analyser); }
    else {
      const d=audioCtx.createDelay(.5); d.delayTime.value=.05;
      const g=audioCtx.createGain(); g.gain.value=.35;
      wetGain.connect(d); d.connect(g); g.connect(d); g.connect(analyser);
    }
  });
  startViz();
}

async function buildReverb() {
  try {
    const sr=audioCtx.sampleRate, len=sr*2.5;
    const buf=audioCtx.createBuffer(2,len,sr);
    for(let ch=0;ch<2;ch++){
      const d=buf.getChannelData(ch);
      for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.2);
    }
    const c=audioCtx.createConvolver(); c.buffer=buf; return c;
  } catch { return null; }
}

function midiToHz(m){ return 440*Math.pow(2,(m-69)/12); }
function noteHz(ni,oct){
  return midiToHz((oct+1)*12+((ni+currentKeyOffset+120)%12));
}

function playNote(ni, oct, el) {
  initAudio();
  if(audioCtx.state==='suspended') audioCtx.resume();
  const id=`${ni}-${oct}`;
  if(active.has(id)) return;

  if (currentInstrument === 'harmonium') {
    playHarmonium(ni, oct, el, id);
    return;
  }

  const freq=noteHz(ni,oct);
  const p=PRESETS[currentInstrument], now=audioCtx.currentTime, nodes=[];
  p.harmonics.forEach(h=>{
    const osc=audioCtx.createOscillator();
    const og=audioCtx.createGain();
    osc.type=p.type; osc.frequency.value=freq*h.r;
    og.gain.setValueAtTime(0,now);
    og.gain.linearRampToValueAtTime(volumeLevel*h.g*.5,now+p.attack);
    if(p.decay>0) og.gain.exponentialRampToValueAtTime(
      Math.max(.0001,volumeLevel*h.g*p.sustain),now+p.attack+p.decay);
    if(p.filter){
      const f=audioCtx.createBiquadFilter();
      f.type=p.filter.type; f.frequency.value=p.filter.freq; f.Q.value=p.filter.Q;
      osc.connect(f); f.connect(og);
    } else osc.connect(og);
    og.connect(dryGain); og.connect(wetGain);
    osc.start(now);
    nodes.push({osc,og});
  });
  active.set(id,nodes);
  const dn=NOTE_NAMES[((ni+currentKeyOffset)%12+12)%12];
  noteNameEl.textContent=`${dn}${oct}`;
  noteFreqEl.textContent=`${freq.toFixed(1)} Hz`;
  if(el){ el.classList.add('active'); ripple(el); }
}

// ─── Harmonium Sampler ────────────────────────────────────────────────────────
// Loads real recorded harmonium WAV samples from nbrosowsky/tonejs-instruments
// (MIT licensed, hosted on GitHub Pages) then pitch-shifts them for every note.
// Sample set covers: A1 C2 D#2 F#2 A2 C3 D#3 F#3 A3 C4 D#4 F#4 A4 C5 D#5 F#5 A5
// All other notes are covered by pitch-shifting the nearest sample.

const BASE_URL = 'https://nbrosowsky.github.io/tonejs-instruments/samples/harmonium/';

// Available sample notes (MIDI numbers) and their filenames
const SAMPLE_MAP = {
  33: 'A1.mp3',  36: 'C2.mp3',  39: 'Ds2.mp3', 42: 'Fs2.mp3',
  45: 'A2.mp3',  48: 'C3.mp3',  51: 'Ds3.mp3', 54: 'Fs3.mp3',
  57: 'A3.mp3',  60: 'C4.mp3',  63: 'Ds4.mp3', 66: 'Fs4.mp3',
  69: 'A4.mp3',  72: 'C5.mp3',  75: 'Ds5.mp3', 78: 'Fs5.mp3',
  81: 'A5.mp3',
};
const SAMPLE_MIDIS = Object.keys(SAMPLE_MAP).map(Number).sort((a,b)=>a-b);

// Cache: MIDI number → AudioBuffer
const sampleBuffers = new Map();
let samplesLoaded = false;
let samplesLoading = false;

// Find nearest sample MIDI for a given target MIDI
function nearestSampleMidi(targetMidi) {
  let best = SAMPLE_MIDIS[0];
  let bestDist = Math.abs(targetMidi - best);
  for (const m of SAMPLE_MIDIS) {
    const d = Math.abs(targetMidi - m);
    if (d < bestDist) { bestDist = d; best = m; }
  }
  return best;
}

// Load all samples into AudioBuffers
async function loadHarmoniumSamples() {
  if (samplesLoading || samplesLoaded) return;
  samplesLoading = true;
  const entries = Object.entries(SAMPLE_MAP);
  await Promise.all(entries.map(async ([midi, file]) => {
    try {
      const resp = await fetch(BASE_URL + file);
      const arr  = await resp.arrayBuffer();
      const buf  = await audioCtx.decodeAudioData(arr);
      sampleBuffers.set(Number(midi), buf);
    } catch(e) {
      console.warn('Failed to load sample:', file, e);
    }
  }));
  samplesLoaded = true;
  samplesLoading = false;
  console.log(`Loaded ${sampleBuffers.size}/${entries.length} harmonium samples`);
}

function playHarmonium(ni, oct, el, id) {
  const targetMidi = (oct + 1) * 12 + ((ni + currentKeyOffset + 120) % 12);
  const freq = midiToHz(targetMidi);
  const now  = audioCtx.currentTime;

  // Master note gain — this is what stopNote fades out
  // Store as { osc: null, og: noteGain } so stopNote handles it
  const noteGain = audioCtx.createGain();
  noteGain.gain.setValueAtTime(0, now);
  noteGain.gain.linearRampToValueAtTime(volumeLevel * 0.8, now + 0.06);
  noteGain.connect(dryGain);
  noteGain.connect(wetGain);

  // Warm lowpass — sits before noteGain
  const lpf = audioCtx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 4000;
  lpf.Q.value = 0.5;
  lpf.connect(noteGain);

  if (samplesLoaded && sampleBuffers.size > 0) {
    // ── Real sample playback + pitch shift ────────────────────────────────────
    const sampleMidi  = nearestSampleMidi(targetMidi);
    const buf         = sampleBuffers.get(sampleMidi);
    if (buf) {
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.pow(2, (targetMidi - sampleMidi) / 12);
      src.loop      = true;
      src.loopStart = buf.duration * 0.15;
      src.loopEnd   = buf.duration * 0.95;
      src.connect(lpf);
      src.start(now);

      // IMPORTANT: store src as osc AND noteGain as og
      // stopNote will: fade og.gain → 0  then  osc.stop()
      active.set(id, [{ osc: src, og: noteGain }]);
    } else {
      // Buffer missing for this midi — still register so stopNote can clean up
      active.set(id, [{ osc: null, og: noteGain }]);
    }
  } else {
    // ── Fallback synthesis while samples are loading ───────────────────────────
    const nodes = [];
    [[0, 0.55], [4, 0.30], [-3, 0.28]].forEach(([cents, g]) => {
      const osc = audioCtx.createOscillator();
      const og  = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq * Math.pow(2, cents / 1200);
      og.gain.value = g * 0.4;
      osc.connect(og);
      og.connect(lpf);
      osc.start(now);
      nodes.push({ osc, og });
    });
    // noteGain is the master fade target — add it last with osc:null
    nodes.push({ osc: null, og: noteGain });
    active.set(id, nodes);

    if (!samplesLoading) loadHarmoniumSamples();
  }

  const dn = NOTE_NAMES[((ni + currentKeyOffset) % 12 + 12) % 12];
  noteNameEl.textContent = `${dn}${oct}`;
  noteFreqEl.textContent = `${freq.toFixed(1)} Hz`;
  if (el) { el.classList.add('active'); ripple(el); }
}

function stopNote(ni, oct, el) {
  const id = `${ni}-${oct}`;
  const nodes = active.get(id);
  if (!nodes) return;
  active.delete(id); // delete immediately so re-press works
  if (el) el.classList.remove('active');
  if (!audioCtx) return;

  const rel = sustainMs / 1000;
  const now = audioCtx.currentTime;

  nodes.forEach(({ osc, og }) => {
    // 1. Fade the gain node to silence
    if (og && og.gain) {
      try {
        og.gain.cancelScheduledValues(now);
        og.gain.setValueAtTime(og.gain.value, now);
        og.gain.exponentialRampToValueAtTime(0.0001, now + rel);
      } catch(e) {}
    }
    // 2. Stop the audio source after the fade completes
    if (osc) {
      try { osc.stop(now + rel + 0.05); } catch(e) {}
    }
    // 3. Disconnect after stop to fully release the node (prevents zombie nodes)
    if (og) {
      setTimeout(() => {
        try { og.disconnect(); } catch(e) {}
      }, (rel + 0.1) * 1000);
    }
  });
}

function ripple(el){
  const r=document.createElement('span'); r.className='ripple';
  const s=el.classList.contains('key-black')?16:20;
  r.style.cssText=`width:${s}px;height:${s}px;left:calc(50% - ${s/2}px);top:40%;`;
  el.appendChild(r);
  r.addEventListener('animationend',()=>r.remove());
}

// ─── Keyboard builder ─────────────────────────────────────────────────────────

/*
  Layout per octave (C major):
  White key indices : 0  2  4  5  7  9  11   (7 whites)
  Black key indices : 1  3  6  8  10          (5 blacks)

  Black key LEFT position = (white_index_before * wkw) + wkw - bkw/2
  White index before black:
    C#(1)  → after white[0]=C  → leftEdge = 0*wkw + wkw - bkw/2
    D#(3)  → after white[1]=D  → leftEdge = 1*wkw + wkw - bkw/2
    F#(6)  → after white[3]=F  → leftEdge = 3*wkw + wkw - bkw/2
    G#(8)  → after white[4]=G  → leftEdge = 4*wkw + wkw - bkw/2
    A#(10) → after white[5]=A  → leftEdge = 5*wkw + wkw - bkw/2
*/

// white key order index (0-6) for each noteIndex
const WHITE_ORDER = { 0:0, 2:1, 4:2, 5:3, 7:4, 9:5, 11:6 };
// black key: which white is immediately to its left
const BLACK_AFTER_WHITE = { 1:0, 3:1, 6:3, 8:4, 10:5 };

const WHITE_NOTES = [0,2,4,5,7,9,11];
const BLACK_NOTES = [1,3,6,8,10];

const KB_LABELS = {
  white: [['Q','W','E','R','T','Y','U'],['I','O','P','[',']','','']],
  black: [['1','2','4','5','6'],['8','9','-','=','']],
};

function getCSSVar(name) {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || 0;
}

function buildKeyboard() {
  kbWrap.innerHTML = '';

  const wkw = getCSSVar('--white-key-w') || 52;
  const wkh = getCSSVar('--white-key-h') || 210;
  const bkw = getCSSVar('--black-key-w') || 32;
  const bkh = getCSSVar('--black-key-h') || 130;

  // Total white keys = 7 (oct1) + 5 (oct2, C D E F G) = 12
  const totalWhites = 7 + 5;
  const totalWidth  = totalWhites * wkw;

  // Create the single flat row
  const row = document.createElement('div');
  row.className = 'keys-row';
  row.style.width  = totalWidth + 'px';
  row.style.height = wkh + 'px';

  // ── Render white keys in order ──
  // oct1: C D E F G A B  (7 keys, indices 0–6)
  // oct2: C D E F G      (5 keys, indices 7–11)
  const allWhites = [
    { ni:0,  oct:currentOctave,   kbIdx:0, octIdx:0 },
    { ni:2,  oct:currentOctave,   kbIdx:1, octIdx:0 },
    { ni:4,  oct:currentOctave,   kbIdx:2, octIdx:0 },
    { ni:5,  oct:currentOctave,   kbIdx:3, octIdx:0 },
    { ni:7,  oct:currentOctave,   kbIdx:4, octIdx:0 },
    { ni:9,  oct:currentOctave,   kbIdx:5, octIdx:0 },
    { ni:11, oct:currentOctave,   kbIdx:6, octIdx:0 },
    { ni:0,  oct:currentOctave+1, kbIdx:0, octIdx:1 },
    { ni:2,  oct:currentOctave+1, kbIdx:1, octIdx:1 },
    { ni:4,  oct:currentOctave+1, kbIdx:2, octIdx:1 },
    { ni:5,  oct:currentOctave+1, kbIdx:3, octIdx:1 },
    { ni:7,  oct:currentOctave+1, kbIdx:4, octIdx:1 },
  ];

  allWhites.forEach(({ ni, oct, kbIdx, octIdx }) => {
    const el = document.createElement('div');
    el.className = 'key-white';
    if (!isNoteInScale(ni)) el.classList.add('scale-inactive');
    const lbl = KB_LABELS.white[octIdx][kbIdx] || '';
    const dn  = NOTE_NAMES[((ni + currentKeyOffset) % 12 + 12) % 12];
    el.dataset.noteIndex = ni;
    el.dataset.octave    = oct;
    el.dataset.note      = `${dn}${oct}`;
    if (lbl) el.dataset.shortcut = lbl;
    bindEvents(el, ni, oct);
    row.appendChild(el);
  });

  // ── Render black keys absolutely ──
  // For each octave, calculate absolute left from the start of that octave's white group
  const octaveStartX = [0, 7 * wkw]; // pixel start of oct1 and oct2

  const allBlacks = [
    { ni:1,  oct:currentOctave,   afterWhite:0, octIdx:0, kbIdx:0 },
    { ni:3,  oct:currentOctave,   afterWhite:1, octIdx:0, kbIdx:1 },
    { ni:6,  oct:currentOctave,   afterWhite:3, octIdx:0, kbIdx:2 },
    { ni:8,  oct:currentOctave,   afterWhite:4, octIdx:0, kbIdx:3 },
    { ni:10, oct:currentOctave,   afterWhite:5, octIdx:0, kbIdx:4 },
    { ni:1,  oct:currentOctave+1, afterWhite:0, octIdx:1, kbIdx:0 },
    { ni:3,  oct:currentOctave+1, afterWhite:1, octIdx:1, kbIdx:1 },
    { ni:6,  oct:currentOctave+1, afterWhite:3, octIdx:1, kbIdx:2 },
    { ni:8,  oct:currentOctave+1, afterWhite:4, octIdx:1, kbIdx:3 },
  ];

  allBlacks.forEach(({ ni, oct, afterWhite, octIdx, kbIdx }) => {
    const el = document.createElement('div');
    el.className = 'key-black';
    if (!isNoteInScale(ni)) el.classList.add('scale-inactive');
    const lbl = KB_LABELS.black[octIdx][kbIdx] || '';
    const dn  = NOTE_NAMES[((ni + currentKeyOffset) % 12 + 12) % 12];
    el.dataset.noteIndex = ni;
    el.dataset.octave    = oct;
    el.dataset.note      = `${dn}${oct}`;
    if (lbl) el.dataset.shortcut = lbl;

    // Black key sits between two white keys:
    // left = octaveStart + (afterWhite+1)*wkw - bkw/2
    const leftPx = octaveStartX[octIdx] + (afterWhite + 1) * wkw - Math.round(bkw / 2);
    el.style.left = leftPx + 'px';

    bindEvents(el, ni, oct);
    row.appendChild(el);
  });

  kbWrap.appendChild(row);

  // Update visualizer width to match
  const vizBar = document.querySelector('.visualizer-bar');
  if (vizBar) vizBar.style.width = (totalWidth + 36) + 'px';
}

function bindEvents(el, ni, oct) {
  // mousedown starts the note; global mouseup (on document) stops it
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    playNote(ni, oct, el);
    pointerHeld.set('mouse', { ni, oct, el });
  });

  // Touch: each touch point tracked by identifier
  el.addEventListener('touchstart', e => {
    e.preventDefault();
    playNote(ni, oct, el);
    for (const t of e.changedTouches) {
      touchHeld.set(t.identifier, { ni, oct, el });
    }
  }, {passive:false});
  el.addEventListener('touchend',    e => { e.preventDefault(); stopNote(ni, oct, el); }, {passive:false});
  el.addEventListener('touchcancel', e => { e.preventDefault(); stopNote(ni, oct, el); }, {passive:false});
}

// ─── Scale ────────────────────────────────────────────────────────────────────

function isNoteInScale(ni) {
  if (currentScale==='chromatic') return true;
  return SCALE_INTERVALS[currentScale].includes(ni%12);
}
function applyScale() {
  document.querySelectorAll('.key-white,.key-black').forEach(k=>{
    k.classList.toggle('scale-inactive', !isNoteInScale(+k.dataset.noteIndex));
  });
}

// ─── Controls ─────────────────────────────────────────────────────────────────

const KEY_NAMES_ARR = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function updateKeyDisplay(){
  const n=KEY_NAMES_ARR[((currentKeyOffset%12)+12)%12];
  const m=currentScale==='minor'?'Minor':currentScale==='pentatonic'?'Penta':'Major';
  keyDisplay.textContent=`${n} ${m}`; keyBadge.textContent=n;
}

document.getElementById('key-up').onclick=()=>{
  currentKeyOffset=(currentKeyOffset+1)%12; updateKeyDisplay(); buildKeyboard();
};
document.getElementById('key-down').onclick=()=>{
  currentKeyOffset=((currentKeyOffset-1)%12+12)%12; updateKeyDisplay(); buildKeyboard();
};
document.getElementById('oct-up').onclick=()=>{
  if(currentOctave<7){ currentOctave++; octDisplay.textContent=currentOctave; buildKeyboard(); }
};
document.getElementById('oct-down').onclick=()=>{
  if(currentOctave>1){ currentOctave--; octDisplay.textContent=currentOctave; buildKeyboard(); }
};

document.querySelectorAll('#instrument-group .pill').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('#instrument-group .pill').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-checked','false');});
    b.classList.add('active'); b.setAttribute('aria-checked','true');
    currentInstrument=b.dataset.instrument;
    // Pre-load harmonium samples as soon as instrument is selected
    if (currentInstrument === 'harmonium' && audioCtx && !samplesLoaded) {
      loadHarmoniumSamples();
    }
  };
});
document.querySelectorAll('#scale-group .pill').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('#scale-group .pill').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-checked','false');});
    b.classList.add('active'); b.setAttribute('aria-checked','true');
    currentScale=b.dataset.scale; updateKeyDisplay(); applyScale();
  };
});

const reverbSl=document.getElementById('reverb-slider'), reverbVal=document.getElementById('reverb-val');
reverbSl.oninput=()=>{
  reverbAmt=reverbSl.value/100; reverbVal.textContent=`${reverbSl.value}%`;
  if(dryGain) dryGain.gain.value=1-reverbAmt;
  if(wetGain) wetGain.gain.value=reverbAmt;
};
const sustSl=document.getElementById('sustain-slider'), sustVal=document.getElementById('sustain-val');
sustSl.oninput=()=>{ sustainMs=+sustSl.value; sustVal.textContent=`${(sustainMs/1000).toFixed(1)}s`; };
const volSl=document.getElementById('volume-slider'), volVal=document.getElementById('volume-val');
volSl.oninput=()=>{ volumeLevel=volSl.value/100; volVal.textContent=`${volSl.value}%`; if(masterGain) masterGain.gain.value=volumeLevel; };

// ─── Keyboard input ───────────────────────────────────────────────────────────

const pressed = new Set();
function resolveKey(e){
  if(e.key==='-') return '-';
  if(e.key==='=') return '=';
  if(e.key==='[') return '[';
  if(e.key===']') return ']';
  return e.key.toLowerCase();
}
document.addEventListener('keydown', e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.repeat) return;
  const k=resolveKey(e);
  if(pressed.has(k)||!KEY_NOTE_MAP[k]) return;
  pressed.add(k);
  const {noteIndex:ni,octaveOffset:oo}=KEY_NOTE_MAP[k];
  const oct=currentOctave+oo;
  const el=document.querySelector(`.key-white[data-note-index="${ni}"][data-octave="${oct}"],.key-black[data-note-index="${ni}"][data-octave="${oct}"]`);
  playNote(ni,oct,el);
});
document.addEventListener('keyup', e=>{
  const k=resolveKey(e);
  pressed.delete(k);
  const m=KEY_NOTE_MAP[k]; if(!m) return;
  const oct=currentOctave+m.octaveOffset;
  const el=document.querySelector(`.key-white[data-note-index="${m.noteIndex}"][data-octave="${oct}"],.key-black[data-note-index="${m.noteIndex}"][data-octave="${oct}"]`);
  stopNote(m.noteIndex,oct,el);
});

// ─── Visualizer ──────────────────────────────────────────────────────────────

function startViz(){
  const ctx=vizCanvas.getContext('2d');
  function resize(){ vizCanvas.width=vizCanvas.offsetWidth; vizCanvas.height=vizCanvas.offsetHeight; }
  resize(); new ResizeObserver(resize).observe(vizCanvas);
  (function draw(){
    requestAnimationFrame(draw);
    if(!analyser) return;
    const W=vizCanvas.width,H=vizCanvas.height;
    const buf=new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='rgba(17,17,24,0.6)'; ctx.fillRect(0,0,W,H);
    ctx.lineWidth=2; ctx.strokeStyle='#d4af64';
    ctx.shadowColor='#d4af64'; ctx.shadowBlur=6;
    ctx.beginPath();
    const sw=W/buf.length;
    buf.forEach((v,i)=>{ const y=(v/128)*H/2; i?ctx.lineTo(i*sw,y):ctx.moveTo(0,y); });
    ctx.lineTo(W,H/2); ctx.stroke();
  })();
}

// ─── Background particles ─────────────────────────────────────────────────────

function initParticles(){
  const c=document.getElementById('bgCanvas'), ctx=c.getContext('2d');
  const r=()=>{ c.width=innerWidth; c.height=innerHeight; };
  r(); window.addEventListener('resize',r);
  const G=['♩','♪','♫','𝄞','♭','♯'];
  const pts=Array.from({length:55},()=>({
    x:Math.random()*innerWidth, y:Math.random()*innerHeight,
    r:Math.random()*1.5+.3, vx:(Math.random()-.5)*.2,
    vy:-(Math.random()*.15+.05), a:Math.random()*.4+.1,
    g:G[Math.floor(Math.random()*G.length)],
  }));
  (function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(212,175,100,${p.a*.5})`; ctx.fill();
      ctx.font=`${Math.floor(p.r*10+8)}px serif`;
      ctx.fillStyle=`rgba(212,175,100,${p.a*.22})`; ctx.fillText(p.g,p.x,p.y);
      p.x+=p.vx; p.y+=p.vy; p.a-=.0005;
      if(p.y<-20||p.a<=0){ p.x=Math.random()*c.width; p.y=c.height+10; p.a=Math.random()*.4+.1; p.vy=-(Math.random()*.15+.05); }
    });
    requestAnimationFrame(draw);
  })();
}

// ─── Hint text ────────────────────────────────────────────────────────────────

function updateHint(){
  const h=document.querySelector('.keyboard-hint span');
  if(h) h.innerHTML='White keys: <kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><kbd>R</kbd><kbd>T</kbd><kbd>Y</kbd><kbd>U</kbd> &nbsp;·&nbsp; Black keys: <kbd>1</kbd><kbd>2</kbd><kbd>4</kbd><kbd>5</kbd><kbd>6</kbd> &nbsp;·&nbsp; Next octave: <kbd>I</kbd><kbd>O</kbd><kbd>P</kbd><kbd>[</kbd><kbd>]</kbd> / <kbd>8</kbd><kbd>9</kbd><kbd>-</kbd><kbd>=</kbd>';
}

// ─── Init ────────────────────────────────────────────────────────────────────

showLoader();
initParticles();
buildKeyboard();
updateKeyDisplay();
updateHint();

['click','keydown','touchstart'].forEach(ev=>
  document.addEventListener(ev,()=>{
    initAudio();
    // If harmonium is already selected, start loading samples right away
    if (currentInstrument === 'harmonium' && !samplesLoaded) {
      loadHarmoniumSamples();
    }
  },{once:true})
);

window.addEventListener('resize', buildKeyboard);

// ─── Global safety nets — release ALL stuck notes ────────────────────────────
// If mouse is released anywhere outside a key, stop all active notes
document.addEventListener('mouseup', () => stopAllNotes());

// If window loses focus (alt-tab, etc.) stop everything
window.addEventListener('blur', () => {
  stopAllNotes();
  pressed.clear(); // clear keyboard shortcut state too
});

// Touch: if all fingers lift anywhere on document
document.addEventListener('touchend',    e => { if (e.touches.length === 0) stopAllNotes(); });
document.addEventListener('touchcancel', e => { stopAllNotes(); });

function stopAllNotes() {
  // Collect all active note IDs and stop them
  const ids = [...active.keys()];
  ids.forEach(id => {
    const [ni, oct] = id.split('-').map(Number);
    // Find the key element if it exists
    const el = document.querySelector(
      `[data-note-index="${ni}"][data-octave="${oct}"]`
    );
    stopNote(ni, oct, el);
  });
}
