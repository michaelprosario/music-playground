import { Injectable, NgZone, signal, Signal, computed, effect, EffectRef, Injector, inject } from '@angular/core';
import { ConfigService } from './config.service';
import { ArpGridService } from './arp-grid.service';
import { ChordService } from './chord.service';
import { MidiService } from './midi.service';
import { JzzSynthService } from './jzz-synth.service';
import { ChordProgression } from '../models/chord.model';
import { ArpGrid } from '../models/arp-grid.model';
import { ArpeggioConfig } from '../models/arpeggio-config.model';
import { CELL_VELOCITY, STACCATO_DURATION_RATIO, NORMAL_DURATION_RATIO } from '../models/arp-cell.model';

export interface ArpeggioPlaybackState {
  isPlaying: boolean;
  currentStep: number;
  currentChordIndex: number;
}

interface NoteEvent {
  midiNote: number;
  durationMs: number;
  velocity: number;
}

/** One slot per absolute step across the whole chord progression. */
type NoteSchedule = NoteEvent[][];

@Injectable({ providedIn: 'root' })
export class ArpeggioPlaybackService {
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _pendingRebuild = false;
  private _effectRef: EffectRef | null = null;
  private _schedule: NoteSchedule = [];
  private _currentAbsStep = 0;
  private _totalSteps = 0;

  private readonly _state = signal<ArpeggioPlaybackState>({
    isPlaying: false,
    currentStep: 0,
    currentChordIndex: 0,
  });

  readonly state: Signal<ArpeggioPlaybackState> = this._state.asReadonly();
  readonly isPlaying = computed(() => this._state().isPlaying);
  readonly currentStep = computed(() => this._state().currentStep);

  private _progression: ChordProgression = { raw: '', chords: [], valid: false, error: null };

  private readonly _injector = inject(Injector);
  private readonly _ngZone   = inject(NgZone);

  constructor(
    private readonly _config: ConfigService,
    private readonly _grid:   ArpGridService,
    private readonly _chord:  ChordService,
    private readonly _midi:   MidiService,
    private readonly _jzz:    JzzSynthService,
  ) {}

  setProgression(p: ChordProgression): void {
    this._progression = p;
  }

  async play(): Promise<void> {
    if (this._state().isPlaying) return;
    if (!this._progression.valid || this._progression.chords.length === 0) return;

    const stepDurationMs = this._config.getStepDurationSec() * 1000;

    this._schedule        = this._buildSchedule(this._progression, this._grid.grid(), this._config.config());
    this._totalSteps      = this._schedule.length;
    this._currentAbsStep  = 0;

    this._state.update(s => ({ ...s, isPlaying: true, currentStep: 0, currentChordIndex: 0 }));

    // Watch for grid changes while playing and trigger a hot-swap on the next loop
    this._effectRef = effect(() => {
      this._grid.grid();   // subscribe to reactive dependency
      if (this._state().isPlaying) {
        this._pendingRebuild = true;
      }
    }, { injector: this._injector });

    // Run the interval outside Angular's zone to avoid unnecessary CD cycles;
    // state updates inside _tick() are brought back into the zone explicitly.
    this._intervalId = this._ngZone.runOutsideAngular(() =>
      setInterval(() => this._tick(), stepDurationMs),
    );
  }

  stop(): void {
    if (!this._state().isPlaying) return;

    this._effectRef?.destroy();
    this._effectRef   = null;
    this._pendingRebuild = false;

    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }

    const ch = this._config.config().midiChannel;
    this._jzz.allNotesOff(ch);
    this._midi.allNotesOff(ch);

    this._ngZone.run(() => {
      this._state.set({ isPlaying: false, currentStep: 0, currentChordIndex: 0 });
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _tick(): void {
    const absStep = this._currentAbsStep;

    // Hot-swap the schedule at the start of each loop (step 0)
    if (absStep === 0 && this._pendingRebuild) {
      this._pendingRebuild = false;
      this._schedule   = this._buildSchedule(this._progression, this._grid.grid(), this._config.config());
      this._totalSteps = this._schedule.length;
    }

    if (this._totalSteps === 0) return;

    const stepsPerMeasure = this._config.getStepsPerMeasure();
    const stepInMeasure   = absStep % stepsPerMeasure;
    const chordIndex      = Math.floor(absStep / stepsPerMeasure);
    const config          = this._config.config();
    const usingRealMidi   = !this._midi.state().usingFallback;

    const events = this._schedule[absStep] ?? [];
    for (const ev of events) {
      // JZZ + jzz-synth-tiny handles note-on → wait → note-off internally
      this._jzz.note(config.midiChannel, ev.midiNote, ev.velocity, ev.durationMs);

      // Forward to hardware MIDI device when one is connected
      if (usingRealMidi) {
        this._midi.noteOn(config.midiChannel, ev.midiNote, ev.velocity);
        this._midi.noteOff(config.midiChannel, ev.midiNote);
      }
    }

    // Update the visual playhead — run inside Angular zone so signals propagate
    this._ngZone.run(() => {
      this._state.update(s => ({ ...s, currentStep: stepInMeasure, currentChordIndex: chordIndex }));
    });

    this._currentAbsStep = (absStep + 1) % this._totalSteps;
  }

  private _buildSchedule(
    progression: ChordProgression,
    grid: ArpGrid,
    config: ArpeggioConfig,
  ): NoteSchedule {
    const stepDurationMs  = this._config.getStepDurationSec() * 1000;
    const stepsPerMeasure = this._config.getStepsPerMeasure();
    const totalSteps      = stepsPerMeasure * progression.chords.length;

    const schedule: NoteSchedule = Array.from({ length: totalSteps }, () => []);

    for (let step = 0; step < totalSteps; step++) {
      const stepInMeasure = step % stepsPerMeasure;
      const chordIndex    = Math.floor(step / stepsPerMeasure);
      const chord         = progression.chords[chordIndex];

      for (const row of grid.rows) {
        const cell = row.cells[stepInMeasure];
        if (!cell || cell.state === 'off') continue;

        const midiNote = this._chord.getMidiNoteForRow(
          chord,
          row.degree,
          row.octaveOffset,
          config.baseOctave,
        );
        const velocity  = CELL_VELOCITY[cell.state];
        const ratio     = cell.state === 'staccato' ? STACCATO_DURATION_RATIO : NORMAL_DURATION_RATIO;

        schedule[step].push({ midiNote, durationMs: stepDurationMs * ratio, velocity });
      }
    }

    return schedule;
  }
}
