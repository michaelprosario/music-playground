# Design 6: Replace Tone.js with JZZ + jzz-synth-tiny

## Feature Summary

Replace the Tone.js audio synthesis and transport engine with the **JZZ** MIDI library plus the **jzz-synth-tiny** soft-synth plugin. JZZ provides a lightweight MIDI engine that works in both browsers and Node.js. jzz-synth-tiny is a Web Audio General MIDI synthesizer exposed as a virtual JZZ MIDI output port — no external software or hardware MIDI device is required.

---

## Motivation

- Tone.js carries a large bundle and couples audio scheduling tightly to its own Transport abstraction.
- JZZ + jzz-synth-tiny offer a leaner stack: MIDI messages are the canonical data format, and jzz-synth-tiny renders them to Web Audio automatically.
- All existing note data (MIDI note numbers, velocities, durations) maps directly to JZZ's `noteOn` / `noteOff` / `note` API calls.

---

## Packages

| Package | Purpose |
|---------|---------|
| `jzz` | MIDI engine, browser-compatible with Web Audio and Web MIDI |
| `jzz-synth-tiny` | Web Audio General MIDI soft synth exposed as a virtual JZZ output port |

```bash
npm install jzz jzz-synth-tiny
```

TypeScript types are bundled with `jzz` (`@types/jzz` is not needed separately).

---

## High-Level Architecture Change

### Before (Tone.js)

```
ArpeggioPlaybackService
  ├── Tone.Transport + Tone.Part  ← scheduling engine
  └── ToneSynthService            ← Tone.PolySynth (triangle oscillator)
        └── Web Audio (via Tone)
```

### After (JZZ)

```
ArpeggioPlaybackService
  ├── setInterval scheduler       ← step clock (JS main thread)
  └── JzzSynthService             ← JZZ engine + jzz-synth-tiny
        └── jzz-synth-tiny (Web Audio GM synth, program 13 = Xylophone)
```

Hardware MIDI output (`MidiService` / Web MIDI API) is preserved as an optional parallel path.

---

## Component Changes

### 1. Remove `ToneSynthService`

`tone-synth.service.ts` is deleted and replaced by `jzz-synth.service.ts`.

### 2. New `JzzSynthService` (`jzz-synth.service.ts`)

Wraps the JZZ engine and jzz-synth-tiny:

```typescript
import JZZ from 'jzz';
import 'jzz-synth-tiny';            // registers the plugin with JZZ

@Injectable({ providedIn: 'root' })
export class JzzSynthService {
  private _port: any = null;

  async init(): Promise<void> {
    const engine = await JZZ();
    this._port = await engine.openMidiOut('Tiny Synth');
    await this._port.program(0, 13); // GM program 13 = Xylophone
  }

  noteOn(channel: number, note: number, velocity: number): void { ... }
  noteOff(channel: number, note: number): void { ... }
  note(channel: number, note: number, velocity: number, durationMs: number): void { ... }
  allNotesOff(): void { ... }
}
```

- Channel numbers follow the same 1-based convention used by `MidiService`.
- `note()` sends noteOn + waits + noteOff in a single JZZ chain call.

### 3. Rewrite `ArpeggioPlaybackService`

Remove all Tone.js imports. Replace `Tone.Transport` + `Tone.Part` with a **`setInterval`-based step clock**:

#### Scheduler Design

```
play() {
  1. Build NoteEvent[] from grid + progression (same logic as before)
  2. Start setInterval at stepDurationMs
     - each tick: play all NoteEvents for currentStep via JzzSynthService.note()
     - increment currentStep, wrap at totalSteps (loop)
     - update Angular state signal (currentStep, chordIndex)
}

stop() {
  clearInterval
  allNotesOff()
  reset state
}
```

#### Hot-swap on Grid Change

An Angular `effect()` still watches `ArpGridService.grid()` while playing and sets `_pendingRebuild = true`. On the **next step-0** (loop boundary), the scheduler rebuilds the `NoteEvent[]` array in place — no audio thread synchronization needed since everything runs on the main JS thread.

#### Step Duration Calculation

Step duration in milliseconds is derived from `ConfigService.getStepDurationSec() * 1000`. This matches the existing formula:

```
stepDurationMs = (60000 / bpm) / (stepsPerMeasure / 4)
```

---

## Timing Characteristics

| Approach | Jitter | Notes |
|----------|--------|-------|
| `Tone.Part` (Web Audio clock) | ~0–1 ms | Most precise |
| `setInterval` + immediate `noteOn` | ~5–15 ms | Acceptable for music playground |
| Lookahead scheduler | ~1–3 ms | Can be adopted later if needed |

For a music playground at typical tempos (80–160 BPM, 16th-note steps = 94–188 ms/step), `setInterval` jitter is imperceptible.

---

## Initialization Flow

1. **`app.ts` `ngOnInit()`** calls `this._jzzSvc.init()` (async, awaited — same as how Tone.start() was called before interaction).
2. jzz-synth-tiny opens a virtual MIDI port named `'Tiny Synth'` backed by Web Audio.
3. A GM program-change to 13 (Xylophone) is sent on channel 1.
4. The app is ready to play.

---

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `jzz`, `jzz-synth-tiny`; remove `tone` |
| `services/tone-synth.service.ts` | **Replaced** by `jzz-synth.service.ts` |
| `services/jzz-synth.service.ts` | **New** — JZZ + jzz-synth-tiny wrapper |
| `services/arpeggio-playback.service.ts` | Rewrite scheduler, swap synth dependency |
| `app.ts` | Import `JzzSynthService`; remove `ToneSynthService` |

---

## Implementation Steps

```bash
# 1. Install packages
npm install jzz jzz-synth-tiny

# 2. Create JzzSynthService
# 3. Rewrite ArpeggioPlaybackService
# 4. Update app.ts
# 5. Remove tone from package.json
```
