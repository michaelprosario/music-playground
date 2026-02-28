# Arp Composer 3 — Technical Approach

## Overview

Arp Composer 3 is a browser-based arpeggio sequencer built with **Angular 17+ standalone components** and the Angular **Signals** primitive for reactive state management. Users define a chord progression, paint note patterns on a step-sequencer grid, and play back the result through a WebAudio synthesizer or a connected Web MIDI device. Patterns can be exported as standard MIDI files or viewed as rendered sheet music.

---

## Tech Stack

| Concern | Library / API |
|---|---|
| UI Framework | Angular 17+ (standalone components, Signals) |
| Audio scheduling | [Tone.js](https://tonejs.github.io/) `Transport` + `Part` |
| Browser audio synthesis | Tone.js `PolySynth` |
| MIDI output | Web MIDI API (with Web Audio fallback) |
| Sheet music rendering | [abcjs](https://paulrosen.github.io/abcjs/) |
| Styling | SCSS per-component |
| Build | Angular CLI (`@angular/build`) |
| Testing | Vitest + jsdom |
| Deployment | GitHub Pages (`angular-cli-ghpages`) |

---

## Domain Entities (Models)

### `ArpCell` — `models/arp-cell.model.ts`

The smallest unit of the sequencer. Represents a single time-step on a single row.

| Field | Type | Description |
|---|---|---|
| `state` | `CellState` | `'off' \| 'v1' \| 'v2' \| 'staccato'` |

Constants exported alongside the model:
- `CELL_VELOCITY` — maps each `CellState` to a MIDI velocity value.
- `STACCATO_DURATION_RATIO` / `NORMAL_DURATION_RATIO` — fraction of a step's duration that a note is held.

### `ArpRow` — `models/arp-grid.model.ts`

One horizontal lane of the grid, mapped to a chord degree.

| Field | Type | Description |
|---|---|---|
| `label` | `string` | Display name (e.g. `'Root-1'`, `'Fifth-2'`) |
| `degree` | `ChordDegree` | `'root' \| '2nd' \| 'third' \| 'fifth'` |
| `octaveOffset` | `number` | `0` = base octave, `1` = one octave higher |
| `cells` | `ArpCell[]` | One cell per time step |

### `ArpGrid` — `models/arp-grid.model.ts`

The complete sequencer pattern.

| Field | Type | Description |
|---|---|---|
| `rows` | `ArpRow[]` | 8 rows (2 octaves × 4 degrees) |
| `stepsPerMeasure` | `number` | Derived from the selected `NoteLength` |

### `ArpeggioConfig` — `models/arpeggio-config.model.ts`

Global playback configuration.

| Field | Type | Default |
|---|---|---|
| `bpm` | `number` | `80` |
| `noteLength` | `NoteLength` | `'sixteenth'` |
| `midiChannel` | `number` | `1` |
| `baseOctave` | `number` | `4` |

`NoteLength` is one of `'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'`. The `STEPS_PER_MEASURE` lookup table maps each length to the number of grid columns (1–16).

### `Chord` — `models/chord.model.ts`

A single parsed chord.

| Field | Type | Description |
|---|---|---|
| `symbol` | `string` | Raw token, e.g. `'Am7'` |
| `rootName` | `string` | Root pitch name, e.g. `'A'` |
| `quality` | `ChordQuality` | `'major' \| 'minor' \| 'maj7' \| 'm7' \| '7' \| 'dim' \| 'aug' \| 'sus2' \| 'sus4'` |
| `midiNotes` | `number[]` | MIDI note numbers of chord tones at octave 4 |

### `ChordProgression` — `models/chord.model.ts`

The result of parsing user-entered text.

| Field | Type | Description |
|---|---|---|
| `raw` | `string` | Original input string |
| `chords` | `Chord[]` | Ordered list of parsed chords |
| `valid` | `boolean` | Whether the parse succeeded |
| `error` | `string \| null` | Parse error message if invalid |

---

## Services

### `ArpGridService`

**Role:** Owns and mutates the `ArpGrid` Signal. All grid state changes flow through this service.

**State:** `_grid: WritableSignal<ArpGrid>` — exposed as a read-only `Signal<ArpGrid>`.

**Key operations:**

| Method | Description |
|---|---|
| `cycleCell(rowIdx, stepIdx)` | Advances a cell through `off → v1 → v2 → staccato → off` |
| `setRowVelocity(rowIdx, v)` | Sets all active cells in a row to `v1` or `v2` |
| `randomizeRow(rowIdx)` | Fills a row with random active states |
| `clearRow(rowIdx)` | Resets all cells in a row to `off` |
| `clearAll()` | Resets the entire grid |
| `resizeSteps(n)` | Adjusts grid column count, preserving existing cell data |
| `exportJson() / importJson(json)` | JSON serialization of the full grid |

---

### `ConfigService`

**Role:** Manages `ArpeggioConfig` as a Signal. Computes derived timing values.

**Key computeds/methods:**

| Member | Description |
|---|---|
| `config` | Read-only `Signal<ArpeggioConfig>` |
| `setConfig(partial)` | Merges a partial config update |
| `getStepsPerMeasure()` | Looks up `STEPS_PER_MEASURE[noteLength]` |
| `getStepDurationSec()` | Computes `(60/bpm) / (stepsPerMeasure/4)` |

---

### `ChordService`

**Role:** Stateless music theory engine. Parses chord symbols and resolves grid degrees to MIDI note numbers.

**Chord parsing:** Tokens are split from free-text input. Each token is matched against a sorted list of root names (`C`, `C#`, `Db`, …) and a quality suffix table. Unsupported symbols return a validation error.

**MIDI resolution:** `getMidiNoteForRow(chord, degree, octaveOffset, baseOctave)` uses the `DEGREE_SEMITONES` lookup table (keyed by `ChordQuality × ChordDegree`) to compute MIDI note = `12 × (baseOctave + octaveOffset + 1) + rootSemitone + degreeInterval`.

---

### `ArpeggioPlaybackService`

**Role:** Orchestrates real-time playback using the Tone.js `Transport` and `Part` scheduler. Coordinates audio output (via `ToneSynthService`) and MIDI output (via `MidiService`).

**State:** `_state: WritableSignal<ArpeggioPlaybackState>` with fields `isPlaying`, `currentStep`, `currentChordIndex`.

**Playback flow:**

1. `play()` — Starts `Tone.Transport`, builds a `Tone.Part` from a flat list of `NoteEvent` objects covering all chords × all steps.
2. Each `NoteEvent` carries `{time, midiNote, duration, velocity, stepIdx, chordIdx, isFirstInLoop}`.
3. The Part callback fires on the audio thread for each event, triggering both `ToneSynthService.triggerNote()` and (if a real MIDI device is connected) `MidiService.noteOn/noteOff()`.
4. `Tone.getDraw().schedule()` is used to push `currentStep` / `currentChordIndex` updates back to the Angular Signal on the main JS thread, keeping the playhead indicator in sync.
5. **Hot-swap on grid edit:** An Angular `effect` watches `ArpGridService.grid()` during playback. When a change is detected it sets `_pendingRebuild = true`. At the loop boundary (`isFirstInLoop`), a new `Tone.Part` is built from fresh state and swapped in without audible interruption.
6. `stop()` — Stops Transport, disposes the Part, calls `releaseAll()` on both synth and MIDI.

---

### `MidiService`

**Role:** Wraps the browser Web MIDI API. Falls back to a Web Audio oscillator-based approximation when MIDI is unavailable.

**State:** `Signal<MidiServiceState>` tracks `supported`, `usingFallback`, `outputs`, `selectedOutputId`, `error`.

**Fallback path:** A triangle-wave `OscillatorNode` with a percussive amplitude envelope (1 ms attack, 350 ms exponential decay) approximates a xylophone timbre. Active oscillators are tracked in a `Map<noteNumber, {osc, gain}>` to support polyphony and explicit `noteOff`.

---

### `ToneSynthService`

**Role:** Manages a Tone.js `PolySynth<Synth>` (triangle oscillator, 16-voice polyphony) as the primary in-browser audio engine.

Initialized lazily via `init()` to comply with browser autoplay policy (`Tone.start()` must be triggered from user gesture). `triggerNote(midiNote, durationSec, atTime, velocity)` converts MIDI to frequency internally.

---

### `AbcNotationService`

**Role:** Stateless converter from `ArpGrid + ChordProgression + ArpeggioConfig` to an ABC notation string.

Generates one measure per chord, writes notes using ABC pitch names (lowercase for octave ≥ 4, apostrophe suffixes for higher octaves), and marks staccato cells with `!staccato!`. Simultaneous notes within a step are wrapped in `[ ]` chord clusters. Output is consumed by `NotationModalComponent` and fed to abcjs for SVG rendering.

---

### `MidiExportService`

**Role:** Stateless generator that writes a binary Standard MIDI File (format 0) and triggers a browser file download.

Walks `grid × progression` identical to `ArpeggioPlaybackService._buildPart`, converts timing to ticks (480 PPQN), and encodes note-on/note-off pairs plus a tempo meta-event. The resulting `Uint8Array` is wrapped in a `Blob` and downloaded as `arpeggio.mid`.

---

## Component Architecture

```
App (root)
├── ToolbarComponent          — play / stop / clear / export / notation actions
├── ConfigPanelComponent      — note length selector + BPM input
├── ChordInputComponent       — free-text chord progression textarea
├── ArpGridComponent          — step-sequencer grid
│   ├── StepPositionBarComponent — animated playhead
│   └── ArpRowComponent (×8)  — single degree lane
│       └── ArpCellComponent (×N) — single step button
└── NotationModalComponent    — sheet music preview (abcjs SVG + MIDI playback)
```

All components are **standalone** (no `NgModule`). Service injection uses `inject()` (functional API).

### Component Responsibilities

| Component | Key inputs | Key outputs | Services used |
|---|---|---|---|
| `App` | — | — | all services |
| `ToolbarComponent` | — | `play`, `stop`, `clearAll`, `midiExport`, `exportArp`, `loadArp`, `openNotation` | — |
| `ConfigPanelComponent` | — | — | `ConfigService`, `ArpGridService` |
| `ChordInputComponent` | — | `progressionChange: ChordProgression` | `ChordService` |
| `ArpGridComponent` | — | — | `ArpGridService`, `ArpeggioPlaybackService` |
| `ArpRowComponent` | `row: ArpRow` | `cellClicked`, `clearRow`, `setVelocity`, `randomize` | — |
| `ArpCellComponent` | `state: CellState` | `clicked` | — |
| `StepPositionBarComponent` | `steps: number[]`, `currentStep: number` | — | — |
| `NotationModalComponent` | `abcString: string` | `close` | — (uses abcjs directly) |

---

## Data Flow

```
User types chord text
  → ChordInputComponent.onInput()
  → ChordService.parse()
  → ChordProgression emitted to App
  → App.onProgressionChange() → ArpeggioPlaybackService.setProgression()

User adjusts BPM / NoteLength
  → ConfigPanelComponent
  → ConfigService.setConfig()          (BPM)
  → ArpGridService.resizeSteps()       (NoteLength triggers column count change)

User clicks a grid cell
  → ArpCellComponent (click)
  → ArpRowComponent (cellClicked output)
  → ArpGridComponent.onCellClicked()
  → ArpGridService.cycleCell()         (Signal update → re-renders grid)

User clicks Play
  → App.play()
  → ArpeggioPlaybackService.play()
      → Tone.Transport.start()
      → Tone.Part fires per NoteEvent
          → ToneSynthService.triggerNote()   (audio)
          → MidiService.noteOn/noteOff()     (MIDI device, if available)
          → Tone.Draw → Signal update        (playhead)

Grid edited while playing
  → Angular effect fires
  → _pendingRebuild = true
  → next loop boundary: new Tone.Part hot-swapped in

User clicks Export MIDI
  → MidiExportService.export()
  → SMF binary → Blob → .mid download

User clicks View Notation
  → AbcNotationService.generateAbc()
  → App.abcString Signal updated
  → NotationModalComponent renders abcjs SVG + optional MIDI synth controls
```

---

## State Management Summary

Angular Signals are used throughout for reactive state, avoiding RxJS Observables for simpler synchronous state. The key Signals and ownership:

| Signal | Owner | Consumers |
|---|---|---|
| `grid` | `ArpGridService` | `ArpGridComponent`, `ArpeggioPlaybackService` (effect) |
| `config` | `ConfigService` | `ConfigPanelComponent`, `ArpeggioPlaybackService`, `MidiExportService` |
| `state` (playback) | `ArpeggioPlaybackService` | `ArpGridComponent → StepPositionBarComponent` |
| `state` (MIDI) | `MidiService` | `App` (MIDI status display) |
| `showNotation`, `abcString` | `App` | `NotationModalComponent` |

---

## Key Design Decisions

- **Tone.js for scheduling:** Audio-accurate timing via the Web Audio clock is critical. Tone.js `Transport` + `Part` handles this; Angular is only updated via `Tone.getDraw()` to avoid blocking the audio thread.
- **Hot-swap during playback:** Rather than stopping and restarting on every grid edit, an Angular `effect` defers the rebuild to the next loop boundary, preventing audible glitches.
- **Dual audio path:** `ToneSynthService` always produces audio; `MidiService` additionally sends to an external device when available. The fallback Web Audio oscillator in `MidiService` is only used when Tone.js is unavailable (e.g., the MIDI path is bypassed by the playback service when using the Tone synth).
- **Signal-first state:** No `BehaviorSubject` or RxJS pipe chains for component state — Angular Signals alone drive all UI reactivity, keeping the mental model simple.
- **Standalone components:** No feature modules; each component declares its own `imports`, making the dependency graph explicit and tree-shaking straightforward.
