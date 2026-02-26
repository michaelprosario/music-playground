# Rhythm Pattern Player — Technical Design

**Date:** 2/2/2025  
**Project:** music-playground / arp-composer2 (Angular)

---

## 1. Overview

A browser-based Angular application that lets a music maker type a rhythm pattern string (e.g. `*---*---*---*---`), configure tempo, beats per measure, and pitch, then start/stop looping playback over Web MIDI.

---

## 2. Pattern String Specification

| Character | Meaning |
|-----------|---------|
| `*`       | Note-on at this subdivision |
| `-`       | Rest / silence at this subdivision |

**Subdivision resolution:**

```
subdivisions_per_beat = pattern.length / beats_per_measure
ms_per_subdivision   = (60_000 / bpm) / subdivisions_per_beat
```

**Examples (all 16 characters, 4 beats per measure → 16th-note grid):**

| Pattern string         | Result |
|------------------------|--------|
| `*---*---*---*---`     | 4 quarter notes |
| `*-*-*-*-*-*-*-*-`    | 8 eighth notes |
| `****************`     | 16 sixteenth notes |
| `*--*--*--*--*--*`     | dotted-eighth rhythm (5+5+5+1 subdivisions) |

The pattern length need not be a power of two; the engine adapts automatically.

---

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│                  Angular App                 │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │           AppComponent               │   │
│  │ ┌──────────────┐  ┌──────────────┐  │   │
│  │ │PatternInput  │  │ConfigPanel   │  │   │
│  │ │Component     │  │Component     │  │   │
│  │ └──────────────┘  └──────────────┘  │   │
│  │ ┌──────────────────────────────────┐ │   │
│  │ │     PlaybackControls Component   │ │   │
│  │ └──────────────────────────────────┘ │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌────────────┐  ┌───────────────────────┐  │
│  │PatternSvc  │  │    PlaybackService    │  │
│  └────────────┘  └───────────────────────┘  │
│  ┌────────────┐  ┌───────────────────────┐  │
│  │MidiService │  │   ConfigService       │  │
│  └────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## 4. Services

### 4.1 `ConfigService`

Holds all user-configurable settings as Angular signals (or BehaviorSubjects).

```typescript
interface RhythmConfig {
  bpm: number;           // tempo, e.g. 120
  beatsPerMeasure: number; // e.g. 4
  midiNote: number;      // MIDI note number, e.g. 60 = middle-C
  midiChannel: number;   // 1–16
  noteDurationMs: number; // how long a note-on lasts before note-off
}
```

**Responsibilities:**
- Expose reactive config state (Angular `signal<RhythmConfig>`)
- Provide a `setConfig(partial)` method
- Calculate derived timing values (`msPerSubdivision`)

---

### 4.2 `PatternService`

Parses the raw pattern string into a typed event list.

```typescript
interface PatternEvent {
  index: number;    // 0-based subdivision index
  isNote: boolean;  // true = '*', false = '-'
}

interface ParsedPattern {
  events: PatternEvent[];
  length: number;   // total number of subdivisions
}
```

**Responsibilities:**
- `parse(pattern: string): ParsedPattern`
- Validate that the string contains only `*` and `-`
- Validate that `pattern.length` is evenly divisible by `beatsPerMeasure` (warn otherwise)
- Expose an error/warning signal for invalid input

---

### 4.3 `MidiService`

Thin wrapper around the Web MIDI API.

```typescript
interface MidiServiceState {
  supported: boolean;
  access: MIDIAccess | null;
  outputs: MIDIOutput[];
  selectedOutputId: string | null;
  error: string | null;
}
```

**Responsibilities:**
- `init(): Promise<void>` — calls `navigator.requestMIDIAccess()`
- `noteOn(channel, note, velocity): void`
- `noteOff(channel, note): void`
- `listOutputs(): MIDIOutput[]`
- `selectOutput(id: string): void`
- Expose reactive state via signal
- **Fallback:** if Web MIDI is unavailable, route through Web Audio API (OscillatorNode) so the app remains functional in non-MIDI browsers

---

### 4.4 `PlaybackService`

Owns the scheduling loop; the heart of the engine.

**Scheduling strategy — "lookahead scheduler" pattern:**

Uses a short-interval `setInterval` (e.g. every 25 ms) plus a lookahead window (e.g. 100 ms) backed by `AudioContext.currentTime` for sample-accurate scheduling. This avoids drift that would occur with naïve `setTimeout`-per-note approaches.

```typescript
interface PlaybackState {
  isPlaying: boolean;
  currentStep: number;   // current subdivision index
  currentBeat: number;   // current beat number
}
```

**Algorithm:**

```
while nextNoteTime < (audioContext.currentTime + LOOKAHEAD_SECONDS):
    if pattern[currentStep] === '*':
        schedule noteOn(nextNoteTime)
        schedule noteOff(nextNoteTime + noteDurationSec)
    advance currentStep (mod pattern.length)
    nextNoteTime += msPerSubdivision / 1000
```

**Responsibilities:**
- `play(): void` — initialize `nextNoteTime`, start scheduler interval
- `stop(): void` — clear interval, send all-notes-off, reset state
- `isPlaying` signal
- Inject `ConfigService`, `PatternService`, `MidiService`
- Re-read config/pattern on each scheduling tick so live edits take effect without stopping

---

## 5. Components

### 5.1 `PatternInputComponent`

- `<textarea>` or `<input>` bound to a pattern string signal
- Displays real-time visual grid showing each subdivision (lit = `*`, dark = `-`)
- Inline validation message from `PatternService`

### 5.2 `ConfigPanelComponent`

- **Tempo** — range slider + number input (20–300 BPM)
- **Beats per measure** — select (2, 3, 4, 5, 6, 7, 8)
- **Pitch** — note picker (C2–B6) or direct MIDI note number input
- **Note duration** — slider (e.g. 10–90% of subdivision length)
- **MIDI output** — dropdown populated from `MidiService.listOutputs()`

### 5.3 `PlaybackControlsComponent`

- **Play** button — calls `PlaybackService.play()`
- **Stop** button — calls `PlaybackService.stop()`
- Buttons are toggled/disabled based on `PlaybackService.isPlaying`
- Optional: display current beat / step as a pulsing indicator

### 5.4 `AppComponent`

- Composes all child components
- On `ngOnInit`: calls `MidiService.init()`
- Displays top-level MIDI error banner if MIDI is unavailable

---

## 6. Data Flow

```
User types pattern string
        │
        ▼
PatternInputComponent ──signal──► PatternService.parse()
                                          │
                                   ParsedPattern signal
                                          │
ConfigPanelComponent ──signal──► ConfigService (bpm, beatsPerMeasure, note…)
                                          │
                                   RhythmConfig signal
                                          │
                          ┌───────────────┘
                          ▼
                   PlaybackService
              (lookahead scheduler loop)
                          │
                          ▼
                    MidiService
               (noteOn / noteOff)
                          │
                          ▼
               Web MIDI Output Device
           (or Web Audio API fallback)
```

---

## 7. State Management

All cross-component state is owned by services using Angular `signal()` / `computed()` (Angular 17+ signals API). Components inject services directly — no NgRx or external store needed at this scale.

| State | Owner |
|-------|-------|
| Pattern string | `PatternService` (or lifted to `AppComponent` signal passed down) |
| Parsed pattern events | `PatternService` |
| BPM, pitch, config | `ConfigService` |
| MIDI access / outputs | `MidiService` |
| isPlaying, currentStep | `PlaybackService` |

---

## 8. Web MIDI Fallback (Web Audio)

If `navigator.requestMIDIAccess` is unavailable or denied, `MidiService` transparently uses the Web Audio API:

- Create an `AudioContext`
- `noteOn` → create `OscillatorNode` + `GainNode`, connect, start
- `noteOff` → stop oscillator / ramp gain to zero
- Convert MIDI note number to frequency: `f = 440 * 2^((note - 69) / 12)`

This ensures the app works in Chrome without MIDI hardware and in Firefox (which lacks Web MIDI support by default).

---

## 9. File / Folder Structure (inside `src/app/`)

```
src/app/
├── services/
│   ├── config.service.ts
│   ├── pattern.service.ts
│   ├── midi.service.ts
│   └── playback.service.ts
├── components/
│   ├── pattern-input/
│   │   ├── pattern-input.component.ts
│   │   ├── pattern-input.component.html
│   │   └── pattern-input.component.scss
│   ├── config-panel/
│   │   ├── config-panel.component.ts
│   │   ├── config-panel.component.html
│   │   └── config-panel.component.scss
│   └── playback-controls/
│       ├── playback-controls.component.ts
│       ├── playback-controls.component.html
│       └── playback-controls.component.scss
├── models/
│   ├── rhythm-config.model.ts
│   └── parsed-pattern.model.ts
├── app.ts
├── app.html
├── app.scss
├── app.routes.ts
└── app.config.ts
```

---

## 10. Key Technical Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `setTimeout`/`setInterval` drift causing rhythmic inaccuracy | Use Web Audio `AudioContext.currentTime` lookahead scheduler |
| Web MIDI unavailable (Firefox, no hardware) | Web Audio API fallback in `MidiService` |
| Pattern length not divisible by beats-per-measure | Warn in UI; allow fractional subdivisions or pad pattern |
| MIDI permission denied by user | Show clear error banner; offer fallback |
| Live config edits disrupting playback | PlaybackService re-reads config signals each scheduler tick |

---

## 11. Open Questions / Future Enhancements

- Multi-track patterns (multiple pitch rows)
- Pattern editor with clickable grid cells (toggle `*` ↔ `-`)
- Swing/humanize option (offset even-indexed subdivisions)
- Export pattern as MIDI file
- Velocity per step (e.g. `9` for accent, `5` for normal, `-` for rest)
- Pattern chaining / song mode
