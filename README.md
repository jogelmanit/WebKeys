# 🎹 WebKeys — A Browser Piano Instrument

> A fully interactive, browser-based piano keyboard built with pure HTML, CSS, and JavaScript. No frameworks. No dependencies. No installation. Just open and play.

[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-FF6B35?style=flat)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

## 📌 About the Project

WebKeys is a browser-based piano instrument that lets you play music directly from your keyboard or touchscreen. It uses the **Web Audio API** to synthesize sound in real time — no audio files, no external libraries, no build step required.

The design is inspired by [Web Harmonium](https://web-harmonium.vercel.app) by Dhruv Akbari, featuring a dark luxury gold aesthetic and a keyboard layout that mirrors a real piano — the number row maps to black keys (sharps), and the QWERTY row maps to white keys (naturals), just like their physical positions on an actual instrument.

---

## 📸 Preview

```
╔══════════════════════════════════════════════════════╗
║  𝄞  WebKeys                                          ║
║  A browser instrument — play with keyboard or touch  ║
╠══════════════════════════════════════════════════════╣
║  Instrument  │  Key  │  Octave  │  Reverb  │  Volume ║
║  Piano  Organ  Synth  Marimba                        ║
╠══════════════════════════════════════════════════════╣
║   ┌─┐ ┌─┐   ┌─┐ ┌─┐ ┌─┐   ┌─┐ ┌─┐                 ║
║   │1│ │2│   │4│ │5│ │6│   │8│ │9│                  ║
║  ┌┴┐└┬┘┌┴┐ ┌┴┐└┬┘┌┴┐└┬┐ ┌┴┐└┬┘┌┴┐                ║
║  │Q││W││E│ │R││T││Y││U│ │I││O││P│  ...             ║
║  └─┘└─┘└─┘ └─┘└─┘└─┘└─┘ └─┘└─┘└─┘                ║
╠══════════════════════════════════════════════════════╣
║  ~~~~ waveform visualizer ~~~~                       ║
╚══════════════════════════════════════════════════════╝
```

---

## ✨ Features

### 🎵 Instrument & Sound
- **4 Instruments** — Piano, Organ, Synth, and Marimba, each synthesized live with unique harmonic stacking and ADSR envelopes
- **Reverb** — Convolver-based concert-hall reverb with adjustable wet/dry blend
- **Sustain Control** — Adjust note release from sharp staccato `0.1s` to a long flowing sustain `3.0s`
- **Volume** — Master gain slider for all output

### 🎼 Musical Controls
- **Key Change** — Transpose the entire keyboard up or down by semitone across all 12 keys (C through B)
- **Octave Shift** — Move the keyboard range across 7 octaves (1–7)
- **Scale Filter** — Dim keys outside the selected scale: Chromatic, Major, Minor, or Pentatonic — great for learning and jamming

### 🖥️ Interface
- **Live Waveform Visualizer** — Real-time oscilloscope canvas below the keys showing your audio signal
- **Animated Background** — Floating musical glyphs (♩ ♪ ♫ 𝄞) rising softly in the background
- **Note Display** — Shows the active note name and frequency in Hz as you play
- **Loading Screen** — Animated intro screen on startup
- **Keyboard + Mouse + Touch** — Play with your computer keyboard, click with a mouse, or tap on mobile

---

## 🗂️ File Structure

```
webkeys/
├── index.html     →  Page structure and UI markup
├── style.css      →  Dark gold aesthetic, key styling, controls, animations
├── app.js         →  Audio engine, keyboard mapping, instrument presets, visualizer
└── README.md      →  You are here
```

All three files must be in the **same folder** for the app to work.

---

## 🚀 Getting Started

No installation, no build step, no package manager needed.

**Option 1 — Just open it:**
1. Download `index.html`, `style.css`, and `app.js` into the same folder
2. Double-click `index.html` to open it in your browser
3. Click any key or press a keyboard shortcut to start playing

**Option 2 — Serve locally (recommended for best audio):**
```bash
# Using Node.js
npx serve .

# Using Python 3
python -m http.server

# Using Python 2
python -m SimpleHTTPServer
```
Then open `http://localhost:3000` (or the port shown) in your browser.

> ⚠️ **Note:** Browsers require a user interaction (click or keypress) before audio can start, due to autoplay policies. The audio engine activates automatically on your first interaction.

---

## 🎹 Keyboard Layout

WebKeys uses the same layout as Web Harmonium. The top two rows of your keyboard map to piano keys, mirroring their physical positions on a real instrument — number row sits above QWERTY, just like black keys sit above white keys.

### White Keys — QWERTY Row (Natural Notes)

| Keyboard | `Q` | `W` | `E` | `R` | `T` | `Y` | `U` | `I` | `O` | `P` | `[` | `]` |
|:--------:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Note     |  C  |  D  |  E  |  F  |  G  |  A  |  B  |  C  |  D  |  E  |  F  |  G  |
| Octave   |  ← Octave 1 (base) →  | | | | | | |  ← Octave 2 →  | | | | |

### Black Keys — Number Row (Sharps)

| Keyboard | `1` | `2` | `4` | `5` | `6` | `8` | `9` | `-` | `=` |
|:--------:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Note     | C#  | D#  | F#  | G#  | A#  | C#  | D#  | F#  | G#  |
| Octave   |  ← Octave 1 →  | | | | |  ← Octave 2 →  | | | |

> Keys `3`, `0`, and `7` are intentionally unused — they correspond to positions where no black key exists on a real piano (between E/F and B/C).

---

## 🎛️ Controls Reference

| Control | Options | Description |
|---------|---------|-------------|
| **Instrument** | Piano / Organ / Synth / Marimba | Changes the synthesized tone and envelope |
| **Key** | C through B (12 semitones) | Transposes the entire keyboard up or down |
| **Octave** | 1 – 7 | Shifts the base octave of the keyboard |
| **Reverb** | 0% – 100% | Blends dry signal with convolution reverb |
| **Sustain** | 0.1s – 3.0s | Controls how long notes ring after release |
| **Volume** | 0% – 100% | Master output gain |
| **Scale** | Chromatic / Major / Minor / Pentatonic | Dims keys outside the active scale |

---

## 🛠️ How It Works (Technical)

All sound is generated live in the browser — no audio samples are downloaded.

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Sound synthesis | `OscillatorNode` | Generates raw waveforms (triangle, sine, sawtooth) |
| Harmonic richness | Multiple oscillators | Stacked at frequency ratios to simulate real instruments |
| Note shaping | `GainNode` + `linearRampToValueAtTime` | ADSR envelope for attack, decay, sustain, release |
| Reverb | `ConvolverNode` | Synthetically generated impulse response for room reverb |
| Tone shaping | `BiquadFilterNode` | Low-pass filter on Synth instrument |
| Visualizer | `AnalyserNode` + Canvas | Real-time waveform oscilloscope |
| Background | `Canvas API` | Animated floating musical glyph particles |

---

## 🎨 Design

- **Typography** — DM Serif Display (logo/headings) + DM Mono (UI labels) via Google Fonts
- **Colour Palette** — Deep near-black backgrounds (`#0a0a0f`) with warm gold accents (`#d4af64`)
- **Key Design** — White keys use a subtle ivory gradient; black keys use a deep layered dark gradient; both animate on press
- **Effects** — CSS glow pulse on logo, ripple effect on key press, gold shimmer on active notes
- **Responsive** — Keys scale on mobile/tablet; keyboard is horizontally scrollable on small screens

---

## 🌐 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | 66+     | ✅ Full support |
| Firefox | 60+     | ✅ Full support |
| Safari  | 14+     | ✅ Full support |
| Edge    | 79+     | ✅ Full support |
| Mobile Chrome | Latest | ✅ Touch support |
| Mobile Safari | Latest | ✅ Touch support |

---

## 🙏 Acknowledgements

- Inspired by [Web Harmonium](https://web-harmonium.vercel.app) by [Dhruv Akbari](https://github.com/MrAkbari91) — keyboard layout and concept
- Built with the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- Typography via [Google Fonts](https://fonts.google.com) — DM Serif Display & DM Mono

---

## 📄 License

This project is open source and free to use, modify, and distribute.

---

*WebKeys © 2026 — Bridging music and the browser, one key at a time* 🎵
