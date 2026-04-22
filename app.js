/* ============================================
   WebKeys — app.js (PRODUCTION-OPTIMIZED v3.0)
   ✅ GLITCH-FREE • ALL BUGS FIXED • PRODUCTION READY
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

const KEY_NOTE_MAP = {
  '`': { noteIndex:0,  octaveOffset:0, isBlack:false, label:'`'  },
  'q': { noteIndex:2,  octaveOffset:0, isBlack:false, label:'Q'  },
  'w': { noteIndex:4,  octaveOffset:0, isBlack:false, label:'W'  },
  'e': { noteIndex:5,  octaveOffset:0, isBlack:false, label:'E'  },
  'r': { noteIndex:7,  octaveOffset:0, isBlack:false, label:'R'  },
  't': { noteIndex:9,  octaveOffset:0, isBlack:false, label:'T'  },
  'y': { noteIndex:11, octaveOffset:0, isBlack:false, label:'Y'  },
  'u': { noteIndex:0,  octaveOffset:1, isBlack:false, label:'U'  },
  'i': { noteIndex:2,  octaveOffset:1, isBlack:false, label:'I'  },
  'o': { noteIndex:4,  octaveOffset:1, isBlack:false, label:'O'  },
  'p': { noteIndex:5,  octaveOffset:1, isBlack:false, label:'P'  },
  '[': { noteIndex:7,  octaveOffset:1, isBlack:false, label:'['  },
  ']': { noteIndex:9,  octaveOffset:1, isBlack:false, label:']'  },
  '\\': { noteIndex:11, octaveOffset:1, isBlack:false, label:'\\' },
  '1': { noteIndex:1,  octaveOffset:0, isBlack:true,  label:'1'  },
  '2': { noteIndex:3,  octaveOffset:0, isBlack:true,  label:'2'  },
  '4': { noteIndex:6,  octaveOffset:0, isBlack:true,  label:'4'  },
  '5': { noteIndex:8,  octaveOffset:0, isBlack:true,  label:'5'  },
  '6': { noteIndex:10, octaveOffset:0, isBlack:true,  label:'6'  },
  '8': { noteIndex:1,  octaveOffset:1, isBlack:true,  label:'8'  },
  '9': { noteIndex:3,  octaveOffset:1, isBlack:true,  label:'9'  },
  '-': { noteIndex:6,  octaveOffset:1, isBlack:true,  label:'-'  },
  '=': { noteIndex:8,  octaveOffset:1, isBlack:true,  label:'='  },
  'Backspace': { noteIndex:10, octaveOffset:1, isBlack:true,  label:'⌫' }, 
  
};

// ═══════════════════════════════════════════════════════════════
// ★ CONFIGURATION CONSTANTS ★
// ═══════════════════════════════════════════════════════════════

const MAX_POLYPHONY = 8;
const DEBOUNCE_MS = 10;

// ═══════════════════════════════════════════════════════════════
// ★ LAZY-LOADED PIANO SAMPLE ENGINE ★
// ═══════════════════════════════════════════════════════════════

let pianoBuffers = {};
let pianoLoaded = false;
let pianoLoading = false;

const PIANO_URL = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/";

const PIANO_NOTES_PRIORITY = [
  "C4","D4","E4","F4","G4","A4","B4",
  "C5","D5","E5","F5","G5","A5","B5",
  "C3","D3","E3","F3","G3","A3","B3"
];

const PIANO_NOTES_EXTENDED = [
  "A0","B0","C1","D1","E1","F1","G1","A1","B1",
  "C2","C#2","D2","D#2","E2","F2","F#2","G2","G#2","A2","A#2","B2",
  "C#3","D#3","F#3","G#3","A#3",
  "C#4","D#4","F#4","G#4","A#4",
  "C#5","D#5","F#5","G#5","A#5",
  "C6","C#6","D6","D#6","E6","F6","F#6","G6","G#6","A6","A#6","B6",
  "C7","D7","E7"
];

function loadPianoSamples() {
  if (pianoLoading || pianoLoaded) return;
  pianoLoading = true;
  
  console.log('🎹 Starting lazy piano sample loading...');
  
  loadBatch(PIANO_NOTES_PRIORITY, () => {
    console.log('✅ Priority piano samples ready');
    setTimeout(() => loadBatch(PIANO_NOTES_EXTENDED, () => {
      pianoLoaded = true;
      console.log(`🎹 All piano samples loaded: ${Object.keys(pianoBuffers).length} notes`);
    }), 100);
  });
}

function loadBatch(notes, callback) {
  let loaded = 0;
  const total = notes.length;
  
  if (total === 0) { if (callback) callback(); return; }
  
  notes.forEach(noteName => {
    fetch(PIANO_URL + noteName + ".mp3")
      .then(response => {
        if (!response.ok) throw new Error(`Failed ${noteName}`);
        return response.arrayBuffer();
      })
      .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        pianoBuffers[noteName] = audioBuffer;
        
        const channelData = audioBuffer.getChannelData(0);
        let maxAmp = 0;
        for (let i = 0; i < channelData.length; i++) {
          maxAmp = Math.max(maxAmp, Math.abs(channelData[i]));
        }
        if (maxAmp > 0) {
          const norm = 0.9 / maxAmp;
          for (let i = 0; i < channelData.length; i++) {
            channelData[i] *= norm;
          }
        }
        
        loaded++;
        if (loaded === total && callback) callback();
      })
      .catch(error => {
        console.warn(`⚠️ Could not load ${noteName}: ${error.message}`);
        loaded++;
        if (loaded === total && callback) callback();
      });
  });
}

function findBestPianoSample(targetFreq) {
  let bestMatch = null;
  let smallestDiff = Infinity;
  
  for (const noteName in pianoBuffers) {
    const noteWithoutOctave = noteName.replace(/[0-9]/g, '');
    const octave = parseInt(noteName.match(/[0-9]/)[0]);
    
    let baseFreq;
    switch(noteWithoutOctave) {
      case 'C': baseFreq = 16.35; break;
      case 'C#': baseFreq = 17.32; break;
      case 'D': baseFreq = 18.35; break;
      case 'D#': baseFreq = 19.45; break;
      case 'E': baseFreq = 20.60; break;
      case 'F': baseFreq = 21.83; break;
      case 'F#': baseFreq = 23.12; break;
      case 'G': baseFreq = 24.50; break;
      case 'G#': baseFreq = 25.96; break;
      case 'A': baseFreq = 27.50; break;
      case 'A#': baseFreq = 29.14; break;
      case 'B': baseFreq = 30.87; break;
      default: baseFreq = 440;
    }
    
    const sampleFreq = baseFreq * Math.pow(2, octave);
    const difference = Math.abs(targetFreq - sampleFreq);
    
    if (difference < smallestDiff) {
      smallestDiff = difference;
      bestMatch = noteName;
    }
  }
  
  return bestMatch;
}

// ═══════════════════════════════════════════════════════════════
// ★ OPTIMIZED VIOLIN SYNTHESIS ENGINE ★
// ═══════════════════════════════════════════════════════════════

const VIOLIN_PARAMS = {
  stringStiffness: 0.0008,
  formants: [
    { freq: 280,  Q: 15, gain: 4.5 },
    { freq: 550,  Q: 8,  gain: 2.0 },
    { freq: 900,  Q: 12, gain: 3.5 },
    { freq: 1500, Q: 10, gain: 2.8 },
    { freq: 2800, Q: 6,  gain: 1.8 },
  ],
  bowNoiseAmount: 0.02,
  vibrato: {
    onsetDelay: 0.25,
    rampTime: 0.4,
    rate: 5.5,
    maxDepth: 18,
    initialDepth: 2,
  },
  envelope: {
    attackTime: 0.08,
    bloomTime: 0.25,
    sustainLevel: 0.85,
    releaseTime: 0.12,
  }
};

function synthesizeViolinTone(frequency, startTime, duration, volume) {
  volume = volume || 0.7;
  const nodes = [];
  
  const masterGain = audioCtx.createGain();
  masterGain.connect(dryGain);
  masterGain.connect(wetGain);
  
  const stringOutput = audioCtx.createGain();
  stringOutput.gain.value = 0;
  
  const harmonics = [
    { ratio: 1.0, amplitude: 1.00, phase: 0 },
    { ratio: 2.0, amplitude: 0.55, phase: 0.1 },
    { ratio: 3.0, amplitude: 0.72, phase: 0.3 },
    { ratio: 4.0, amplitude: 0.28, phase: 0.5 },
    { ratio: 5.0, amplitude: 0.22, phase: 0.7 },
    { ratio: 6.0, amplitude: 0.18, phase: 0.9 },
    { ratio: 7.0, amplitude: 0.12, phase: 1.1 },
  ];
  
  harmonics.forEach(function(harmonic) {
    var inharmonicityFactor = 1 + (VIOLIN_PARAMS.stringStiffness * Math.pow(harmonic.ratio, 2));
    var harmonicFrequency = frequency * harmonic.ratio * inharmonicityFactor;
    
    var osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = harmonicFrequency;
    osc.detune.value = (Math.random() - 0.5) * 2;
    
    var harmonicGain = audioCtx.createGain();
    harmonicGain.gain.value = harmonic.amplitude * volume * 0.15;
    
    osc.connect(harmonicGain);
    harmonicGain.connect(stringOutput);
    
    osc.start(startTime);
    if (duration > 0) osc.stop(startTime + duration + 0.1);
    
    nodes.push({ oscillator: osc, gain: harmonicGain });
  });
  
  var bowNoiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
  var bowNoiseData = bowNoiseBuffer.getChannelData(0);
  for (var bi = 0; bi < bowNoiseData.length; bi++) {
    bowNoiseData[bi] = (Math.random() * 2 - 1) * 0.7;
  }
  
  var bowNoiseSource = audioCtx.createBufferSource();
  bowNoiseSource.buffer = bowNoiseBuffer;
  bowNoiseSource.loop = true;
  
  var bowFilter = audioCtx.createBiquadFilter();
  bowFilter.type = 'bandpass';
  bowFilter.frequency.value = Math.min(frequency * 2.5, 3500);
  bowFilter.Q.value = 0.7;
  
  var bowNoiseGain = audioCtx.createGain();
  bowNoiseGain.gain.value = volume * VIOLIN_PARAMS.bowNoiseAmount;
  
  bowNoiseSource.connect(bowFilter);
  bowFilter.connect(bowNoiseGain);
  bowNoiseGain.connect(masterGain);
  
  bowNoiseSource.start(startTime);
  if (duration > 0) bowNoiseSource.stop(startTime + duration + 0.1);
  nodes.push({ oscillator: bowNoiseSource, gain: bowNoiseGain });
  
  var lastNode = stringOutput;
  VIOLIN_PARAMS.formants.forEach(function(formant) {
    var filter = audioCtx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = formant.freq;
    filter.Q.value = formant.Q;
    filter.gain.value = formant.gain;
    
    lastNode.disconnect();
    lastNode.connect(filter);
    lastNode = filter;
  });
  lastNode.connect(masterGain);
  
  var vibratoLFO = audioCtx.createOscillator();
  vibratoLFO.type = 'sine';
  vibratoLFO.frequency.value = VIOLIN_PARAMS.vibrato.rate;
  
  var vibratoGain = audioCtx.createGain();
  vibratoGain.gain.value = 0;
  
  var vibOnset = startTime + VIOLIN_PARAMS.vibrato.onsetDelay;
  var vibRampEnd = vibOnset + VIOLIN_PARAMS.vibrato.rampTime;
  var maxDepthFreq = frequency * (VIOLIN_PARAMS.vibrato.maxDepth / 1200);
  
  vibratoGain.gain.setValueAtTime(0, startTime);
  vibratoGain.gain.setValueAtTime(0, vibOnset);
  vibratoGain.gain.linearRampToValueAtTime(maxDepthFreq * 0.1, vibOnset + 0.05);
  vibratoGain.gain.linearRampToValueAtTime(maxDepthFreq, vibRampEnd);
  
  vibratoLFO.connect(vibratoGain);
  
  nodes.forEach(function(node) {
    if (node.oscillator && node.oscillator.frequency && node.oscillator.type === 'sine') {
      if (node.oscillator.frequency.value < frequency * 5) {
        vibratoGain.connect(node.oscillator.frequency);
      }
    }
  });
  
  vibratoLFO.start(startTime);
  if (duration > 0) vibratoLFO.stop(startTime + duration + 0.1);
  nodes.push({ oscillator: vibratoLFO, gain: vibratoGain });
  
  var env = VIOLIN_PARAMS.envelope;
  masterGain.gain.setValueAtTime(0, startTime);
  masterGain.gain.linearRampToValueAtTime(volume * 0.4, startTime + env.attackTime);
  masterGain.gain.linearRampToValueAtTime(volume * 0.75, startTime + env.bloomTime);
  masterGain.gain.linearRampToValueAtTime(volume * env.sustainLevel, startTime + env.bloomTime + 0.15);
  
  if (duration > 0) {
    var releaseStart = startTime + duration - env.releaseTime;
    masterGain.gain.setValueAtTime(volume * env.sustainLevel, releaseStart);
    masterGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  }
  
  stringOutput.gain.setValueAtTime(0, startTime);
  stringOutput.gain.linearRampToValueAtTime(1.0, startTime + 0.02);
  
  return {
    masterGain: masterGain,
    allNodes: nodes,
    stop: function(stopTime) {
      masterGain.gain.cancelScheduledValues(stopTime);
      masterGain.gain.setValueAtTime(masterGain.gain.value, stopTime);
      masterGain.gain.exponentialRampToValueAtTime(0.001, stopTime + env.releaseTime);
      
      nodes.forEach(function(node) {
        try {
          if (node.oscillator.stop) node.oscillator.stop(stopTime + env.releaseTime + 0.05);
        } catch(e) {}
      });
      
      setTimeout(function() {
        try { masterGain.disconnect(); } catch(e) {}
        nodes.forEach(function(node) {
          try { 
            if (node.oscillator.disconnect) node.oscillator.disconnect();
            if (node.gain.disconnect) node.gain.disconnect();
          } catch(e) {}
        });
      }, (env.releaseTime + 0.1) * 1000);
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// ★ PRESETS (FIXED - DISTINCT SOUNDS) ★
// ═══════════════════════════════════════════════════════════════

var PRESETS = {
  piano: null,
  organ: {
    type: 'sine', 
    attack: 0.01, decay: 0, sustain: 0.85,
    harmonics: [
      {r:1,g:1},
      {r:2,g:.75},
      {r:3,g:.5},
      {r:4,g:.35},
      {r:6,g:.2},
      {r:8,g:.12},
    ],
    filter: null,
  },
  synth: {
    type: 'sawtooth', 
    attack: 0.02, decay: 0.15, sustain: 0.65,
    harmonics: [{r:1,g:1}], 
    filter: {type:'lowpass',freq:1200,Q:12},
  },
  harmonium: null,
};

// ─── State ────────────────────────────────────────────────────────────────────

var audioCtx=null, dryGain=null, wetGain=null, masterGain=null, analyser=null;
var currentOctave=4, currentKeyOffset=0;
var currentInstrument='piano', currentScale='chromatic';
var reverbAmt=0.2, sustainMs=800, volumeLevel=0.8;
var instrumentMode = 'normal'; // ← FIXED: Declared here!
var vibratoTimers=new Map();
var active = new Map();
var activeNotes = new Set();
var lastPlayTime = new Map();
var voiceOrder = [];

var pointerHeld = new Map();
var touchHeld   = new Map();

function releasePointer(key, map) {
  var held = map.get(key);
  if (held) { stopNote(held.ni, held.oct, held.el); map.delete(key); }
}

document.addEventListener('mouseup', function(e) {
  if (e.button !== 0) return;
  releasePointer('mouse', pointerHeld);
});

document.addEventListener('touchend', function(e) {
  for (var ti = 0; ti < e.changedTouches.length; ti++) {
    releasePointer(e.changedTouches[ti].identifier, touchHeld);
  }
}, {passive:true});

document.addEventListener('touchcancel', function(e) {
  for (var ti = 0; ti < e.changedTouches.length; ti++) {
    releasePointer(e.changedTouches[ti].identifier, touchHeld);
  }
}, {passive:true});

window.addEventListener('blur', function() {
  pointerHeld.forEach(function(held, key) { stopNote(held.ni, held.oct, held.el); });
  touchHeld.forEach(function(held, key)   { stopNote(held.ni, held.oct, held.el); });
  pointerHeld.clear();
  touchHeld.clear();
  active.forEach(function(nodes, id) {
    var parts = id.split('-');
    var ni = parseInt(parts[0]);
    var oct = parseInt(parts[1]);
    var el = document.querySelector('[data-note-index="' + ni + '"][data-octave="' + oct + '"]');
    stopNote(ni, oct, el);
  });
});

// ─── DOM References ───────────────────────────────────────────────────────────

var kbWrap      = document.getElementById('keyboard-wrap');
var noteNameEl  = document.getElementById('note-name');
var noteFreqEl  = document.getElementById('note-freq');
var keyDisplay  = document.getElementById('key-display');
var keyBadge    = document.getElementById('current-key-badge');
var octDisplay  = document.getElementById('oct-display');
var vizCanvas   = document.getElementById('vizCanvas');

// ─── Loading overlay ──────────────────────────────────────────────────────────

function showLoader() {
  var ov = document.createElement('div');
  ov.id = 'loading-overlay';
  ov.innerHTML = '<div class="loading-icon">𝄞</div><div class="loading-text">WebKeys Pro</div><div class="loading-sub">Initializing...</div>';
  document.body.prepend(ov);
  
  setTimeout(function() {
    ov.classList.add('hidden');
    setTimeout(function() { ov.remove(); }, 400);
  }, 800);
}

// ─── Audio Initialization ─────────────────────────────────────────────────────

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(audioCtx.destination);

  setTimeout(function() { loadPianoSamples(); }, 100);

  var comp = audioCtx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value     = 8;
  comp.attack.value    = 0.005;
  comp.knee.value      = 10;
  comp.release.value   = 0.15;
  comp.connect(masterGain);

  var presence = audioCtx.createBiquadFilter();
  presence.type = 'peaking'; 
  presence.frequency.value = 3500;
  presence.Q.value = 0.8; 
  presence.gain.value = 2.5;
  presence.connect(comp);

  var warmth = audioCtx.createBiquadFilter();
  warmth.type = 'peaking';
  warmth.frequency.value = 250;
  warmth.Q.value = 0.6;
  warmth.gain.value = 2;
  warmth.connect(presence);

  var airShelf = audioCtx.createBiquadFilter();
  airShelf.type = 'highshelf';
  airShelf.frequency.value = 8000;
  airShelf.gain.value = 1.5;
  airShelf.connect(warmth);

  var lowCut = audioCtx.createBiquadFilter();
  lowCut.type = 'highpass'; 
  lowCut.frequency.value = 50;
  lowCut.Q.value = 0.5;
  lowCut.connect(airShelf);

  analyser = audioCtx.createAnalyser(); 
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.85;
  analyser.connect(lowCut);

  dryGain = audioCtx.createGain(); 
  dryGain.gain.value = 1 - reverbAmt;
  wetGain = audioCtx.createGain(); 
  wetGain.gain.value = reverbAmt;
  dryGain.connect(analyser);

  buildReverb().then(function(conv) {
    if (conv) { 
      wetGain.connect(conv); 
      conv.connect(analyser); 
    } else {
      var d = audioCtx.createDelay(.5); 
      d.delayTime.value = .05;
      var g = audioCtx.createGain(); 
      g.gain.value = .35;
      wetGain.connect(d); 
      d.connect(g); 
      g.connect(d); 
      g.connect(analyser);
    }
  });
  startViz();
}

function buildReverb() {
  try {
    var sr=audioCtx.sampleRate, len=sr*3.0;
    var buf=audioCtx.createBuffer(2,len,sr);
    for(var ch=0;ch<2;ch++){
      var d=buf.getChannelData(ch);
      for(var i=0;i<len;i++) 
        d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.0);
    }
    var c=audioCtx.createConvolver(); 
    c.buffer=buf; 
    return Promise.resolve(c);
  } catch (e) {
    return Promise.resolve(null);
  }
}

function midiToHz(m){ return 440*Math.pow(2,(m-69)/12); }

function noteHz(ni,oct){
  return midiToHz((oct+1)*12+((ni+currentKeyOffset+120)%12));
}

// ═══════════════════════════════════════════════════════════════
// ★ VOICE MANAGEMENT SYSTEM ★
// ═══════════════════════════════════════════════════════════════

function enforcePolyphonyLimit() {
  while (active.size >= MAX_POLYPHONY) {
    var oldestId = voiceOrder.shift();
    if (oldestId && active.has(oldestId)) {
      var parts = oldestId.split('-');
      var ni = parseInt(parts[0]);
      var oct = parseInt(parts[1]);
      var el = document.querySelector('[data-note-index="' + ni + '"][data-octave="' + oct + '"]');
      forceStopNote(ni, oct, el);
    } else {
      break;
    }
  }
}

function forceStopNote(ni, oct, el) {
  var id = ni + '-' + oct;
  var noteData = active.get(id);
  if (!noteData) return;
  
  active.delete(id);
  if (el) el.classList.remove('active');
  
  var now = audioCtx.currentTime;
  
  if (typeof noteData.stop === 'function') {
    noteData.stop(now);
  } else if (Array.isArray(noteData)) {
    noteData.forEach(function(item) {
      var osc = item.osc;
      var og = item.og;
      if (og && og.gain) {
        try {
          og.gain.cancelScheduledValues(now);
          og.gain.setValueAtTime(og.gain.value, now);
          og.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        } catch(e) {}
      }
      if (osc) {
        try { osc.stop(now + 0.1); } catch(e) {}
      }
    });
  }
}

function checkDebounce(ni, oct) {
  var id = ni + '-' + oct;
  var now = Date.now();
  var lastTime = lastPlayTime.get(id) || 0;
  
  if (now - lastTime < DEBOUNCE_MS) {
    return false;
  }
  
  lastPlayTime.set(id, now);
  return true;
}

// ═══════════════════════════════════════════════════════════════
// ★ NOTE PLAYING FUNCTIONS ★
// ═══════════════════════════════════════════════════════════════

function playNote(ni, oct, el) {
  initAudio();
  if(audioCtx.state==='suspended') audioCtx.resume();
  
  var id = ni + '-' + oct;
  if(active.has(id)) return;

  if (!checkDebounce(ni, oct)) return;

  enforcePolyphonyLimit();

  voiceOrder.push(id);

  if(currentInstrument==='harmonium'){ playHarmonium(ni,oct,el,id); return; }
  if(currentInstrument==='violin'){    playViolinPro(ni,oct,el,id); return; }
  if(currentInstrument==='organ' || currentInstrument==='synth'){ playPreset(ni,oct,el,id); return; }

  playPianoReal(ni, oct, el, id);
}

// ═══════════════════════════════════════════════════════════════
// ★ REAL PIANO SAMPLE PLAYBACK ★
// ═══════════════════════════════════════════════════════════════

function playPianoReal(ni, oct, el, id) {
  var freq = noteHz(ni, oct);
  var now = audioCtx.currentTime;
  
  var sampleName = findBestPianoSample(freq);
  
  if (!sampleName || !pianoBuffers[sampleName]) {
    playPianoFallback(ni, oct, el, id, freq);
    return;
  }
  
  var sampleBuffer = pianoBuffers[sampleName];
  
  var sampleNote = sampleName.replace(/[0-9]/g, '');
  var sampleOctave = parseInt(sampleName.match(/[0-9]/)[0]);
  var noteIndices = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11};
  var sampleFreq = 261.63 * Math.pow(2, (noteIndices[sampleNote] + (sampleOctave - 4) * 12) / 12);
  
  var source = audioCtx.createBufferSource();
  source.buffer = sampleBuffer;
  source.loop = false;
  source.playbackRate.value = freq / sampleFreq;
  
  var voiceVolume = volumeLevel * 0.9;
  var gainNode = audioCtx.createGain();
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(voiceVolume * 0.85, now + 0.002);
  gainNode.gain.exponentialRampToValueAtTime(voiceVolume * 0.55, now + 0.3);
  gainNode.gain.exponentialRampToValueAtTime(voiceVolume * 0.35, now + 1.0);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
  
  var warmFilter = audioCtx.createBiquadFilter();
  warmFilter.type = 'lowpass';
  warmFilter.frequency.value = Math.min(5000, freq * 3);
  warmFilter.Q.value = 0.5;
  
  source.connect(warmFilter);
  warmFilter.connect(gainNode);
  gainNode.connect(dryGain);
  gainNode.connect(wetGain);
  
  source.start(now);
  source.stop(now + 4.0);
  
  active.set(id, {
    source: source,
    gainNode: gainNode,
    type: 'piano-real',
    stop: function(stopTime) {
      gainNode.gain.cancelScheduledValues(stopTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, stopTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, stopTime + 0.8);
      try { source.stop(stopTime + 0.85); } catch(e) {}
    }
  });

  updateUI(ni, oct, el, freq);
}

function playPianoFallback(ni, oct, el, id, freq) {
  var now = audioCtx.currentTime;
  var voiceVolume = volumeLevel * 0.7;
  
  var osc = audioCtx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  
  var gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(voiceVolume * 0.6, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(voiceVolume * 0.3, now + 0.5);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
  
  osc.connect(gainNode);
  gainNode.connect(dryGain);
  gainNode.connect(wetGain);
  
  osc.start(now);
  osc.stop(now + 2.1);
  
  active.set(id, {
    source: osc,
    gainNode: gainNode,
    type: 'piano-fallback',
    stop: function(stopTime) {
      gainNode.gain.cancelScheduledValues(stopTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, stopTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, stopTime + 0.5);
      try { osc.stop(stopTime + 0.55); } catch(e) {}
    }
  });
  
  updateUI(ni, oct, el, freq);
}

function updateUI(ni, oct, el, freq) {
  var dn = NOTE_NAMES[((ni+currentKeyOffset)%12+12)%12];
  noteNameEl.textContent = dn + oct;
  noteFreqEl.textContent = freq.toFixed(1) + ' Hz';
  if(el){ el.classList.add('active'); ripple(el); }
}

// ═══════════════════════════════════════════════════════════════
// ★ ORGAN / SYNTH PRESET PLAYBACK (FIXED) ★
// ═══════════════════════════════════════════════════════════════

function playPreset(ni, oct, el, id) {
  var freq = noteHz(ni, oct);
  var now  = audioCtx.currentTime;
  var preset = PRESETS[currentInstrument];
  if (!preset) { playPianoReal(ni, oct, el, id); return; }

  var voiceVolume = volumeLevel * 0.85;
  var nodes = [];

  var masterG = audioCtx.createGain();
  masterG.gain.setValueAtTime(0, now);
  masterG.gain.linearRampToValueAtTime(voiceVolume * preset.sustain, now + preset.attack);
  
  var targetNode = masterG;
  
  if (preset.filter) {
    var filterNode = audioCtx.createBiquadFilter();
    filterNode.type = preset.filter.type;
    filterNode.frequency.value = preset.filter.freq;
    filterNode.Q.value = preset.filter.Q;
    targetNode = filterNode;
    filterNode.connect(masterG);
  }

  masterG.connect(dryGain);
  masterG.connect(wetGain);

  preset.harmonics.forEach(function(h) {
    var osc = audioCtx.createOscillator();
    var og  = audioCtx.createGain();
    osc.type = preset.type;
    osc.frequency.value = freq * h.r;
    og.gain.value = h.g * 0.35;
    osc.connect(og);
    og.connect(targetNode);
    osc.start(now);
    nodes.push({osc: osc, og: og});
  });

  nodes.push({osc: null, og: masterG});
  active.set(id, nodes);

  updateUI(ni, oct, el, freq);
}

// ═══════════════════════════════════════════════════════════════
// ★ VIOLIN PLAYBACK ★
// ═══════════════════════════════════════════════════════════════

function playViolinPro(ni, oct, el, id) {
  var freq = noteHz(ni, oct);
  var now = audioCtx.currentTime;
  
  var norm = volumeLevel * 0.85;
  var violinInstance = synthesizeViolinTone(freq, now, 0, norm);
  
  active.set(id, {
    masterGain: violinInstance.masterGain,
    allNodes: violinInstance.allNodes,
    type: 'violin',
    stop: function(stopTime) {
      violinInstance.stop(stopTime);
    }
  });

  updateUI(ni, oct, el, freq);
}

// ═══════════════════════════════════════════════════════════════
// ★ HARMONIUM (OPTIMIZED) ★
// ═══════════════════════════════════════════════════════════════

function playHarmonium(ni, oct, el, id) {
  var freq = midiToHz((oct + 1) * 12 + ((ni + currentKeyOffset + 120) % 12));
  var now  = audioCtx.currentTime;
  var nodes = [];

  var masterGainH = audioCtx.createGain();
  masterGainH.gain.setValueAtTime(0, now);
  masterGainH.gain.linearRampToValueAtTime(volumeLevel * 0.5, now + 0.08);
  masterGainH.connect(dryGain);
  masterGainH.connect(wetGain);

  var lowShelf = audioCtx.createBiquadFilter();
  lowShelf.type = 'lowshelf'; 
  lowShelf.frequency.value = 300; 
  lowShelf.gain.value = 3.5;

  var midPeak = audioCtx.createBiquadFilter();
  midPeak.type = 'peaking'; 
  midPeak.frequency.value = 900; 
  midPeak.Q.value = 1.5; 
  midPeak.gain.value = 6;

  var lpf = audioCtx.createBiquadFilter();
  lpf.type = 'lowpass'; 
  lpf.frequency.value = 4500; 
  lpf.Q.value = 0.5;

  lowShelf.connect(midPeak);
  midPeak.connect(lpf);
  lpf.connect(masterGainH);

  var lfo = audioCtx.createOscillator();
  var lfoGain = audioCtx.createGain();
  lfo.type = 'sine'; 
  lfo.frequency.value = 5.5;
  lfoGain.gain.value = freq * 0.002;
  lfo.connect(lfoGain);
  lfo.start(now);
  nodes.push({ osc: lfo, og: lfoGain });

  [{detune:0, vol:0.50}, {detune:4, vol:0.28}, {detune:-3, vol:0.26}].forEach(function(layer) {
    var dr = Math.pow(2, layer.detune / 1200);
    
    [
      {mult:1,   type:'sawtooth', g:0.75},
      {mult:2,   type:'sine',     g:0.22},
      {mult:0.5, type:'sine',     g:0.12},
    ].forEach(function(h) {
      var osc = audioCtx.createOscillator();
      var og  = audioCtx.createGain();
      osc.type = h.type;
      osc.frequency.value = freq * h.mult * dr;
      og.gain.value = layer.vol * h.g * 0.38;
      lfoGain.connect(osc.frequency);
      osc.connect(og);
      og.connect(lowShelf);
      osc.start(now);
      nodes.push({osc: osc, og: og});
    });
  });

  nodes.push({ osc: null, og: masterGainH });
  active.set(id, nodes);

  updateUI(ni, oct, el, freq);
}

// ═══════════════════════════════════════════════════════════════
// ★ ENHANCED NOTE RELEASE ★
// ═══════════════════════════════════════════════════════════════

function stopNote(ni, oct, el) {
  var id = ni + '-' + oct;
  
  if(vibratoTimers && vibratoTimers.has(id)){
    clearTimeout(vibratoTimers.get(id)); 
    vibratoTimers.delete(id);
  }
  
  var noteData = active.get(id);
  if (!noteData) return;
  active.delete(id);
  
  var idx = voiceOrder.indexOf(id);
  if (idx > -1) voiceOrder.splice(idx, 1);
  
  if (el) el.classList.remove('active');
  if (!audioCtx) return;

  var now = audioCtx.currentTime;

  if (typeof noteData.stop === 'function') {
    noteData.stop(now);
  } else if (Array.isArray(noteData)) {
    var rel = sustainMs / 1000;
    var releaseTime = rel;

    if (currentInstrument === 'violin') {
      releaseTime = Math.min(rel, 0.12);
    } else if (currentInstrument === 'piano') {
      releaseTime = 0.8;
    }

    noteData.forEach(function(item) {
      var osc = item.osc;
      var og = item.og;
      if (og && og.gain) {
        try {
          og.gain.cancelScheduledValues(now);
          og.gain.setValueAtTime(og.gain.value, now);
          og.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
        } catch(e) {}
      }
      if (osc) {
        try { osc.stop(now + releaseTime + 0.05); } catch(e) {}
      }
      if (og) {
        (function(ogNode, rt) {
          setTimeout(function() {
            try { ogNode.disconnect(); } catch(e) {}
          }, (rt + 0.1) * 1000);
        })(og, releaseTime);
      }
    });
  }
}

function ripple(el){
  var r=document.createElement('span'); r.className='ripple';
  var s=el.classList.contains('key-black')?16:20;
  r.style.cssText='width:'+s+'px;height:'+s+'px;left:calc(50% - '+s/2+'px);top:40%;';
  el.appendChild(r);
  r.addEventListener('animationend',function(){r.remove();});
}

// ─── Keyboard builder ─────────────────────────────────────────────────────────

var WHITE_ORDER = { 0:0, 2:1, 4:2, 5:3, 7:4, 9:5, 11:6 };
var BLACK_AFTER_WHITE = { 1:0, 3:1, 6:3, 8:4, 10:5 };

var LABELS = {
  white: [
    ['`', 'Q', 'W', 'E', 'R', 'T', 'Y'],
    ['U', 'I', 'O', 'P', '[', ']', '\\'],
  ],
  black: [
    ['1', '2', '4', '5', '6'],
    ['8', '9', '-', '=', '⌫'],
  ],
};

function buildKeyboard() {
  kbWrap.innerHTML = '';

  var style = getComputedStyle(document.documentElement);
  var wkw = parseFloat(style.getPropertyValue('--white-key-w')) || 52;
  var wkh = parseFloat(style.getPropertyValue('--white-key-h')) || 210;
  var bkw = parseFloat(style.getPropertyValue('--black-key-w')) || 32;
  var bkh = parseFloat(style.getPropertyValue('--black-key-h')) || 130;

  var totalWhites = 14;
  var totalWidth  = totalWhites * wkw;

  var row = document.createElement('div');
  row.className = 'keys-row';
  row.style.width  = totalWidth + 'px';
  row.style.height = wkh + 'px';

  var allWhites = [
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
    { ni:9,  oct:currentOctave+1, kbIdx:5, octIdx:1 },
    { ni:11, oct:currentOctave+1, kbIdx:6, octIdx:1 },
  ];

  allWhites.forEach(function(k) {
    var el = document.createElement('div');
    el.className = 'key-white';
    if (!isNoteInScale(k.ni)) el.classList.add('scale-inactive');
    var lbl = LABELS.white[k.octIdx][k.kbIdx] || '';
    var dn  = NOTE_NAMES[((k.ni + currentKeyOffset) % 12 + 12) % 12];
    el.dataset.noteIndex = k.ni;
    el.dataset.octave    = k.oct;
    el.dataset.note      = dn + k.oct;
    if (lbl) el.dataset.shortcut = lbl;
    bindEvents(el, k.ni, k.oct);
    row.appendChild(el);
  });

  var octaveStartX = [0, 7 * wkw];

  var allBlacks = [
    { ni:1,  oct:currentOctave,   afterWhite:0, octIdx:0, kbIdx:0 },
    { ni:3,  oct:currentOctave,   afterWhite:1, octIdx:0, kbIdx:1 },
    { ni:6,  oct:currentOctave,   afterWhite:3, octIdx:0, kbIdx:2 },
    { ni:8,  oct:currentOctave,   afterWhite:4, octIdx:0, kbIdx:3 },
    { ni:10, oct:currentOctave,   afterWhite:5, octIdx:0, kbIdx:4 },
    { ni:1,  oct:currentOctave+1, afterWhite:0, octIdx:1, kbIdx:0 },
    { ni:3,  oct:currentOctave+1, afterWhite:1, octIdx:1, kbIdx:1 },
    { ni:6,  oct:currentOctave+1, afterWhite:3, octIdx:1, kbIdx:2 },
    { ni:8,  oct:currentOctave+1, afterWhite:4, octIdx:1, kbIdx:3 },
    { ni:10, oct:currentOctave+1, afterWhite:5, octIdx:1, kbIdx:4 },
  ];

  allBlacks.forEach(function(k) {
    var el = document.createElement('div');
    el.className = 'key-black';
    if (!isNoteInScale(k.ni)) el.classList.add('scale-inactive');
    var lbl = LABELS.black[k.octIdx][k.kbIdx] || '';
    var dn  = NOTE_NAMES[((k.ni + currentKeyOffset) % 12 + 12) % 12];
    el.dataset.noteIndex = k.ni;
    el.dataset.octave    = k.oct;
    el.dataset.note      = dn + k.oct;
    if (lbl) el.dataset.shortcut = lbl;
    var leftPx = octaveStartX[k.octIdx] + (k.afterWhite + 1) * wkw - Math.round(bkw / 2);
    el.style.left = leftPx + 'px';
    bindEvents(el, k.ni, k.oct);
    row.appendChild(el);
  });

  kbWrap.appendChild(row);

  var vizBar = document.querySelector('.visualizer-bar');
  if (vizBar) vizBar.style.width = (totalWidth + 36) + 'px';
}

function bindEvents(el, ni, oct) {
  el.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    playNote(ni, oct, el);
    pointerHeld.set('mouse', { ni: ni, oct: oct, el: el });
  });

  el.addEventListener('touchstart', function(e) {
    e.preventDefault();
    playNote(ni, oct, el);
    for (var ti = 0; ti < e.changedTouches.length; ti++) {
      touchHeld.set(e.changedTouches[ti].identifier, { ni: ni, oct: oct, el: el });
    }
  }, {passive:false});
  el.addEventListener('touchend',    function(e) { e.preventDefault(); stopNote(ni, oct, el); }, {passive:false});
  el.addEventListener('touchcancel', function(e) { e.preventDefault(); stopNote(ni, oct, el); }, {passive:false});
}

// ─── Scale ────────────────────────────────────────────────────────────────────

function isNoteInScale(ni) {
  if (currentScale==='chromatic') return true;
  return SCALE_INTERVALS[currentScale].includes(ni%12);
}
function applyScale() {
  var keys = document.querySelectorAll('.key-white,.key-black');
  keys.forEach(function(k){
    k.classList.toggle('scale-inactive', !isNoteInScale(+k.dataset.noteIndex));
  });
}

// ─── Controls ─────────────────────────────────────────────────────────────────

var KEY_NAMES_ARR = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function updateKeyDisplay(){
  var n=KEY_NAMES_ARR[((currentKeyOffset%12)+12)%12];
  var m=currentScale==='minor'?'Minor':currentScale==='pentatonic'?'Penta':'Major';
  keyDisplay.textContent=n + ' ' + m; keyBadge.textContent=n;
}

document.getElementById('key-up').onclick=function(){
  currentKeyOffset=(currentKeyOffset+1)%12; updateKeyDisplay(); buildKeyboard();
};
document.getElementById('key-down').onclick=function(){
  currentKeyOffset=((currentKeyOffset-1)%12+12)%12; updateKeyDisplay(); buildKeyboard();
};
document.getElementById('oct-up').onclick=function(){
  if(currentOctave<7){ currentOctave++; octDisplay.textContent=currentOctave; buildKeyboard(); }
};
document.getElementById('oct-down').onclick=function(){
  if(currentOctave>1){ currentOctave--; octDisplay.textContent=currentOctave; buildKeyboard(); }
};

document.querySelectorAll('#instrument-group .pill').forEach(function(b){
  b.onclick=function(){
    document.querySelectorAll('#instrument-group .pill').forEach(function(x){x.classList.remove('active');x.setAttribute('aria-checked','false');});
    b.classList.add('active'); b.setAttribute('aria-checked','true');
    currentInstrument=b.dataset.instrument;
  };
});
document.querySelectorAll('#scale-group .pill').forEach(function(b){
  b.onclick=function(){
    document.querySelectorAll('#scale-group .pill').forEach(function(x){x.classList.remove('active');x.setAttribute('aria-checked','false');});
    b.classList.add('active'); b.setAttribute('aria-checked','true');
    currentScale=b.dataset.scale; updateKeyDisplay(); applyScale();
  };
});

var reverbSl=document.getElementById('reverb-slider'), reverbVal=document.getElementById('reverb-val');
reverbSl.oninput=function(){
  reverbAmt=reverbSl.value/100; reverbVal.textContent=reverbSl.value+'%';
  if(dryGain) dryGain.gain.value=1-reverbAmt;
  if(wetGain) wetGain.gain.value=reverbAmt;
};
var sustSl=document.getElementById('sustain-slider'), sustVal=document.getElementById('sust-val');
sustSl.oninput=function(){ sustainMs=+sustSl.value; sustVal.textContent=(sustainMs/1000).toFixed(1)+'s'; };
var volSl=document.getElementById('volume-slider'), volVal=document.getElementById('volume-val');
volSl.oninput=function(){ volumeLevel=volSl.value/100; volVal.textContent=volSl.value+'%'; if(masterGain) masterGain.gain.value=volumeLevel; };

// ─── Keyboard input ───────────────────────────────────────────────────────────

var pressed = new Set();
function resolveKey(e){
  if(e.key==='-')   return '-';
  if(e.key==='=')   return '=';
  if(e.key==='[')   return '[';
  if(e.key===']')   return ']';
  if(e.key==='`')   return '`';
  if(e.key==='\\') return '\\';
  if(e.key==='Backspace') return 'Backspace';  
  return e.key.toLowerCase();
}
document.addEventListener('keydown', function(e){
  if(e.ctrlKey||e.metaKey||e.altKey||e.repeat) return;
  var k=resolveKey(e);
  if(pressed.has(k)||!KEY_NOTE_MAP[k]) return;
  pressed.add(k);
  var info=KEY_NOTE_MAP[k];
  var ni=info.noteIndex;
  var oo=info.octaveOffset;
  var oct=currentOctave+oo;
  var el=document.querySelector('.key-white[data-note-index="'+ni+'"][data-octave="'+oct+'"],.key-black[data-note-index="'+ni+'"][data-octave="'+oct+'"]');
  playNote(ni,oct,el);
});
document.addEventListener('keyup', function(e){
  var k=resolveKey(e);
  pressed.delete(k);
  var m=KEY_NOTE_MAP[k]; if(!m) return;
  var oct=currentOctave+m.octaveOffset;
  var el=document.querySelector('.key-white[data-note-index="'+m.noteIndex+'"][data-octave="'+oct+'"],.key-black[data-note-index="'+m.noteIndex+'"][data-octave="'+oct+'"]');
  stopNote(m.noteIndex,oct,el);
});

// ─── Visualizer ──────────────────────────────────────────────────────────────

function startViz(){
  var ctx=vizCanvas.getContext('2d');
  function resize(){ vizCanvas.width=vizCanvas.offsetWidth; vizCanvas.height=vizCanvas.offsetHeight; }
  resize(); new ResizeObserver(resize).observe(vizCanvas);
  (function draw(){
    requestAnimationFrame(draw);
    if(!analyser) return;
    var W=vizCanvas.width,H=vizCanvas.height;
    var buf=new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='rgba(17,17,24,0.6)'; ctx.fillRect(0,0,W,H);
    ctx.lineWidth=2.5; ctx.strokeStyle='#d4af64';
    ctx.shadowColor='#d4af64'; ctx.shadowBlur=8;
    ctx.beginPath();
    var sw=W/buf.length;
    buf.forEach(function(v,i){ var y=(v/128)*H/2; if(i){ctx.lineTo(i*sw,y);}else{ctx.moveTo(0,y);} });
    ctx.lineTo(W,H/2); ctx.stroke();
    
    var freqBuf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqBuf);
    ctx.fillStyle='rgba(212,175,100,0.15)';
    var barWidth = W / 64;
    for(var fi = 0; fi < 64; fi++) {
      var barHeight = (freqBuf[fi*4] / 255) * H * 0.4;
      ctx.fillRect(fi * barWidth, H - barHeight, barWidth - 1, barHeight);
    }
  })();
}

// ─── Background particles ─────────────────────────────────────────────────────

function initParticles(){
  var c=document.getElementById('bgCanvas'), ctx=c.getContext('2d');
  function r(){ c.width=innerWidth; c.height=innerHeight; }
  r(); window.addEventListener('resize',r);
  var G=['♩','♪','♫','𝄞','♭','♯'];
  var pts=[];
  for(var pi=0;pi<55;pi++){
    pts.push({
      x:Math.random()*innerWidth, y:Math.random()*innerHeight,
      r:Math.random()*1.5+.3, vx:(Math.random()-.5)*.2,
      vy:-(Math.random()*.15+.05), a:Math.random()*.4+.1,
      g:G[Math.floor(Math.random()*G.length)],
    });
  }
  (function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    pts.forEach(function(p){
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(212,175,100,'+(p.a*.5)+')'; ctx.fill();
      ctx.font=Math.floor(p.r*10+8)+'px serif';
      ctx.fillStyle='rgba(212,175,100,'+(p.a*.22)+')'; ctx.fillText(p.g,p.x,p.y);
      p.x+=p.vx; p.y+=p.vy; p.a-=.0005;
      if(p.y<-20||p.a<=0){ p.x=Math.random()*c.width; p.y=c.height+10; p.a=Math.random()*.4+.1; p.vy=-(Math.random()*.15+.05); }
    });
    requestAnimationFrame(draw);
  })();
}

// ─── Hint text ────────────────────────────────────────────────────────────────

function updateHint(){
  var h=document.querySelector('.keyboard-hint span');
  if(h) h.innerHTML='White: <kbd>`</kbd><kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><kbd>R</kbd><kbd>T</kbd><kbd>Y</kbd> / <kbd>U</kbd><kbd>I</kbd><kbd>O</kbd><kbd>P</kbd><kbd>[</kbd><kbd>]</kbd><kbd>\\</kbd> &nbsp;·&nbsp; Black: <kbd>1</kbd><kbd>2</kbd><kbd>4</kbd><kbd>5</kbd><kbd>6</kbd> / <kbd>8</kbd><kbd>9</kbd><kbd>-</kbd><kbd>=</kbd><kbd>⌫</kbd>';
}

// ─── Init ────────────────────────────────────────────────────────────────────

showLoader();
initParticles();
buildKeyboard();
updateKeyDisplay();
updateHint();

['click','keydown','touchstart'].forEach(function(ev){
  document.addEventListener(ev, function(){ initAudio(); }, {once:true});
});

window.addEventListener('resize', buildKeyboard);

document.addEventListener('mouseup', function(){ stopAllNotes(); });
window.addEventListener('blur', function(){ stopAllNotes(); pressed.clear(); });
document.addEventListener('touchend', function(e){ if (e.touches.length === 0) stopAllNotes(); });
document.addEventListener('touchcancel', function(e){ stopAllNotes(); });

function stopAllNotes() {
  var ids = [];
  active.forEach(function(v, k){ ids.push(k); });
  ids.forEach(function(id){
    var parts = id.split('-');
    var ni = parseInt(parts[0]);
    var oct = parseInt(parts[1]);
    var el = document.querySelector('[data-note-index="'+ni+'"][data-octave="'+oct+'"]');
    stopNote(ni, oct, el);
  });
  voiceOrder.length = 0;
}

// ═══════════════════════════════════════════════════════════════
// ★ PROFESSIONAL LOOPER SYSTEM ★
// ═══════════════════════════════════════════════════════════════

var CHORD_TYPES = [
  [[0,4,7,11],'Maj7'],[[0,4,7,10],'7'],[[0,3,7,10],'m7'],
  [[0,3,6,10],'m7b5'],[[0,3,6,9],'dim7'],
  [[0,4,7],'Major'],[[0,3,7],'Minor'],[[0,3,6],'dim'],
  [[0,4,8],'Aug'],[[0,2,7],'Sus2'],[[0,5,7],'Sus4'],
  [[0,4,7,9,11],'Maj9'],[[0,3,7,10,14],'m9'],
];

var chordTimer = null;

function getPitchClass(midi){ return midi % 12; }

function detectChord(midiNotes){
  if(!midiNotes.length) return '';
  if(midiNotes.length===1) return NOTE_NAMES[getPitchClass(midiNotes[0])] + (Math.floor(midiNotes[0]/12)-1);
  var pcs=[];
  midiNotes.forEach(function(m){ pcs.push(getPitchClass(m)); });
  pcs=[...new Set(pcs)].sort(function(a,b){return a-b;});
  for(var ci=0;ci<CHORD_TYPES.length;ci++){
    var intervals=CHORD_TYPES[ci][0];
    var name=CHORD_TYPES[ci][1];
    for(var ri=0;ri<pcs.length;ri++){
      var root=pcs[ri];
      var shifted=pcs.map(function(p){return ((p-root)+12)%12;}).sort(function(a,b){return a-b;});
      if(intervals.every(function(v,i){return v===shifted[i];}) && shifted.length===intervals.length)
        return NOTE_NAMES[root]+' '+name;
    }
  }
  return pcs.map(function(p){return NOTE_NAMES[p];}).join('+');
}

var _origPlay = playNote;
playNote = function(ni,oct,el){
  _origPlay(ni,oct,el);
  var midi=(oct+1)*12+((ni+currentKeyOffset+120)%12);
  activeNotes.add(midi);
  scheduleChordDetect();
};
var _origStop = stopNote;
stopNote = function(ni,oct,el){
  _origStop(ni,oct,el);
  var midi=(oct+1)*12+((ni+currentKeyOffset+120)%12);
  activeNotes.delete(midi);
  scheduleChordDetect();
};

function scheduleChordDetect(){
  clearTimeout(chordTimer);
  chordTimer=setTimeout(function(){
    var chord=detectChord([...activeNotes]);
    var el=document.getElementById('chord-display');
    if(el) el.textContent=chord||'—';
    if(isRecording && chord && activeNotes.size>0){
      var now=performance.now();
      if(lastChordRef && lastChordRef.chord===chord) return;
      if(lastChordRef) lastChordRef.duration=now-lastChordRef.start;
      lastChordRef={
        chord: chord,
        start: now,
        duration: 0,
        notes: [...activeNotes],
        instrument: currentInstrument === 'harmonium' ? 'harmonium' : 
                   currentInstrument === 'violin' ? 'violin' : 'piano'
      };
      loopData.push(lastChordRef);
    }
  },40);
}

var isRecording=false, isPlaying=false;
var loopData=[], lastChordRef=null;
var bpm=120, bars=1;
var loopStart=0, loopLen=0, rafId=null;
var loopGain=null;
var loopEvents = [];

function getBeat(){ return 60000/bpm; }
function getLoopLen(){ return bars*4*getBeat(); }

function quantize(ms){
  var sixteenth=getBeat()/4;
  return Math.round(ms/sixteenth)*sixteenth;
}

function toggleRecord(){
  isRecording=!isRecording;
  var btn=document.getElementById('btn-record');
  if(isRecording){
    loopData=[];lastChordRef=null;
    btn.classList.add('active');
    btn.textContent='⏹ Stop Rec';
    btn.style.animation = 'pulse 1s infinite';
  } else {
    if(lastChordRef) lastChordRef.duration=performance.now()-lastChordRef.start;
    btn.classList.remove('active');
    btn.textContent='⏺ Record';
    btn.style.animation = '';
    
    var total=loopData.reduce(function(s,c){return s+c.duration;},0)||getLoopLen();
    var cursor=0;
    loopData.forEach(function(c){
      c.start=quantize(cursor);
      c.duration=Math.max(quantize(c.duration), getBeat()/2);
      cursor+=c.duration;
    });
    
    console.log('🎵 Loop recorded: ' + loopData.length + ' events, ' + (total/1000).toFixed(1) + 's');
  }
}

function togglePlay(){
  if(!audioCtx) initAudio();
  isPlaying=!isPlaying;
  var btn=document.getElementById('btn-play');
  if(isPlaying){
    loopLen=getLoopLen();
    loopStart=performance.now();
    lastScheduled=-1;
    loopEvents=[];
    btn.textContent='⏹ Stop';
    btn.classList.add('active');
    schedulePlayback();
  } else {
    cancelAnimationFrame(rafId);
    btn.textContent='▶ Play';
    btn.classList.remove('active');
    stopLoopOscillators();
  }
}

var loopOscs=[];
function stopLoopOscillators(){
  loopOscs.forEach(function(o){try{o.stop();}catch(e){}});
  loopOscs=[];
  loopEvents=[];
}

var lastScheduled=-1;
function schedulePlayback(){
  if(!isPlaying) return;
  var now=performance.now();
  
  var lookAhead = 200;
  
  loopData.forEach(function(c, idx) {
    var loopNum = Math.floor((now - loopStart) / loopLen);
    var cStart = loopStart + loopNum * loopLen + c.start;
    
    if(cStart > lastScheduled && cStart <= now + lookAhead) {
      var delay = Math.max(0, (cStart - now) / 1000);
      playLoopEvent(c, delay, c.duration / 1000, idx);
      lastScheduled = cStart;
    }
  });
  
  loopEvents = loopEvents.filter(function(e){ return e.endTime > now; });
  
  rafId=requestAnimationFrame(schedulePlayback);
}

function playLoopEvent(event, delayS, durS, idx) {
  if(!audioCtx) return;
  
  if(!loopGain){
    loopGain=audioCtx.createGain();
    loopGain.gain.value=parseFloat(document.getElementById('loop-vol')?.value||0.5);
    loopGain.connect(analyser);
  }
  
  var now = audioCtx.currentTime;
  var startTime = now + delayS;
  
  loopEvents.push({
    idx: idx,
    startTime: performance.now() + delayS * 1000,
    endTime: performance.now() + (delayS + durS) * 1000
  });

  switch(event.instrument || 'piano') {
    case 'violin':
      playLoopViolin(event.notes, startTime, durS);
      break;
    case 'harmonium':
      playLoopHarmonium(event.notes, startTime, durS);
      break;
    default:
      playLoopPiano(event.notes, startTime, durS);
  }
}

function playLoopPiano(midiNotes, start, dur) {
  var loopVol = parseFloat(document.getElementById('loop-vol')?.value || 0.5);
  
  midiNotes.forEach(function(midi) {
    var freq = 440 * Math.pow(2, (midi - 69) / 12);
    
    var sampleName = findBestPianoSample(freq);
    
    if (sampleName && pianoBuffers[sampleName]) {
      var src = audioCtx.createBufferSource();
      src.buffer = pianoBuffers[sampleName];
      
      var sampleNote = sampleName.replace(/[0-9]/g, '');
      var sampleOctave = parseInt(sampleName.match(/[0-9]/)[0]);
      var noteIndices = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11};
      var sampleFreq = 261.63 * Math.pow(2, (noteIndices[sampleNote] + (sampleOctave - 4) * 12) / 12);
      
      src.playbackRate.value = freq / sampleFreq;
      
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(loopVol * 0.8, start + 0.002);
      g.gain.exponentialRampToValueAtTime(loopVol * 0.4, start + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      
      src.connect(g);
      g.connect(loopGain);
      src.start(start);
      src.stop(start + dur + 0.1);
      loopOscs.push(src);
    } else {
      var osc = audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(loopVol * 0.5, start + 0.005);
      g.gain.exponentialRampToValueAtTime(loopVol * 0.2, start + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      
      osc.connect(g);
      g.connect(loopGain);
      osc.start(start);
      osc.stop(start + dur + 0.05);
      loopOscs.push(osc);
    }
  });
}

function playLoopViolin(midiNotes, start, dur) {
  var loopVol = parseFloat(document.getElementById('loop-vol')?.value || 0.5);
  
  midiNotes.forEach(function(midi) {
    var freq = 440 * Math.pow(2, (midi - 69) / 12);
    var violinInstance = synthesizeViolinTone(freq, start, dur, loopVol * 0.8);
    
    violinInstance.masterGain.connect(loopGain);
    try {
      violinInstance.masterGain.disconnect(dryGain);
      violinInstance.masterGain.disconnect(wetGain);
    } catch(e) {}
    
    violinInstance.allNodes.forEach(function(n){
      if(n.oscillator) loopOscs.push(n.oscillator);
    });
  });
}

function playLoopHarmonium(midiNotes, start, dur) {
  var loopVol = parseFloat(document.getElementById('loop-vol')?.value || 0.5);
  
  midiNotes.forEach(function(midi) {
    var freq = 440 * Math.pow(2, (midi - 69) / 12);
    
    [-3, 3].forEach(function(detune) {
      var osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(loopVol * 0.18, start + 0.05);
      g.gain.setValueAtTime(loopVol * 0.18, start + dur - 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      
      osc.connect(g);
      g.connect(loopGain);
      osc.start(start);
      osc.stop(start + dur + 0.05);
      loopOscs.push(osc);
    });
  });
}

// ── Wire UI ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',function(){
  var recBtn=document.getElementById('btn-record');
  if(recBtn) recBtn.addEventListener('click',toggleRecord);
  var playBtn=document.getElementById('btn-play');
  if(playBtn) playBtn.addEventListener('click',togglePlay);
  var bpmInput=document.getElementById('bpm-input');
  if(bpmInput) bpmInput.addEventListener('input',function(e){
    bpm=Math.max(40,Math.min(240,+e.target.value));
    var bv=document.getElementById('bpm-val');
    if(bv) bv.textContent=bpm;
  });
  var barsInput=document.getElementById('bars-input');
  if(barsInput) barsInput.addEventListener('input',function(e){
    bars=Math.max(1,Math.min(16,+e.target.value));
    var bv=document.getElementById('bars-val');
    if(bv) bv.textContent=bars;
  });
  var lv=document.getElementById('loop-vol');
  if(lv) lv.addEventListener('input',function(e){
    if(loopGain) loopGain.gain.value=+e.target.value;
  });
});

// ── Mode toggle ───────────────────────────────────────────────
document.querySelectorAll('[data-mode]').forEach(function(b){
  b.addEventListener('click',function(){
    instrumentMode=b.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(function(x){
      x.classList.toggle('active', x===b);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
console.log('🎹 WebKeys Pro v3.0 Loaded - All Fixes Applied');
