import { Injectable, computed, signal } from '@angular/core';
import { RhythmConfig, DEFAULT_RHYTHM_CONFIG } from '../models/rhythm-config.model';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly _config = signal<RhythmConfig>({ ...DEFAULT_RHYTHM_CONFIG });

  readonly config = this._config.asReadonly();

  readonly msPerSubdivision = computed(() => {
    const { bpm, beatsPerMeasure } = this._config();
    // will be recalculated by playback service using pattern length, provided here as a baseline
    const msPerBeat = 60_000 / bpm;
    return msPerBeat / 4; // default to 16th-note; playback service overrides with actual subdivision count
  });

  readonly secPerBeat = computed(() => 60 / this._config().bpm);

  setConfig(partial: Partial<RhythmConfig>): void {
    this._config.update(c => ({ ...c, ...partial }));
  }

  getMsPerSubdivision(subdivisionCount: number): number {
    const { bpm, beatsPerMeasure } = this._config();
    const subdivisionsPerBeat = subdivisionCount / beatsPerMeasure;
    return (60_000 / bpm) / subdivisionsPerBeat;
  }

  getNoteDurationMs(subdivisionCount: number): number {
    return this.getMsPerSubdivision(subdivisionCount) * this._config().noteDurationRatio;
  }
}
