# Live Arpeggio Hot-Swap — Technical Design

**Date:** 2/26/2026  
**Project:** music-playground / arp-composer3 (Angular)  
**Builds on:** design3.md (Tone.Transport + Tone.Part + ToneSynthService)

---

## 1. Goal

While the sequencer is playing, any cell edit made in the arp grid (toggle on/off, cycle velocity, randomize row, etc.) should be reflected in the **next audible loop iteration** — without stopping or restarting playback.

---

## 2. Current State Analysis

### What already works
- `ArpGridService.grid` is an Angular `Signal<ArpGrid>`. Every cell edit calls `_grid.update(...)`, which emits a new signal value automatically.
- `ArpeggioPlaybackService` builds a `Tone.Part` at `play()` time containing a snapshot of the grid and loops it indefinitely.

### What is missing
`Tone.Part` is **static** — its event list is compiled once at construction. Grid edits made after `play()` are invisible to the running Part. The playback service must detect grid changes and swap in a freshly compiled Part.

---

## 3. Chosen Approach — Angular `effect()` + Loop-Boundary Hot-Swap

### Why `effect()`?
Angular's `effect()` primitive fires automatically whenever any reactive signal it reads changes. Placing one in `ArpeggioPlaybackService` that reads `this._grid.grid()` means zero boilerplate in components — no `EventEmitter`, no explicit call, no subscription management.

### Why loop-boundary swap (not immediate)?
Replacing the Part mid-loop is audibly safe in Tone.js (the Transport keeps running), but discarding a Part while its callback may be mid-fire can cause a brief duplicate or missing note. Waiting for the **loop boundary** (the instant the Part wraps back to time 0) ensures a clean cut with no notes dropped or doubled.

### Swap Strategy

```
grid signal changes
  └─ effect fires
       └─ _pendingRebuild = true      (flag, no audio action yet)

Part callback fires — first event of a new loop (time ≈ 0 mod loopDuration)
  └─ if (_pendingRebuild) {
         dispose old Part
         build new Part from current grid snapshot
         part.start(nextLoopStart)
         _pendingRebuild = false
     }
```

Because `Tone.Part` callbacks run on the audio render thread with look-ahead, detecting "first event of a new loop" is straightforward: the event with `time === 0` (the smallest `time` value among all Part events) fires once per loop.

---

## 4. Architecture Changes

```
Before (design3.md):
  play()
    → Tone.Part (frozen snapshot of grid at play time)
         loops forever, ignores later grid edits

After (design4.md):
  play()
    → Tone.Part (initial snapshot)

  effect() watches _grid.grid()
    → sets _pendingRebuild = true on any change

  Part callback — first step of each new loop
    → if _pendingRebuild: hot-swap Part with fresh snapshot
```

No other services, components, or UI code changes.

---

## 5. Implementation Details

### 5.1 New private state in `ArpeggioPlaybackService`

```typescript
private _part: Tone.Part | null = null;
private _pendingRebuild = false;
private _effectRef: EffectRef | null = null;
```

### 5.2 Register `effect()` on `play()`

Start the watcher only while playing; destroy it on `stop()` to avoid spurious triggers.

```typescript
import { effect, EffectRef, Injector, inject } from '@angular/core';

// In constructor:
private readonly _injector = inject(Injector);

async play(): Promise<void> {
  if (this._state().isPlaying) return;
  if (!this._progression.valid || this._progression.chords.length === 0) return;

  await Tone.start();
  const transport = Tone.getTransport();
  transport.bpm.value = this._config.config().bpm;
  transport.stop();
  transport.position = 0;

  this._part?.dispose();
  this._part = this._buildPart(this._progression, this._grid.grid(), this._config.config());
  this._part.start(0);
  transport.start();

  this._state.update(s => ({ ...s, isPlaying: true, currentStep: 0, currentChordIndex: 0 }));

  // Watch for grid changes while playing
  this._effectRef = effect(() => {
    this._grid.grid();            // read to establish reactive dependency
    if (this._state().isPlaying) {
      this._pendingRebuild = true;
    }
  }, { injector: this._injector });
}
```

### 5.3 Perform the swap inside `_buildPart`'s callback

Identify the "first event of a loop" by checking whether `ev.isFirstInLoop` is `true`. Add this flag when building the event list:

```typescript
// In _buildPart event construction loop:
events.push({
  time:          step * stepDur,
  midiNote,
  duration:      stepDur * ratio,
  velocity,
  stepIdx:       stepInMeasure,
  chordIdx:      chordIndex,
  isFirstInLoop: step === 0,   // ← new field
});
```

Then, in the Part callback:

```typescript
const part = new Tone.Part<NoteEvent>((time, ev) => {

  // Hot-swap at loop boundary
  if (ev.isFirstInLoop && this._pendingRebuild) {
    this._pendingRebuild = false;
    const snapshot = this._grid.grid();
    const cfg      = this._config.config();
    const prog     = this._progression;

    // Schedule the swap at the next audio tick to avoid re-entrant dispose
    Tone.getDraw().schedule(() => {
      if (!this._state().isPlaying) return;
      const newPart = this._buildPart(prog, snapshot, cfg);
      this._part?.dispose();
      this._part = newPart;
      newPart.start(0);             // Transport keeps running; new Part enters at beat 0 of next loop
    }, time);
  }

  // Normal note triggering
  this._tone.triggerNote(ev.midiNote, ev.duration, time, ev.velocity);
  // ... MIDI and Draw UI update as before
}, events);
```

> **Note:** The `Tone.getDraw().schedule()` wrapper ensures the Part disposal and re-creation happen on the main JS thread (not inside the audio callback), preventing any race condition.

### 5.4 Tear down the effect on `stop()`

```typescript
stop(): void {
  if (!this._state().isPlaying) return;

  this._effectRef?.destroy();
  this._effectRef = null;
  this._pendingRebuild = false;

  Tone.getTransport().stop();
  this._part?.dispose();
  this._part = null;
  this._tone.releaseAll();
  this._midi.allNotesOff(this._config.config().midiChannel);
  this._state.set({ isPlaying: false, currentStep: 0, currentChordIndex: 0 });
}
```

---

## 6. Interface Change — `NoteEvent`

Add `isFirstInLoop` to the private event type:

```typescript
interface NoteEvent {
  time:          number;
  midiNote:      number;
  duration:      number;
  velocity:      number;
  stepIdx:       number;
  chordIdx:      number;
  isFirstInLoop: boolean;   // ← new
}
```

---

## 7. Edge Cases

| Scenario | Handling |
|----------|----------|
| Grid edited multiple times before the loop wraps | `_pendingRebuild` is a simple flag; only the most recent grid snapshot is used — all intermediate edits are coalesced |
| Empty grid after edit (all cells off) | `_buildPart` produces an empty event list; `Tone.Part` loops silently with no audio output; no crash |
| BPM changed while playing | Same mechanism — also watch `_config.config()` signal in the effect; `_pendingRebuild = true`; new Part picks up new `stepDur` |
| Chord progression changed while playing | Same mechanism — `setProgression()` is called from the component; effect can also watch a `_progressionSignal` if `_progression` is converted to a signal |
| Very fast edits (< one loop length) | Coalesced by the flag; at most one Part rebuild per loop cycle — no stacking up |
| User stops during a swap in `getDraw` | `stop()` sets `isPlaying: false`; the `getDraw` callback checks this and returns early |

---

## 8. Affected Files (Summary)

| File | Change |
|------|--------|
| `services/arpeggio-playback.service.ts` | Add `_pendingRebuild` flag, `_effectRef`, `effect()` in `play()`, `isFirstInLoop` check in Part callback, effect tear-down in `stop()` |
| `models/arp-cell.model.ts` (or inline) | `NoteEvent` gains `isFirstInLoop: boolean` |
| All other files | **No change** |

---

## 9. Sequence Diagram — Live Edit Flow

```
User clicks cell in ArpGridComponent
  → ArpGridService.cycleCell()
    → _grid signal emits new value

effect() in ArpeggioPlaybackService fires
  → _pendingRebuild = true

... Transport continues playing current Part ...

Part callback fires — ev.isFirstInLoop === true
  → getDraw().schedule(() => {
       build new Tone.Part from latest grid snapshot
       old Part.dispose()
       new Part.start(0)
     })

Next audio frame:
  → getDraw callback runs on JS thread
    → new Part is live; plays updated pattern

... loop continues seamlessly ...
```

---

## 10. Optional Enhancement — Sub-Loop Swap

For very long progressions (e.g., 8 chords × 16 steps = 128 events), the user might want edits reflected faster than one full loop length. In that case, instead of waiting for `step === 0`, wait for the **chord boundary** (`ev.stepIdx === 0` for the chord currently playing). This is a one-line change to the swap trigger condition and does not alter the rest of the architecture.
