import { Injectable, computed, signal } from '@angular/core';
import { ConfigService } from './config.service';
import { PatternService } from './pattern.service';
import { MidiService } from './midi.service';

const SCHEDULER_INTERVAL_MS = 25;
const LOOKAHEAD_SEC = 0.1;

export interface PlaybackState {
  isPlaying: boolean;
  currentStep: number;
  currentBeat: number;
}

@Injectable({ providedIn: 'root' })
export class PlaybackService {
  private _schedulerIntervalId: ReturnType<typeof setInterval> | null = null;
  private _nextNoteTimeSec = 0;
  private _currentStep = 0;

  private readonly _state = signal<PlaybackState>({
    isPlaying: false,
    currentStep: 0,
    currentBeat: 0,
  });

  readonly state = this._state.asReadonly();
  readonly isPlaying = computed(() => this._state().isPlaying);
  readonly currentStep = computed(() => this._state().currentStep);

  constructor(
    private readonly _configService: ConfigService,
    private readonly _patternService: PatternService,
    private readonly _midiService: MidiService,
  ) {}

  play(): void {
    if (this._state().isPlaying) return;

    // Resume AudioContext (required after user gesture)
    this._midiService.resumeAudioContext();

    const ctx = this._midiService.getAudioContext();
    this._nextNoteTimeSec = ctx ? ctx.currentTime : 0;
    this._currentStep = 0;

    this._state.update(s => ({ ...s, isPlaying: true, currentStep: 0, currentBeat: 0 }));

    this._schedulerIntervalId = setInterval(() => this._schedule(), SCHEDULER_INTERVAL_MS);
  }

  stop(): void {
    if (!this._state().isPlaying) return;

    if (this._schedulerIntervalId !== null) {
      clearInterval(this._schedulerIntervalId);
      this._schedulerIntervalId = null;
    }

    const { midiChannel } = this._configService.config();
    this._midiService.allNotesOff(midiChannel);

    this._state.set({ isPlaying: false, currentStep: 0, currentBeat: 0 });
  }

  private _schedule(): void {
    const ctx = this._midiService.getAudioContext();
    const nowSec = ctx ? ctx.currentTime : performance.now() / 1000;
    const pattern = this._patternService.parsedPattern();

    if (pattern.length === 0) return;

    const config = this._configService.config();
    const subDivisionMs = this._configService.getMsPerSubdivision(pattern.length);
    const noteDurationSec = this._configService.getNoteDurationMs(pattern.length) / 1000;
    const subDivisionSec = subDivisionMs / 1000;

    while (this._nextNoteTimeSec < nowSec + LOOKAHEAD_SEC) {
      const event = pattern.events[this._currentStep % pattern.length];

      if (event.isNote) {
        this._midiService.noteOn(
          config.midiChannel,
          config.midiNote,
          100,
          this._nextNoteTimeSec,
        );
        this._midiService.noteOff(
          config.midiChannel,
          config.midiNote,
          this._nextNoteTimeSec + noteDurationSec,
        );
      }

      const beat = Math.floor(this._currentStep / (pattern.length / config.beatsPerMeasure));
      const stepSnapshot = this._currentStep;

      // Update UI state near real-time (not sample-accurate, but good enough for display)
      const delayMs = (this._nextNoteTimeSec - nowSec) * 1000;
      setTimeout(() => {
        if (this._state().isPlaying) {
          this._state.update(s => ({
            ...s,
            currentStep: stepSnapshot % pattern.length,
            currentBeat: beat,
          }));
        }
      }, Math.max(0, delayMs));

      this._currentStep = (this._currentStep + 1) % pattern.length;
      this._nextNoteTimeSec += subDivisionSec;
    }
  }
}
