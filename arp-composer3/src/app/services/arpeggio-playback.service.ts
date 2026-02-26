import { Injectable, signal, Signal, computed } from '@angular/core';
import { ConfigService } from './config.service';
import { ArpGridService } from './arp-grid.service';
import { ChordService } from './chord.service';
import { MidiService } from './midi.service';
import { ChordProgression } from '../models/chord.model';
import { CELL_VELOCITY, STACCATO_DURATION_RATIO, NORMAL_DURATION_RATIO } from '../models/arp-cell.model';

const SCHEDULER_INTERVAL_MS = 25;
const LOOKAHEAD_SEC = 0.1;

export interface ArpeggioPlaybackState {
  isPlaying: boolean;
  currentStep: number;
  currentChordIndex: number;
}

@Injectable({ providedIn: 'root' })
export class ArpeggioPlaybackService {
  private _schedulerIntervalId: ReturnType<typeof setInterval> | null = null;
  private _nextNoteTimeSec = 0;
  private _globalStep = 0;

  private readonly _state = signal<ArpeggioPlaybackState>({
    isPlaying: false,
    currentStep: 0,
    currentChordIndex: 0,
  });

  readonly state: Signal<ArpeggioPlaybackState> = this._state.asReadonly();
  readonly isPlaying = computed(() => this._state().isPlaying);
  readonly currentStep = computed(() => this._state().currentStep);

  private _progression: ChordProgression = { raw: '', chords: [], valid: false, error: null };

  constructor(
    private readonly _config: ConfigService,
    private readonly _grid: ArpGridService,
    private readonly _chord: ChordService,
    private readonly _midi: MidiService,
  ) {}

  setProgression(p: ChordProgression): void {
    this._progression = p;
  }

  play(): void {
    if (this._state().isPlaying) return;

    this._midi.resumeAudioContext();

    const ctx = this._midi.getAudioContext();
    this._nextNoteTimeSec = ctx ? ctx.currentTime : 0;
    this._globalStep = 0;

    this._state.update(s => ({ ...s, isPlaying: true, currentStep: 0, currentChordIndex: 0 }));

    this._schedulerIntervalId = setInterval(() => this._schedule(), SCHEDULER_INTERVAL_MS);
  }

  stop(): void {
    if (!this._state().isPlaying) return;

    if (this._schedulerIntervalId !== null) {
      clearInterval(this._schedulerIntervalId);
      this._schedulerIntervalId = null;
    }

    const { midiChannel } = this._config.config();
    this._midi.allNotesOff(midiChannel);

    this._state.set({ isPlaying: false, currentStep: 0, currentChordIndex: 0 });
  }

  private _schedule(): void {
    const ctx = this._midi.getAudioContext();
    const nowSec = ctx ? ctx.currentTime : performance.now() / 1000;

    const config = this._config.config();
    const grid = this._grid.grid();
    const stepsPerMeasure = this._config.getStepsPerMeasure();
    const stepDurationSec = this._config.getStepDurationSec();

    const progression = this._progression;
    if (!progression.valid || progression.chords.length === 0) return;

    while (this._nextNoteTimeSec < nowSec + LOOKAHEAD_SEC) {
      const stepInMeasure = this._globalStep % stepsPerMeasure;
      const chordIndex = Math.floor(this._globalStep / stepsPerMeasure) % progression.chords.length;
      const chord = progression.chords[chordIndex];

      for (let ri = 0; ri < grid.rows.length; ri++) {
        const row = grid.rows[ri];
        const cell = row.cells[stepInMeasure];
        if (!cell || cell.state === 'off') continue;

        const midiNote = this._chord.getMidiNoteForRow(
          chord,
          row.degree,
          row.octaveOffset,
          config.baseOctave,
        );
        const velocity = CELL_VELOCITY[cell.state];
        const ratio = cell.state === 'staccato' ? STACCATO_DURATION_RATIO : NORMAL_DURATION_RATIO;
        const durationSec = stepDurationSec * ratio;

        this._midi.noteOn(config.midiChannel, midiNote, velocity, this._nextNoteTimeSec);
        this._midi.noteOff(config.midiChannel, midiNote, this._nextNoteTimeSec + durationSec);
      }

      // Update UI state near real-time
      const delayMs = (this._nextNoteTimeSec - nowSec) * 1000;
      const stepSnapshot = stepInMeasure;
      const chordSnapshot = chordIndex;
      setTimeout(() => {
        if (this._state().isPlaying) {
          this._state.update(s => ({
            ...s,
            currentStep: stepSnapshot,
            currentChordIndex: chordSnapshot,
          }));
        }
      }, Math.max(0, delayMs));

      this._globalStep++;
      this._nextNoteTimeSec += stepDurationSec;
    }
  }
}
