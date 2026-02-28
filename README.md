# Music Playground — Arp Composer

A browser-based Angular application for composing and playing back arpeggios over chord progressions. Paint notes onto a step-sequencer grid, type a chord progression, and loop the result through your browser's audio engine or a connected MIDI device.

[Check out our demo for ArpComposer Playground](https://michaelprosario.github.io/music-playground/)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later (bundled with Node.js)

### Install dependencies

```bash
cd arp-composer3
npm install
```

### Start the development server

```bash
npm start
# or
npx ng serve
```

The app will be available at `http://localhost:4200` by default.

### Build for production

```bash
npm run build
```

Output is written to `arp-composer3/dist/`.

---

## Music Concepts

### Chord Progressions
Type a sequence of chord symbols separated by spaces (e.g. `Em C D G`). The app parses each token into a root note and quality, then uses those chords to drive the arpeggio grid. Supported qualities include: `major`, `minor`, `maj7`, `m7`, `7`, `dim`, `aug`, `sus2`, `sus4`.

### Arpeggios
An arpeggio breaks a chord into individual notes played in sequence rather than simultaneously. The step-sequencer grid lets you specify *which* chord tones to play at *which* step, giving full control over rhythm and voicing.

### Grid Rows and Chord Tones
Each row in the grid maps to a chord degree:

| Row | Degree | Description |
|-----|--------|-------------|
| 0   | Root   | Tonic (1st) |
| 1   | 2nd    | Second chord tone |
| 2   | Third  | Third chord tone |
| 3   | Fifth  | Fifth chord tone |

Rows repeat across two octaves, so an 8-row grid gives you the root through the fifth and then the same degrees one octave higher.

### Step Sequencer
The grid has 16 steps per measure (configurable). Each cell can be:
- **Off** — silent
- **Normal** — full-velocity note
- **Accent** — louder hit
- **Staccato** — short, detached note (shorter duration ratio)

### MIDI and Synthesis
Playback uses [Tone.js](https://tonejs.github.io/) (`PolySynth`) as the primary audio engine. If the browser supports the [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) and a MIDI output device is connected, notes are also sent to that device (GM program 13 — Xylophone). When MIDI is unavailable, Tone.js provides a built-in synthesizer fallback.

### Tempo and Note Length
The playback tempo (BPM) and base note length (e.g. sixteenth notes) are configurable from the toolbar. Step duration is derived as:

$$\text{step duration (s)} = \frac{60}{\text{bpm}} \div \frac{\text{steps per measure}}{4}$$

### Export
- **MIDI Export** — renders one full loop (all chords × one measure each) to a standard Type-0 MIDI file and triggers a browser download.
- **Export Arp (JSON)** — saves the current grid layout as a JSON file for later reuse.
- **Load Arp** — restores a previously saved JSON grid.

---

## Key Services

### `ChordService`
Stateless service that parses chord symbol strings (e.g. `"Em C D G"`) into a `ChordProgression` model and maps grid rows to MIDI note numbers using interval tables for each chord quality.

### `ArpGridService`
Manages the reactive state of the step-sequencer grid (rows, cells, cell states). Provides methods to toggle cells, clear the grid, and import/export the grid as JSON.

### `ArpeggioPlaybackService`
Orchestrates playback using `Tone.Transport` and `Tone.Part`. Compiles all note events for the full chord progression into a looping part, drives `ToneSynthService` and `MidiService` on each scheduled step, and exposes a reactive playhead signal for UI synchronization.

### `ToneSynthService`
Wraps a `Tone.PolySynth` instance. Handles audio context initialization, note triggering (`triggerAttackRelease`), and releasing all active voices on stop.

### `MidiService`
Wraps the Web MIDI API. Enumerates available output devices, sends `noteOn`/`noteOff`/`programChange` messages, and falls back to a Web Audio oscillator when MIDI is unavailable.

### `MidiExportService`
Builds a binary MIDI Type-0 file from the current grid and chord progression, encodes it as a `Blob`, and triggers a browser download.

### `ConfigService`
Holds global playback configuration (BPM, MIDI channel, base octave, note length). Exposes a reactive `config` signal consumed by other services and components.


