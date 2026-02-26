# Design 5: Music Notation Transcription with abcjs

## Feature Summary

Transcribe the current arpeggio pattern played over each chord in the progression into standard music notation, rendered in a large modal using [abcjs](https://www.abcjs.net/). The modal also provides MIDI playback via abcjs's built-in synth. The notation is rendered **once** (one pass through the entire chord progression), not looped.

---

## High-Level Architecture

```
App (modal trigger)
  └── NotationModalComponent
        ├── AbcNotationService  ← generates ABC string from grid + progression
        └── abcjs               ← renders SVG notation + drives MIDI playback
```

---

## 1. Install abcjs

```bash
npm install abcjs
npm install --save-dev @types/abcjs   # if available, otherwise use declare module
```

abcjs is a pure-JS library with no Angular-specific wrapper needed. Import directly where used.

---

## 2. AbcNotationService

**Location:** `src/app/services/abc-notation.service.ts`

Responsibility: Convert the `ArpGrid`, `ChordProgression`, and `ArpeggioConfig` into a valid [ABC notation](https://abcnotation.com/wiki/abc:standard) string.

### ABC Notation Structure

```
X:1
T:Arpeggio
M:4/4
L:1/16         ← depends on noteLength config (1/4, 1/8, 1/16, etc.)
Q:1/4=80       ← BPM from config
K:C            ← key (always C; chord tones named explicitly)
%%MIDI program 13   ← xylophone
[M1 notes][M2 notes]...
```

Each measure corresponds to one chord in the progression. Notes are derived by iterating through each step column of the grid, collecting all active cells in that column (one note or a chord cluster), and emitting the appropriate ABC note name.

### Key Conversion Logic

#### Step → ABC Note

For a given step `s` across all rows:
1. Collect all rows where `cells[s].state !== 'off'`.
2. For each active row, resolve the MIDI pitch using the existing `ChordService.getMidiNoteForRow(chord, row.degree, row.octaveOffset, baseOctave)`.
3. Convert MIDI pitch → ABC note name:
   - `midiNote % 12` → chromatic pitch class (C, ^C, D, ^D, E, F, ^F, G, ^G, A, ^A, B)
   - `Math.floor(midiNote / 12) - 5` → octave modifier (middle octave = 0; each octave above adds `'`, each below adds `,`)
4. If multiple notes are active in the same step, wrap them in `[...]` (ABC chord).
5. If no notes are active, emit a rest: `z` (full step rest).

#### Note Duration in ABC

The ABC `L:` unit = the `noteLength` from config:
- `sixteenth` → `L:1/16`, each step = `1`
- `eighth` → `L:1/8`, each step = `1`
- `quarter` → `L:1/4`, each step = `1`

Staccato cells: append `!staccato!` decoration before the note in ABC.

#### Method Signature

```typescript
generateAbc(
  grid: ArpGrid,
  progression: ChordProgression,
  config: ArpeggioConfig,
  chordService: ChordService
): string
```

---

## 3. NotationModalComponent

**Location:** `src/app/components/notation-modal/notation-modal.component.ts`

### Template layout

```
┌─────────────────────────────────────────────┐
│  Music Notation Preview              [✕ Close]│
├─────────────────────────────────────────────┤
│                                             │
│   [abcjs SVG notation renders here]         │
│                                             │
├─────────────────────────────────────────────┤
│  [▶ Play]  [■ Stop]  [Download MIDI]        │
└─────────────────────────────────────────────┘
```

### Component logic (key details)

```typescript
@Component({
  selector: 'app-notation-modal',
  standalone: true,
  // ...
})
export class NotationModalComponent implements AfterViewInit, OnDestroy {
  @Input() abcString = '';

  private synth: abcjs.SynthController | null = null;
  private visualObj: abcjs.TuneObject[] = [];

  ngAfterViewInit(): void {
    // 1. Render notation SVG
    this.visualObj = abcjs.renderAbc('notation-target', this.abcString, {
      responsive: 'resize',
      add_classes: true,
    });

    // 2. Initialize MIDI synth
    if (abcjs.synth.supportsAudio()) {
      this.synth = new abcjs.synth.SynthController();
      this.synth.load('#synth-controls', null, {
        displayLoop: false,
        displayRestart: true,
        displayPlay: true,
        displayProgress: true,
      });
      this.synth.setTune(this.visualObj[0], false);
    }
  }

  ngOnDestroy(): void {
    this.synth?.stop();
  }
}
```

The modal is shown/hidden via a boolean signal `showNotation` on the `App` component. When `showNotation` is set to `true`, the app generates the ABC string first and passes it as an `@Input()` to the modal.

### Overlay / modal CSS

Use a full-screen overlay backdrop with `position: fixed; inset: 0`. The inner modal box is centered, large (`width: min(92vw, 1100px); max-height: 85vh; overflow-y: auto`). This ensures the notation has sufficient horizontal space to render all measures.

---

## 4. App Component Changes

### Trigger button

Add a **"Show Notation"** button to `ToolbarComponent` (emits a new `showNotation` output).

### App orchestration

```typescript
showNotation = signal(false);
abcString    = signal('');

openNotation(): void {
  const abc = this._abcSvc.generateAbc(
    this._gridSvc.grid(),
    this._progression,
    this._configSvc.config(),
    this._chordSvc,
  );
  this.abcString.set(abc);
  this.showNotation.set(true);
}
```

### Template addition

```html
@if (showNotation()) {
  <app-notation-modal
    [abcString]="abcString()"
    (close)="showNotation.set(false)"
  />
}
```

---

## 5. One-Pass (Non-Looping) Rendering

The ABC string encodes the chord progression exactly **once**: each chord becomes exactly one measure of ABC notation representing the arpeggio pattern transposed to that chord. There is no loop directive in the ABC string. The abcjs synth plays it once and stops. This keeps the notation readable and avoids repetitive scrolling.

---

## 6. File Change Summary

| File | Action |
|------|--------|
| `package.json` | Add `abcjs` dependency |
| `services/abc-notation.service.ts` | New — ABC string generator |
| `components/notation-modal/notation-modal.component.ts` | New — modal with abcjs render + synth |
| `components/notation-modal/notation-modal.component.scss` | New — modal/overlay styles |
| `components/toolbar/toolbar.component.ts` | Add `showNotation` output + button |
| `app.ts` | Inject `AbcNotationService`, add `openNotation()`, `showNotation` signal |
| `app.html` | Add `@if` block for modal, wire toolbar `showNotation` event |

---

## 7. Edge Cases

- **Empty grid**: if all cells are `off`, the ABC string contains only rests. Still valid; notation renders as rests.
- **Invalid progression**: the "Show Notation" button is disabled when `progression.valid === false`.
- **Audio not supported**: if `abcjs.synth.supportsAudio()` returns false, hide the Play/Stop controls gracefully with an info message.
- **Staccato**: map `staccato` cell state to `!staccato!` ABC decoration; use the standard duration.
