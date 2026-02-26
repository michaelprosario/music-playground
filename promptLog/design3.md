# Arpeggio Looping with Tone.js PolySynth — Technical Design

**Date:** 2/26/2026  
**Project:** music-playground / arp-composer3 (Angular)  
**Builds on:** design2.md (ArpeggioPlaybackService + MidiService)

---

## 1. Goal

Replace the current Web Audio triangle-oscillator fallback with **Tone.js**, delivering:

- A rich polyphonic synth timbre via `Tone.PolySynth<Tone.Synth>` — no audio sample files required.
- Continuous, gap-free **looping** of the full chord progression using `Tone.Transport`.
- Minimal disruption to the existing Angular service/component architecture.

---

## 2. Current State Analysis

### What already works
- `ArpeggioPlaybackService` already loops indefinitely:
  ```
  chordIndex = Math.floor(_globalStep / stepsPerMeasure) % progression.chords.length
  ```
  `_globalStep` advances every step, so chord cycling happens automatically — **no structural change** is needed here.
- `MidiService` routes notes either to a real Web MIDI output **or** a Web Audio fallback (triangle oscillator).

### What needs to change
The triangle-oscillator fallback is a crude approximation. The requirement is to use **Tone.js** with a polyphonic synthesizer, which provides:
- Pleasant polyphonic timbre via `Tone.PolySynth<Tone.Synth>` — no network requests or MP3 files needed.
- Tone.js's `Transport` clock for rock-solid timing (avoids `setInterval` drift).
- `Tone.Part` loop semantics that handle the repeating pattern more cleanly.

---

## 3. Chosen Approach — Tone.Transport + Tone.PolySynth

### Option A (Recommended): Replace the scheduler with Tone.js Transport + Part

Tone.js provides two primitives that map perfectly to our use case:

| Tone.js primitive | Our use                                              |
|-------------------|------------------------------------------------------|
| `Tone.Transport`  | Global tempo clock; start / stop playback            |
| `Tone.PolySynth`  | Polyphonic synthesizer; plays chords and arpeggios   |
| `Tone.Synth`      | Voice definition used inside `PolySynth`             |
| `Tone.Part`       | Holds the full sequence (all chords × all steps) and loops it |

### Option B (Minimal): Keep setInterval scheduler, swap audio output only

Replace `_fallbackNoteOn` in `MidiService` with `polySynth.triggerAttackRelease(...)`.  
**Not recommended** — loses the cleaner Transport clock and leaves the manual drift-prone scheduler in place.

---

## 4. Architecture Changes

```
Before (design2.md):
  ArpeggioPlaybackService
    └─ setInterval (25 ms) → Web Audio manual scheduler
         └─ MidiService.noteOn / noteOff
              └─ Web MIDI output  OR  OscillatorNode (triangle)

After (design3.md):
  ArpeggioPlaybackService  (refactored)
    └─ Tone.Transport (start / stop)
    └─ Tone.Part (looping, rebuilt on play)
         └─ ToneSynthService.triggerNote(midiNote, duration, time, velocity)
              └─ Tone.PolySynth<Tone.Synth> → Tone.Destination (Web Audio output)
              └─ MidiService.noteOn (kept for real MIDI output path)
```

`MidiService` is **kept** for real MIDI device output; the `ToneSynthService` is the new audio-only path that fires in parallel (or exclusively when no MIDI device is selected).

---

## 5. New Service: `ToneSynthService`

**File:** `src/app/services/tone-synth.service.ts`

### Responsibilities
- Instantiate a `Tone.PolySynth<Tone.Synth>` and connect it to `Tone.Destination`.
- Expose `triggerNote(midiNote, durationSec, atTime, velocity)`.
- Expose `isReady: Signal<boolean>` (always `true` — no samples to load).
- Expose `releaseAll()` for stop cleanup.

### Why `PolySynth` + `Synth`?

`Tone.PolySynth` manages a pool of monophonic `Tone.Synth` voices automatically, enabling simultaneous notes (chords / fast arpeggios) without manual voice allocation. No MP3 files, CDN requests, or loading state is required — synthesis happens entirely in-browser.

```typescript
import * as Tone from 'tone';
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToneSynthService {
  private _polySynth: Tone.PolySynth<Tone.Synth> | null = null;
  // No async loading needed — synth is ready immediately after init()
  private readonly _ready = signal(false);
  readonly isReady = this._ready.asReadonly();

  init(): void {
    this._polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack:  0.005,
        decay:   0.1,
        sustain: 0.6,
        release: 0.8,
      },
    }).toDestination();

    this._polySynth.maxPolyphony = 16;
    this._ready.set(true);
  }

  triggerNote(midiNote: number, durationSec: number, atTime: number, velocity: number): void {
    if (!this._polySynth || !this._ready()) return;
    const noteName = Tone.Frequency(midiNote, 'midi').toNote();
    const velNorm  = velocity / 127;
    this._polySynth.triggerAttackRelease(noteName, durationSec, atTime, velNorm);
  }

  releaseAll(): void {
    this._polySynth?.releaseAll();
  }
}
```

> **Timbre tuning:** The `oscillator.type` can be changed to `'sine'`, `'sawtooth'`, or `'square'` for different characters. An `amSynth` or `fmSynth` voice can be substituted inside `PolySynth` for richer tones without any additional dependencies.

---

## 6. Refactored `ArpeggioPlaybackService`

### Key changes
1. Remove `setInterval` / manual Web Audio scheduler.
2. Use `Tone.Transport.bpm.value` to set tempo.
3. Build a `Tone.Part` containing every note event for the full progression loop.
4. Set `part.loop = true` and `part.loopEnd` to the total duration of all chords combined.
5. On `play()`: rebuild the Part, sync Transport, start.
6. On `stop()`: stop Transport, `releaseAll()`, clear UI state.

### Building the Part

The Part is rebuilt each time `play()` is called (catches any grid or progression changes):

```typescript
private _buildPart(progression, grid, config): Tone.Part {
  const stepDur    = Tone.Time(this._config.getStepDurationSec()).toSeconds();
  const stepsPerM  = this._config.getStepsPerMeasure();
  const chordCount = progression.chords.length;
  const totalSteps = stepsPerM * chordCount;

  const events: Array<{ time: number; midiNote: number; duration: number; velocity: number }> = [];

  for (let step = 0; step < totalSteps; step++) {
    const stepInMeasure = step % stepsPerM;
    const chordIndex    = Math.floor(step / stepsPerM);
    const chord         = progression.chords[chordIndex];

    for (const row of grid.rows) {
      const cell = row.cells[stepInMeasure];
      if (!cell || cell.state === 'off') continue;

      const midiNote = this._chord.getMidiNoteForRow(chord, row.degree, row.octaveOffset, config.baseOctave);
      const velocity = CELL_VELOCITY[cell.state];
      const ratio    = cell.state === 'staccato' ? STACCATO_DURATION_RATIO : NORMAL_DURATION_RATIO;

      events.push({
        time:     step * stepDur,
        midiNote,
        duration: stepDur * ratio,
        velocity,
      });
    }
  }

  const part = new Tone.Part((time, ev) => {
    this._tone.triggerNote(ev.midiNote, ev.duration, time, ev.velocity);
    // Also fire real MIDI if available
    const ch = config.midiChannel;
    this._midi.noteOn(ch, ev.midiNote, ev.velocity, time);
    this._midi.noteOff(ch, ev.midiNote, time + ev.duration);
    // Update UI playhead
    const chordIdx = Math.floor(ev.time / (stepsPerM * stepDur));
    const stepIdx  = Math.round((ev.time % (stepsPerM * stepDur)) / stepDur);
    Tone.getDraw().schedule(() => {
      this._state.update(s => ({ ...s, currentStep: stepIdx, currentChordIndex: chordIdx }));
    }, time);
  }, events);

  part.loop    = true;
  part.loopEnd = totalSteps * stepDur;
  return part;
}
```

### `play()` / `stop()`

```typescript
async play(): Promise<void> {
  if (this._state().isPlaying) return;
  await Tone.start();                         // unlock Web Audio (user gesture)
  Tone.Transport.bpm.value = this._config.config().bpm;
  Tone.Transport.stop();
  Tone.Transport.position = 0;

  this._part?.dispose();
  this._part = this._buildPart(this._progression, this._grid.grid(), this._config.config());
  this._part.start(0);
  Tone.Transport.start();

  this._state.update(s => ({ ...s, isPlaying: true }));
}

stop(): void {
  if (!this._state().isPlaying) return;
  Tone.Transport.stop();
  this._part?.dispose();
  this._part = null;
  this._tone.releaseAll();
  this._midi.allNotesOff(this._config.config().midiChannel);
  this._state.set({ isPlaying: false, currentStep: 0, currentChordIndex: 0 });
}
```

---

## 7. UI Playhead Sync

`Tone.getDraw()` (formerly `Tone.Draw`) schedules callbacks to fire at the exact audio render time, bridging audio thread timing with the Angular UI:

```typescript
Tone.getDraw().schedule(() => {
  this._state.update(s => ({ ...s, currentStep: stepIdx, currentChordIndex: chordIdx }));
}, time);
```

This replaces the `setTimeout(delayMs)` approximation used in the current implementation.

---

## 8. Dependency Installation

```bash
cd arp-composer3
npm install tone
```

Tone.js v14+ ships ESM-first; Angular's build (Webpack/esbuild) handles it without additional config. **No audio asset files are required** — `Tone.PolySynth` performs real-time synthesis entirely in the browser.

Add to `tsconfig.app.json` if needed:
```json
{
  "compilerOptions": {
    "types": ["tone"]
  }
}
```

---

## 9. Affected Files (Summary)

| File | Change |
|------|--------|
| `package.json` | Add `"tone": "^14.x"` |
| `services/tone-synth.service.ts` | **New** — `PolySynth` wrapper (no MP3 assets) |
| `services/arpeggio-playback.service.ts` | Refactor scheduler → Tone.Transport + Part |
| `services/midi.service.ts` | No change (real MIDI path kept as-is) |
| `app.ts` | Inject `ToneSynthService`, call `init()` in `ngOnInit` (sync) |

---

## 10. Sequence Diagram — Play Flow

```
User clicks [Play]
  → AppComponent.onPlay()
    → ArpeggioPlaybackService.play()
      → Tone.start()                (unlock AudioContext)
      → Transport.bpm = config.bpm
      → _buildPart(...)             (compile all events for full progression loop)
      → part.loop = true
      → part.start(0)
      → Transport.start()
           ↓ (every step, on audio thread)
      → Part callback fires
        → ToneSynthService.triggerNote(midiNote, dur, time, vel)
            → PolySynth.triggerAttackRelease(noteName, dur, time, vel)  ← synthesized audio
        → MidiService.noteOn(...)   ← real MIDI (if device connected)
        → Tone.Draw.schedule(...)   ← update Angular playhead signal
           ↓ (loops forever)
User clicks [Stop]
  → ArpeggioPlaybackService.stop()
    → Transport.stop()
    → part.dispose()
    → ToneSynthService.releaseAll()
    → MidiService.allNotesOff()
```

---

## 11. Edge Cases

| Scenario | Handling |
|----------|----------|
| Synth not yet initialised when user hits Play | `ToneSynthService.isReady()` is `true` immediately after synchronous `init()` — no async wait needed |
| Progression changes while playing | Stop → update progression → Play re-builds Part |
| Grid edited while playing | Same as above (or add a "re-sync" button) |
| No MIDI device | `Tone.PolySynth` is the sole audio output; MidiService MIDI path is skipped silently |
| Real MIDI device present | Both PolySynth + MIDI device fire; user can mute system audio if pure MIDI output is preferred |
| Voice stealing (>16 simultaneous notes) | `PolySynth.maxPolyphony = 16` caps voices; oldest note is released automatically |
