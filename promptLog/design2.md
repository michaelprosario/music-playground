# Arpeggio & Chord Progression Player — Technical Design

**Date:** 2/26/2026  
**Project:** music-playground / arp-composer3 (Angular)

---

## 1. Overview

A browser-based Angular application that lets a music maker:

1. Type a chord progression (e.g. `Em C D G`).
2. Paint a per-row step-sequencer grid where each row maps to a chord tone across two octaves.
3. Loop the resulting arpeggio over Web MIDI (xylophone sound), with per-cell velocity control and staccato articulation.
4. Save and load arpeggio grid patterns as JSON, and export the full sequence as a MIDI file.

The UI is modelled after the screenshot reference: a toolbar across the top, a step-sequencer grid with labeled rows, and a chord progression text input below the grid.

This application is implemented as a new Angular workspace (`arp-composer3`) that re-uses code and conventions established in `arp-composer2`.

---

## 2. Visual Layout (AppComponent)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Play] [Stop] [Clear] [Midi Export] [Export Arp] [Load Arp]            │
│                                             Note length: [Sixteenth ▼]  │
│                                             Tempo:       [80        ]   │
├─────────────────────────────────────────────────────────────────────────┤
│  Arp Composer                                                            │
│                                                                          │
│              ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐        │
│  (pos bar)   │  │  │  │  │  │  │  │  │  │  │  │  │  │  │▶ │  │        │
│              └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘        │
│  Fifth-2  [Clear][1][2][Rnd] │██│  │██│  │  │S │  │██│  │  │██│  │    │
│  Third-2  [Clear][1][2][Rnd] │  │██│  │S │S │  │██│  │  │██│  │S │    │
│  2nd-2    [Clear][1][2][Rnd] │  │  │  │  │  │S │  │  │██│  │  │S │    │
│  Root-2   [Clear][1][2][Rnd] │  │  │  │  │S │  │  │██│  │  │██│  │    │
│  Fifth-1  [Clear][1][2][Rnd] │  │██│  │  │S │  │  │  │██│  │  │██│    │
│  Third-1  [Clear][1][2][Rnd] │██│  │  │S │  │██│  │  │  │██│  │  │    │
│  2nd-1    [Clear][1][2][Rnd] │  │  │S │  │  │  │██│  │  │  │██│  │    │
│  Root-1   [Clear][1][2][Rnd] │S │  │██│  │  │██│  │  │██│  │  │██│    │
│              └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  Chord Progression:                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Em C D G                                                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘

Legend: ██ = active note (dark = V2 loud, lighter = V1 soft)   S = staccato
```

---

## 3. Grid Row Model

The grid has **8 rows**, representing chord tones in two octaves (octave 1 = base octave, octave 2 = base octave + 1):

| Row label | Degree  | Octave offset | Example for Em (E minor: E G B) |
|-----------|---------|---------------|----------------------------------|
| Root-1    | Root    | +0            | E4 (MIDI 64)                     |
| 2nd-1     | 2nd     | +0            | G4 (MIDI 67) — 2nd chord tone   |
| Third-1   | Third   | +0            | B4 (MIDI 71) — 3rd chord tone   |
| Fifth-1   | Fifth   | +0            | E5 (MIDI 76) — repeats root +8va|
| Root-2    | Root    | +1            | E5 (MIDI 76)                     |
| 2nd-2     | 2nd     | +1            | G5 (MIDI 79)                     |
| Third-2   | Third   | +1            | B5 (MIDI 83)                     |
| Fifth-2   | Fifth   | +1            | E6 (MIDI 88)                     |

The "degree" labels are ordinal positions in the chord's note array (not fixed interval names), so they adapt to any chord quality. For a triad the 4th position (Fifth-1) wraps to the root an octave up.

---

## 4. Cell State Model

Each cell in the grid has one of four states:

| State     | Display        | MIDI velocity | Note duration           |
|-----------|----------------|---------------|-------------------------|
| `off`     | Empty cell     | —             | —                       |
| `v1`      | Light purple   | 64            | `stepDurationSec * 0.85`|
| `v2`      | Dark purple    | 100           | `stepDurationSec * 0.85`|
| `staccato`| Cell with "S"  | 80            | `stepDurationSec * 0.20`|

Clicking a cell cycles: `off → v1 → v2 → staccato → off`.

The **[1]** and **[2]** row buttons set every currently-active cell in that row to `v1` or `v2` respectively (leaving `off` cells untouched).

The **[Rnd]** row button randomly activates roughly half of the row's cells with random states (`v1`, `v2`, or `staccato`), replacing the current row pattern.

The **[Clear]** row button sets all cells in the row to `off`.

The global **[Clear]** toolbar button resets the entire grid to `off`.

---

## 5. Note Length & Timing

The **Note length** dropdown controls the step subdivision:

| Label       | Steps per measure | Step duration at BPM=80 |
|-------------|-------------------|-------------------------|
| Whole       | 1                 | 3000 ms                 |
| Half        | 2                 | 1500 ms                 |
| Quarter     | 4                 | 750 ms                  |
| Eighth      | 8                 | 375 ms                  |
| Sixteenth   | 16                | 187.5 ms                |

The grid always displays **16 columns**. When note length is coarser than sixteenth, each column represents a proportionally longer slice:

```
stepDurationSec = (60 / bpm) / (stepsPerMeasure / 4)
stepsPerBeat    = stepsPerMeasure / 4    // beats per measure fixed at 4
```

---

## 6. Chord String Specification

Entered in the text area below the grid. Space-separated chord symbols, one chord per measure:

```
Em C D G
C C F G
Am F C G
```

Supported chord qualities:

| Symbol suffix | Quality    | Intervals (semitones)  |
|---------------|------------|------------------------|
| *(none)*      | Major      | 0, 4, 7                |
| `m`           | Minor      | 0, 3, 7                |
| `maj7`        | Major 7    | 0, 4, 7, 11            |
| `m7`          | Minor 7    | 0, 3, 7, 10            |
| `7`           | Dominant 7 | 0, 4, 7, 10            |
| `dim`         | Diminished | 0, 3, 6                |
| `aug`         | Augmented  | 0, 4, 8                |
| `sus2`        | Sus2       | 0, 2, 7                |
| `sus4`        | Sus4       | 0, 5, 7                |

Root names: `C C# Db D D# Eb E F F# Gb G G# Ab A A# Bb B`.

---

## 7. Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                         Angular App (arp-composer3)                   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                        AppComponent                            │  │
│  │  ┌────────────────────┐   ┌─────────────────────────────────┐  │  │
│  │  │ ToolbarComponent   │   │ ConfigPanelComponent            │  │  │
│  │  │ Play/Stop/Clear/   │   │ (note length dropdown + tempo)  │  │  │
│  │  │ Export/Load        │   └─────────────────────────────────┘  │  │
│  │  └────────────────────┘                                        │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │                  ArpGridComponent                       │   │  │
│  │  │  StepPositionBarComponent (playhead indicator row)      │   │  │
│  │  │  ArpRowComponent × 8      (label + controls + cells)    │   │  │
│  │  │    ArpCellComponent × 16  (single clickable cell)       │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │            ChordInputComponent                          │   │  │
│  │  │  (textarea + validation error message)                  │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │ ChordService │  │ ArpGridSvc   │  │ ConfigService (REUSED)     │  │
│  │  (NEW)       │  │  (NEW)       │  └────────────────────────────┘  │
│  └──────────────┘  └──────────────┘                                   │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │          ArpeggioPlaybackService  (NEW)                          │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │          MidiService  (REUSED + programChange)                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │          MidiExportService  (NEW)                                │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 8. Data Models

### 8.1 `arp-cell.model.ts` *(new)*

```typescript
export type CellState = 'off' | 'v1' | 'v2' | 'staccato';

export interface ArpCell {
  state: CellState;
}

export const CELL_VELOCITY: Record<CellState, number> = {
  off: 0,
  v1: 64,
  v2: 100,
  staccato: 80,
};

export const STACCATO_DURATION_RATIO = 0.20;
export const NORMAL_DURATION_RATIO   = 0.85;
```

### 8.2 `arp-grid.model.ts` *(new)*

```typescript
export type ChordDegree = 'root' | '2nd' | 'third' | 'fifth';

export interface ArpRow {
  label: string;        // e.g. "Root-1", "Third-2"
  degree: ChordDegree;
  octaveOffset: number; // 0 = base octave, 1 = base octave + 1
  cells: ArpCell[];     // length = stepsPerMeasure (default 16)
}

export interface ArpGrid {
  rows: ArpRow[];          // 8 rows, top = Fifth-2, bottom = Root-1
  stepsPerMeasure: number; // 1 | 2 | 4 | 8 | 16
}
```

### 8.3 `chord.model.ts` *(new)*

```typescript
export type ChordQuality =
  | 'major' | 'minor' | 'maj7' | 'm7' | '7'
  | 'dim' | 'aug' | 'sus2' | 'sus4';

export interface Chord {
  symbol: string;       // raw token, e.g. "Em"
  rootName: string;     // "E"
  quality: ChordQuality;
  midiNotes: number[];  // root-position notes at base octave, e.g. [64, 67, 71]
}

export interface ChordProgression {
  raw: string;
  chords: Chord[];
  valid: boolean;
  error: string | null;
}
```

### 8.4 `arpeggio-config.model.ts` *(new)*

```typescript
export type NoteLength = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export interface ArpeggioConfig {
  bpm: number;
  noteLength: NoteLength;
  midiChannel: number;
  baseOctave: number;
}

export const DEFAULT_ARPEGGIO_CONFIG: ArpeggioConfig = {
  bpm: 80,
  noteLength: 'sixteenth',
  midiChannel: 1,
  baseOctave: 4,
};

export const STEPS_PER_MEASURE: Record<NoteLength, number> = {
  whole: 1, half: 2, quarter: 4, eighth: 8, sixteenth: 16,
};
```

---

## 9. Services

### 9.1 `MidiService` — **REUSED + `programChange()`**

Copy from `arp-composer2`. Add:

```typescript
programChange(channel: number, program: number): void {
  const output = this._getSelectedOutput();
  if (!output) return;
  output.send([0xC0 | ((channel - 1) & 0x0f), program & 0x7f]);
}
```

Web Audio fallback: use `triangle` oscillator with percussive envelope (attack 1 ms, decay 300 ms, sustain 0) to approximate xylophone timbre. Send GM program 13 (Xylophone) on play start.

### 9.2 `ConfigService` — **REUSED, swap model**

Copy from `arp-composer2`. Replace `RhythmConfig` with `ArpeggioConfig`. Keep `getMsPerSubdivision()` and `getNoteDurationMs()` helpers. Add:

```typescript
getStepsPerMeasure(): number {
  return STEPS_PER_MEASURE[this.config().noteLength];
}
```

### 9.3 `ChordService` *(new, stateless)*

```typescript
@Injectable({ providedIn: 'root' })
export class ChordService {
  // Parses "Em C D G" into a ChordProgression
  parse(input: string): ChordProgression;

  // Returns the MIDI note number for a specific row of the grid
  getMidiNoteForRow(chord: Chord, degree: ChordDegree, octaveOffset: number, baseOctave: number): number;

  private _parseSymbol(token: string): Chord | null;
  private _rootSemitone(name: string): number;   // C=0 … B=11
  private _intervals(q: ChordQuality): number[];
}
```

**Row-to-MIDI mapping:**

```
intervals  = _intervals(chord.quality)          // e.g. [0, 3, 7] for minor
degreeIdx  = { root:0, '2nd':1, third:2, fifth:3 }[degree]
interval   = intervals[degreeIdx % intervals.length]
octaveWrap = floor(degreeIdx / intervals.length) // wraps back to root +8va for 4th row
midiNote   = 12*(baseOctave + octaveOffset + octaveWrap + 1)
           + _rootSemitone(chord.rootName)
           + interval
```

### 9.4 `ArpGridService` *(new)*

Owns all mutable grid state as Angular signals. Provides row/cell mutation and JSON serialization.

```typescript
@Injectable({ providedIn: 'root' })
export class ArpGridService {
  readonly grid: Signal<ArpGrid>;

  cycleCell(rowIdx: number, stepIdx: number): void;  // off→v1→v2→staccato→off
  setRowVelocity(rowIdx: number, v: 'v1' | 'v2'): void;
  randomizeRow(rowIdx: number): void;
  clearRow(rowIdx: number): void;
  clearAll(): void;

  resizeSteps(stepsPerMeasure: number): void; // called when note length changes

  exportJson(): string;
  importJson(json: string): void;
}
```

### 9.5 `ArpeggioPlaybackService` *(new)*

Extends the Web Audio lookahead-scheduler pattern from `arp-composer2`. Reads the grid instead of a single pattern string and resolves MIDI notes per row via `ChordService`.

```typescript
export interface ArpeggioPlaybackState {
  isPlaying: boolean;
  currentStep: number;       // 0-based within the measure
  currentChordIndex: number; // index into ChordProgression
}

@Injectable({ providedIn: 'root' })
export class ArpeggioPlaybackService {
  constructor(
    private _config: ConfigService,
    private _grid: ArpGridService,
    private _chord: ChordService,
    private _midi: MidiService,
  ) {}

  readonly state: Signal<ArpeggioPlaybackState>;
  play(): void;
  stop(): void;
  private _schedule(): void;
}
```

**Scheduler algorithm:**

```
stepsPerMeasure = configService.getStepsPerMeasure()
stepDurationSec = (60 / bpm) / (stepsPerMeasure / 4)

on each scheduled step s:
  chordIndex = floor(globalStep / stepsPerMeasure) % progression.length
  chord      = progression.chords[chordIndex]

  for each row r (0..7):
    cell = grid.rows[r].cells[s]
    if cell.state === 'off': continue

    midiNote     = chordService.getMidiNoteForRow(chord, row.degree, row.octaveOffset, baseOctave)
    velocity     = CELL_VELOCITY[cell.state]
    ratio        = cell.state === 'staccato' ? STACCATO_DURATION_RATIO : NORMAL_DURATION_RATIO
    durationSec  = stepDurationSec * ratio

    midi.noteOn(channel, midiNote, velocity, scheduledTime)
    midi.noteOff(channel, midiNote, scheduledTime + durationSec)

  globalStep++
  nextNoteTimeSec += stepDurationSec
```

Multiple rows can fire simultaneously on the same step, producing chordal stabs within the arpeggio.

### 9.6 `MidiExportService` *(new)*

Renders one complete loop (all chords × one measure each) to a Type-1 MIDI file and triggers a browser download.

```typescript
@Injectable({ providedIn: 'root' })
export class MidiExportService {
  export(
    grid: ArpGrid,
    progression: ChordProgression,
    config: ArpeggioConfig,
    chordService: ChordService,
  ): void; // builds binary MIDI blob → URL.createObjectURL → <a>.click()
}
```

---

## 10. Components

| Component | Source | Responsibility |
|---|---|---|
| `ToolbarComponent` | New | Play, Stop, Clear, Midi Export, Export Arp, Load Arp buttons |
| `ConfigPanelComponent` | Adapted from arp-composer2 | Note length dropdown + Tempo number input, top-right |
| `ArpGridComponent` | New | Renders the 8-row grid and step-position bar |
| `StepPositionBarComponent` | New | Dark top row; green cell tracks `currentStep` during playback |
| `ArpRowComponent` | New | Row label, [Clear][1][2][Rnd] buttons, 16 `ArpCellComponent`s |
| `ArpCellComponent` | New | Single clickable cell; CSS class driven by `CellState` |
| `ChordInputComponent` | New | Textarea for chord string; shows `ChordService` parse errors inline |

---

## 11. Reuse Summary

| File from arp-composer2 | Action for arp-composer3 |
|---|---|
| `midi.service.ts` | Copy + add `programChange()`, update fallback envelope to triangle/percussive |
| `config.service.ts` | Copy + swap to `ArpeggioConfig`, add `getStepsPerMeasure()` |
| `pattern.service.ts` | **Not reused** — replaced by `ArpGridService` |
| `parsed-pattern.model.ts` | **Not reused** — replaced by `arp-grid.model.ts` |
| `playback.service.ts` | Adapt scheduler loop into `ArpeggioPlaybackService` |
| `rhythm-config.model.ts` | Replaced by `arpeggio-config.model.ts` |
| SCSS colour palette | Copy purple/button vars for visual consistency |

New files: `arp-cell.model.ts`, `arp-grid.model.ts`, `chord.model.ts`, `arpeggio-config.model.ts`, `chord.service.ts`, `arp-grid.service.ts`, `arpeggio-playback.service.ts`, `midi-export.service.ts`, and all new component files.

---

## 12. Implementation Plan

1. **Scaffold** `arp-composer3` with `ng new`.
2. **Copy** `midi.service.ts` and `config.service.ts` from `arp-composer2`; apply updates.
3. **Implement** `chord.model.ts` + `ChordService` (pure, fully unit-testable).
4. **Implement** `arp-cell.model.ts`, `arp-grid.model.ts`, `ArpGridService`.
5. **Implement** `ArpCellComponent`, `ArpRowComponent`, `StepPositionBarComponent`, `ArpGridComponent`.
6. **Implement** `ArpeggioPlaybackService` using the multi-row scheduler algorithm.
7. **Implement** `ChordInputComponent` wired to `ChordService`.
8. **Implement** `MidiExportService`, Export Arp (JSON download), Load Arp (file input).
9. **Implement** `ToolbarComponent` and `ConfigPanelComponent`.
10. **Wire** `AppComponent` to match the layout in §2.
11. **Test**: chord transitions, simultaneous row notes, staccato duration, MIDI export file validity, Web Audio fallback timbre.
