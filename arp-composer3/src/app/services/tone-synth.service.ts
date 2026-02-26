import * as Tone from 'tone';
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToneSynthService {
  private _polySynth: Tone.PolySynth<Tone.Synth> | null = null;
  private readonly _ready = signal(false);
  readonly isReady = this._ready.asReadonly();

  init(): void {
    this._polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.005,
        decay: 0.1,
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
    const velNorm = velocity / 127;
    this._polySynth.triggerAttackRelease(noteName, durationSec, atTime, velNorm);
  }

  releaseAll(): void {
    this._polySynth?.releaseAll();
  }
}
