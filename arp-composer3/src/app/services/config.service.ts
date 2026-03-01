import { Injectable, computed, signal } from '@angular/core';
import {
  ArpeggioConfig,
  DEFAULT_ARPEGGIO_CONFIG,
  STEPS_PER_MEASURE,
} from '../models/arpeggio-config.model';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly _config = signal<ArpeggioConfig>({ ...DEFAULT_ARPEGGIO_CONFIG });

  readonly config = this._config.asReadonly();

  readonly secPerBeat = computed(() => 60 / this._config().bpm);

  setConfig(partial: Partial<ArpeggioConfig>): void {
    this._config.update(c => ({ ...c, ...partial }));
  }

  getStepsPerMeasure(): number {
    return STEPS_PER_MEASURE[this._config().noteLength];
  }

  getStepDurationSec(): number {
    const { bpm } = this._config();
    const stepsPerMeasure = this.getStepsPerMeasure();
    // stepDurationSec = (60 / bpm) / (stepsPerMeasure / 4)
    return (60 / bpm) / (stepsPerMeasure / 4);
  }

  /** Duration (seconds) of a single played note based on noteDuration setting. */
  getNoteDurationSec(): number {
    const { bpm, noteDuration } = this._config();
    return (60 / bpm) / (STEPS_PER_MEASURE[noteDuration] / 4);
  }
}
