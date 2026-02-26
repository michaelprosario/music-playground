import * as Tone from 'tone';
import { Injectable, signal, Signal, computed, effect, EffectRef, Injector, inject } from '@angular/core';
import { ConfigService } from './config.service';
import { ArpGridService } from './arp-grid.service';
import { ChordService } from './chord.service';
import { MidiService } from './midi.service';
import { ToneSynthService } from './tone-synth.service';
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
  time: number;
  midiNote: number;
  duration: number;
  velocity: number;
  stepIdx: number;
  chordIdx: number;
  isFirstInLoop: boolean;
}

@Injectable({ providedIn: 'root' })
export class ArpeggioPlaybackService {
  private _part: Tone.Part | null = null;
  private _pendingRebuild = false;
  private _effectRef: EffectRef | null = null;

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

  constructor(
    private readonly _config: ConfigService,
    private readonly _grid: ArpGridService,
    private readonly _chord: ChordService,
    private readonly _midi: MidiService,
    private readonly _tone: ToneSynthService,
  ) {}

  setProgression(p: ChordProgression): void {
    this._progression = p;
  }

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

    // Watch for grid changes while playing and schedule a hot-swap
    this._effectRef = effect(() => {
      this._grid.grid();            // read to establish reactive dependency
      if (this._state().isPlaying) {
        this._pendingRebuild = true;
      }
    }, { injector: this._injector });
  }

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

  private _buildPart(progression: ChordProgression, grid: ArpGrid, config: ArpeggioConfig): Tone.Part {
    const stepDur = this._config.getStepDurationSec();
    const stepsPerMeasure = this._config.getStepsPerMeasure();
    const chordCount = progression.chords.length;
    const totalSteps = stepsPerMeasure * chordCount;
    const usingRealMidi = !this._midi.state().usingFallback;

    const events: NoteEvent[] = [];

    for (let step = 0; step < totalSteps; step++) {
      const stepInMeasure = step % stepsPerMeasure;
      const chordIndex = Math.floor(step / stepsPerMeasure);
      const chord = progression.chords[chordIndex];

      for (const row of grid.rows) {
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

        events.push({
          time:          step * stepDur,
          midiNote,
          duration:      stepDur * ratio,
          velocity,
          stepIdx:       stepInMeasure,
          chordIdx:      chordIndex,
          isFirstInLoop: step === 0,
        });
      }
    }

    const part = new Tone.Part<NoteEvent>((time, ev) => {
      // Hot-swap at loop boundary
      if (ev.isFirstInLoop && this._pendingRebuild) {
        this._pendingRebuild = false;
        const snapshot = this._grid.grid();
        const cfg      = this._config.config();
        const prog     = this._progression;

        // Schedule swap on the main JS thread to avoid re-entrant dispose
        Tone.getDraw().schedule(() => {
          if (!this._state().isPlaying) return;
          const newPart = this._buildPart(prog, snapshot, cfg);
          this._part?.dispose();
          this._part = newPart;
          newPart.start(0);
        }, time);
      }

      // Tone.js polyphonic synth audio output
      this._tone.triggerNote(ev.midiNote, ev.duration, time, ev.velocity);

      // Real MIDI device output (skip fallback path to avoid double audio)
      if (usingRealMidi) {
        const ch = config.midiChannel;
        this._midi.noteOn(ch, ev.midiNote, ev.velocity);
        this._midi.noteOff(ch, ev.midiNote);
      }

      // Update Angular playhead via Draw scheduler
      Tone.getDraw().schedule(() => {
        this._state.update(s => ({ ...s, currentStep: ev.stepIdx, currentChordIndex: ev.chordIdx }));
      }, time);
    }, events);

    part.loop = true;
    part.loopEnd = totalSteps * stepDur;
    return part;
  }
}
